import type { ExamMode, Material, MaterialKind, Profile, Project, Report, Session, Turn } from "@/lib/types";
import { scoreMaxFor } from "@/lib/types";
import type { DataStore, NewMaterial } from "./types";

/**
 * Modalità prova: tutto resta nel browser (localStorage + IndexedDB per i file).
 * Serve a provare l’app senza un progetto Supabase collegato.
 */

const KEY = "ai-insegnante:v1";

interface LocalDb {
  profile: Profile;
  materials: Material[];
  projects: Project[];
  sessions: Session[];
  turns: Turn[];
  reports: Report[];
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function emptyDb(): LocalDb {
  return {
    profile: {
      id: "locale",
      name: "",
      defaultVoice: "calma",
      defaultDifficulty: "medio",
      defaultDuration: 20,
    },
    materials: [],
    projects: [],
    sessions: [],
    turns: [],
    reports: [],
  };
}

function load(): LocalDb {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDb();
    return { ...emptyDb(), ...(JSON.parse(raw) as Partial<LocalDb>) };
  } catch {
    return emptyDb();
  }
}

function save(db: LocalDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Spazio pieno o archiviazione bloccata: i dati restano solo in memoria.
  }
}

// I file originali vanno in IndexedDB: localStorage non regge i PDF.
const FILE_DB = "ai-insegnante-files";
function fileStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FILE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result.transaction("files", mode).objectStore("files"));
    req.onerror = () => reject(req.error);
  });
}
async function putFile(id: string, blob: Blob) {
  try {
    const store = await fileStore("readwrite");
    store.put(blob, id);
  } catch {
    /* senza IndexedDB il file non viene conservato */
  }
}
async function getFile(id: string): Promise<Blob | null> {
  try {
    const store = await fileStore("readonly");
    return await new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as Blob) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
async function deleteFile(id: string) {
  try {
    const store = await fileStore("readwrite");
    store.delete(id);
  } catch {
    /* niente da fare */
  }
}

// Sessioni e turni salvati prima della prova scritta non hanno i campi nuovi.
const withSessionDefaults = (s: Session): Session => ({ ...s, format: s.format ?? "orale", projectId: s.projectId ?? null });
const withTurnDefaults = (t: Turn): Turn => ({ ...t, kind: t.kind ?? "aperta", options: t.options ?? null });

export function kindForFile(file: File): MaterialKind | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx"))
    return "docx";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|oga|flac|aac)$/.test(name)) return "audio";
  if (file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(name)) return "video";
  if (file.type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) return "text";
  return null;
}

export function createLocalStore(): DataStore {
  const read = () => load();
  const write = (fn: (db: LocalDb) => void) => {
    const db = load();
    fn(db);
    save(db);
    return db;
  };

  return {
    kind: "local",

    async getProfile() {
      return read().profile;
    },
    async updateProfile(patch) {
      return write((db) => {
        db.profile = { ...db.profile, ...patch };
      }).profile;
    },

    async listMaterials() {
      return read()
        .materials.map((m) => ({ ...m, role: m.role ?? "studio" }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async addMaterial(input: NewMaterial) {
      const id = uid();
      const material: Material =
        input.kind === "url"
          ? {
              id,
              name: input.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
              kind: "url",
              role: input.role ?? "studio",
              status: "reading",
              source: input.url,
              sizeBytes: null,
              text: null,
              error: null,
              createdAt: new Date().toISOString(),
            }
          : {
              id,
              name: input.file.name,
              kind: kindForFile(input.file) ?? "text",
              role: input.role ?? "studio",
              status: "reading",
              source: `locale/${id}`,
              sizeBytes: input.file.size,
              text: null,
              error: null,
              createdAt: new Date().toISOString(),
            };
      if (input.kind === "file") await putFile(id, input.file);
      write((db) => {
        db.materials.push(material);
      });
      return material;
    },
    async updateMaterial(id, patch) {
      write((db) => {
        db.materials = db.materials.map((m) => (m.id === id ? { ...m, ...patch } : m));
      });
    },
    async deleteMaterial(id) {
      await deleteFile(id);
      write((db) => {
        db.materials = db.materials.filter((m) => m.id !== id);
      });
    },
    async getMaterialFile(material) {
      return getFile(material.id);
    },

    async listProjects(mode?: ExamMode) {
      return read()
        .projects.filter((p) => !mode || p.mode === mode)
        .sort((a, b) => a.name.localeCompare(b.name, "it"));
    },
    async createProject(mode, name) {
      const project: Project = { id: uid(), mode, name: name.trim(), createdAt: new Date().toISOString() };
      write((db) => {
        db.projects.push(project);
      });
      return project;
    },
    async renameProject(id, name) {
      write((db) => {
        db.projects = db.projects.map((p) => (p.id === id ? { ...p, name: name.trim() } : p));
      });
    },
    async deleteProject(id) {
      write((db) => {
        db.projects = db.projects.filter((p) => p.id !== id);
        db.sessions = db.sessions.map((s) => (s.projectId === id ? { ...s, projectId: null } : s));
      });
    },

    async listSessions(limit) {
      const all = read().sessions.map(withSessionDefaults).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      return limit ? all.slice(0, limit) : all;
    },
    async getSession(id) {
      const found = read().sessions.find((s) => s.id === id);
      return found ? withSessionDefaults(found) : null;
    },
    async createSession(config, title) {
      const session: Session = {
        ...config,
        id: uid(),
        title,
        status: "in_corso",
        score: null,
        scoreMax: scoreMaxFor(config.mode),
        startedAt: new Date().toISOString(),
        endedAt: null,
      };
      write((db) => {
        db.sessions.push(session);
      });
      return session;
    },
    async updateSession(id, patch) {
      write((db) => {
        db.sessions = db.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s));
      });
    },

    async listTurns(sessionId) {
      return read()
        .turns.filter((t) => t.sessionId === sessionId)
        .map(withTurnDefaults)
        .sort((a, b) => a.index - b.index);
    },
    async addTurn(turn) {
      const created: Turn = { ...turn, id: uid() };
      write((db) => {
        db.turns.push(created);
      });
      return created;
    },
    async updateTurn(id, patch) {
      write((db) => {
        db.turns = db.turns.map((t) => (t.id === id ? { ...t, ...patch } : t));
      });
    },

    async getReport(sessionId) {
      return read().reports.find((r) => r.sessionId === sessionId) ?? null;
    },
    async saveReport(report) {
      write((db) => {
        db.reports = [...db.reports.filter((r) => r.sessionId !== report.sessionId), report];
      });
    },
  };
}
