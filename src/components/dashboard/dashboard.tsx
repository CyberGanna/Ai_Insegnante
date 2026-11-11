"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { mutate } from "swr";
import { useStore } from "@/components/providers";
import { MaterialCard } from "@/components/material-card";
import { ProgressChart } from "@/components/progress-chart";
import { SessionRow } from "@/components/session-row";
import { Button, Card, SectionTitle } from "@/components/ui";
import { getAi } from "@/lib/ai";
import { keys, useMaterials, useProfile, useSessions } from "@/lib/hooks";
import { readMaterial } from "@/lib/materials";
import { examHref, type Difficulty, type Duration, type ExamFormat, type ExamMode, type Material, type Voice } from "@/lib/types";
import { DropZone } from "./drop-zone";
import { ExamSettings, FormatPicker, ModePicker } from "./setup";

function sessionTitle(mode: ExamMode, format: ExamFormat, materials: Material[], jobPosting: string) {
  const written = format === "scritto";
  if (mode === "colloquio") {
    const first =
      jobPosting
        .split(/\r?\n/)
        .find((l) => l.trim())
        ?.trim() ?? "";
    const label = written ? "Colloquio scritto" : "Colloquio";
    return first ? `${label}: ${first.slice(0, 48)}` : written ? "Colloquio scritto" : "Colloquio di lavoro";
  }
  const names = materials.map((m) => m.name.replace(/\.[a-z0-9]+$/i, "")).slice(0, 2);
  const rest = materials.length - names.length;
  const base = names.join(", ") + (rest > 0 ? ` e altri ${rest}` : "");
  if (mode === "maturita") return `${written ? "Maturità scritta" : "Maturità"}: ${base}`;
  if (written) return base ? `Verifica: ${base}` : "Verifica scritta";
  return base || "Interrogazione";
}

export function Dashboard() {
  const store = useStore();
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: materials = [] } = useMaterials();
  const { data: sessions = [] } = useSessions();

  const [mode, setMode] = useState<ExamMode>("interrogazione");
  const [format, setFormat] = useState<ExamFormat>("orale");
  const [jobPosting, setJobPosting] = useState("");
  const [duration, setDuration] = useState<Duration>(20);
  const [difficulty, setDifficulty] = useState<Difficulty>("medio");
  const [voice, setVoice] = useState<Voice>("calma");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<{ text: string; field: "materials" | "job" } | null>(null);
  const [starting, setStarting] = useState(false);
  const materialsRef = useRef<HTMLElement>(null);

  // Le preferenze salvate diventano i valori iniziali.
  const appliedDefaults = useRef(false);
  useEffect(() => {
    if (!profile || appliedDefaults.current) return;
    appliedDefaults.current = true;
    setDuration(profile.defaultDuration);
    setDifficulty(profile.defaultDifficulty);
    setVoice(profile.defaultVoice);
  }, [profile]);

  const ready = useMemo(() => materials.filter((m) => m.status === "ready"), [materials]);
  const chosen = useMemo(() => ready.filter((m) => !excluded.has(m.id)), [ready, excluded]);
  const stillReading = materials.some((m) => m.status === "reading");
  const recent = sessions.slice(0, 3);
  const name = profile?.name.trim().split(/\s+/)[0];

  async function start() {
    setError(null);
    if (mode === "colloquio" && jobPosting.trim().length < 40) {
      setError({
        text: "Incolla l’annuncio di lavoro: servono almeno un paio di righe per preparare le domande.",
        field: "job",
      });
      document.querySelector<HTMLTextAreaElement>("textarea[name=annuncio]")?.focus();
      return;
    }
    if (mode !== "colloquio" && chosen.length === 0) {
      setError({
        text: stillReading
          ? "Sto ancora leggendo i materiali. Tra qualche secondo puoi iniziare."
          : "Aggiungi almeno un materiale da studiare, poi inizia la simulazione.",
        field: "materials",
      });
      materialsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setStarting(true);
    try {
      const session = await store.createSession(
        {
          mode,
          format,
          durationMin: duration,
          difficulty,
          voice,
          jobPosting: mode === "colloquio" ? jobPosting.trim() : null,
          materialIds: chosen.map((m) => m.id),
          focusTopics: [],
        },
        sessionTitle(mode, format, chosen, jobPosting),
      );
      await mutate(keys.sessions);
      router.push(examHref(session));
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : "Non riesco a creare la simulazione.", field: "materials" });
      setStarting(false);
    }
  }

  const startButton = (
    <Button size="lg" onClick={start} disabled={starting} aria-describedby={error ? "start-error" : undefined}>
      {starting ? "Preparo la simulazione…" : "Nuova simulazione"}
    </Button>
  );

  return (
    <div className="mx-auto grid max-w-[1180px] gap-10 px-4 pt-8 pb-28 sm:px-6 md:pb-12 lg:px-10 lg:pt-12 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-12">
      <div className="min-w-0">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[2rem] leading-[1.1] font-medium text-ink sm:text-[2.5rem]">
              {name ? `Ciao ${name}, cosa prepariamo oggi?` : "Ciao, cosa prepariamo oggi?"}
            </h1>
            {profile && !name ? (
              <p className="mt-2 text-sm text-ink-soft">
                <Link href="/impostazioni/" className="font-medium text-teal underline-offset-2 hover:underline">
                  Aggiungi il tuo nome
                </Link>{" "}
                e l’esaminatore ti chiamerà per nome.
              </p>
            ) : null}
          </div>
          <div className="hidden shrink-0 md:block">{startButton}</div>
        </header>

        <p
          id="start-error"
          role="alert"
          className={error ? "mt-4 rounded-[10px] bg-[#fdecea] px-4 py-3 text-sm text-danger" : "sr-only"}
        >
          {error?.text}
        </p>

        <section ref={materialsRef} aria-labelledby="materiali" className="mt-10 scroll-mt-20">
          <SectionTitle
            id="materiali"
            hint={ready.length ? `${chosen.length} di ${ready.length} selezionati per la prova` : undefined}
          >
            Cosa studi
          </SectionTitle>
          <DropZone />
          {materials.length ? (
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2" aria-label="Materiali caricati">
              {materials.map((m) => (
                <MaterialCard
                  key={m.id}
                  material={m}
                  selected={!excluded.has(m.id)}
                  onToggle={(checked) =>
                    setExcluded((prev) => {
                      const next = new Set(prev);
                      if (checked) next.delete(m.id);
                      else next.add(m.id);
                      return next;
                    })
                  }
                  onRetry={() => void readMaterial(store, m, null)}
                  onRemove={async () => {
                    if (!window.confirm(`Rimuovere “${m.name}” dai materiali?`)) return;
                    await store.deleteMaterial(m.id);
                    await mutate(keys.materials);
                  }}
                />
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="modalita" className="mt-12">
          <SectionTitle id="modalita">Che prova vuoi fare</SectionTitle>
          <ModePicker
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            jobPosting={jobPosting}
            onJobPosting={setJobPosting}
            jobError={error?.field === "job" ? error.text : null}
          />
          <FormatPicker value={format} mode={mode} onChange={setFormat} />
        </section>

        <section aria-labelledby="impostazioni-prova" className="mt-12">
          <SectionTitle id="impostazioni-prova">Prima di iniziare</SectionTitle>
          <Card className="p-5 sm:p-6">
            <ExamSettings
              duration={duration}
              difficulty={difficulty}
              voice={voice}
              onDuration={setDuration}
              onDifficulty={setDifficulty}
              onVoice={setVoice}
              showVoice={format === "orale"}
            />
          </Card>
          {getAi().isDemo ? (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
              Modalità prova: domande, correzione e voto sono simulati. Collega un fornitore AI per l’esaminatore vero.
            </p>
          ) : null}
        </section>
      </div>

      <aside className="min-w-0 space-y-6 xl:pt-[4.5rem]" aria-label="I tuoi risultati">
        <Card className="p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Ultime sessioni</h2>
            {sessions.length > 3 ? (
              <Link href="/sessioni/" className="text-sm font-medium text-teal hover:underline">
                Vedi tutte
              </Link>
            ) : null}
          </div>
          {recent.length ? (
            <ul className="divide-y divide-line/70">
              {recent.map((s) => (
                <SessionRow key={s.id} session={s} compact />
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-ink-soft">Qui troverai le tue ultime simulazioni con il voto.</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-medium">Andamento</h2>
          <ProgressChart sessions={sessions} />
        </Card>
      </aside>

      {/* Sul telefono il pulsante principale resta a portata di pollice. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-line/70 bg-paper/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="[&>button]:w-full">{startButton}</div>
      </div>
    </div>
  );
}
