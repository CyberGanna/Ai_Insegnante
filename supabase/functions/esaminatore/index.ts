// L'esaminatore. Quattro azioni:
//   read      legge un materiale (PDF, DOCX, foto, audio, video, link) e ne salva il testo
//   question  sceglie la prossima domanda della prova orale (nuova o di approfondimento)
//   test      prepara tutte le domande della prova scritta
//   evaluate  dà il voto e prepara il report
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import { HttpError, json, serve, userClient } from "../_shared/http.ts";
import { getLlm, type Attachment } from "../_shared/llm.ts";
import { transcribe } from "../_shared/speech.ts";
import { evaluationPrompt, questionPrompt, readPrompt, testPrompt } from "./prompts.ts";

const MAX_MATERIAL_CHARS = 120_000;

serve(async (req) => {
  const { supabase } = await userClient(req);
  const body = (await req.json()) as { action?: string; materialId?: string; sessionId?: string; elapsedSec?: number };

  switch (body.action) {
    case "read":
      return json(await readMaterial(supabase, body.materialId ?? ""));
    case "question": {
      const ctx = await loadSession(supabase, body.sessionId ?? "");
      return json(await getLlm().json({ ...questionPrompt(ctx, body.elapsedSec ?? 0), fast: true }));
    }
    case "test": {
      const ctx = await loadSession(supabase, body.sessionId ?? "");
      return json(await getLlm().json({ ...testPrompt(ctx), maxTokens: 8000 }));
    }
    case "evaluate": {
      const ctx = await loadSession(supabase, body.sessionId ?? "");
      return json(await getLlm().json({ ...evaluationPrompt(ctx), maxTokens: 12000 }));
    }
    default:
      throw new HttpError("Azione sconosciuta.");
  }
});

// ---------------------------------------------------------------------------
// Lettura dei materiali

// Codifica veloce: costruire una stringa carattere per carattere consuma troppa CPU sui file grandi.
const toBase64 = (buf: ArrayBuffer) => encodeBase64(buf);

/** Blocca indirizzi locali e privati: la funzione non deve diventare un proxy verso la rete interna. */
function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError("Link non valido.");
  }
  const host = url.hostname;
  if (!/^https?:$/.test(url.protocol)) throw new HttpError("Sono accettati solo link http e https.");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host) ||
    host.includes(":")
  )
    throw new HttpError("Questo link non è raggiungibile.");
  return url;
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

async function readMaterial(supabase: SupabaseClient, materialId: string) {
  const { data: m, error } = await supabase.from("materials").select("*").eq("id", materialId).maybeSingle();
  if (error || !m) throw new HttpError("Materiale non trovato.", 404);

  const done = async (text: string) => {
    const clean = text.trim().slice(0, MAX_MATERIAL_CHARS);
    if (!clean) throw new HttpError("Non ho trovato testo leggibile in questo materiale.");
    await supabase.from("materials").update({ status: "ready", extracted_text: clean, error: null }).eq("id", m.id);
    return { text: clean };
  };

  try {
    if (m.kind === "url") {
      const url = assertPublicUrl(m.source);
      const res = await fetch(url, {
        headers: { "User-Agent": "AiInsegnante/1.0 (lettura materiali di studio)" },
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new HttpError(`La pagina risponde con errore ${res.status}.`);
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("application/pdf")) {
        const out = await getLlm().json<{ text: string }>(readPrompt([{ kind: "pdf", base64: toBase64(await res.arrayBuffer()) }]));
        return done(out.text);
      }
      return done(htmlToText((await res.text()).slice(0, 2_000_000)));
    }

    const file = await supabase.storage.from("materials").download(m.source);
    if (file.error || !file.data) throw new HttpError("File non trovato nell'archivio.");
    const buf = await file.data.arrayBuffer();

    if (m.kind === "text") return done(new TextDecoder().decode(buf));
    if (m.kind === "audio" || m.kind === "video") {
      // Il servizio di trascrizione accetta anche MP4 e WebM: ne usa solo l'audio.
      const type = file.data.type || (m.kind === "video" ? "video/mp4" : "audio/mpeg");
      return done(await transcribe(new File([buf], m.name, { type })));
    }
    if (m.kind === "docx") {
      // Caricata solo per i file Word: è una libreria pesante da avviare.
      const { default: mammoth } = await import("npm:mammoth@1.13.0");
      const { value } = await mammoth.extractRawText({ arrayBuffer: buf } as never);
      return done(value);
    }
    let attachment: Attachment;
    if (m.kind === "pdf") attachment = { kind: "pdf", base64: toBase64(buf) };
    else {
      const mediaType = file.data.type || "image/jpeg";
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType))
        throw new HttpError("Formato foto non supportato: usa JPG o PNG (sull'iPhone: Impostazioni, Fotocamera, Formati, Più compatibile).");
      attachment = { kind: "image", base64: toBase64(buf), mediaType };
    }
    const out = await getLlm().json<{ text: string }>({ ...readPrompt([attachment]), maxTokens: 16000 });
    return done(out.text);
  } catch (e) {
    const message = e instanceof HttpError ? e.message : "Lettura non riuscita.";
    await supabase.from("materials").update({ status: "error", error: message }).eq("id", m.id);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Contesto della sessione

export interface SessionContext {
  studentName: string;
  session: {
    mode: "interrogazione" | "maturita" | "colloquio";
    format: "orale" | "scritto";
    duration_min: number;
    difficulty: "base" | "medio" | "esigente";
    voice: "calma" | "severa";
    job_posting: string | null;
    focus_topics: string[];
    score_max: 10 | 100;
  };
  materials: { name: string; text: string; role: "studio" | "modello" }[];
  turns: {
    idx: number;
    question: string;
    topic: string;
    is_follow_up: boolean;
    kind: "aperta" | "multipla" | "traccia";
    options: string[] | null;
    answer: string | null;
  }[];
}

async function loadSession(supabase: SupabaseClient, sessionId: string): Promise<SessionContext> {
  const { data: session } = await supabase.from("sessions").select("*, session_materials(material_id)").eq("id", sessionId).maybeSingle();
  if (!session) throw new HttpError("Simulazione non trovata.", 404);
  const ids = (session.session_materials as { material_id: string }[]).map((r) => r.material_id);
  const [{ data: materials }, { data: turns }, { data: profile }] = await Promise.all([
    ids.length
      ? supabase.from("materials").select("name, extracted_text, role").in("id", ids)
      : Promise.resolve({ data: [] as { name: string; extracted_text: string | null; role: "studio" | "modello" }[] }),
    supabase.from("turns").select("idx, question, topic, is_follow_up, kind, options, answer").eq("session_id", sessionId).order("idx"),
    supabase.from("profiles").select("name").maybeSingle(),
  ]);
  return {
    studentName: profile?.name ?? "",
    session,
    materials: (materials ?? []).map((m) => ({ name: m.name, text: m.extracted_text ?? "", role: m.role ?? "studio" })),
    turns: turns ?? [],
  };
}
