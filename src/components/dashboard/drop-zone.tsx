"use client";

import { useId, useRef, useState } from "react";
import { useStore } from "@/components/providers";
import { IconLink, IconUpload } from "@/components/icons";
import { Button, cn } from "@/components/ui";
import {
  ACCEPT,
  addAndRead,
  normalizeUrl,
  validateFile,
} from "@/lib/materials";

export function DropZone() {
  const store = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const urlId = useId();
  const hintId = useId();

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const errors: string[] = [];
    for (const file of files) {
      const err = validateFile(file);
      if (err) {
        errors.push(err);
        continue;
      }
      try {
        await addAndRead(store, { kind: "file", file });
      } catch (e) {
        errors.push(
          `${file.name}: ${e instanceof Error ? e.message : "caricamento non riuscito."}`,
        );
      }
    }
    setMessage(errors.length ? errors.join(" ") : null);
  }

  async function addUrl(raw: string) {
    const normalized = normalizeUrl(raw);
    if (!normalized) {
      setMessage(
        "Questo link non sembra valido. Controlla che inizi con https://",
      );
      return false;
    }
    setMessage(null);
    try {
      await addAndRead(store, { kind: "url", url: normalized });
      return true;
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Non riesco ad aggiungere il link.",
      );
      return false;
    }
  }

  return (
    <div>
      <div
        role="group"
        aria-describedby={hintId}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
          else {
            const text =
              e.dataTransfer.getData("text/uri-list") ||
              e.dataTransfer.getData("text/plain");
            if (text) void addUrl(text);
          }
        }}
        onPaste={(e) => {
          if (e.target instanceof HTMLInputElement) return;
          if (e.clipboardData.files.length) {
            e.preventDefault();
            void addFiles(e.clipboardData.files);
            return;
          }
          const text = e.clipboardData.getData("text/plain");
          if (text && normalizeUrl(text)) {
            e.preventDefault();
            void addUrl(text);
          }
        }}
        className={cn(
          "relative rounded-[var(--radius-card)] border-[1.5px] border-dashed px-5 py-8 text-center transition-colors sm:px-8 sm:py-10",
          dragging
            ? "border-teal bg-teal-soft/70"
            : "border-[#cfc8b8] bg-card/60",
        )}
      >
        <div
          className={cn(
            "mx-auto mb-4 grid size-12 place-items-center rounded-full transition-colors",
            dragging ? "bg-teal text-white" : "bg-teal-soft text-teal",
          )}
        >
          <IconUpload size={22} />
        </div>
        <p className="mx-auto max-w-sm font-serif text-xl leading-snug text-ink">
          Trascina qui appunti, PDF, foto o incolla un link
        </p>
        <p id={hintId} className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          PDF, Word, testo, foto di pagine scritte a mano o stampate (fino a 20
          MB). Audio e video di una lezione (MP3, M4A, MP4, fino a 25 MB): li
          trascriviamo e li usiamo come appunti.
        </p>

        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Scegli file
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <form
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-card py-1 pr-1 pl-4 ring-1 ring-line focus-within:ring-2 focus-within:ring-teal sm:max-w-sm"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await addUrl(url)) setUrl("");
            }}
          >
            <IconLink size={18} className="shrink-0 text-ink-faint" />
            <label htmlFor={urlId} className="sr-only">
              Link a una pagina web
            </label>
            <input
              id={urlId}
              name="url"
              type="text"
              inputMode="url"
              enterKeyHint="done"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <Button type="submit" variant="ghost" size="sm">
              Aggiungi
            </Button>
          </form>
        </div>
      </div>
      <p
        aria-live="polite"
        className={cn("text-sm text-danger", message && "mt-3")}
      >
        {message}
      </p>
    </div>
  );
}
