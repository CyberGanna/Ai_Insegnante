// Prompt dell'esaminatore, in italiano. La parte stabile (ruolo + materiali)
// sta nel system prompt, che il fornitore può tenere in cache tra una domanda e l'altra.
import type { Attachment, JsonRequest } from "../_shared/llm.ts";
import type { SessionContext } from "./index.ts";

const WRITTEN_ROLE = {
  interrogazione:
    "Sei un insegnante di scuola superiore italiana che prepara e corregge una verifica scritta sul materiale qui sotto. Dai del tu.",
  maturita:
    "Sei la commissione della maturità italiana e prepari una prova scritta: un elaborato che collega più argomenti e discipline, più alcune domande aperte. Dai del tu.",
  colloquio:
    "Sei un selezionatore del personale che prepara e corregge un test scritto di selezione per la posizione dell'annuncio qui sotto: domande motivazionali, casi pratici e domande sui requisiti. Dai del Lei.",
} as const;

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
  const { session } = ctx;
  const study = ctx.materials.filter((m) => m.role !== "modello");
  const models = ctx.materials.filter((m) => m.role === "modello");
  const sources = study.length
    ? study.map((m, i) => `<materiale n="${i + 1}" nome="${m.name}">\n${m.text}\n</materiale>`).join("\n\n")
    : "(nessun materiale caricato)";
  const examples = models.length
    ? [
        "Lo studente ha caricato prove vecchie dello stesso insegnante o della stessa scuola. Usale solo come modello di forma: imita tipo e numero di domande, consegne, lunghezza delle risposte richieste, livello e modo di valutare. Gli argomenti delle domande vengono invece dai materiali di studio, non dagli esempi.",
        `<esempi_di_prova>\n${models.map((m, i) => `<esempio n="${i + 1}" nome="${m.name}">\n${m.text}\n</esempio>`).join("\n\n")}\n</esempi_di_prova>`,
      ].join("\n\n")
    : "";
  const written = session.format === "scritto";
  return [
    written ? WRITTEN_ROLE[session.mode] : MODE_ROLE[session.mode],
    DIFFICULTY[session.difficulty],
    written ? "" : TONE[session.voice],
    written
      ? "La prova è scritta: lo studente legge le domande sullo schermo e risponde per iscritto. Niente markdown."
      : "Le domande vengono lette ad alta voce: scrivi frasi naturali da parlato, senza elenchi, simboli o markdown.",
    "Resta sul materiale fornito. Non inventare argomenti che non ci sono.",
    session.job_posting ? `<annuncio>\n${session.job_posting}\n</annuncio>` : "",
    `<materiali>\n${sources}\n</materiali>`,
    examples,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function transcript(ctx: SessionContext) {
  if (!ctx.turns.length) return "(nessuna domanda ancora)";
  const kindLabel = { aperta: "", multipla: " (a crocette)", traccia: " (elaborato)" } as const;
  return ctx.turns
    .map((t) => {
      const options = t.kind === "multipla" && t.options?.length ? `\nOpzioni: ${t.options.map((o) => `«${o}»`).join(" | ")}` : "";
      return `Domanda ${t.idx + 1}${t.is_follow_up ? " (approfondimento)" : ""}${kindLabel[t.kind ?? "aperta"]} [argomento: ${t.topic}]: ${t.question}${options}\nRisposta: ${t.answer ?? "(nessuna risposta)"}`;
    })
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

export const TEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "topic", "kind", "options"],
        properties: {
          question: { type: "string", description: "Il testo della domanda o della traccia." },
          topic: { type: "string", description: "L'argomento, in poche parole." },
          kind: { type: "string", enum: ["aperta", "multipla", "traccia"] },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Solo per 'multipla': 4 opzioni, una sola corretta, in ordine casuale. Vuoto per le altre.",
          },
        },
      },
    },
  },
};

/** Quante domande, in base al tempo: circa 2-3 minuti per domanda aperta. */
const WRITTEN_COUNT: Record<number, string> = {
  5: "3 domande",
  10: "5 domande",
  20: "8 domande",
  40: "12 domande",
};

export function testPrompt(ctx: SessionContext): JsonRequest {
  const { mode, duration_min } = ctx.session;
  const count = WRITTEN_COUNT[duration_min] ?? "8 domande";
  const mix = {
    interrogazione: `Prepara una verifica di ${count}: circa metà a crocette (4 opzioni, una sola corretta) e metà aperte. Copri argomenti diversi del materiale.`,
    maturita: `Prepara una prova da ${duration_min} minuti: la prima voce è una traccia di elaborato (kind "traccia") che chiede di collegare almeno tre argomenti del materiale e altre discipline; poi ${duration_min >= 40 ? "4" : duration_min >= 20 ? "3" : duration_min >= 10 ? "2" : "1"} domande aperte.`,
    colloquio: `Prepara un test di selezione di ${count}: domande aperte su motivazione ed esperienza, casi pratici sul ruolo e alcune domande a crocette (4 opzioni) sui requisiti tecnici dell'annuncio.`,
  }[mode];
  return {
    system: systemPrompt(ctx),
    schema: TEST_SCHEMA,
    user: [
      ctx.studentName ? `Lo studente si chiama ${ctx.studentName}.` : "",
      ctx.session.focus_topics.length
        ? `È una prova di ripasso: concentrati su questi argomenti deboli: ${ctx.session.focus_topics.join(", ")}.`
        : "",
      ctx.materials.some((m) => m.role === "modello")
        ? `${mix} Se gli esempi di prova indicano un formato diverso (numero di domande, tipi, punteggi), segui gli esempi, restando nei ${duration_min} minuti.`
        : mix,
      "Le domande aperte indicano quanto scrivere (per esempio 'in 5-8 righe'). Nelle domande a crocette le opzioni sbagliate devono essere plausibili, non ovvie, e tutte di lunghezza simile.",
      "Resta sul materiale: ogni risposta corretta deve essere ricavabile da lì.",
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
      ctx.session.format === "scritto"
        ? "È una prova scritta: valuta anche ordine, lessico e ortografia. Per le domande a crocette il commento dice se la scelta è giusta e la risposta modello indica l'opzione corretta e perché. Pesa l'elaborato più delle singole domande."
        : "",
      "Per ogni domanda scrivi un commento e una risposta modello basata sul materiale. Rivolgiti allo studente con il tu (con il Lei nel colloquio).",
      `${ctx.session.format === "scritto" ? "Prova consegnata" : "Conversazione"}:\n${transcript(ctx)}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
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
