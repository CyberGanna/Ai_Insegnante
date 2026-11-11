import { mutate } from "swr";
import { getAi } from "@/lib/ai";
import { kindForFile } from "@/lib/store/local";
import type { DataStore, NewMaterial } from "@/lib/store/types";
import type { Material } from "@/lib/types";
import { keys } from "./hooks";

export const MAX_FILE_MB = 20;
export const ACCEPT = ".pdf,.docx,.txt,.md,image/*";

export function validateFile(file: File): string | null {
  if (!kindForFile(file)) return `${file.name}: formato non supportato. Usa PDF, DOCX, testo o una foto.`;
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `${file.name}: supera i ${MAX_FILE_MB} MB.`;
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
