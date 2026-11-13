import type { Voice } from "@/lib/types";
import type { Listening, SpeechToText, TextToSpeech } from "./types";

/* Voce e trascrizione del browser: gratis, buone per provare, qualità variabile. */

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function recognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => RecognitionLike) | null;
}

export function createBrowserStt(): SpeechToText {
  const Ctor = recognitionCtor();
  return {
    supported: Boolean(Ctor),
    async start(): Promise<Listening> {
      if (!Ctor) throw new Error("Il riconoscimento vocale non è disponibile in questo browser.");
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        throw new Error("Per rispondere a voce consenti l’uso del microfono.");
      }

      const rec = new Ctor();
      rec.lang = "it-IT";
      rec.continuous = true;
      rec.interimResults = true;
      const finals: string[] = [];
      let interim = "";
      let ended = false;
      let resolveEnd: () => void = () => {};
      const endPromise = new Promise<void>((r) => (resolveEnd = r));

      rec.onresult = (e) => {
        interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finals.push(r[0].transcript.trim());
          else interim += r[0].transcript;
        }
      };
      rec.onerror = () => {};
      rec.onend = () => {
        if (!ended) {
          // Chrome chiude dopo qualche secondo di silenzio: riapriamo finché non premi stop.
          try {
            rec.start();
            return;
          } catch {
            /* già chiuso */
          }
        }
        resolveEnd();
      };
      rec.start();

      const release = () => stream?.getTracks().forEach((t) => t.stop());
      return {
        stream,
        async stop() {
          ended = true;
          rec.stop();
          await Promise.race([endPromise, new Promise((r) => setTimeout(r, 1500))]);
          release();
          return [...finals, interim.trim()].filter(Boolean).join(" ");
        },
        cancel() {
          ended = true;
          rec.abort();
          release();
        },
      };
    },
  };
}

function pickItalianVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("it"));
  return voices.find((v) => /google|alice|federica|elsa/i.test(v.name)) ?? voices[0] ?? null;
}

export function createBrowserTts(): TextToSpeech {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  return {
    supported,
    speak(text: string, voice: Voice) {
      if (!supported) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const synth = window.speechSynthesis;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "it-IT";
        const v = pickItalianVoice();
        if (v) u.voice = v;
        u.rate = voice === "severa" ? 1.02 : 0.94;
        u.pitch = voice === "severa" ? 0.85 : 1.02;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        synth.speak(u);
      });
    },
    stop() {
      if (supported) window.speechSynthesis.cancel();
    },
  };
}
