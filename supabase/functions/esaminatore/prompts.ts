// Prompt dell'esaminatore, in italiano. La parte stabile (ruolo + materiali)
// sta nel system prompt, che il fornitore può tenere in cache tra una domanda e l'altra.
import type { Attachment, JsonRequest } from "../_shared/llm.ts";
import type { SessionContext } from "./index.ts";

const MODE_ROLE = {
  interrogazione:
    "Sei un insegnante di scuola superiore italiana che interroga uno studente alla cattedra sul materiale qui sotto. Dai del tu.",
  maturita:
    "Sei la commissione dell'esame orale della maturità italiana. La prima domanda parte da uno spunto (un concetto, una citazione, un fatto) tratto dal materiale e chiede allo studente di sviluppare collegamenti tra più discipline. Dai del tu.",
  colloquio:
    "Sei un selezionatore del personale che conduce un colloquio di lavoro in italiano per la posizione dell'annuncio qui sotto. Alterni domande motivazionali, comportamentali (chiedi esempi concreti di situazioni vissute) e tecniche sui requisiti. Dai del Lei.",
} as const;

const DIFFICULTY = {
  base: "Livello base: domande dirette sui concetti principali, accetta risposte semplici se corrette.",
  medio: "Livello medio: chiedi definizioni precise, cause, conseguenze ed esempi.",
  esigente:
    "Livello esigente: pretendi precisione terminologica, collegamenti e spirito critico. Incalza quando una risposta è vaga.",
} as const;

const TONE = {
  calma: "Tono calmo e incoraggiante: quando lo studente si blocca, offri un piccolo appiglio senza dare la risposta.",
  severa: "Tono asciutto e severo, mai scortese: niente complimenti, vai dritto al punto.",
} as const;

function systemPrompt(ctx: SessionContext) {
  const { session, materials } = ctx;
  const sources = materials.length
    ? materials.map((m, i) => `<materiale n="${i + 1}" nome="${m.name}">\n${m.text}\n</materiale>`).join("\n\n")
    : "(nessun materiale caricato)";
  return [
    MODE_ROLE[session.mode],
    DIFFICULTY[session.difficulty],
    TONE[session.voice],
    "Le domande vengono lette ad alta voce: scrivi frasi naturali da parlato, senza elenchi, simboli o markdown.",
    "Resta sul materiale fornito. Non inventare argomenti che non ci sono.",
    session.job_posting ? `<annuncio>\n${session.job_posting}\n</annuncio>` : "",
    `<materiali>\n${sources}\n</materiali>`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function transcript(ctx: SessionContext) {
  if (!ctx.turns.length) return "(nessuna domanda ancora)";
  return ctx.turns
    .map(
      (t) =>
        `Domanda ${t.idx + 1}${t.is_follow_up ? " (approfondimento)" : ""} [argomento: ${t.topic}]: ${t.question}\nRisposta: ${t.answer ?? "(nessuna risposta)"}`,
    )
    .join("\n\n");
}

export const QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["question", "topic", "isFollowUp"],
  properties: {
    question: { type: "string", description: "La domanda da leggere ad alta voce, al massimo due frasi." },
    topic: { type: "string", description: "L'argomento della domanda, in poche parole." },
    isFollowUp: { type: "boolean", description: "true se approfondisce la risposta precedente." },
  },
};

export function questionPrompt(ctx: SessionContext, elapsedSec: number): JsonRequest {
  const remaining = Math.max(0, ctx.session.duration_min * 60 - elapsedSec);
  const followUps = [...ctx.turns].reverse().findIndex((t) => !t.is_follow_up);
  return {
    system: systemPrompt(ctx),
    schema: QUESTION_SCHEMA,
    maxTokens: 1500,
    user: [
      ctx.studentName ? `Lo studente si chiama ${ctx.studentName}.` : "",
      ctx.session.focus_topics.length
        ? `Questa è una sessione di ripasso: concentrati su questi argomenti deboli: ${ctx.session.focus_topics.join(", ")}.`
        : "",
      `Tempo rimasto: circa ${Math.round(remaining / 60)} minuti su ${ctx.session.duration_min}.`,
      `Conversazione finora:\n${transcript(ctx)}`,
      "Decidi la prossima domanda.",
      "- Se l'ultima risposta è incompleta, vaga, sbagliata o contiene un passaggio interessante, fai una domanda di approfondimento su quella risposta, come farebbe un vero insegnante o selezionatore.",
      `- Non fare più di due approfondimenti di fila sullo stesso argomento (ora sono ${Math.max(0, followUps)}).`,
      "- Altrimenti passa a un argomento nuovo del materiale, non ancora toccato.",
      "- Se è la prima domanda, apri in modo naturale, con un breve saluto.",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export const EVALUATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "summary", "strengths", "improvements", "weakTopics", "turns"],
  properties: {
    score: { type: "number" },
    summary: { type: "string", description: "Giudizio complessivo in due o tre frasi, rivolto allo studente." },
    strengths: { type: "array", items: { type: "string" }, description: "Esattamente tre punti di forza concreti." },
    improvements: { type: "array", items: { type: "string" }, description: "Esattamente tre cose da migliorare, concrete e azionabili." },
    weakTopics: { type: "array", items: { type: "string" }, description: "Gli argomenti su cui lo studente è andato peggio." },
    turns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "feedback", "modelAnswer"],
        properties: {
          index: { type: "integer", description: "Numero della domanda meno uno." },
          feedback: { type: "string", description: "Una frase di commento sulla risposta." },
          modelAnswer: { type: "string", description: "Una risposta migliore, come la darebbe uno studente preparato, in 3-6 frasi." },
        },
      },
    },
  },
};

export function evaluationPrompt(ctx: SessionContext): JsonRequest {
  const max = ctx.session.score_max;
  return {
    system: systemPrompt(ctx),
    schema: EVALUATION_SCHEMA,
    user: [
      `La prova è finita. Valuta lo studente con un voto da 0 a ${max}${max === 10 ? " (mezzi voti ammessi, 6 è la sufficienza)" : " (60 è la sufficienza)"}.`,
      "Basati solo sulle risposte date: contenuto, correttezza, chiarezza, capacità di collegare. Una domanda senza risposta pesa negativamente.",
      "Per ogni domanda scrivi un commento e una risposta modello basata sul materiale. Rivolgiti allo studente con il tu (con il Lei nel colloquio).",
      `Conversazione:\n${transcript(ctx)}`,
    ].join("\n\n"),
  };
}

export const READ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: { text: { type: "string" } },
};

export function readPrompt(attachments: Attachment[]): JsonRequest {
  return {
    system:
      "Trascrivi fedelmente il testo del documento o della foto (anche se scritto a mano), in italiano come nell'originale. Mantieni titoli e paragrafi su righe separate. Descrivi in una frase grafici, formule o immagini importanti. Non aggiungere commenti.",
    user: "Trascrivi questo materiale di studio.",
    schema: READ_SCHEMA,
    attachments,
    maxTokens: 16000,
  };
}
