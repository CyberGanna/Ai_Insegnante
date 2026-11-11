"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SessionRow } from "@/components/session-row";
import { ButtonLink, Card, cn } from "@/components/ui";
import { useSessions } from "@/lib/hooks";
import type { ExamFormat, ExamMode } from "@/lib/types";
import { PageFrame, PageHeader } from "./page-header";

const MODES: Record<ExamMode, { title: string; intro: string; empty: string }> =
  {
    interrogazione: {
      title: "Verifiche",
      intro:
        "Tutte le tue interrogazioni e verifiche scritte, con il voto. Aprine una per rileggere domande, risposte e correzioni.",
      empty: "Non hai ancora fatto nessuna verifica o interrogazione.",
    },
    maturita: {
      title: "Esami di maturità",
      intro:
        "Le simulazioni dell’orale e degli scritti della maturità, con il voto in centesimi.",
      empty: "Non hai ancora simulato la maturità.",
    },
    colloquio: {
      title: "Colloqui",
      intro:
        "I colloqui di lavoro e i test di selezione che hai provato, con i consigli del selezionatore.",
      empty: "Non hai ancora provato nessun colloquio.",
    },
  };

const isMode = (v: string | null): v is ExamMode =>
  v === "interrogazione" || v === "maturita" || v === "colloquio";

const FILTERS: { value: ExamMode | null; label: string }[] = [
  { value: null, label: "Tutte" },
  { value: "interrogazione", label: "Verifiche" },
  { value: "maturita", label: "Maturità" },
  { value: "colloquio", label: "Colloqui" },
];

export function Sessions() {
  const params = useSearchParams();
  const tipo = params.get("tipo");
  const mode = isMode(tipo) ? tipo : null;
  const formato = params.get("formato") as ExamFormat | null;
  const { data: sessions, isLoading } = useSessions();

  const list = (sessions ?? []).filter(
    (s) => (!mode || s.mode === mode) && (!formato || s.format === formato),
  );
  const copy = mode ? MODES[mode] : null;
  const href = (m: ExamMode | null, f: ExamFormat | null) => {
    const q = new URLSearchParams();
    if (m) q.set("tipo", m);
    if (f) q.set("formato", f);
    const s = q.toString();
    return `/sessioni/${s ? `?${s}` : ""}`;
  };

  return (
    <PageFrame>
      <PageHeader
        title={copy?.title ?? "Le mie sessioni"}
        intro={
          copy?.intro ??
          "Ogni simulazione con il voto. Apri una sessione per rileggere domande, risposte e consigli."
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
              href={href(f.value, formato)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-4 text-sm transition-colors",
                active
                  ? "bg-ink font-medium text-white"
                  : "glass-bubble text-ink-soft hover:text-ink",
              )}
            >
              {f.label}
            </Link>
          );
        })}
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
        ).map(([value, label]) => {
          const active = value === formato;
          return (
            <Link
              key={label}
              href={href(mode, value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full px-3.5 text-sm transition-colors",
                active
                  ? "bg-white/80 font-medium text-ink shadow-[var(--shadow-card)]"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-ink-soft">Caricamento…</p>
        ) : list.length ? (
          <Card className="py-1.5">
            <p className="sr-only" aria-live="polite">
              {list.length} {list.length === 1 ? "sessione" : "sessioni"}
            </p>
            <ul className="divide-y divide-line/70">
              {list.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <p className="font-serif text-xl">
              {copy ? copy.empty : "Ancora nessuna simulazione"}
            </p>
            <p className="mt-2 text-ink-soft">
              Carica i tuoi appunti nella dashboard e fai la prima prova:
              bastano dieci minuti.
            </p>
          </Card>
        )}
      </div>
    </PageFrame>
  );
}
