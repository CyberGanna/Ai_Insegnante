"use client";

import { useRef, useState } from "react";
import { mutate } from "swr";
import { useStore } from "@/components/providers";
import { MaterialCard } from "@/components/material-card";
import { IconUpload } from "@/components/icons";
import { Button } from "@/components/ui";
import { keys } from "@/lib/hooks";
import { addAndRead, readMaterial, validateFile } from "@/lib/materials";
import type { ExamFormat, ExamMode, Material } from "@/lib/types";

/** Le verifiche vecchie sono documenti o foto: niente audio o video. */
const MODEL_ACCEPT = ".pdf,.docx,.txt,.md,image/*";

const COPY: Record<
  ExamMode,
  { title: string; text: Record<ExamFormat, string> }
> = {
  interrogazione: {
    title: "Verifiche vecchie del tuo professore",
    text: {
      scritto:
        "Caricane una o più, anche in foto: l’AI ne copia il tipo di domande, il numero, la lunghezza e il livello. Le domande nuove restano sui tuoi materiali.",
      orale:
        "Caricane una o più, anche in foto: l’AI farà domande con lo stesso stile e lo stesso livello.",
    },
  },
  maturita: {
    title: "Prove degli anni passati",
    text: {
      scritto:
        "Carica tracce o simulazioni della tua scuola: l’AI ne imita struttura e consegne, usando i tuoi argomenti.",
      orale:
        "Carica spunti o simulazioni della tua scuola: l’AI ne imita lo stile.",
    },
  },
  colloquio: {
    title: "Test di selezione che conosci",
    text: {
      scritto:
        "Se hai un test di un’azienda simile, caricalo: l’AI ne imita formato e difficoltà.",
      orale:
        "Se hai le domande di un colloquio simile, caricale: l’AI ne imita lo stile.",
    },
  },
};

export function ModelTests({
  models,
  mode,
  format,
  excluded,
  onToggle,
}: {
  models: Material[];
  mode: ExamMode;
  format: ExamFormat;
  excluded: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const store = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const copy = COPY[mode];

  async function addFiles(list: FileList) {
    const errors: string[] = [];
    for (const file of Array.from(list)) {
      const err = validateFile(file);
      const kind = err ? null : file.type.split("/")[0];
      if (err || kind === "audio" || kind === "video") {
        errors.push(
          err ??
            `${file.name}: come modello servono documenti o foto, non audio o video.`,
        );
        continue;
      }
      try {
        await addAndRead(store, { kind: "file", file, role: "modello" });
      } catch (e) {
        errors.push(
          `${file.name}: ${e instanceof Error ? e.message : "caricamento non riuscito."}`,
        );
      }
    }
    setMessage(errors.length ? errors.join(" ") : null);
  }

  return (
    <div className="mt-6 border-t border-line/70 pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-ink">
            {copy.title}{" "}
            <span className="font-normal text-ink-faint">(facoltativo)</span>
          </p>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-ink-soft">
            {copy.text[format]}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0 self-start"
          onClick={() => inputRef.current?.click()}
        >
          <IconUpload size={16} />
          Carica un esempio
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={MODEL_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <p
        role="status"
        className={message ? "mt-3 text-sm text-danger" : "sr-only"}
      >
        {message}
      </p>
      {models.length ? (
        <ul
          className="mt-4 grid gap-2.5 sm:grid-cols-2"
          aria-label="Esempi caricati"
        >
          {models.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              selected={!excluded.has(m.id)}
              onToggle={(checked) => onToggle(m.id, checked)}
              onRetry={() => void readMaterial(store, m, null)}
              onRemove={async () => {
                if (!window.confirm(`Rimuovere “${m.name}” dagli esempi?`))
                  return;
                await store.deleteMaterial(m.id);
                await mutate(keys.materials);
              }}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
