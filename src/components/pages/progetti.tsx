"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { mutate } from "swr";
import { Segmented } from "../dashboard/setup";
import {
  IconArrowLeft,
  IconBriefcase,
  IconChat,
  IconFolder,
  IconLaurel,
} from "../icons";
import { useStore } from "../providers";
import { Button } from "../ui";
import { keys, useFolders, useProjects, useSessions } from "@/lib/hooks";
import { PROJECT_COPY, type ExamMode, type Folder } from "@/lib/types";
import { PageFrame } from "./page-header";
import { Projects } from "./sessioni";

const FIXED = [
  { mode: "interrogazione", icon: IconChat },
  { mode: "maturita", icon: IconLaurel },
  { mode: "colloquio", icon: IconBriefcase },
] as const;

const KIND_OPTIONS: { value: ExamMode; label: string }[] = [
  { value: "interrogazione", label: "Verifica" },
  { value: "maturita", label: "Maturità" },
  { value: "colloquio", label: "Colloquio" },
];

const isMode = (v: string | null): v is ExamMode =>
  FIXED.some((f) => f.mode === v);

const countLabel = (n: number) => (n === 1 ? "1 progetto" : `${n} progetti`);

/**
 * Progetti: le tre cartelle fisse più quelle create dall’utente.
 * ?tipo= apre una cartella fissa, ?cartella= una dell’utente.
 */
export function ProjectsPage() {
  const params = useSearchParams();
  const tipo = params.get("tipo");
  const cartella = params.get("cartella");
  const { data: projects = [] } = useProjects();
  const { data: folders = [] } = useFolders();
  const { data: sessions = [] } = useSessions();

  const folder = cartella ? folders.find((f) => f.id === cartella) : undefined;
  if (folder)
    return (
      <FolderView
        folder={folder}
        projects={projects.filter((p) => p.folderId === folder.id)}
        sessions={sessions}
      />
    );

  if (isMode(tipo))
    return (
      <PageFrame>
        <BackLink />
        <h1 className="mt-2 text-[2rem] leading-tight font-medium sm:text-[2.25rem]">
          {PROJECT_COPY[tipo].section}
        </h1>
        <Projects
          bare
          mode={tipo}
          title={PROJECT_COPY[tipo].section}
          projects={projects.filter((p) => p.mode === tipo && !p.folderId)}
          sessions={sessions}
        />
      </PageFrame>
    );

  return (
    <PageFrame>
      <h1 className="text-[2rem] leading-tight font-medium sm:text-[2.25rem]">
        Progetti
      </h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {FIXED.map(({ mode, icon }) => (
          <FolderCard
            key={mode}
            href={`/progetti/?tipo=${mode}`}
            icon={icon}
            name={PROJECT_COPY[mode].section}
            count={
              projects.filter((p) => p.mode === mode && !p.folderId).length
            }
          />
        ))}
        {folders.map((f) => (
          <FolderCard
            key={f.id}
            href={`/progetti/?cartella=${f.id}`}
            icon={IconFolder}
            name={f.name}
            count={projects.filter((p) => p.folderId === f.id).length}
          />
        ))}
        <li>
          <NewFolder existing={folders.map((f) => f.name)} />
        </li>
      </ul>
    </PageFrame>
  );
}

function BackLink() {
  return (
    <Link
      href="/progetti/"
      className="-ml-1 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[15px] font-medium text-teal hover:bg-white/50"
    >
      <IconArrowLeft />
      Progetti
    </Link>
  );
}

function FolderCard({
  href,
  icon: Icon,
  name,
  count,
}: {
  href: string;
  icon: (p: { size?: number }) => React.ReactNode;
  name: string;
  count: number;
}) {
  return (
    <li>
      <Link
        href={href}
        className="glass-bubble flex h-full items-center gap-4 p-5 transition-shadow hover:shadow-[var(--shadow-lift)] sm:flex-col sm:items-start sm:p-6"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#33c2b1] to-[#0f766e] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.45)]">
          <Icon size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif text-xl leading-snug font-medium text-ink">
            {name}
          </span>
          <span className="mt-0.5 block text-sm text-ink-soft">
            {countLabel(count)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Crea una cartella con il nome che si vuole e sceglie come interroga l’AI. */
function NewFolder({ existing }: { existing: string[] }) {
  const store = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ExamMode>("interrogazione");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError("Scrivi il nome della cartella.");
      return;
    }
    const taken = [
      ...existing,
      ...FIXED.map((f) => PROJECT_COPY[f.mode].section),
    ];
    if (taken.some((n) => n.toLowerCase() === clean.toLowerCase())) {
      setError("Hai già una cartella con questo nome.");
      return;
    }
    try {
      const f = await store.createFolder(mode, clean);
      await mutate(keys.folders);
      router.push(`/progetti/?cartella=${f.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Non riesco a creare la cartella.",
      );
    }
  }

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full min-h-[5.5rem] w-full items-center justify-center gap-2 rounded-[22px] border-[1.5px] border-dashed border-white/80 p-5 text-teal transition-colors hover:bg-white/30 sm:flex-col sm:gap-1"
      >
        <span className="text-2xl leading-none" aria-hidden="true">
          +
        </span>
        <span className="text-[15px] font-medium">Nuova cartella</span>
      </button>
    );

  return (
    <form
      onSubmit={create}
      className="glass-bubble flex h-full flex-col gap-4 p-5"
    >
      <div>
        <label htmlFor={inputId} className="text-[15px] font-medium text-ink">
          Nome della cartella
        </label>
        <input
          id={inputId}
          autoFocus
          value={name}
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Es. Patente, Concorso, Esami universitari"
          aria-invalid={error ? true : undefined}
          className="mt-2 h-11 w-full rounded-full bg-white/80 px-4 text-[15px] text-ink ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-teal focus:outline-none"
        />
      </div>
      <Segmented<ExamMode>
        legend="Come ti interroga l’AI"
        options={KIND_OPTIONS}
        value={mode}
        onChange={setMode}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Crea
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Annulla
        </Button>
      </div>
    </form>
  );
}

function FolderView({
  folder,
  projects,
  sessions,
}: {
  folder: Folder;
  projects: Parameters<typeof Projects>[0]["projects"];
  sessions: Parameters<typeof Projects>[0]["sessions"];
}) {
  const store = useStore();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const inputId = useId();

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await store.renameFolder(folder.id, name);
    await mutate(keys.folders);
    setEditing(false);
  }

  async function remove() {
    const where = PROJECT_COPY[folder.mode].section;
    if (
      !window.confirm(
        `Eliminare la cartella “${folder.name}”? I progetti dentro passano in ${where}.`,
      )
    )
      return;
    await store.deleteFolder(folder.id);
    await Promise.all([mutate(keys.folders), mutate(keys.projects)]);
    router.replace("/progetti/");
  }

  return (
    <PageFrame>
      <BackLink />
      {editing ? (
        <form
          onSubmit={rename}
          className="mt-2 flex flex-wrap items-center gap-2"
        >
          <label htmlFor={inputId} className="sr-only">
            Nome della cartella
          </label>
          <input
            id={inputId}
            autoFocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
            className="h-12 min-w-0 flex-1 rounded-full bg-white/80 px-4 font-serif text-2xl text-ink ring-1 ring-line focus:ring-2 focus:ring-teal focus:outline-none"
          />
          <Button type="submit" size="sm">
            Salva
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Annulla
          </Button>
        </form>
      ) : (
        <h1 className="mt-2 text-[2rem] leading-tight font-medium break-words sm:text-[2.25rem]">
          {folder.name}
        </h1>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {editing ? null : (
          <button
            type="button"
            onClick={() => {
              setName(folder.name);
              setEditing(true);
            }}
            className="font-medium text-teal hover:underline"
          >
            Rinomina
          </button>
        )}
        <button
          type="button"
          onClick={() => void remove()}
          className="font-medium text-danger hover:underline"
        >
          Elimina cartella
        </button>
      </div>
      <Projects
        bare
        mode={folder.mode}
        title={folder.name}
        folderId={folder.id}
        projects={projects}
        sessions={sessions}
      />
    </PageFrame>
  );
}
