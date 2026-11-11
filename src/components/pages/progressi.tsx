"use client";

import { ProgressChart, toTenths } from "@/components/progress-chart";
import { Card } from "@/components/ui";
import { useSessions } from "@/lib/hooks";
import { MODE_LABEL, type ExamMode } from "@/lib/types";
import { PageFrame, PageHeader } from "./page-header";

const fmt = (n: number) =>
  n.toLocaleString("it-IT", { maximumFractionDigits: 1 });

export function Progress() {
  const { data: sessions = [] } = useSessions();
  const done = sessions.filter(
    (s) => s.status === "completata" && s.score != null,
  );
  const avg = done.length
    ? done.reduce((a, s) => a + toTenths(s), 0) / done.length
    : null;
  const minutes = done.reduce((a, s) => {
    if (!s.endedAt) return a;
    return (
      a +
      Math.max(
        1,
        Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000),
      )
    );
  }, 0);

  const byMode = (Object.keys(MODE_LABEL) as ExamMode[])
    .map((mode) => {
      const list = done.filter((s) => s.mode === mode);
      return {
        mode,
        count: list.length,
        avg: list.length
          ? list.reduce((a, s) => a + toTenths(s), 0) / list.length
          : null,
      };
    })
    .filter((m) => m.count);

  return (
    <PageFrame>
      <PageHeader
        title="Progressi"
        intro="Come vanno i voti nel tempo, riportati tutti in decimi per confrontarli."
      />

      <dl className="mt-8 grid grid-cols-3 gap-3">
        {[
          { label: "Simulazioni", value: String(done.length) },
          { label: "Media", value: avg == null ? "–" : fmt(avg) },
          { label: "Minuti di pratica", value: String(minutes) },
        ].map((s) => (
          <Card key={s.label} className="p-4 sm:p-5">
            <dt className="text-[13px] text-ink-soft">{s.label}</dt>
            <dd className="mt-1 font-serif text-[1.75rem] leading-none font-semibold tabular">
              {s.value}
            </dd>
          </Card>
        ))}
      </dl>

      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="mb-4 text-xl font-medium">Andamento</h2>
        <ProgressChart sessions={sessions} height={180} />
      </Card>

      {byMode.length ? (
        <Card className="mt-4 p-5 sm:p-6">
          <h2 className="text-xl font-medium">Per tipo di prova</h2>
          <ul className="mt-4 divide-y divide-line/70">
            {byMode.map((m) => (
              <li
                key={m.mode}
                className="flex items-center justify-between py-3"
              >
                <span>
                  {MODE_LABEL[m.mode]}
                  <span className="ml-2 text-sm text-ink-faint">
                    {m.count} {m.count === 1 ? "prova" : "prove"}
                  </span>
                </span>
                <span className="font-serif text-lg font-semibold text-amber-deep tabular">
                  {fmt(m.avg!)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </PageFrame>
  );
}
