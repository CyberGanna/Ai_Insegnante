"use client";

import Link from "next/link";
import { useProjects, useSessions } from "@/lib/hooks";
import { PROJECT_COPY, type ExamMode } from "@/lib/types";
import { PageFrame, PageHeader } from "./page-header";
import { Projects } from "./sessioni";

const MODES: ExamMode[] = ["interrogazione", "maturita", "colloquio"];

/** Tutti i progetti, divisi per tipo di prova. Sul telefono è la prima voce della barra in basso. */
export function ProjectsPage() {
  const { data: projects = [] } = useProjects();
  const { data: sessions = [] } = useSessions();
  return (
    <PageFrame>
      <PageHeader
        title="Progetti"
        intro="Le tue cartelle per materia e per azienda. Aprine una per vedere le prove fatte e iniziarne un’altra."
      />
      {MODES.map((mode) => (
        <Projects
          key={mode}
          mode={mode}
          title={PROJECT_COPY[mode].section}
          projects={projects.filter((p) => p.mode === mode)}
          sessions={sessions}
          action={
            <Link
              href={`/sessioni/?tipo=${mode}`}
              className="text-sm font-medium text-teal underline-offset-2 hover:underline"
            >
              Tutte le prove
            </Link>
          }
        />
      ))}
    </PageFrame>
  );
}
