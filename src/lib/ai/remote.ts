import { callFunction } from "@/lib/supabase/client";
import { createBrowserTts } from "./browser-speech";
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
      const res = (await callFunction("esaminatore", {
        action: "test",
        sessionId: ctx.session.id,
      })) as {
        questions: WrittenQuestion[];
      };
      return res.questions.map((q) => ({
        ...q,
        options: q.kind === "multipla" ? (q.options ?? []) : null,
      }));
    },
    async evaluate(ctx) {
      return (await callFunction("esaminatore", {
        action: "evaluate",
        sessionId: ctx.session.id,
      })) as Evaluation;
    },
  };
}

export function createRemoteReader(): MaterialReader {
  return {
    async read(material) {
      const res = (await callFunction("esaminatore", {
        action: "read",
        materialId: material.id,
      })) as { text: string };
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
          const audio = new Blob(chunks, {
            type: recorder.mimeType || "audio/webm",
          });
          if (audio.size < 2000) return "";
          const form = new FormData();
          form.append("audio", audio, `risposta.${audio.type.includes("mp4") ? "m4a" : "webm"}`);
          const res = (await callFunction("trascrivi", form)) as {
            text: string;
          };
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

// Un attimo di silenzio: suonato dentro un clic, rende l’elemento audio utilizzabile anche dopo.
const SILENCE =
  "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

export function createRemoteTts(): TextToSpeech {
  // Un solo elemento per tutta la prova: Safari permette di farlo suonare dopo il primo sblocco.
  let audio: HTMLAudioElement | null = null;
  const element = () => (audio ??= new Audio());
  const fallback = createBrowserTts();
  let generation = 0;
  return {
    supported: typeof window !== "undefined",
    async speak(text: string, voice: Voice) {
      const mine = ++generation;
      let blob: Blob;
      try {
        blob = (await callFunction("voce", { text, voice }, "blob")) as Blob;
      } catch {
        // Voce online non disponibile (limite gratuito, rete): legge la voce del browser.
        if (mine === generation) await fallback.speak(text, voice);
        return;
      }
      if (mine !== generation) return;
      const el = element();
      const src = URL.createObjectURL(blob);
      el.pause();
      el.src = src;
      const played = await new Promise<boolean>((resolve) => {
        el.onended = () => resolve(true);
        el.onerror = () => resolve(false);
        el.onpause = () => resolve(true);
        el.play().catch(() => resolve(false));
      });
      URL.revokeObjectURL(src);
      if (!played && mine === generation) await fallback.speak(text, voice);
    },
    stop() {
      generation++;
      audio?.pause();
      fallback.stop();
    },
    unlock() {
      const el = element();
      el.src = SILENCE;
      el.play().catch(() => {});
      fallback.unlock();
    },
  };
}
