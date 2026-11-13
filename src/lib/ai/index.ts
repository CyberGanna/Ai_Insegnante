import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createBrowserStt, createBrowserTts } from "./browser-speech";
import { createMockExaminer, createMockReader } from "./mock";
import { createRemoteExaminer, createRemoteReader, createRemoteStt, createRemoteTts } from "./remote";
import type { AiProvider } from "./types";

export type { AiProvider } from "./types";

/*
  Scelta dei fornitori, ognuno indipendente dagli altri:
    NEXT_PUBLIC_AI_EXAMINER = remote | mock      (domande, voto, lettura materiali)
    NEXT_PUBLIC_AI_STT      = remote | browser   (trascrizione)
    NEXT_PUBLIC_AI_TTS      = remote | browser   (voce)
  Senza variabili: "remote" se Supabase è configurato, altrimenti modalità prova.
*/

const fallback = isSupabaseConfigured ? "remote" : "local";
const pick = (value: string | undefined) => (value ?? fallback) === "remote" && isSupabaseConfigured;

let provider: AiProvider | null = null;

export function getAi(): AiProvider {
  if (provider) return provider;
  const remoteBrain = pick(process.env.NEXT_PUBLIC_AI_EXAMINER);
  const remoteStt = pick(process.env.NEXT_PUBLIC_AI_STT);
  const remoteTts = pick(process.env.NEXT_PUBLIC_AI_TTS);
  provider = {
    examiner: remoteBrain ? createRemoteExaminer() : createMockExaminer(),
    reader: remoteBrain ? createRemoteReader() : createMockReader(),
    stt: remoteStt ? createRemoteStt() : createBrowserStt(),
    tts: remoteTts ? createRemoteTts() : createBrowserTts(),
    isDemo: !remoteBrain,
  };
  return provider;
}
