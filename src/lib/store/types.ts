import type { Material, MaterialRole, Profile, Report, Session, SessionConfig, Turn } from "@/lib/types";

export interface NewMaterialFile {
  kind: "file";
  file: File;
  role?: MaterialRole;
}
export interface NewMaterialUrl {
  kind: "url";
  url: string;
  role?: MaterialRole;
}
export type NewMaterial = NewMaterialFile | NewMaterialUrl;

/**
 * Tutto quello che l’interfaccia chiede ai dati passa da qui.
 * Due implementazioni: Supabase (vera) e locale (prova senza account).
 */
export interface DataStore {
  readonly kind: "supabase" | "local";

  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Omit<Profile, "id">>): Promise<Profile>;

  listMaterials(): Promise<Material[]>;
  /** Salva il file o il link con stato "reading" e lo restituisce subito. */
  addMaterial(input: NewMaterial): Promise<Material>;
  updateMaterial(id: string, patch: Partial<Pick<Material, "status" | "text" | "error">>): Promise<void>;
  deleteMaterial(id: string): Promise<void>;
  /** Scarica il file originale (serve per leggerlo in modalità prova). */
  getMaterialFile(material: Material): Promise<Blob | null>;

  listSessions(limit?: number): Promise<Session[]>;
  getSession(id: string): Promise<Session | null>;
  createSession(config: SessionConfig, title: string): Promise<Session>;
  updateSession(id: string, patch: Partial<Pick<Session, "status" | "score" | "endedAt">>): Promise<void>;

  listTurns(sessionId: string): Promise<Turn[]>;
  addTurn(turn: Omit<Turn, "id">): Promise<Turn>;
  updateTurn(id: string, patch: Partial<Pick<Turn, "answer" | "modelAnswer" | "feedback">>): Promise<void>;

  getReport(sessionId: string): Promise<Report | null>;
  saveReport(report: Report): Promise<void>;
}
