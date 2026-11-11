"use client";

import { SessionRow } from "@/components/session-row";
import { ButtonLink, Card } from "@/components/ui";
import { useSessions } from "@/lib/hooks";
import { PageFrame, PageHeader } from "./page-header";

export function Sessions() {
  const { data: sessions, isLoading } = useSessions();
  return (
    <PageFrame>
      <PageHeader
        title="Le mie sessioni"
        intro="Ogni simulazione con il voto. Apri una sessione per rileggere domande, risposte e consigli."
        action={<ButtonLink href="/">Nuova simulazione</ButtonLink>}
      />
      <div className="mt-8">
        {isLoading ? (
          <p className="text-ink-soft">Caricamento…</p>
        ) : sessions?.length ? (
          <Card className="py-1.5">
            <ul className="divide-y divide-line/70">
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <p className="font-serif text-xl">Ancora nessuna simulazione</p>
            <p className="mt-2 text-ink-soft">
              Carica i tuoi appunti nella dashboard e fai la prima prova: bastano dieci minuti.
            </p>
          </Card>
        )}
      </div>
    </PageFrame>
  );
}
