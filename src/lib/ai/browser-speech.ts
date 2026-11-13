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

/* Le voci "Natural", "Online", "Premium" o "Enhanced" sono neurali e suonano molto meno robotiche:
   Edge ha Elsa, Isabella, Giuseppe e Diego; Safari ha Alice, Federica e Luca in qualità migliorata. */
const MALE = /giuseppe|diego|luca|cosimo|benigno|gianni|paolo|roberto|male|uomo/i;
const FEMALE = /elsa|isabella|alice|federica|emma|paola|elena|fiamma|carla|female|donna/i;

function score(v: SpeechSynthesisVoice, voice: Voice): number {
  let s = 0;
  if (/natural|neural|online/i.test(v.name)) s += 100;
  if (/premium/i.test(v.name)) s += 90;
  if (/enhanced|siri/i.test(v.name)) s += 70;
  if (/google/i.test(v.name)) s += 50;
  if (!v.localService) s += 10;
  if (v.lang.toLowerCase() === "it-it") s += 5;
  if (voice === "severa" ? MALE.test(v.name) : FEMALE.test(v.name)) s += 8;
  return s;
}

function italianVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("it"));
}

/* Su Chrome l’elenco delle voci arriva qualche istante dopo il caricamento. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = italianVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(italianVoices());
    window.speechSynthesis.addEventListener("voiceschanged", done, {
      once: true,
    });
    setTimeout(done, 1200);
  });
}

function pickItalianVoice(voices: SpeechSynthesisVoice[], voice: Voice): SpeechSynthesisVoice | null {
  return [...voices].sort((a, b) => score(b, voice) - score(a, voice))[0] ?? null;
}

/* Frasi brevi: le pause tra una frase e l’altra sono più naturali e Chrome non tronca i testi lunghi. */
function sentences(text: string): string[] {
  const parts = text.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [text];
  const out: string[] = [];
  for (const p of parts) {
    const last = out.at(-1);
    if (last && last.length < 60) out[out.length - 1] = last + p;
    else out.push(p);
  }
  return out.map((x) => x.trim()).filter(Boolean);
}

export function createBrowserTts(): TextToSpeech {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  let generation = 0;
  return {
    supported,
    async speak(text: string, voice: Voice) {
      if (!supported) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const mine = ++generation;
      const v = pickItalianVoice(await loadVoices(), voice);
      const natural = v ? score(v, voice) >= 50 : false;
      for (const chunk of sentences(text)) {
        if (mine !== generation) return;
        await new Promise<void>((resolve) => {
          const u = new SpeechSynthesisUtterance(chunk);
          u.lang = "it-IT";
          if (v) u.voice = v;
          // Le voci neurali vanno lasciate al loro ritmo; quelle base rallentano un poco.
          u.rate = natural ? 1 : voice === "severa" ? 1 : 0.95;
          u.pitch = 1;
          u.onend = () => resolve();
          u.onerror = () => resolve();
          synth.speak(u);
        });
      }
    },
    stop() {
      generation++;
      if (supported) window.speechSynthesis.cancel();
    },
    unlock() {
      if (!supported) return;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    },
  };
}
