"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";
import { ProgressChart, toTenths } from "@/components/progress-chart";
import { Card } from "@/components/ui";
import { useFolders, useProjects, useSessions } from "@/lib/hooks";
import { PROJECT_COPY, type ExamMode, type Session } from "@/lib/types";
import { PageFrame, PageHeader } from "./page-header";

const MODES: ExamMode[] = ["interrogazione", "maturita", "colloquio"];
const ALL = "tutti";

const fmt = (n: number) =>
  n.toLocaleString("it-IT", { maximumFractionDigits: 1 });

const isMode = (v: string): v is ExamMode => (MODES as string[]).includes(v);

const SELECT =
  "mt-2 h-11 w-full rounded-full bg-white/80 px-4 text-[15px] text-ink ring-1 ring-line focus:ring-2 focus:ring-teal focus:outline-none disabled:opacity-60";

/**
 * Progressi di un progetto: prima si sceglie la cartella (Verifiche, Maturità,
 * Colloqui o una dell’utente), poi il progetto o tutta la cartella.
 */
export function Progress() {
  const router = useRouter();
  const params = useSearchParams();
  const folderKey = params.get("cartella") ?? "";
  const projectKey = params.get("progetto") ?? "";
  const { data: sessions = [] } = useSessions();
  const { data: projects = [] } = useProjects();
  const { data: folders = [] } = useFolders();
  const folderId = useId();
  const projectId = useId();

  const folderOptions = [
    ...MODES.map((m) => ({ value: m, label: PROJECT_COPY[m].section })),
    ...folders.map((f) => ({ value: f.id, label: f.name })),
  ];
  const validFolder = folderOptions.some((o) => o.value === folderKey);
  const inFolder = !validFolder
    ? []
    : isMode(folderKey)
      ? projects.filter((p) => p.mode === folderKey && !p.folderId)
      : projects.filter((p) => p.folderId === folderKey);
  const validProject =
    validFolder &&
    (projectKey === ALL || inFolder.some((p) => p.id === projectKey));

  const go = (cartella: string, progetto: string) => {
    const q = new URLSearchParams();
    if (cartella) q.set("cartella", cartella);
    if (progetto) q.set("progetto", progetto);
    const s = q.toString();
    router.replace(`/progressi/${s ? `?${s}` : ""}`);
  };

  const inScope = (s: Session) => {
    if (projectKey !== ALL) return s.projectId === projectKey;
    if (isMode(folderKey)) {
      if (s.mode !== folderKey) return false;
      const p = projects.find((x) => x.id === s.projectId);
      return !p || !p.folderId;
    }
    return inFolder.some((p) => p.id === s.projectId);
  };
  const scoped = validProject ? sessions.filter(inScope) : [];
  const folderLabel = folderOptions.find((o) => o.value === folderKey)?.label;
  const projectLabel =
    projectKey === ALL
      ? "tutta la cartella"
      : inFolder.find((p) => p.id === projectKey)?.name;

  return (
    <PageFrame>
      <PageHeader title="Progressi" />

      <div className="glass-bubble mt-6 grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
        <div>
          <label
            htmlFor={folderId}
            className="text-[15px] font-medium text-ink"
          >
            Cartella
          </label>
          <select
            id={folderId}
            value={validFolder ? folderKey : ""}
            onChange={(e) => go(e.target.value, "")}
            className={SELECT}
          >
            <option value="" disabled>
              Scegli una cartella
            </option>
            {folderOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={projectId}
            className="text-[15px] font-medium text-ink"
          >
            Progetto
          </label>
          <select
            id={projectId}
            value={validProject ? projectKey : ""}
            disabled={!validFolder}
            onChange={(e) => go(folderKey, e.target.value)}
            className={SELECT}
          >
            <option value="" disabled>
              {validFolder ? "Scegli un progetto" : "Prima scegli la cartella"}
            </option>
            {inFolder.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {validFolder ? (
              <option value={ALL}>Tutta la cartella</option>
            ) : null}
          </select>
        </div>
      </div>

      {validProject ? (
        <Stats
          title={`${folderLabel} · ${projectLabel}`}
          sessions={scoped}
          breakdown={
            projectKey === ALL
              ? inFolder.map((p) => ({
                  name: p.name,
                  list: scoped.filter((s) => s.projectId === p.id),
                }))
              : null
          }
        />
      ) : (
        <p className="mt-6 text-ink-soft">
          {validFolder
            ? "Ora scegli il progetto di cui vuoi vedere i progressi."
            : "Scegli la cartella e il progetto di cui vuoi vedere i progressi, per esempio Verifiche e poi Biologia."}
        </p>
      )}
    </PageFrame>
  );
}

const done = (list: Session[]) =>
  list.filter((s) => s.status === "completata" && s.score != null);
const average = (list: Session[]) =>
  list.length ? list.reduce((a, s) => a + toTenths(s), 0) / list.length : null;

function Stats({
  title,
  sessions,
  breakdown,
}: {
  title: string;
  sessions: Session[];
  breakdown: { name: string; list: Session[] }[] | null;
}) {
  const finished = done(sessions);
  const avg = average(finished);
  const minutes = finished.reduce((a, s) => {
    if (!s.endedAt) return a;
    return (
      a +
      Math.max(
        1,
        Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000),
      )
    );
  }, 0);
  const rows = (breakdown ?? [])
    .map((b) => ({ name: b.name, list: done(b.list) }))
    .filter((b) => b.list.length);

  return (
    <section aria-label={title} className="mt-6">
      <h2 className="text-xl font-medium">{title}</h2>
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "Simulazioni", value: String(finished.length) },
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
        <h3 className="mb-4 text-xl font-medium">Andamento</h3>
        <ProgressChart sessions={sessions} height={180} />
      </Card>

      {rows.length ? (
        <Card className="mt-4 p-5 sm:p-6">
          <h3 className="text-xl font-medium">Per progetto</h3>
          <ul className="mt-4 divide-y divide-line/70">
            {rows.map((r) => (
              <li
                key={r.name}
                className="flex items-center justify-between py-3"
              >
                <span>
                  {r.name}
                  <span className="ml-2 text-sm text-ink-faint">
                    {r.list.length} {r.list.length === 1 ? "prova" : "prove"}
                  </span>
                </span>
                <span className="font-serif text-lg font-semibold text-amber-deep tabular">
                  {fmt(average(r.list)!)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}
