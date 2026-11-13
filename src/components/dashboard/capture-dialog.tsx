"use client";

import { useEffect, useRef, useState } from "react";
import { IconClose } from "@/components/icons";
import { Button, cn, formatBytes } from "@/components/ui";
import { MAX_MEDIA_MB } from "@/lib/materials";

export type CaptureMode = "foto" | "video" | "audio";

const TITLE: Record<CaptureMode, string> = {
  foto: "Scatta una foto",
  video: "Registra un video",
  audio: "Registra l’audio",
};

const HINT: Record<CaptureMode, string> = {
  foto: "Inquadra la pagina dritta e ben illuminata. Puoi scattare più foto di fila.",
  video:
    "Il video viene salvato leggero: circa 8 minuti al massimo. Per una lezione intera usa “Registra audio”.",
  audio:
    "Appoggia il telefono vicino a chi parla. Puoi registrare circa un’ora di lezione.",
};

/** Qualità bassa apposta: serve all’AI per trascrivere, e il file deve restare sotto i 25 MB. */
const BITRATE = {
  video: { videoBitsPerSecond: 350_000, audioBitsPerSecond: 64_000 },
  audio: { audioBitsPerSecond: 48_000 },
};

const LIMIT = (MAX_MEDIA_MB - 1) * 1024 * 1024;

function pickMime(mode: "video" | "audio") {
  const options =
    mode === "video"
      ? [
          "video/mp4;codecs=avc1,mp4a",
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ]
      : [
          "audio/mp4",
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg;codecs=opus",
        ];
  return options.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

const stamp = () =>
  new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace(/[/:]/g, ".")
    .replace(",", "");

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function CaptureDialog({
  mode,
  onClose,
  onFile,
}: {
  mode: CaptureMode;
  onClose: () => void;
  onFile: (file: File) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [shots, setShots] = useState(0);

  useEffect(() => {
    dialogRef.current?.showModal();
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          "Questo browser non può usare la fotocamera o il microfono. Usa “Scegli file”.",
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video:
            mode === "audio"
              ? false
              : {
                  facingMode: { ideal: "environment" },
                  width: { ideal: mode === "foto" ? 1920 : 854 },
                },
          audio: mode !== "foto",
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current && mode !== "audio") {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        setError(
          mode === "audio"
            ? "Non riesco a usare il microfono. Controlla di averlo consentito nelle impostazioni del browser."
            : "Non riesco a usare la fotocamera. Controlla di averla consentita nelle impostazioni del browser.",
        );
      }
    })();
    return () => {
      cancelled = true;
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  // Cronometro della registrazione.
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setShots((n) => n + 1);
        onFile(
          new File(
            [blob],
            `Foto ${stamp()}${shots ? ` (${shots + 1})` : ""}.jpg`,
            { type: "image/jpeg" },
          ),
        );
      },
      "image/jpeg",
      0.9,
    );
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || mode === "foto") return;
    const mimeType = pickMime(mode);
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      ...BITRATE[mode],
    });
    const chunks: Blob[] = [];
    let size = 0;
    recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      chunks.push(e.data);
      size += e.data.size;
      setBytes(size);
      // Ci fermiamo da soli prima del limite di 25 MB.
      if (size > LIMIT && recorder.state === "recording") recorder.stop();
    };
    recorder.onstop = () => {
      setRecording(false);
      const type = (
        recorder.mimeType ||
        mimeType ||
        (mode === "video" ? "video/webm" : "audio/webm")
      ).split(";")[0];
      const ext = type.includes("mp4")
        ? mode === "audio"
          ? "m4a"
          : "mp4"
        : type.includes("ogg")
          ? "ogg"
          : "webm";
      const blob = new Blob(chunks, { type });
      if (blob.size < 1000) {
        setError("La registrazione è vuota. Riprova.");
        return;
      }
      onFile(
        new File(
          [blob],
          `${mode === "video" ? "Video" : "Audio"} ${stamp()}.${ext}`,
          { type },
        ),
      );
      onClose();
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setSeconds(0);
    setBytes(0);
    setRecording(true);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cattura-titolo"
      onCancel={(e) => {
        if (recording) e.preventDefault();
        else onClose();
      }}
      className="m-auto max-h-[100dvh] w-full max-w-none overscroll-contain bg-card text-ink shadow-[var(--shadow-lift)] backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] sm:w-[min(92vw,34rem)] sm:rounded-[var(--radius-card)]"
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h2 id="cattura-titolo" className="text-xl font-medium">
          {TITLE[mode]}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={recording}
          aria-label="Chiudi"
          className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-paper disabled:opacity-40"
        >
          <IconClose size={20} />
        </button>
      </div>

      <div className="px-5 pb-5">
        {mode !== "audio" ? (
          <div className="relative overflow-hidden rounded-[10px] bg-ink">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[3/4] w-full object-cover sm:aspect-[4/3]"
            />
            {recording ? (
              <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-ink/70 px-3 py-1 text-sm font-medium text-white tabular">
                <span
                  className="animate-status size-2 rounded-full bg-[#ef4444]"
                  aria-hidden="true"
                />
                {fmtTime(seconds)}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="grid place-items-center rounded-[10px] bg-paper py-12">
            <span
              className={cn(
                "grid size-24 place-items-center rounded-full transition-colors",
                recording
                  ? "animate-status bg-amber text-white"
                  : "bg-teal-soft text-teal",
              )}
              aria-hidden="true"
            >
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <rect x="9" y="3.5" width="6" height="11" rx="3" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
              </svg>
            </span>
            <p
              className="mt-4 font-serif text-3xl tabular"
              role="timer"
              aria-live="off"
            >
              {fmtTime(seconds)}
            </p>
          </div>
        )}

        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {error ? <span className="text-danger">{error}</span> : HINT[mode]}
        </p>
        {mode !== "foto" && recording ? (
          <p
            className="mt-1 text-[13px] text-ink-faint tabular"
            aria-live="polite"
          >
            {formatBytes(bytes) || "0 kB"} di {MAX_MEDIA_MB} MB
          </p>
        ) : null}
        {mode === "foto" && shots ? (
          <p
            className="mt-1 text-[13px] font-medium text-teal"
            aria-live="polite"
          >
            {shots === 1
              ? "1 foto aggiunta ai materiali"
              : `${shots} foto aggiunte ai materiali`}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {mode === "foto" ? (
            <>
              <Button variant="secondary" onClick={onClose}>
                {shots ? "Fine" : "Annulla"}
              </Button>
              <Button onClick={snap} disabled={!ready}>
                Scatta
              </Button>
            </>
          ) : recording ? (
            <Button onClick={stopRecording}>Ferma e aggiungi</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>
                Annulla
              </Button>
              <Button onClick={startRecording} disabled={!ready}>
                Inizia a registrare
              </Button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
