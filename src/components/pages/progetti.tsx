"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconBriefcase, IconChat, IconLaurel } from "../icons";
import { useProjects, useSessions } from "@/lib/hooks";
import { PROJECT_COPY, type ExamMode } from "@/lib/types";
import { PageFrame } from "./page-header";
import { Projects } from "./sessioni";

const FOLDERS = [
  { mode: "interrogazione", icon: IconChat },
  { mode: "maturita", icon: IconLaurel },
  { mode: "colloquio", icon: IconBriefcase },
] as const;

const isMode = (v: string | null): v is ExamMode =>
  FOLDERS.some((f) => f.mode === v);

/**
 * Progetti: tre cartelle (Verifiche, Esami di maturità, Colloqui).
 * Aprendone una (?tipo=) si vedono i progetti che contiene.
 */
export function ProjectsPage() {
  const tipo = useSearchParams().get("tipo");
  const { data: projects = [] } = useProjects();
  const { data: sessions = [] } = useSessions();

  if (isMode(tipo)) {
    const own = projects.filter((p) => p.mode === tipo);
    return (
      <PageFrame>
        <Link
          href="/progetti/"
          className="-ml-1 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[15px] font-medium text-teal hover:bg-white/50"
        >
          <IconArrowLeft />
          Progetti
        </Link>
        <h1 className="mt-2 text-[2rem] leading-tight font-medium sm:text-[2.25rem]">
          {PROJECT_COPY[tipo].section}
        </h1>
        <Projects
          bare
          mode={tipo}
          title={PROJECT_COPY[tipo].section}
          projects={own}
          sessions={sessions}
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <h1 className="text-[2rem] leading-tight font-medium sm:text-[2.25rem]">
        Progetti
      </h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {FOLDERS.map(({ mode, icon: Icon }) => {
          const count = projects.filter((p) => p.mode === mode).length;
          return (
            <li key={mode}>
              <Link
                href={`/progetti/?tipo=${mode}`}
                className="glass-bubble flex items-center gap-4 p-5 transition-shadow hover:shadow-[var(--shadow-lift)] sm:flex-col sm:items-start sm:p-6"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#33c2b1] to-[#0f766e] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] [&_svg]:size-6">
                  <Icon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-xl leading-snug font-medium text-ink">
                    {PROJECT_COPY[mode].section}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-soft">
                    {count === 1 ? "1 progetto" : `${count} progetti`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </PageFrame>
  );
}
