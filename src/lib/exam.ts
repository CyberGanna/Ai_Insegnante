import type { Evaluation } from "@/lib/ai/types";
import type { DataStore } from "@/lib/store/types";
import type { Session, Turn } from "@/lib/types";

/** Salva voto, commenti e risposte modello, e chiude la sessione. Vale per la prova orale e per quella scritta. */
export async function saveEvaluation(store: DataStore, session: Session, turns: Turn[], evaluation: Evaluation) {
  await Promise.all(
    evaluation.turns.map((te) => {
      const turn = turns.find((t) => t.index === te.index);
      return turn ? store.updateTurn(turn.id, { feedback: te.feedback, modelAnswer: te.modelAnswer }) : null;
    }),
  );
  await store.saveReport({
    sessionId: session.id,
    score: evaluation.score,
    scoreMax: session.scoreMax,
    summary: evaluation.summary,
    strengths: evaluation.strengths.slice(0, 3),
    improvements: evaluation.improvements.slice(0, 3),
    weakTopics: evaluation.weakTopics,
    createdAt: new Date().toISOString(),
  });
  await store.updateSession(session.id, {
    status: "completata",
    score: evaluation.score,
    endedAt: new Date().toISOString(),
  });
}
