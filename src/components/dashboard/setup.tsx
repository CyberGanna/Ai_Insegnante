"use client";

import { useId, useState } from "react";
import {
  IconBriefcase,
  IconChat,
  IconLaurel,
  IconSpeaker,
} from "@/components/icons";
import { cn } from "@/components/ui";
import { getAi } from "@/lib/ai";
import type {
  Difficulty,
  Duration,
  ExamFormat,
  ExamMode,
  Voice,
} from "@/lib/types";

const MODES: {
  value: ExamMode;
  title: string;
  text: string;
  icon: typeof IconChat;
}[] = [
  {
    value: "interrogazione",
    title: "Interrogazione / verifica",
    text: "Domande sul programma, come alla cattedra. Voto in decimi.",
    icon: IconChat,
  },
  {
    value: "maturita",
    title: "Orale della maturità",
    text: "Si parte da uno spunto e colleghi le materie. Voto in centesimi.",
    icon: IconLaurel,
  },
  {
    value: "colloquio",
    title: "Colloquio di lavoro",
    text: "Un selezionatore ti fa domande sull’annuncio che incolli.",
    icon: IconBriefcase,
  },
];

export function ModePicker({
  value,
  onChange,
  jobPosting,
  onJobPosting,
  jobError,
}: {
  value: ExamMode;
  onChange: (m: ExamMode) => void;
  jobPosting: string;
  onJobPosting: (s: string) => void;
  jobError?: string | null;
}) {
  const name = useId();
  const postingId = useId();
  const errId = useId();
  return (
    <fieldset>
      <legend className="sr-only">Tipo di prova</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {MODES.map(({ value: v, title, text, icon: Icon }) => {
          const checked = v === value;
          return (
            <label
              key={v}
              className={cn(
                "group relative flex cursor-pointer flex-col rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-card)] ring-1 transition-[box-shadow,background-color] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal sm:p-5",
                checked
                  ? "ring-2 ring-teal"
                  : "ring-transparent hover:shadow-[var(--shadow-lift)]",
              )}
            >
              <input
                type="radio"
                name={name}
                value={v}
                checked={checked}
                onChange={() => onChange(v)}
                className="sr-only"
              />
              <span className="flex items-center gap-3 sm:flex-col sm:items-start">
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
                    checked ? "bg-teal text-white" : "bg-paper text-ink-soft",
                  )}
                >
                  <Icon size={20} />
                </span>
                <span className="font-serif text-[1.075rem] leading-snug font-medium text-ink sm:mt-1">
                  {title}
                </span>
              </span>
              <span className="mt-2 text-sm leading-relaxed text-ink-soft">
                {text}
              </span>
            </label>
          );
        })}
      </div>

      {value === "colloquio" ? (
        <div className="mt-4">
          <label
            htmlFor={postingId}
            className="text-[15px] font-medium text-ink"
          >
            Annuncio di lavoro
          </label>
          <p className="mt-0.5 text-sm text-ink-soft">
            Incolla il testo dell’annuncio: le domande seguiranno ruolo,
            requisiti e azienda.
          </p>
          <textarea
            id={postingId}
            name="annuncio"
            value={jobPosting}
            onChange={(e) => onJobPosting(e.target.value)}
            rows={5}
            aria-invalid={jobError ? true : undefined}
            aria-describedby={jobError ? errId : undefined}
            placeholder="Es. Cerchiamo un addetto vendite con esperienza nel contatto con il pubblico…"
            className="mt-2 block w-full resize-y rounded-[var(--radius-card)] bg-card p-3.5 text-[15px] leading-relaxed text-ink shadow-[var(--shadow-card)] ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-teal focus:outline-none aria-[invalid]:ring-danger"
          />
          {jobError ? (
            <p id={errId} className="mt-2 text-sm text-danger">
              {jobError}
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

const FORMAT_HINT: Record<ExamFormat, Record<ExamMode, string>> = {
  orale: {
    interrogazione:
      "L’esaminatore ti fa una domanda alla volta e tu rispondi parlando.",
    maturita:
      "La commissione ti propone uno spunto e ti ascolta mentre colleghi le materie.",
    colloquio: "Il selezionatore ti fa le domande e tu rispondi parlando.",
  },
  scritto: {
    interrogazione:
      "L’AI prepara una verifica con domande aperte e a crocette. La consegni e lei la corregge.",
    maturita:
      "Un elaborato su più argomenti e alcune domande aperte, da consegnare e far correggere.",
    colloquio:
      "Un test scritto di selezione: domande sul ruolo, casi pratici e risposte a scelta.",
  },
};

export function Segmented<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  aside,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  aside?: React.ReactNode;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[15px] font-medium text-ink">
        {legend}
      </legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-paper-deep p-1">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={cn(
                "relative flex h-10 cursor-pointer items-center justify-center rounded-full px-2 text-[15px] whitespace-nowrap transition-[background-color,color,box-shadow] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-teal",
                checked
                  ? "bg-card font-medium text-ink shadow-[var(--shadow-card)]"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {aside}
    </fieldset>
  );
}

const SAMPLE: Record<Voice, string> = {
  calma:
    "Ciao, sono il tuo esaminatore. Prenditi il tempo che ti serve per rispondere.",
  severa: "Buongiorno. Cominciamo. Risponda in modo preciso, per favore.",
};

export function ExamSettings({
  format,
  mode,
  onFormat,
  duration,
  difficulty,
  voice,
  onDuration,
  onDifficulty,
  onVoice,
}: {
  /** Senza onFormat (pagina Impostazioni) la scelta del formato non compare. */
  format?: ExamFormat;
  mode?: ExamMode;
  onFormat?: (f: ExamFormat) => void;
  duration: Duration;
  difficulty: Difficulty;
  voice: Voice;
  onDuration: (d: Duration) => void;
  onDifficulty: (d: Difficulty) => void;
  onVoice: (v: Voice) => void;
}) {
  const [playing, setPlaying] = useState(false);
  async function preview() {
    const tts = getAi().tts;
    if (playing) {
      tts.stop();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    try {
      await tts.speak(SAMPLE[voice], voice);
    } catch {
      /* anteprima non disponibile */
    } finally {
      setPlaying(false);
    }
  }

  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {onFormat && format && mode ? (
        <Segmented<ExamFormat>
          legend="Formato"
          value={format}
          onChange={onFormat}
          options={[
            { value: "orale", label: "Orale" },
            { value: "scritto", label: "Scritto" },
          ]}
          aside={
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {FORMAT_HINT[format][mode]}
            </p>
          }
        />
      ) : null}
      <Segmented<Duration>
        legend="Durata"
        value={duration}
        onChange={onDuration}
        options={[
          { value: 5, label: "5 min" },
          { value: 10, label: "10 min" },
          { value: 20, label: "20 min" },
          { value: 40, label: "40 min" },
        ]}
      />
      <Segmented<Difficulty>
        legend="Difficoltà"
        value={difficulty}
        onChange={onDifficulty}
        options={[
          { value: "base", label: "Base" },
          { value: "medio", label: "Medio" },
          { value: "esigente", label: "Esigente" },
        ]}
      />
      {format !== "scritto" ? (
        <Segmented<Voice>
          legend="Voce dell’esaminatore"
          value={voice}
          onChange={onVoice}
          options={[
            { value: "calma", label: "Calma" },
            { value: "severa", label: "Severa" },
          ]}
          aside={
            <button
              type="button"
              onClick={preview}
              className="mt-2 -ml-2 inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-teal hover:bg-teal-soft"
            >
              <IconSpeaker size={16} />
              {playing ? "Ferma l’anteprima" : "Ascolta la voce"}
            </button>
          }
        />
      ) : null}
    </div>
  );
}
