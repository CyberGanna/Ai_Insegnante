"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { mutate } from "swr";
import { useStore } from "@/components/providers";
import { IconArrowLeft, IconKeyboard, IconMic, IconRepeat, IconStop } from "@/components/icons";
import { Button, ButtonLink, cn } from "@/components/ui";
import { getAi } from "@/lib/ai";
import type { ExamContext, Listening } from "@/lib/ai/types";
import { saveEvaluation } from "@/lib/exam";
import { keys } from "@/lib/hooks";
import { modeLabel, type Material, type Session, type Turn } from "@/lib/types";
import { SoundOrb, type OrbState } from "./sound-orb";

type Phase =
  | "loading"
  | "intro"
  | "thinking"
  | "speaking"
  | "waiting"
  | "listening"
  | "transcribing"
  | "finishing"
  | "error";

const STATUS: Partial<Record<Phase, string>> = {
  thinking: "L’esaminatore sta pensando…",
  speaking: "L’esaminatore sta parlando",
  waiting: "Tocca a te",
  listening: "Ti ascolto…",
  transcribing: "Trascrivo la risposta…",
  finishing: "Preparo il report…",
};

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function ExamScreen() {
  const id = useSearchParams().get("id");
  const store = useStore();
  const router = useRouter();
  const ai = getAi();

  const [phase, setPhase] = useState<Phase>(id ? "loading" : "error");
  const [session, setSession] = useState<Session | null>(null);
  const [current, setCurrent] = useState<Turn | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; retry: () => void } | null>(
    id ? null : { text: "Manca il riferimento alla simulazione.", retry: () => router.replace("/") },
  );
  const [questionNumber, setQuestionNumber] = useState(0);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);

  const turnsRef = useRef<Turn[]>([]);
  const materialsRef = useRef<Material[]>([]);
  const listeningRef = useRef<Listening | null>(null);
  const elapsedRef = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const draftId = useId();

  const total = (session?.durationMin ?? 20) * 60;
  const remaining = total - elapsed;
  const timeUp = remaining <= 0;

  const ctx = (s: Session): ExamContext => ({
    session: s,
    materials: materialsRef.current.map(({ id: mid, name, text }) => ({ id: mid, name, text })),
    turns: turnsRef.current,
    elapsedSec: elapsedRef.current,
  });

  const countQuestions = (upTo: Turn) => turnsRef.current.filter((t) => t.index <= upTo.index && !t.isFollowUp).length;

  // Caricamento della sessione.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const s = await store.getSession(id);
      if (cancelled) return;
      if (!s) {
        setPhase("error");
        setError({ text: "Non trovo questa simulazione.", retry: () => router.replace("/") });
        return;
      }
      if (s.status === "completata") {
        router.replace(`/report/?id=${s.id}`);
        return;
      }
      const [turns, materials] = await Promise.all([store.listTurns(s.id), store.listMaterials()]);
      if (cancelled) return;
      turnsRef.current = turns;
      materialsRef.current = materials.filter((m) => s.materialIds.includes(m.id));
      const saved = Number(sessionStorage.getItem(`esame:${s.id}:tempo`) ?? 0);
      elapsedRef.current = saved;
      setElapsed(saved);
      setSession(s);
      const last = turns.at(-1);
      if (last && !last.answer) {
        setCurrent(last);
        setQuestionNumber(countQuestions(last));
      }
      setPhase("intro");
    })().catch((e) => {
      setPhase("error");
      setError({ text: e instanceof Error ? e.message : "Errore di caricamento.", retry: () => location.reload() });
    });
    return () => {
      cancelled = true;
    };
  }, [id, store, router]);

  // Cronometro: parte dopo "Inizia" e si ferma mentre si prepara il report.
  const running = !["loading", "intro", "finishing", "error"].includes(phase);
  useEffect(() => {
    if (!running || !session) return;
    const t = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current % 5 === 0) sessionStorage.setItem(`esame:${session.id}:tempo`, String(elapsedRef.current));
    }, 1000);
    return () => clearInterval(t);
  }, [running, session]);

  // Pulizia all’uscita: niente voce o microfono accesi su altre pagine.
  useEffect(
    () => () => {
      ai.tts.stop();
      listeningRef.current?.cancel();
    },
    [ai],
  );

  async function speak(s: Session, text: string) {
    setPhase("speaking");
    try {
      await ai.tts.speak(text, s.voice);
    } catch {
      setNotice("La voce non è disponibile: leggi la domanda qui sotto.");
    }
    setPhase((p) => (p === "speaking" ? "waiting" : p));
  }

  async function finish(s: Session) {
    ai.tts.stop();
    setPhase("finishing");
    setError(null);
    try {
      const evaluation = await ai.examiner.evaluate(ctx(s));
      await saveEvaluation(store, s, turnsRef.current, evaluation);
      sessionStorage.removeItem(`esame:${s.id}:tempo`);
      await mutate(keys.sessions);
      router.replace(`/report/?id=${s.id}`);
    } catch (e) {
      setPhase("error");
      setError({
        text: e instanceof Error ? e.message : "Non riesco a preparare il report.",
        retry: () => void finish(s),
      });
    }
  }

  async function ask(s: Session) {
    setPhase("thinking");
    setError(null);
    setNotice(null);
    try {
      const next = await ai.examiner.nextQuestion(ctx(s));
      const turn = await store.addTurn({
        sessionId: s.id,
        index: turnsRef.current.length,
        question: next.question,
        topic: next.topic,
        isFollowUp: next.isFollowUp,
        kind: "aperta",
        options: null,
        answer: null,
        modelAnswer: null,
        feedback: null,
        askedAt: new Date().toISOString(),
      });
      turnsRef.current = [...turnsRef.current, turn];
      setCurrent(turn);
      setQuestionNumber(countQuestions(turn));
      await speak(s, turn.question);
    } catch (e) {
      setPhase("error");
      setError({ text: e instanceof Error ? e.message : "L’esaminatore non risponde.", retry: () => void ask(s) });
    }
  }

  async function submitAnswer(text: string) {
    if (!session || !current) return;
    const answer = text.trim();
    if (!answer) {
      setNotice("Non ho sentito niente. Premi Rispondi e riprova, oppure scrivi la risposta.");
      setPhase("waiting");
      return;
    }
    setNotice(null);
    await store.updateTurn(current.id, { answer });
    turnsRef.current = turnsRef.current.map((t) => (t.id === current.id ? { ...t, answer } : t));
    setDraft("");
    if (elapsedRef.current >= session.durationMin * 60) await finish(session);
    else await ask(session);
  }

  async function startListening() {
    setNotice(null);
    ai.tts.stop();
    try {
      const handle = await ai.stt.start();
      listeningRef.current = handle;
      setStream(handle.stream);
      setPhase("listening");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Non riesco ad accendere il microfono.");
      setTyping(true);
      setPhase("waiting");
    }
  }

  async function stopListening() {
    const handle = listeningRef.current;
    listeningRef.current = null;
    setStream(null);
    if (!handle) return;
    setPhase("transcribing");
    try {
      const text = await handle.stop();
      await submitAnswer(text);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Trascrizione non riuscita. Riprova o scrivi la risposta.");
      setPhase("waiting");
    }
  }

  function begin() {
    if (!session) return;
    if (!ai.stt.supported) setTyping(true);
    if (current) void speak(session, current.question);
    else void ask(session);
  }

  // Barra spaziatrice: accende e spegne il microfono.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const el = e.target as HTMLElement;
      if (el.closest("button, a, input, textarea, dialog")) return;
      if (phase === "waiting" && !typing) {
        e.preventDefault();
        void startListening();
      } else if (phase === "listening") {
        e.preventDefault();
        void stopListening();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const orbState: OrbState =
    phase === "speaking"
      ? "speaking"
      : phase === "listening"
        ? "listening"
        : phase === "thinking" || phase === "transcribing" || phase === "finishing"
          ? "thinking"
          : "idle";

  const canAnswer = phase === "waiting" || phase === "speaking";

  return (
    <div className="flex min-h-dvh flex-col bg-paper pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Barra in alto: esci, tipo di prova, tempo */}
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        {phase === "intro" || phase === "loading" || phase === "error" ? (
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[15px] text-ink-soft hover:bg-paper-deep hover:text-ink"
          >
            <IconArrowLeft size={18} />
            Esci
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            disabled={phase === "finishing"}
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[15px] text-ink-soft hover:bg-paper-deep hover:text-ink disabled:opacity-40"
          >
            <IconArrowLeft size={18} />
            Termina
          </button>
        )}
        <p className="hidden truncate text-sm text-ink-faint sm:block">{session ? modeLabel(session) : ""}</p>
        <div
          role="timer"
          aria-label={`Tempo rimasto ${fmtTime(remaining)}`}
          className={cn(
            "rounded-full px-3.5 py-1.5 font-medium tabular ring-1 transition-colors",
            timeUp
              ? "bg-amber-soft text-amber-deep ring-amber/40"
              : remaining <= 60
                ? "text-amber-deep ring-amber/40"
                : "text-ink ring-line",
          )}
        >
          {session ? fmtTime(remaining) : "–:––"}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 pb-6 text-center sm:px-6">
        {phase === "loading" ? (
          <p className="my-auto text-ink-soft" aria-busy="true">
            Preparo l’aula…
          </p>
        ) : phase === "intro" && session ? (
          <div className="my-auto max-w-md">
            <SoundOrb state="idle" stream={null} />
            <h1 className="mt-8 text-[1.75rem] leading-tight font-medium sm:text-[2rem]">{session.title}</h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              L’esaminatore ti farà la prima domanda a voce. Premi{" "}
              <strong className="font-medium text-ink">Rispondi</strong> quando vuoi parlare e di nuovo quando hai
              finito. Hai {session.durationMin} minuti.
            </p>
            <Button size="lg" className="mt-8 min-w-48" onClick={begin} autoFocus>
              {current ? "Riprendi" : "Inizia"}
            </Button>
            {!ai.stt.supported ? (
              <p className="mt-4 text-sm text-ink-faint">
                Questo browser non trascrive la voce: risponderai per iscritto. Chrome, Edge e Safari lo supportano.
              </p>
            ) : null}
          </div>
        ) : phase === "error" ? (
          <div className="my-auto max-w-md" role="alert">
            <h1 className="text-2xl font-medium">Qualcosa si è interrotto</h1>
            <p className="mt-3 leading-relaxed text-ink-soft">{error?.text}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => error?.retry()}>Riprova</Button>
              <ButtonLink href="/" variant="secondary">
                Torna alla dashboard
              </ButtonLink>
            </div>
          </div>
        ) : (
          <>
            <h1 className="sr-only">{session?.title ?? "Simulazione"}</h1>
            <div className="pt-2 sm:pt-6">
              <SoundOrb state={orbState} stream={stream} />
            </div>

            <p
              className={cn(
                "mt-6 inline-flex items-center gap-2 text-sm font-medium",
                phase === "listening" ? "text-amber-deep" : "text-teal",
              )}
              aria-live="polite"
            >
              {STATUS[phase]}
            </p>

            <section aria-label="Domanda" className="mt-3 w-full max-w-2xl">
              {current ? (
                <>
                  <p className="text-[13px] text-ink-faint">
                    Domanda {questionNumber}
                    {current.isFollowUp ? ", approfondimento" : ""}
                  </p>
                  <p
                    className="mt-2 font-serif text-[1.375rem] leading-snug text-ink sm:text-[1.75rem]"
                    aria-live="polite"
                  >
                    {current.question}
                  </p>
                </>
              ) : (
                <p className="font-serif text-xl text-ink-faint">Un momento…</p>
              )}
            </section>

            <div className="mt-auto w-full max-w-md pt-8">
              {timeUp && canAnswer ? (
                <p className="mb-4 text-sm text-amber-deep">
                  Tempo scaduto: rispondi a quest’ultima domanda e poi vedi il report.
                </p>
              ) : null}
              <p aria-live="assertive" className={cn("text-sm text-danger", notice && "mb-4")}>
                {notice}
              </p>

              {typing ? (
                <form
                  className="text-left"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitAnswer(draft);
                  }}
                >
                  <label htmlFor={draftId} className="text-[15px] font-medium">
                    La tua risposta
                  </label>
                  <textarea
                    id={draftId}
                    rows={4}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={!canAnswer}
                    className="mt-2 block w-full resize-y rounded-[var(--radius-card)] bg-card p-3.5 text-[15px] leading-relaxed shadow-[var(--shadow-card)] ring-1 ring-line focus:ring-2 focus:ring-teal focus:outline-none"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {ai.stt.supported ? (
                      <button
                        type="button"
                        onClick={() => setTyping(false)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:underline"
                      >
                        <IconMic size={16} />
                        Rispondi a voce
                      </button>
                    ) : (
                      <span />
                    )}
                    <Button type="submit" disabled={!canAnswer}>
                      Invia risposta
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => (phase === "listening" ? void stopListening() : void startListening())}
                    disabled={!(canAnswer || phase === "listening")}
                    aria-pressed={phase === "listening"}
                    className={cn(
                      "group flex h-[4.5rem] min-w-[12rem] items-center justify-center gap-3 rounded-full px-8 text-lg font-medium text-white transition-[background-color,transform,box-shadow] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 touch-manipulation",
                      phase === "listening"
                        ? "bg-amber-deep shadow-[0_10px_30px_-12px_rgb(217_119_6/0.8)]"
                        : "bg-teal shadow-[0_10px_30px_-12px_rgb(15_118_110/0.8)] hover:bg-teal-deep",
                    )}
                  >
                    {phase === "listening" ? <IconStop size={24} /> : <IconMic size={24} />}
                    {phase === "listening" ? "Ho finito" : "Rispondi"}
                  </button>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
                    <button
                      type="button"
                      onClick={() => session && current && void speak(session, current.question)}
                      disabled={!current || phase !== "waiting"}
                      className="inline-flex items-center gap-1.5 font-medium text-teal hover:underline disabled:opacity-40 disabled:hover:no-underline"
                    >
                      <IconRepeat size={16} />
                      Ripeti la domanda
                    </button>
                    <button
                      type="button"
                      onClick={() => setTyping(true)}
                      disabled={phase === "listening"}
                      className="inline-flex items-center gap-1.5 text-ink-soft hover:text-ink hover:underline disabled:opacity-40"
                    >
                      <IconKeyboard size={16} />
                      Preferisco scrivere
                    </button>
                  </div>
                  <p className="mt-3 hidden text-xs text-ink-faint sm:block">Puoi usare anche la barra spaziatrice.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <dialog
        ref={dialogRef}
        aria-labelledby="termina-titolo"
        className="m-auto w-[min(92vw,26rem)] overscroll-contain rounded-[var(--radius-card)] bg-card p-6 text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/30 backdrop:backdrop-blur-[2px]"
      >
        <h2 id="termina-titolo" className="text-xl font-medium">
          Vuoi terminare adesso?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Riceverai comunque il voto e i consigli sulle domande a cui hai risposto.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
            Continua l’esame
          </Button>
          <Button
            onClick={() => {
              dialogRef.current?.close();
              listeningRef.current?.cancel();
              listeningRef.current = null;
              setStream(null);
              if (session) void finish(session);
            }}
          >
            Termina e vedi il report
          </Button>
        </div>
      </dialog>
    </div>
  );
}
