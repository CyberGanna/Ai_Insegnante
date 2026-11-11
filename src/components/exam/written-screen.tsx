"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import { useStore } from "@/components/providers";
import { IconArrowLeft, IconPrinter } from "@/components/icons";
import { Button, ButtonLink, cn } from "@/components/ui";
import { getAi } from "@/lib/ai";
import { saveEvaluation } from "@/lib/exam";
import { keys } from "@/lib/hooks";
import { modeLabel, type Material, type Session, type Turn } from "@/lib/types";

type Phase = "loading" | "generating" | "ready" | "submitting" | "error";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const INSTRUCTIONS: Record<Session["mode"], string> = {
  interrogazione:
    "Rispondi a tutte le domande. Nelle domande a crocette scegli una sola risposta; in quelle aperte spiega con parole tue e porta esempi.",
  maturita:
    "Sviluppa l’elaborato con un’introduzione, i collegamenti tra le materie e una riflessione personale. Poi rispondi alle domande aperte.",
  colloquio:
    "Rispondi come faresti in una prova di selezione vera: frasi chiare, esempi concreti della tua esperienza, una sola scelta nelle domande chiuse.",
};

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function WrittenScreen() {
  const id = useSearchParams().get("id");
  const store = useStore();
  const router = useRouter();
  const ai = getAi();

  const [phase, setPhase] = useState<Phase>(id ? "loading" : "error");
  const [session, setSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<{
    text: string;
    retry: () => void;
  } | null>(
    id
      ? null
      : {
          text: "Manca il riferimento alla prova.",
          retry: () => router.replace("/"),
        },
  );

  const materialsRef = useRef<Material[]>([]);
  const elapsedRef = useRef(0);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const total = (session?.durationMin ?? 20) * 60;
  const remaining = total - elapsed;
  const timeUp = remaining <= 0;
  const answered = turns.filter((t) => (answers[t.id] ?? "").trim()).length;
  const missing = turns.length - answered;

  async function generate(s: Session) {
    setPhase("generating");
    setError(null);
    try {
      const questions = await ai.examiner.writtenTest({
        session: s,
        materials: materialsRef.current.map(
          ({ id: mid, name, text, role }) => ({ id: mid, name, text, role }),
        ),
        turns: [],
        elapsedSec: 0,
      });
      if (!questions.length)
        throw new Error("Non sono riuscito a preparare le domande. Riprova.");
      const created: Turn[] = [];
      for (const [index, q] of questions.entries()) {
        created.push(
          await store.addTurn({
            sessionId: s.id,
            index,
            question: q.question,
            topic: q.topic,
            isFollowUp: false,
            kind: q.kind,
            options: q.kind === "multipla" ? q.options : null,
            answer: null,
            modelAnswer: null,
            feedback: null,
            askedAt: new Date().toISOString(),
          }),
        );
      }
      setTurns(created);
      setPhase("ready");
    } catch (e) {
      setPhase("error");
      setError({
        text:
          e instanceof Error ? e.message : "Non riesco a preparare la prova.",
        retry: () => void generate(s),
      });
    }
  }

  // Caricamento: se la prova è già stata preparata la riprendiamo, altrimenti la generiamo.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const s = await store.getSession(id);
      if (cancelled) return;
      if (!s) {
        setPhase("error");
        setError({
          text: "Non trovo questa prova.",
          retry: () => router.replace("/"),
        });
        return;
      }
      if (s.status === "completata") {
        router.replace(`/report/?id=${s.id}`);
        return;
      }
      const [existing, materials] = await Promise.all([
        store.listTurns(s.id),
        store.listMaterials(),
      ]);
      if (cancelled) return;
      materialsRef.current = materials.filter((m) =>
        s.materialIds.includes(m.id),
      );
      const saved = Number(sessionStorage.getItem(`esame:${s.id}:tempo`) ?? 0);
      elapsedRef.current = saved;
      setElapsed(saved);
      setSession(s);
      if (existing.length) {
        setTurns(existing);
        setAnswers(
          Object.fromEntries(existing.map((t) => [t.id, t.answer ?? ""])),
        );
        setPhase("ready");
      } else {
        void generate(s);
      }
    })().catch((e) => {
      setPhase("error");
      setError({
        text: e instanceof Error ? e.message : "Errore di caricamento.",
        retry: () => location.reload(),
      });
    });
    return () => {
      cancelled = true;
    };
    // generate è una funzione semplice: va lanciata solo al caricamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, store, router]);

  // Cronometro: corre mentre la prova è aperta.
  useEffect(() => {
    if (phase !== "ready" || !session) return;
    const t = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current % 5 === 0)
        sessionStorage.setItem(
          `esame:${session.id}:tempo`,
          String(elapsedRef.current),
        );
    }, 1000);
    return () => clearInterval(t);
  }, [phase, session]);

  // Avviso prima di chiudere la pagina con risposte non ancora salvate.
  useEffect(() => {
    if (phase !== "ready") return;
    const timers = saveTimers.current;
    const onLeave = (e: BeforeUnloadEvent) => {
      if (timers.size) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [phase]);

  function setAnswer(turn: Turn, value: string) {
    setAnswers((prev) => ({ ...prev, [turn.id]: value }));
    setConfirming(false);
    // Salvataggio automatico, così la prova si può riprendere.
    const timers = saveTimers.current;
    clearTimeout(timers.get(turn.id));
    timers.set(
      turn.id,
      setTimeout(() => {
        timers.delete(turn.id);
        void store.updateTurn(turn.id, { answer: value.trim() ? value : null });
      }, 700),
    );
  }

  async function submit() {
    if (!session) return;
    if (missing > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    setPhase("submitting");
    setError(null);
    try {
      for (const t of saveTimers.current.values()) clearTimeout(t);
      saveTimers.current.clear();
      const final = turns.map((t) => ({
        ...t,
        answer: (answers[t.id] ?? "").trim() || null,
      }));
      await Promise.all(
        final.map((t) => store.updateTurn(t.id, { answer: t.answer })),
      );
      const evaluation = await ai.examiner.evaluate({
        session,
        materials: materialsRef.current.map(
          ({ id: mid, name, text, role }) => ({ id: mid, name, text, role }),
        ),
        turns: final,
        elapsedSec: elapsedRef.current,
      });
      await saveEvaluation(store, session, final, evaluation);
      sessionStorage.removeItem(`esame:${session.id}:tempo`);
      await mutate(keys.sessions);
      router.replace(`/report/?id=${session.id}`);
    } catch (e) {
      setPhase("error");
      setError({
        text:
          e instanceof Error ? e.message : "Non riesco a correggere la prova.",
        retry: () => void submit(),
      });
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line/70 bg-paper/95 px-4 py-3 backdrop-blur sm:px-6 print:hidden">
        <Link
          href="/"
          className="-ml-2 inline-flex h-10 items-center gap-2 rounded-full px-3 text-[15px] text-ink-soft hover:bg-paper-deep hover:text-ink"
        >
          <IconArrowLeft size={18} />
          Esci
        </Link>
        <p className="hidden truncate text-sm text-ink-faint sm:block">
          {session ? modeLabel(session) : ""}
        </p>
        <div className="flex items-center gap-2">
          {phase === "ready" ? (
            <span className="hidden sm:block">
              <Button variant="ghost" size="sm" onClick={() => window.print()}>
                <IconPrinter size={17} />
                Stampa
              </Button>
            </span>
          ) : null}
          <div
            role="timer"
            aria-label={
              timeUp ? "Tempo scaduto" : `Tempo rimasto ${fmtTime(remaining)}`
            }
            className={cn(
              "rounded-full px-3.5 py-1.5 font-medium tabular ring-1 transition-colors",
              timeUp
                ? "bg-amber-soft text-amber-deep ring-amber/40"
                : remaining <= 120
                  ? "text-amber-deep ring-amber/40"
                  : "text-ink ring-line",
            )}
          >
            {session ? fmtTime(remaining) : "–:––"}
          </div>
        </div>
      </header>

      {phase === "loading" ? (
        <p className="my-auto py-16 text-center text-ink-soft" aria-busy="true">
          Apro la prova…
        </p>
      ) : phase === "generating" ? (
        <div
          className="mx-auto my-auto max-w-sm px-6 py-16 text-center"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="mx-auto flex w-fit gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="animate-status size-2.5 rounded-full bg-teal"
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </span>
          <h1 className="mt-6 text-[1.75rem] leading-tight font-medium">
            Preparo la tua prova…
          </h1>
          <p className="mt-3 leading-relaxed text-ink-soft">
            L’AI sta scrivendo le domande sui tuoi materiali. Ci vuole qualche
            secondo.
          </p>
        </div>
      ) : phase === "error" ? (
        <div
          className="mx-auto my-auto max-w-md px-6 py-16 text-center"
          role="alert"
        >
          <h1 className="text-2xl font-medium">Qualcosa si è interrotto</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">{error?.text}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => error?.retry()}>Riprova</Button>
            <ButtonLink href="/" variant="secondary">
              Torna alla dashboard
            </ButtonLink>
          </div>
        </div>
      ) : session ? (
        <>
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-36 sm:px-6 sm:pt-10 print:p-0">
            <article className="rounded-[var(--radius-card)] bg-card px-5 py-7 shadow-[var(--shadow-card)] sm:px-10 sm:py-10 print:shadow-none">
              <header className="border-b border-line/70 pb-6">
                <p className="text-sm text-ink-faint">
                  {modeLabel(session)}, {turns.length}{" "}
                  {turns.length === 1 ? "domanda" : "domande"},{" "}
                  {session.durationMin} minuti
                </p>
                <h1 className="mt-1 text-[1.75rem] leading-tight font-medium text-balance sm:text-[2.125rem]">
                  {session.title}
                </h1>
                <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
                  {INSTRUCTIONS[session.mode]}
                </p>
                {materialsRef.current.some((m) => m.role === "modello") ? (
                  <p className="mt-2 text-sm text-ink-faint">
                    Impostata sul modello di:{" "}
                    {materialsRef.current
                      .filter((m) => m.role === "modello")
                      .map((m) => m.name)
                      .join(", ")}
                  </p>
                ) : null}
                {timeUp ? (
                  <p className="mt-4 rounded-[10px] bg-amber-soft px-4 py-3 text-sm text-amber-deep print:hidden">
                    Tempo scaduto. Finisci la frase e consegna quando sei
                    pronto.
                  </p>
                ) : null}
              </header>

              <ol className="divide-y divide-line/70">
                {turns.map((t, i) => (
                  <li
                    key={t.id}
                    className="py-7 last:pb-0 print:break-inside-avoid"
                  >
                    <Question
                      turn={t}
                      number={i + 1}
                      value={answers[t.id] ?? ""}
                      onChange={(v) => setAnswer(t, v)}
                    />
                  </li>
                ))}
              </ol>
            </article>
          </main>

          <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line/70 bg-paper/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur print:hidden">
            <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-soft" aria-live="polite">
                {confirming ? (
                  <span className="text-amber-deep">
                    {missing === 1
                      ? "Una domanda è"
                      : `${missing} domande sono`}{" "}
                    senza risposta. Le consegni così?
                  </span>
                ) : (
                  <>
                    Hai risposto a{" "}
                    <span className="font-medium text-ink tabular">
                      {answered}
                    </span>{" "}
                    di <span className="tabular">{turns.length}</span>. Le
                    risposte si salvano da sole.
                  </>
                )}
              </p>
              <Button
                size="lg"
                onClick={() => void submit()}
                disabled={phase === "submitting"}
                className="shrink-0"
              >
                {phase === "submitting"
                  ? "Correggo la prova…"
                  : confirming
                    ? "Consegna comunque"
                    : "Consegna la prova"}
              </Button>
            </div>
          </footer>
        </>
      ) : null}
    </div>
  );
}

function Question({
  turn,
  number,
  value,
  onChange,
}: {
  turn: Turn;
  number: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const labelId = `q-${turn.id}`;
  const heading = (
    <>
      <p className="text-[13px] text-ink-faint">
        {number}.{" "}
        {turn.kind === "multipla"
          ? "A crocette"
          : turn.kind === "traccia"
            ? "Elaborato"
            : "Domanda aperta"}
        {turn.topic ? `, ${turn.topic}` : ""}
      </p>
      <p
        id={labelId}
        className="mt-1.5 font-serif text-[1.2rem] leading-snug text-ink sm:text-[1.3rem]"
      >
        {turn.question}
      </p>
    </>
  );

  if (turn.kind === "multipla" && turn.options?.length) {
    return (
      <fieldset>
        <legend className="contents">{heading}</legend>
        <div className="mt-4 grid gap-2">
          {turn.options.map((opt, i) => {
            const checked = value === opt;
            return (
              <label
                key={opt}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[10px] px-3.5 py-3 ring-1 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal",
                  checked
                    ? "bg-teal-soft ring-teal"
                    : "ring-line hover:bg-paper",
                )}
              >
                <input
                  type="radio"
                  name={labelId}
                  value={opt}
                  checked={checked}
                  onChange={() => onChange(opt)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-sm font-medium transition-colors",
                    checked ? "bg-teal text-white" : "bg-paper text-ink-soft",
                  )}
                  aria-hidden="true"
                >
                  {LETTERS[i]}
                </span>
                <span className="pt-0.5 leading-relaxed text-ink">{opt}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const long = turn.kind === "traccia";
  const n = countWords(value);
  return (
    <div>
      {heading}
      <textarea
        aria-labelledby={labelId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={long ? 14 : 6}
        placeholder={
          long ? "Scrivi qui il tuo elaborato…" : "Scrivi qui la tua risposta…"
        }
        className="mt-4 block w-full resize-y rounded-[10px] bg-paper/60 p-3.5 text-[16px] leading-relaxed text-ink ring-1 ring-line placeholder:text-ink-faint focus:bg-card focus:ring-2 focus:ring-teal focus:outline-none print:bg-transparent"
      />
      <p className="mt-1.5 text-right text-[13px] text-ink-faint tabular print:hidden">
        {n} {n === 1 ? "parola" : "parole"}
        {long ? ", consigliate almeno 300" : ""}
      </p>
    </div>
  );
}
