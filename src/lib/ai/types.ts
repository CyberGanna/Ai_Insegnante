import type { Material, QuestionKind, Session, Turn, Voice } from "@/lib/types";

/**
 * L’unica porta verso AI e voce. Tre parti sostituibili:
 * - Examiner: il "cervello" (LLM) che fa le domande e dà il voto
 * - SpeechToText: trascrive la risposta parlata
 * - TextToSpeech: legge la domanda ad alta voce
 * più MaterialReader, che trasforma PDF, DOCX, foto e link in testo.
 */

export interface ExamContext {
  session: Session;
  materials: Pick<Material, "id" | "name" | "text">[];
  /** Turni già fatti, con la risposta trascritta. */
  turns: Turn[];
  elapsedSec: number;
}

export interface NextQuestion {
  question: string;
  topic: string;
  isFollowUp: boolean;
}

export interface WrittenQuestion {
  question: string;
  topic: string;
  kind: QuestionKind;
  options: string[] | null;
}

export interface TurnEvaluation {
  index: number;
  feedback: string;
  modelAnswer: string;
}

export interface Evaluation {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  weakTopics: string[];
  turns: TurnEvaluation[];
}

export interface Examiner {
  nextQuestion(ctx: ExamContext): Promise<NextQuestion>;
  /** Prova scritta: prepara tutte le domande in una volta. */
  writtenTest(ctx: ExamContext): Promise<WrittenQuestion[]>;
  evaluate(ctx: ExamContext): Promise<Evaluation>;
}

export interface MaterialReader {
  /** Restituisce il testo del materiale. `file` è null per i link. */
  read(material: Material, file: Blob | null): Promise<string>;
}

export interface Listening {
  /** Ferma l’ascolto e restituisce la trascrizione. */
  stop(): Promise<string>;
  cancel(): void;
  /** Flusso del microfono, per animare il cerchio con il volume reale. */
  stream: MediaStream | null;
}

export interface SpeechToText {
  readonly supported: boolean;
  start(): Promise<Listening>;
}

export interface TextToSpeech {
  readonly supported: boolean;
  speak(text: string, voice: Voice): Promise<void>;
  stop(): void;
}

export interface AiProvider {
  examiner: Examiner;
  reader: MaterialReader;
  stt: SpeechToText;
  tts: TextToSpeech;
  /** true se tutto gira in modalità prova, senza AI vera. */
  isDemo: boolean;
}
