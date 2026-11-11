"use client";

import { IconCheck, IconFile, IconImage, IconLink, IconTrash, IconVideo, IconWave } from "@/components/icons";
import { cn, formatBytes } from "@/components/ui";
import type { Material } from "@/lib/types";

const KIND_LABEL: Record<Material["kind"], string> = {
  pdf: "PDF",
  docx: "Word",
  image: "Foto",
  audio: "Audio",
  video: "Video",
  url: "Link",
  text: "Testo",
};

const KIND_ICON: Partial<Record<Material["kind"], typeof IconFile>> = {
  image: IconImage,
  url: IconLink,
  audio: IconWave,
  video: IconVideo,
};

export function MaterialStatus({ material, onRetry }: { material: Material; onRetry?: () => void }) {
  if (material.status === "reading")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft">
        <span className="animate-status size-1.5 rounded-full bg-amber" aria-hidden="true" />
        {material.kind === "audio" || material.kind === "video" ? "In trascrizione" : "In lettura"}
      </span>
    );
  if (material.status === "ready")
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-teal">
        <IconCheck size={15} />
        Pronto
      </span>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 text-[13px] text-danger">
      Non letto
      {onRetry ? (
        <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
          Riprova
        </button>
      ) : null}
    </span>
  );
}

export function MaterialCard({
  material,
  selected,
  onToggle,
  onRemove,
  onRetry,
}: {
  material: Material;
  selected?: boolean;
  onToggle?: (checked: boolean) => void;
  onRemove?: () => void;
  onRetry?: () => void;
}) {
  const Icon = KIND_ICON[material.kind] ?? IconFile;
  const selectable = onToggle && material.status === "ready";
  const meta = [KIND_LABEL[material.kind], formatBytes(material.sizeBytes)].filter(Boolean).join(", ");

  return (
    <li
      className={cn(
        "relative flex min-w-0 items-center gap-3 rounded-[var(--radius-card)] bg-card p-3 pr-2 shadow-[var(--shadow-card)] ring-1 transition-shadow",
        selectable && selected ? "ring-teal/60" : "ring-transparent",
      )}
    >
      <div
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-lg",
          material.status === "error" ? "bg-[#fdecea] text-danger" : "bg-paper text-ink-soft",
        )}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        {selectable ? (
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggle(e.target.checked)}
              className="size-4 shrink-0 accent-[var(--color-teal)]"
              aria-describedby={`m-${material.id}-meta`}
            />
            <span className="truncate text-[15px] font-medium text-ink" title={material.name}>
              {material.name}
            </span>
          </label>
        ) : (
          <p className="truncate text-[15px] font-medium text-ink" title={material.name}>
            {material.name}
          </p>
        )}
        <div id={`m-${material.id}-meta`} className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-[13px] text-ink-faint">{meta}</span>
          <MaterialStatus material={material} onRetry={onRetry} />
        </div>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Rimuovi ${material.name}`}
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-paper hover:text-danger"
        >
          <IconTrash size={18} />
        </button>
      ) : null}
    </li>
  );
}
