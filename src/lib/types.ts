export type MaterialKind = "pdf" | "docx" | "image" | "audio" | "video" | "url" | "text";
export type MaterialStatus = "reading" | "ready" | "error";

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
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
export type Duration = 10 | 20 | 40;
/** A voce: domanda e risposta una alla volta. Per iscritto: l’AI prepara un compito intero da consegnare. */
export type ExamFormat = "orale" | "scritto";
/** aperta = risposta libera, multipla = a crocette, traccia = tema o elaborato lungo. */
export type QuestionKind = "aperta" | "multipla" | "traccia";

export interface SessionConfig {
  mode: ExamMode;
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

export const scoreMaxFor = (mode: ExamMode): 10 | 100 => (mode === "maturita" ? 100 : 10);
