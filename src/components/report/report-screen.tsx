"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import { useStore } from "@/components/providers";
import { IconArrowLeft, IconCheck } from "@/components/icons";
import { Button, ButtonLink, Card, cn, formatDateTime } from "@/components/ui";
import { keys } from "@/lib/hooks";
import { examHref, modeLabel } from "@/lib/types";

export function ReportScreen() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  /** Arrivati qui appena finita la prova: suona il voto. */
  const store = useStore();
  const router = useRouter();
  const { data, isLoading, error } = useSWR(
    id ? keys.report(id) : null,
    async () => {
      const [session, report, turns] = await Promise.all([
        store.getSession(id),
        store.getReport(id),
        store.listTurns(id),
      ]);
      return { session, report, turns };
    },
  );
  const [retrying, setRetrying] = useState(false);

  if (isLoading)
    return (
      <p className="px-6 py-16 text-center text-ink-soft">Carico il report…</p>
    );
  if (error || !data?.session || !data.report) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-medium">Report non disponibile</h1>
        <p className="mt-3 text-ink-soft">
          {data?.session && !data.report
            ? "Questa simulazione non è stata completata."
            : "Non trovo questa simulazione."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {data?.session ? (
            <ButtonLink href={examHref(data.session)}>
              Riprendi la simulazione
            </ButtonLink>
          ) : null}
          <ButtonLink href="/" variant="secondary">
            Torna alla dashboard
          </ButtonLink>
        </div>
      </div>
    );
  }

  const { session, report, turns } = data;
  const answered = turns.filter((t) => t.answer);
  const scoreText =
    report.scoreMax === 100
      ? Math.round(report.score).toString()
      : report.score.toLocaleString("it-IT", { maximumFractionDigits: 1 });
  const passed = (report.score * 10) / report.scoreMax >= 6;

  async function retryWeak() {
    setRetrying(true);
    try {
      const next = await store.createSession(
        {
          mode: session!.mode,
          projectId: session!.projectId,
          format: session!.format,
          durationMin: session!.durationMin,
          difficulty: session!.difficulty,
          voice: session!.voice,
          jobPosting: session!.jobPosting,
          materialIds: session!.materialIds,
          focusTopics: report!.weakTopics,
        },
        `Ripasso: ${report!.weakTopics.slice(0, 2).join(", ") || session!.title}`.slice(
          0,
          80,
        ),
      );
      await mutate(keys.sessions);
      router.push(examHref(next));
    } catch {
      setRetrying(false);
    }
  }

  return (
    <article className="mx-auto max-w-[56rem] px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-10">
      <Link
        href="/"
        className="-ml-3 inline-flex h-10 items-center gap-2 rounded-full px-3 text-[15px] text-ink-soft hover:bg-paper-deep hover:text-ink"
      >
        <IconArrowLeft size={18} />
        Dashboard
      </Link>

      <header className="mt-6 grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-10">
        <div
          className="flex size-40 shrink-0 flex-col items-center justify-center rounded-full bg-card shadow-[var(--shadow-lift)] ring-[6px] ring-amber-soft sm:size-44"
          aria-label={`Voto ${scoreText} su ${report.scoreMax}`}
          role="img"
        >
          <span
            className="font-serif text-[3.5rem] leading-none font-semibold text-amber tabular"
            aria-hidden="true"
          >
            {scoreText}
          </span>
          <span
            className="mt-1 text-sm text-ink-faint tabular"
            aria-hidden="true"
          >
            su {report.scoreMax}
          </span>
        </div>
        <div>
          <p className="text-sm text-ink-faint">
            {modeLabel(session)}, {formatDateTime(session.startedAt)}
          </p>
          <h1 className="mt-1 text-[1.875rem] leading-tight font-medium sm:text-[2.25rem]">
            {session.title}
          </h1>
          <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">
            {report.summary}
          </p>
          <p className="mt-3 text-sm text-ink-faint">
            {answered.length} {answered.length === 1 ? "risposta" : "risposte"}{" "}
            su {turns.length} {turns.length === 1 ? "domanda" : "domande"}
            {passed ? ", sopra la sufficienza." : ", sotto la sufficienza."}
          </p>
        </div>
      </header>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-medium">Punti di forza</h2>
          <ul className="mt-4 space-y-3">
            {report.strengths.map((s) => (
              <li key={s} className="flex gap-3 leading-relaxed">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-teal-soft text-teal">
                  <IconCheck size={14} />
                </span>
                {s}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-medium">Da migliorare</h2>
          <ul className="mt-4 space-y-3">
            {report.improvements.map((s) => (
              <li key={s} className="flex gap-3 leading-relaxed">
                <span
                  className="mt-[0.55rem] size-2 shrink-0 rounded-full bg-amber"
                  aria-hidden="true"
                />
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-[var(--radius-card)] bg-teal-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-medium text-ink">Argomenti da ripassare</p>
          <p className="mt-1 text-[15px] text-ink-soft">
            {report.weakTopics.length
              ? report.weakTopics.join(", ")
              : "Nessuno in particolare: puoi alzare la difficoltà."}
          </p>
        </div>
        <Button
          size="lg"
          onClick={retryWeak}
          disabled={retrying}
          className="shrink-0"
        >
          {retrying ? "Preparo…" : "Riprova sugli argomenti deboli"}
        </Button>
      </div>

      <section aria-labelledby="domande" className="mt-14">
        <h2 id="domande" className="text-[1.5rem] font-medium">
          Domanda per domanda
        </h2>
        <ol className="mt-6 space-y-5">
          {turns.map((t, i) => (
            <li key={t.id}>
              <Card className="p-5 sm:p-6">
                <p className="text-[13px] text-ink-faint">
                  {i + 1}.{" "}
                  {t.isFollowUp ? "Approfondimento" : t.topic || "Domanda"}
                  {t.kind === "multipla"
                    ? ", a crocette"
                    : t.kind === "traccia"
                      ? ", elaborato"
                      : ""}
                </p>
                <h3 className="mt-1.5 text-[1.2rem] leading-snug font-medium">
                  {t.question}
                </h3>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-ink-soft">
                      La tua risposta
                    </p>
                    <p
                      className={cn(
                        "mt-1.5 leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]",
                        t.answer ? "text-ink" : "text-ink-faint italic",
                      )}
                    >
                      {t.answer ?? "Nessuna risposta."}
                    </p>
                    {t.feedback ? (
                      <p className="mt-3 text-sm leading-relaxed text-amber-deep">
                        {t.feedback}
                      </p>
                    ) : null}
                  </div>
                  {t.modelAnswer ? (
                    <div className="rounded-[10px] bg-paper p-4">
                      <p className="text-sm font-medium text-teal">
                        Una risposta migliore
                      </p>
                      <p className="mt-1.5 leading-relaxed text-ink">
                        {t.modelAnswer}
                      </p>
                    </div>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
