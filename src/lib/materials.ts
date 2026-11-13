import { mutate } from "swr";
import { getAi } from "@/lib/ai";
import { kindForFile } from "@/lib/store/local";
import type { DataStore, NewMaterial } from "@/lib/store/types";
import type { Material } from "@/lib/types";
import { keys } from "./hooks";

export const MAX_FILE_MB = 20;
/** Audio e video passano dal servizio di trascrizione, che accetta fino a 25 MB. */
export const MAX_MEDIA_MB = 25;
export const ACCEPT = ".pdf,.docx,.txt,.md,image/*,audio/*,video/mp4,video/webm,video/quicktime,.m4a,.mp3,.mov";

export function validateFile(file: File): string | null {
  const kind = kindForFile(file);
  if (!kind) return `${file.name}: formato non supportato. Usa PDF, Word, testo, foto, audio o video.`;
  const name = file.name.toLowerCase();
  if (kind === "video" && (file.type === "video/quicktime" || name.endsWith(".mov")))
    return `${file.name}: i video .mov dell’iPhone non si possono trascrivere. Esportalo in MP4 oppure carica solo l’audio (per esempio un memo vocale).`;
  const isMedia = kind === "audio" || kind === "video";
  const max = isMedia ? MAX_MEDIA_MB : MAX_FILE_MB;
  if (file.size > max * 1024 * 1024)
    return isMedia
      ? `${file.name}: supera i ${max} MB. Per una lezione lunga carica solo l’audio, oppure dividila in parti.`
      : `${file.name}: supera i ${max} MB.`;
  return null;
}

export function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Legge il materiale (estrazione testo / OCR) e aggiorna lo stato da "In lettura" a "Pronto". */
export async function readMaterial(store: DataStore, material: Material, file: Blob | null) {
  try {
    await store.updateMaterial(material.id, { status: "reading", error: null });
    await mutate(keys.materials);
    const blob = file ?? (getAi().isDemo ? await store.getMaterialFile(material) : null);
    const text = await getAi().reader.read(material, blob);
    await store.updateMaterial(material.id, { status: "ready", text });
  } catch (e) {
    await store.updateMaterial(material.id, {
      status: "error",
      error: e instanceof Error ? e.message : "Lettura non riuscita.",
    });
  } finally {
    await mutate(keys.materials);
  }
}

/** Salva il materiale e avvia la lettura senza aspettarla. */
export async function addAndRead(store: DataStore, input: NewMaterial) {
  const material = await store.addMaterial(input);
  await mutate(keys.materials);
  void readMaterial(store, material, input.kind === "file" ? input.file : null);
  return material;
}
