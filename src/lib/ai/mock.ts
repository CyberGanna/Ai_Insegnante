import type { Material } from "@/lib/types";
import type { Evaluation, ExamContext, Examiner, MaterialReader, NextQuestion } from "./types";

/*
  Esaminatore di prova: nessuna AI, solo regole semplici sul testo dei materiali.
  Serve a far funzionare tutte le schermate prima di collegare un fornitore vero.
*/

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const words = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/).filter(Boolean);

interface Topic {
  title: string;
  body: string;
}

/** Titoli = righe brevi senza punto finale; il corpo è il testo che li segue. */
function topicsFrom(materials: ExamContext["materials"]): Topic[] {
  const topics: Topic[] = [];
  for (const m of materials) {
    const lines = (m.text ?? "").split(/\r?\n/).map((l) => l.trim());
    let current: Topic | null = null;
    for (const line of lines) {
      if (!line) continue;
      const isHeading = line.length <= 70 && !/[.;:,]$/.test(line) && words(line).length <= 9;
      if (isHeading) {
        if (current && current.body) topics.push(current);
        current = { title: line.replace(/^#+\s*/, ""), body: "" };
      } else if (current) {
        current.body += (current.body ? " " : "") + line;
      } else {
        current = { title: m.name.replace(/\.[a-z0-9]+$/i, ""), body: line };
      }
    }
    if (current) topics.push(current);
    if (!topics.length) topics.push({ title: m.name.replace(/\.[a-z0-9]+$/i, ""), body: "" });
  }
  return topics;
}

const OPENERS: Record<string, string[]> = {
  calma: ["Partiamo con calma.", "Bene, andiamo avanti.", "Ottimo, cambiamo argomento."],
  severa: ["Cominciamo.", "Avanti.", "Passiamo oltre."],
};

const TEMPLATES = [
  (t: string) => `Mi spieghi ${t} con parole tue?`,
  (t: string) => `Che cosa sai dirmi su ${t}? Parti dai concetti principali.`,
  (t: string) => `Prova a collegare ${t} a qualcosa che hai studiato in un’altra materia.`,
  (t: string) => `Qual è il punto più importante di ${t}, secondo te, e perché?`,
];

const JOB_QUESTIONS = [
  "Mi racconta il suo percorso e perché si è candidato per questa posizione?",
  "Mi descriva una situazione difficile sul lavoro o nello studio e come l’ha gestita.",
  "Quali competenze dell’annuncio sente più sue? Mi faccia un esempio concreto.",
  "Dove si vede tra tre anni, e cosa le serve imparare per arrivarci?",
  "Ha qualche domanda per noi sull’azienda o sul ruolo?",
];

const FOLLOW_UPS = {
  calma: ["Puoi approfondire un po'? Fammi un esempio concreto.", "Interessante. Mi spieghi meglio il perché?"],
  severa: [
    "È troppo poco. Approfondisca con un esempio preciso.",
    "Non mi basta. Mi dia una spiegazione più rigorosa.",
  ],
};

export function createMockExaminer(): Examiner {
  return {
    async nextQuestion(ctx: ExamContext): Promise<NextQuestion> {
      await wait(700);
      const { session, turns } = ctx;
      const tone = session.voice;
      const last = turns.at(-1);

      // Approfondimento se l’ultima risposta era breve e non era già un approfondimento.
      if (last && !last.isFollowUp && words(last.answer).length < 25) {
        const options = FOLLOW_UPS[tone];
        return { question: options[turns.length % options.length], topic: last.topic, isFollowUp: true };
      }

      const asked = turns.filter((t) => !t.isFollowUp).length;

      if (session.mode === "colloquio") {
        const q = JOB_QUESTIONS[asked % JOB_QUESTIONS.length];
        return { question: q, topic: "Colloquio", isFollowUp: false };
      }

      const all = topicsFrom(ctx.materials);
      const focus = session.focusTopics.length
        ? all.filter((t) => session.focusTopics.some((f) => t.title.toLowerCase().includes(f.toLowerCase())))
        : [];
      const pool = focus.length ? focus : all;
      const topic = pool[asked % pool.length] ?? { title: "l’argomento che hai preparato", body: "" };
      const title = topic.title.charAt(0).toLowerCase() + topic.title.slice(1);

      let question: string;
      if (session.mode === "maturita" && asked === 0) {
        question = `Ti propongo uno spunto: ${topic.title}. Che cosa ti fa venire in mente, e che collegamenti vedi con le altre materie?`;
      } else {
        const opener = asked === 0 ? "" : OPENERS[tone][asked % OPENERS[tone].length] + " ";
        question = opener + TEMPLATES[asked % TEMPLATES.length](`«${title}»`);
      }
      return { question, topic: topic.title, isFollowUp: false };
    },

    async evaluate(ctx: ExamContext): Promise<Evaluation> {
      await wait(1200);
      const topics = topicsFrom(ctx.materials);
      const max = ctx.session.scoreMax;
      const answered = ctx.turns.filter((t) => words(t.answer).length > 0);

      const perTurn = ctx.turns.map((t) => {
        const n = words(t.answer).length;
        const quality = Math.min(1, n / 80);
        const ref = topics.find((x) => x.title === t.topic);
        const model = ref?.body
          ? ref.body
              .split(/(?<=[.!?])\s+/)
              .slice(0, 3)
              .join(" ")
          : ctx.session.mode === "colloquio"
            ? "Una risposta forte segue lo schema situazione, azione, risultato: descrive il contesto in una frase, quello che hai fatto tu in prima persona e un risultato misurabile."
            : "Una buona risposta definisce il concetto, lo spiega con un esempio e chiude con un collegamento ad altri argomenti.";
        return {
          index: t.index,
          quality,
          feedback:
            n === 0
              ? "Nessuna risposta registrata."
              : quality > 0.7
                ? "Risposta completa e ben argomentata."
                : quality > 0.35
                  ? "Corretta ma un po' breve: aggiungi esempi e collegamenti."
                  : "Troppo sintetica: sviluppa il ragionamento.",
          modelAnswer: model,
        };
      });

      const avg = perTurn.length ? perTurn.reduce((s, t) => s + t.quality, 0) / perTurn.length : 0;
      const raw = 4 + avg * 5.5 + (answered.length >= 4 ? 0.5 : 0);
      const score10 = Math.max(2, Math.min(10, raw));
      const score = max === 100 ? Math.round(score10 * 10) : Math.round(score10 * 2) / 2;

      const weak = Array.from(
        new Set(
          perTurn.filter((t) => t.quality < 0.45).map((t) => ctx.turns.find((x) => x.index === t.index)?.topic ?? ""),
        ),
      ).filter(Boolean);

      return {
        score,
        summary:
          answered.length === 0
            ? "Non hai risposto a nessuna domanda: riprova quando hai qualche minuto tranquillo."
            : "Questa è una valutazione di prova, calcolata sulla lunghezza delle risposte. Collega un fornitore AI per un giudizio vero sul contenuto.",
        strengths: [
          "Hai affrontato tutte le domande senza bloccarti.",
          "Hai usato un linguaggio chiaro e ordinato.",
          answered.length > 3
            ? "Hai retto bene il ritmo dell’interrogazione."
            : "Hai iniziato le risposte andando dritto al punto.",
        ],
        improvements: [
          "Porta almeno un esempio concreto per ogni concetto.",
          "Chiudi ogni risposta con un collegamento a un altro argomento.",
          "Usa i termini tecnici del materiale, non solo parole tue.",
        ],
        weakTopics: weak.length ? weak : topics.slice(0, 2).map((t) => t.title),
        turns: perTurn.map(({ index, feedback, modelAnswer }) => ({ index, feedback, modelAnswer })),
      };
    },
  };
}

export function createMockReader(): MaterialReader {
  return {
    async read(material: Material, file: Blob | null) {
      await wait(900 + Math.random() * 900);
      if (material.kind === "text" && file) return file.text();
      if (material.kind === "url") return `${material.name}\nContenuto della pagina collegata.`;
      // In modalità prova non leggiamo davvero PDF, DOCX e foto: usiamo il nome come argomento.
      return `${material.name.replace(/\.[a-z0-9]+$/i, "")}\n`;
    },
  };
}
