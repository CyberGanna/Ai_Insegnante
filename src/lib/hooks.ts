"use client";

import useSWR from "swr";
import { useStore } from "@/components/providers";

/* Chiavi SWR condivise, così dopo una modifica si aggiorna tutto con mutate(chiave). */
export const keys = {
  profile: "profile",
  materials: "materials",
  sessions: "sessions",
  projects: "projects",
  folders: "folders",
  session: (id: string) => `session:${id}`,
  turns: (id: string) => `turns:${id}`,
  report: (id: string) => `report:${id}`,
};

export function useProfile() {
  const store = useStore();
  return useSWR(keys.profile, () => store.getProfile());
}

export function useMaterials() {
  const store = useStore();
  return useSWR(keys.materials, () => store.listMaterials());
}

export function useSessions() {
  const store = useStore();
  return useSWR(keys.sessions, () => store.listSessions());
}

export function useProjects() {
  const store = useStore();
  return useSWR(keys.projects, () => store.listProjects());
}

export function useFolders() {
  const store = useStore();
  return useSWR(keys.folders, () => store.listFolders());
}
