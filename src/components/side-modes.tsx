"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { mutate } from "swr";
import { useStore } from "./providers";
import { IconBriefcase, IconChat, IconLaurel } from "./icons";
import { cn } from "./ui";
import { keys, useProjects } from "@/lib/hooks";
import { PROJECT_COPY, type ExamMode } from "@/lib/types";

const MODE_NAV = [
  { mode: "interrogazione", label: "Verifiche", icon: IconChat },
  { mode: "maturita", label: "Esami di maturità", icon: IconLaurel },
  { mode: "colloquio", label: "Colloqui", icon: IconBriefcase },
] as const;

const sectionHref = (mode: ExamMode, project?: string) =>
  `/sessioni/?tipo=${mode}${project ? `&progetto=${project}` : ""}`;

/**
 * "Le tue prove" nella barra laterale: ogni tipo di prova si apre come una cartella
 * con le sue sezioni (materie o aziende) e il pulsante "Aggiungi".
 */
export function SideModes({
  tipo,
  progetto,
  onSessions,
}: {
  tipo: string | null;
  progetto: string | null;
  onSessions: boolean;
}) {
  const { data: projects = [] } = useProjects();
  const [toggled, setToggled] = useState<Partial<Record<ExamMode, boolean>>>(
    {},
  );

  return (
    <div>
      <p className="px-3 text-[11px] font-medium tracking-[0.08em] text-white/50 uppercase">
        Le tue prove
      </p>
      <ul className="mt-2 space-y-1">
        {MODE_NAV.map(({ mode, label, icon: Icon }) => {
          const current = onSessions && tipo === mode;
          const open = toggled[mode] ?? current;
          const own = projects.filter((p) => p.mode === mode);
          const listId = `sezioni-${mode}`;
          return (
            <li key={mode}>
              <div className="flex items-center">
                <Link
                  href={sectionHref(mode)}
                  onClick={() => setToggled((t) => ({ ...t, [mode]: true }))}
                  aria-current={current && !progetto ? "page" : undefined}
                  className={cn(
                    "flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
                    current && !progetto
                      ? "bg-gradient-to-b from-[#33c2b1] to-[#12877e] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_8px_20px_-8px_rgb(45_212_191/0.7)]"
                      : current
                        ? "font-medium text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon />
                  <span className="truncate">{label}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setToggled((t) => ({ ...t, [mode]: !open }))}
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-label={open ? `Chiudi ${label}` : `Apri ${label}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={cn("transition-transform", open && "rotate-90")}
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </div>
              {open ? (
                <ul
                  id={listId}
                  className="mt-1 mb-2 ml-[1.35rem] space-y-0.5 border-l border-white/15 pl-2"
                >
                  {own.map((p) => {
                    const active = onSessions && progetto === p.id;
                    return (
                      <li key={p.id}>
                        <Link
                          href={sectionHref(mode, p.id)}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm transition-colors",
                            active
                              ? "bg-white/18 font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"
                              : "text-white/70 hover:bg-white/10 hover:text-white",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              active ? "bg-[#5eead4]" : "bg-white/40",
                            )}
                            aria-hidden="true"
                          />
                          <span className="truncate">{p.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                  <li>
                    <AddSection mode={mode} existing={own.map((p) => p.name)} />
                  </li>
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AddSection({
  mode,
  existing,
}: {
  mode: ExamMode;
  existing: string[];
}) {
  const store = useStore();
  const router = useRouter();
  const copy = PROJECT_COPY[mode];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setAdding(false);
      return;
    }
    if (existing.some((n) => n.toLowerCase() === clean.toLowerCase())) {
      setError("Esiste già.");
      return;
    }
    try {
      const p = await store.createProject(mode, clean);
      await mutate(keys.projects);
      setName("");
      setAdding(false);
      router.push(sectionHref(mode, p.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Non riesco ad aggiungerla.",
      );
    }
  }

  if (!adding)
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-sm text-[#5eead4] transition-colors hover:bg-white/10"
      >
        <span className="text-base leading-none" aria-hidden="true">
          +
        </span>
        Aggiungi
      </button>
    );

  return (
    <form onSubmit={create} className="py-1">
      <label htmlFor={inputId} className="sr-only">
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
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setName("");
            setAdding(false);
          }
        }}
        onBlur={() => {
          if (!name.trim()) setAdding(false);
        }}
        placeholder={
          mode === "colloquio" ? "Nome dell’azienda" : "Nome della materia"
        }
        aria-invalid={error ? true : undefined}
        className="h-9 w-full rounded-lg bg-white/12 px-2.5 text-sm text-white ring-1 ring-white/25 placeholder:text-white/45 focus:ring-2 focus:ring-[#5eead4] focus:outline-none"
      />
      <p
        className={error ? "mt-1 px-1 text-xs text-[#fca5a5]" : "sr-only"}
        role="status"
      >
        {error ?? "Premi Invio per aggiungere"}
      </p>
    </form>
  );
}
