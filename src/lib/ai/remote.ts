import { callFunction } from "@/lib/supabase/client";
import type { Voice } from "@/lib/types";
import type {
  Evaluation,
  Examiner,
  Listening,
  MaterialReader,
  NextQuestion,
  SpeechToText,
  TextToSpeech,
  WrittenQuestion,
} from "./types";

/*
  Fornitori veri, dietro le Edge Functions di Supabase (cartella supabase/functions).
  Le chiavi dei fornitori restano sul server; quale fornitore usare si sceglie
  con le variabili LLM_PROVIDER, STT_PROVIDER e TTS_PROVIDER delle funzioni.
*/

export function createRemoteExaminer(): Examiner {
  return {
    async nextQuestion(ctx) {
      return (await callFunction("esaminatore", {
        action: "question",
        sessionId: ctx.session.id,
        elapsedSec: ctx.elapsedSec,
      })) as NextQuestion;
    },
    async writtenTest(ctx) {
      const res = (await callFunction("esaminatore", { action: "test", sessionId: ctx.session.id })) as {
        questions: WrittenQuestion[];
      };
      return res.questions.map((q) => ({ ...q, options: q.kind === "multipla" ? (q.options ?? []) : null }));
    },
    async evaluate(ctx) {
      return (await callFunction("esaminatore", { action: "evaluate", sessionId: ctx.session.id })) as Evaluation;
    },
  };
}

export function createRemoteReader(): MaterialReader {
  return {
    async read(material) {
      const res = (await callFunction("esaminatore", { action: "read", materialId: material.id })) as { text: string };
      return res.text;
    },
  };
}

function pickMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return options.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

export function createRemoteStt(): SpeechToText {
  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined";
  return {
    supported,
    async start(): Promise<Listening> {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        throw new Error("Per rispondere a voce consenti l’uso del microfono.");
      }
      const mimeType = pickMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start(1000);
      const release = () => stream.getTracks().forEach((t) => t.stop());

      return {
        stream,
        async stop() {
          const done = new Promise<void>((r) => (recorder.onstop = () => r()));
          recorder.stop();
          await done;
          release();
          const audio = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          if (audio.size < 2000) return "";
          const form = new FormData();
          form.append("audio", audio, `risposta.${audio.type.includes("mp4") ? "m4a" : "webm"}`);
          const res = (await callFunction("trascrivi", form)) as { text: string };
          return res.text;
        },
        cancel() {
          if (recorder.state !== "inactive") recorder.stop();
          release();
        },
      };
    },
  };
}

export function createRemoteTts(): TextToSpeech {
  let current: HTMLAudioElement | null = null;
  return {
    supported: typeof window !== "undefined",
    async speak(text: string, voice: Voice) {
      const blob = (await callFunction("voce", { text, voice }, "blob")) as Blob;
      const src = URL.createObjectURL(blob);
      current?.pause();
      const audio = new Audio(src);
      current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.onpause = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(src);
    },
    stop() {
      current?.pause();
      current = null;
    },
  };
}
