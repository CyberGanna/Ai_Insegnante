"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { mutate } from "swr";
import { IconArrowLeft, IconPencil, IconTrash } from "@/components/icons";
import { ProgressChart } from "@/components/progress-chart";
import { useStore } from "@/components/providers";
import { SessionRow } from "@/components/session-row";
import { Button, ButtonLink, Card, cn, formatScore } from "@/components/ui";
import { keys, useProjects, useSessions } from "@/lib/hooks";
import {
  PROJECT_COPY,
  type ExamFormat,
  type ExamMode,
  type Project,
  type Session,
} from "@/lib/types";
import { PageFrame, PageHeader } from "./page-header";

const MODES: Record<ExamMode, { intro: string; empty: string }> = {
  interrogazione: {
    intro: "Le tue interrogazioni e verifiche scritte, divise per materia.",
    empty: "Non hai ancora fatto nessuna verifica o interrogazione.",
  },
  maturita: {
    intro:
      "Le simulazioni dell’orale e degli scritti della maturità, con il voto in centesimi.",
    empty: "Non hai ancora simulato la maturità.",
  },
  colloquio: {
    intro:
      "I colloqui e i test di selezione che hai provato, divisi per azienda.",
    empty: "Non hai ancora provato nessun colloquio.",
  },
};

const isMode = (v: string | null): v is ExamMode =>
  v === "interrogazione" || v === "maturita" || v === "colloquio";

/* Filtri: un solo stile chiaro; quello attivo è bianco pieno con il testo verde acqua. */
const CHIP_ON =
  "bg-white font-medium text-teal shadow-[var(--shadow-card)] ring-1 ring-white";
const CHIP_OFF =
  "bg-white/45 text-ink-soft ring-1 ring-white/70 hover:bg-white/70 hover:text-ink";

const FILTERS: { value: ExamMode | null; label: string }[] = [
  { value: null, label: "Tutte" },
  { value: "interrogazione", label: "Verifiche" },
  { value: "maturita", label: "Maturità" },
  { value: "colloquio", label: "Colloqui" },
];

function sessionsHref(
  mode: ExamMode | null,
  format: ExamFormat | null,
  project?: string | null,
) {
  const q = new URLSearchParams();
  if (mode) q.set("tipo", mode);
  if (project) q.set("progetto", project);
  if (format) q.set("formato", format);
  const s = q.toString();
  return `/sessioni/${s ? `?${s}` : ""}`;
}

export function Sessions() {
  const params = useSearchParams();
  const tipo = params.get("tipo");
  const mode = isMode(tipo) ? tipo : null;
  const formato = params.get("formato") as ExamFormat | null;
  const projectId = params.get("progetto");
  const { data: sessions, isLoading } = useSessions();
  const { data: projects = [] } = useProjects();

  const project = projectId
    ? projects.find((p) => p.id === projectId)
    : undefined;
  if (projectId && project)
    return (
      <ProjectView
        project={project}
        sessions={sessions ?? []}
        formato={formato}
      />
    );

  const list = (sessions ?? []).filter(
    (s) => (!mode || s.mode === mode) && (!formato || s.format === formato),
  );
  const projectName = (s: Session) =>
    projects.find((p) => p.id === s.projectId)?.name;

  return (
    <PageFrame>
      <PageHeader
        title={mode ? PROJECT_COPY[mode].section : "Le mie sessioni"}
        intro={
          mode
            ? MODES[mode].intro
            : "Ogni simulazione con il voto. Apri una sessione per rileggere domande, risposte e consigli."
        }
        action={<ButtonLink href="/">Nuova simulazione</ButtonLink>}
      />

      <nav
        aria-label="Filtra per tipo"
        className="mt-6 flex flex-wrap items-center gap-2"
      >
        {FILTERS.map((f) => {
          const active = f.value === mode;
          return (
            <Link
              key={f.label}
              href={sessionsHref(f.value, formato)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-sm transition-colors",
                active ? CHIP_ON : CHIP_OFF,
              )}
            >
              {f.label}
            </Link>
          );
        })}
        <FormatFilter href={(f) => sessionsHref(mode, f)} value={formato} />
      </nav>

      {mode ? (
        <Projects
          mode={mode}
          projects={projects.filter((p) => p.mode === mode)}
          sessions={sessions ?? []}
        />
      ) : null}

      <section aria-labelledby="elenco" className="mt-8">
        <h2
          id="elenco"
          className={mode ? "mb-3 text-[1.375rem] font-medium" : "sr-only"}
        >
          {mode ? "Tutte le prove" : "Elenco"}
        </h2>
        <SessionList
          loading={isLoading}
          sessions={list}
          empty={mode ? MODES[mode].empty : "Ancora nessuna simulazione"}
          projectName={projectName}
        />
      </section>
    </PageFrame>
  );
}

function FormatFilter({
  href,
  value,
}: {
  href: (f: ExamFormat | null) => string;
  value: ExamFormat | null;
}) {
  return (
    <>
      <span
        className="mx-1 hidden h-5 w-px bg-ink/15 sm:block"
        aria-hidden="true"
      />
      {(
        [
          [null, "Orali e scritte"],
          ["orale", "Orali"],
          ["scritto", "Scritte"],
        ] as const
      ).map(([v, label]) => {
        const active = v === value;
        return (
          <Link
            key={label}
            href={href(v)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full px-4 text-sm transition-colors",
              active ? CHIP_ON : CHIP_OFF,
            )}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}

function SessionList({
  loading,
  sessions,
  empty,
  projectName,
}: {
  loading?: boolean;
  sessions: Session[];
  empty: string;
  projectName?: (s: Session) => string | undefined;
}) {
  if (loading) return <p className="text-ink-soft">Caricamento…</p>;
  if (!sessions.length)
    return (
      <Card className="p-8 text-center">
        <p className="font-serif text-xl">{empty}</p>
        <p className="mt-2 text-ink-soft">
          Carica i tuoi appunti nella dashboard e fai la prima prova: bastano
          dieci minuti.
        </p>
      </Card>
    );
  return (
    <Card className="py-1.5">
      <ul className="divide-y divide-line/70">
        {sessions.map((s) => (
          <SessionRow key={s.id} session={s} projectName={projectName?.(s)} />
        ))}
      </ul>
    </Card>
  );
}

function lastScore(list: Session[]) {
  const done = list.filter(
    (s) => s.status === "completata" && s.score !== null,
  );
  return done[0] ? formatScore(done[0].score, done[0].scoreMax) : null;
}

export function Projects({
  mode,
  projects,
  sessions,
  title = "Progetti",
  action,
}: {
  mode: ExamMode;
  projects: Project[];
  sessions: Session[];
  title?: string;
  action?: React.ReactNode;
}) {
  const store = useStore();
  const router = useRouter();
  const copy = PROJECT_COPY[mode];
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError(`Scrivi il nome della ${copy.one}.`);
      return;
    }
    if (projects.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
      setError("Hai già un progetto con questo nome.");
      return;
    }
    try {
      const p = await store.createProject(mode, clean);
      await mutate(keys.projects);
      setName("");
      setCreating(false);
      router.push(sessionsHref(mode, null, p.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Non riesco a creare il progetto.",
      );
    }
  }

  return (
    <section aria-labelledby={`progetti-${mode}`} className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`progetti-${mode}`} className="text-[1.375rem] font-medium">
          {title}
        </h2>
        {action ?? <p className="text-sm text-ink-soft">{copy.hint}</p>}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => {
          const own = sessions.filter((s) => s.projectId === p.id);
          const score = lastScore(own);
          return (
            <li key={p.id}>
              <Link
                href={sessionsHref(mode, null, p.id)}
                className="glass-bubble flex h-full flex-col p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <span className="font-serif text-lg leading-snug font-medium text-ink">
                  {p.name}
                </span>
                <span className="mt-auto flex items-baseline justify-between gap-3 pt-3 text-sm text-ink-soft">
                  {own.length === 0
                    ? "Nessuna prova"
                    : own.length === 1
                      ? "1 prova"
                      : `${own.length} prove`}
                  {score ? (
                    <span className="font-serif text-base font-semibold text-amber-deep tabular">
                      {score}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          {creating ? (
            <form
              onSubmit={create}
              className="glass-bubble flex h-full flex-col gap-2 p-4"
            >
              <label htmlFor={inputId} className="text-sm font-medium text-ink">
                Nome della {copy.one}
              </label>
              <input
                id={inputId}
                autoFocus
                value={name}
                maxLength={80}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
                placeholder={copy.placeholder}
                aria-invalid={error ? true : undefined}
                className="h-10 rounded-lg bg-white/80 px-3 text-[15px] text-ink ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-teal focus:outline-none"
              />
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <div className="mt-1 flex gap-2">
                <Button type="submit" size="sm">
                  Crea
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCreating(false)}
                >
                  Annulla
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-full min-h-[6.5rem] w-full flex-col items-center justify-center gap-1 rounded-[22px] border-[1.5px] border-dashed border-white/80 p-4 text-teal transition-colors hover:bg-white/30"
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                +
              </span>
              <span className="text-[15px] font-medium">Nuovo progetto</span>
            </button>
          )}
        </li>
      </ul>
    </section>
  );
}

function ProjectView({
  project,
  sessions,
  formato,
}: {
  project: Project;
  sessions: Session[];
  formato: ExamFormat | null;
}) {
  const store = useStore();
  const router = useRouter();
  const copy = PROJECT_COPY[project.mode];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const inputId = useId();

  const own = sessions.filter((s) => s.projectId === project.id);
  const list = own.filter((s) => !formato || s.format === formato);
  const back = sessionsHref(project.mode, null);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await store.renameProject(project.id, name);
    await mutate(keys.projects);
    setEditing(false);
  }

  async function remove() {
    if (
      !window.confirm(
        `Eliminare il progetto “${project.name}”? Le prove restano, senza progetto.`,
      )
    )
      return;
    await store.deleteProject(project.id);
    await Promise.all([mutate(keys.projects), mutate(keys.sessions)]);
    router.replace(back);
  }

  return (
    <PageFrame>
      <Link
        href={back}
        className="-ml-3 inline-flex h-10 items-center gap-2 rounded-full px-3 text-[15px] text-ink-soft hover:bg-white/30 hover:text-ink"
      >
        <IconArrowLeft size={18} />
        {copy.section}
      </Link>

      <header className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {editing ? (
            <form
              onSubmit={rename}
              className="flex flex-wrap items-center gap-2"
            >
              <label htmlFor={inputId} className="sr-only">
                Nome del progetto
              </label>
              <input
                id={inputId}
                autoFocus
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
                className="h-11 min-w-0 flex-1 rounded-lg bg-white/80 px-3 font-serif text-2xl text-ink ring-1 ring-line focus:ring-2 focus:ring-teal focus:outline-none"
              />
              <Button type="submit" size="sm">
                Salva
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Annulla
              </Button>
            </form>
          ) : (
            <h1 className="text-[2rem] leading-tight font-medium break-words sm:text-[2.25rem]">
              {project.name}
            </h1>
          )}
          <p className="mt-2 text-ink-soft">
            {own.length === 0
              ? "Ancora nessuna prova"
              : own.length === 1
                ? "1 prova"
                : `${own.length} prove`}
            {lastScore(own) ? `, ultimo voto ${lastScore(own)}` : ""}
          </p>
        </div>
        <ButtonLink href={`/?progetto=${project.id}`} className="shrink-0">
          Nuova prova in{" "}
          {project.name.length > 18 ? "questo progetto" : project.name}
        </ButtonLink>
      </header>

      <div className="mt-3 flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <IconPencil size={16} />
          Rinomina
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={remove}
          className="text-danger hover:bg-white/30"
        >
          <IconTrash size={16} />
          Elimina progetto
        </Button>
      </div>

      {own.some((s) => s.status === "completata") ? (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 text-lg font-medium">Andamento</h2>
          <ProgressChart sessions={own} />
        </Card>
      ) : null}

      <section aria-labelledby="prove-progetto" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 id="prove-progetto" className="mr-2 text-[1.375rem] font-medium">
            Prove
          </h2>
          <FormatFilter
            href={(f) => sessionsHref(project.mode, f, project.id)}
            value={formato}
          />
        </div>
        <SessionList
          sessions={list}
          empty={`Nessuna prova in “${project.name}”`}
        />
      </section>
    </PageFrame>
  );
}
