"use client";

import { useId, useState } from "react";
import { mutate } from "swr";
import { useStore } from "@/components/providers";
import { Button } from "@/components/ui";
import { keys } from "@/lib/hooks";
import { PROJECT_COPY, type ExamMode, type Project } from "@/lib/types";

const NEW = "__nuovo__";

/** Sceglie (o crea al volo) il progetto in cui salvare la prova. */
export function ProjectPicker({
  mode,
  projects,
  value,
  onChange,
}: {
  mode: ExamMode;
  projects: Project[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const store = useStore();
  const copy = PROJECT_COPY[mode];
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectId = useId();
  const nameId = useId();
  const own = projects.filter((p) => p.mode === mode);

  async function create() {
    const clean = name.trim();
    if (!clean) {
      setError(`Scrivi il nome della ${copy.one}.`);
      return;
    }
    const existing = own.find(
      (p) => p.name.toLowerCase() === clean.toLowerCase(),
    );
    try {
      const p = existing ?? (await store.createProject(mode, clean));
      await mutate(keys.projects);
      onChange(p.id);
      setName("");
      setCreating(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Non riesco a creare il progetto.",
      );
    }
  }

  return (
    <div className="mt-5">
      <label htmlFor={selectId} className="text-[15px] font-medium text-ink">
        Progetto{" "}
        <span className="font-normal text-ink-faint">(facoltativo)</span>
      </label>
      <p className="mt-0.5 text-sm text-ink-soft">
        Salva la prova nella cartella della {copy.one}, così la ritrovi dopo.
      </p>
      {creating ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor={nameId} className="sr-only">
            Nome della {copy.one}
          </label>
          <input
            id={nameId}
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder={copy.placeholder}
            aria-invalid={error ? true : undefined}
            className="h-11 min-w-0 flex-1 rounded-full bg-white/80 px-4 text-[15px] text-ink ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-teal focus:outline-none sm:max-w-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void create()}>
              Crea
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreating(false)}
            >
              Annulla
            </Button>
          </div>
        </div>
      ) : (
        <select
          id={selectId}
          value={value ?? ""}
          onChange={(e) => {
            if (e.target.value === NEW) setCreating(true);
            else onChange(e.target.value || null);
          }}
          className="mt-2 h-11 w-full rounded-full bg-white/80 px-4 text-[15px] text-ink ring-1 ring-line focus:ring-2 focus:ring-teal focus:outline-none sm:max-w-sm"
        >
          <option value="">Nessun progetto</option>
          {own.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value={NEW}>+ Nuovo progetto…</option>
        </select>
      )}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
