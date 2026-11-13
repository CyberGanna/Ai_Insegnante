export type MaterialKind = "pdf" | "docx" | "image" | "audio" | "video" | "url" | "text";
export type MaterialStatus = "reading" | "ready" | "error";
/** studio = appunti su cui fare le domande; modello = verifica vecchia da cui copiare struttura e stile. */
export type MaterialRole = "studio" | "modello";

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
  role: MaterialRole;
  status: MaterialStatus;
  /** Percorso nell’archivio (Supabase Storage) o URL della pagina. */
  source: string | null;
  sizeBytes: number | null;
  /** Testo estratto, usato dall’esaminatore per preparare le domande. */
  text: string | null;
  error: string | null;
  createdAt: string;
}

export type ExamMode = "interrogazione" | "maturita" | "colloquio";
export type Difficulty = "base" | "medio" | "esigente";
export type Voice = "calma" | "severa";
export type Duration = 5 | 10 | 20 | 40;
/** A voce: domanda e risposta una alla volta. Per iscritto: l’AI prepara un compito intero da consegnare. */
export type ExamFormat = "orale" | "scritto";
/** aperta = risposta libera, multipla = a crocette, traccia = tema o elaborato lungo. */
export type QuestionKind = "aperta" | "multipla" | "traccia";

/** Una cartella per materia (verifiche, maturità) o per azienda (colloqui). */
export interface Project {
  id: string;
  mode: ExamMode;
  name: string;
  /** Cartella creata dall’utente; null = la cartella del tipo (Verifiche, Maturità, Colloqui). */
  folderId: string | null;
  createdAt: string;
}

/**
 * Cartella aggiunta dall’utente accanto alle tre fisse, con il nome che vuole
 * (es. "Patente", "Concorso"). Il tipo dice come interroga l’AI.
 */
export interface Folder {
  id: string;
  mode: ExamMode;
  name: string;
  createdAt: string;
}

export interface SessionConfig {
  mode: ExamMode;
  /** Progetto a cui appartiene la prova, se scelto. */
  projectId: string | null;
  format: ExamFormat;
  durationMin: Duration;
  difficulty: Difficulty;
  voice: Voice;
  /** Solo per il colloquio di lavoro. */
  jobPosting: string | null;
  materialIds: string[];
  /** Argomenti su cui concentrarsi (per "Riprova sugli argomenti deboli"). */
  focusTopics: string[];
}

export type SessionStatus = "in_corso" | "completata" | "interrotta";

export interface Session extends SessionConfig {
  id: string;
  title: string;
  status: SessionStatus;
  score: number | null;
  scoreMax: 10 | 100;
  startedAt: string;
  endedAt: string | null;
}

export interface Turn {
  id: string;
  sessionId: string;
  index: number;
  question: string;
  topic: string;
  isFollowUp: boolean;
  kind: QuestionKind;
  /** Solo per le domande a crocette. */
  options: string[] | null;
  answer: string | null;
  modelAnswer: string | null;
  feedback: string | null;
  askedAt: string;
}

export interface Report {
  sessionId: string;
  score: number;
  scoreMax: 10 | 100;
  summary: string;
  strengths: string[];
  improvements: string[];
  weakTopics: string[];
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  defaultVoice: Voice;
  defaultDifficulty: Difficulty;
  defaultDuration: Duration;
}

export const MODE_LABEL: Record<ExamMode, string> = {
  interrogazione: "Interrogazione / verifica",
  maturita: "Orale della maturità",
  colloquio: "Colloquio di lavoro",
};

export const WRITTEN_LABEL: Record<ExamMode, string> = {
  interrogazione: "Verifica scritta",
  maturita: "Maturità scritta",
  colloquio: "Colloquio scritto",
};

export const modeLabel = (s: Pick<SessionConfig, "mode" | "format">) =>
  s.format === "scritto" ? WRITTEN_LABEL[s.mode] : MODE_LABEL[s.mode];

/** Pagina dove si svolge la prova. */
export const examHref = (s: Pick<Session, "id" | "format">) =>
  `${s.format === "scritto" ? "/scritto/" : "/esame/"}?id=${s.id}`;

export const PROJECT_COPY: Record<ExamMode, { section: string; one: string; placeholder: string; hint: string }> = {
  interrogazione: {
    section: "Verifiche",
    one: "materia",
    placeholder: "Es. Storia, Fisica, Inglese",
    hint: "Una cartella per materia: dentro ritrovi tutte le verifiche e interrogazioni fatte.",
  },
  maturita: {
    section: "Esami di maturità",
    one: "materia o percorso",
    placeholder: "Es. Italiano, Percorso sul Novecento",
    hint: "Raggruppa le simulazioni per materia o per il percorso che porterai all’orale.",
  },
  colloquio: {
    section: "Colloqui",
    one: "azienda",
    placeholder: "Es. Ferrero, Studio Rossi",
    hint: "Una cartella per azienda: ritrovi i colloqui provati per ogni candidatura.",
  },
};

export const scoreMaxFor = (mode: ExamMode): 10 | 100 => (mode === "maturita" ? 100 : 10);
