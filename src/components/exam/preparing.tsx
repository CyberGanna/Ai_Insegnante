"use client";

import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

/* Prima di iniziare l'esaminatore studia i materiali: il cronometro è fermo
   e i passaggi avanzano mentre l'AI prepara la prova. */
const STEPS = [
  "Legge i materiali che hai caricato",
  "Individua gli argomenti principali",
  "Prepara le domande",
];

export function Preparing({
  title,
  materials,
  done = false,
}: {
  title: string;
  materials: string[];
  done?: boolean;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      2200,
    );
    return () => clearInterval(t);
  }, []);
  const at = done ? STEPS.length : step;

  return (
    <div
      className="mx-auto my-auto w-full max-w-md px-2 py-10 text-left"
      aria-busy={!done}
      aria-live="polite"
    >
      <span className="flex w-fit gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="animate-status size-2.5 rounded-full bg-teal"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
      </span>
      <h1 className="mt-6 text-[1.75rem] leading-tight font-medium sm:text-[2rem]">
        {done ? "L’esaminatore è pronto" : "L’esaminatore sta studiando"}
      </h1>
      <p className="mt-2 text-ink-soft">{title}</p>

      <ol className="mt-8 space-y-3">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-3 text-[15px] transition-colors duration-500",
              i < at ? "text-ink" : i === at ? "text-ink" : "text-ink-faint",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs transition-colors duration-500",
                i < at
                  ? "bg-teal text-white"
                  : i === at
                    ? "animate-status ring-2 ring-teal"
                    : "ring-1 ring-ink-faint/50",
              )}
            >
              {i < at ? "✓" : ""}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {materials.length ? (
        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Materiali">
          {materials.slice(0, 6).map((m) => (
            <li
              key={m}
              className="max-w-full truncate rounded-full bg-black/[0.06] px-3 py-1 text-[13px] text-ink-soft"
            >
              {m}
            </li>
          ))}
          {materials.length > 6 ? (
            <li className="px-1 py-1 text-[13px] text-ink-faint">
              e altri {materials.length - 6}
            </li>
          ) : null}
        </ul>
      ) : null}

      <p className="mt-8 text-sm text-ink-faint">
        Il cronometro parte quando inizia la conversazione.
      </p>
    </div>
  );
}
