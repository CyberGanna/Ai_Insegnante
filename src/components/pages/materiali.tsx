"use client";

import { mutate } from "swr";
import { DropZone } from "@/components/dashboard/drop-zone";
import { MaterialCard } from "@/components/material-card";
import { useStore } from "@/components/providers";
import { keys, useMaterials } from "@/lib/hooks";
import { readMaterial } from "@/lib/materials";
import { PageFrame, PageHeader } from "./page-header";

export function Materials() {
  const store = useStore();
  const { data: materials = [], isLoading } = useMaterials();
  return (
    <PageFrame>
      <PageHeader
        title="Materiali"
        intro="Appunti, libri, foto delle pagine e link. L’esaminatore prepara le domande solo su quello che carichi qui."
      />
      <div className="mt-8">
        <DropZone />
      </div>
      {isLoading ? (
        <p className="mt-6 text-ink-soft">Caricamento…</p>
      ) : materials.length ? (
        <ul
          className="mt-6 grid gap-2.5 sm:grid-cols-2"
          aria-label="Materiali caricati"
        >
          {materials.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              onRetry={() => void readMaterial(store, m, null)}
              onRemove={async () => {
                if (!window.confirm(`Rimuovere “${m.name}” dai materiali?`))
                  return;
                await store.deleteMaterial(m.id);
                await mutate(keys.materials);
              }}
            />
          ))}
        </ul>
      ) : null}
    </PageFrame>
  );
}
