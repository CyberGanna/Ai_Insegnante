"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAuth } from "./providers";
import { SideModes } from "./side-modes";
import {
  IconBooks,
  IconFolder,
  IconHome,
  IconProgress,
  IconSessions,
  IconSettings,
} from "./icons";
import { cn } from "./ui";

export function Logo({
  className,
  light,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-md",
        className,
      )}
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle
          cx="16"
          cy="16"
          r="15"
          fill={light ? "#ffffff" : "var(--color-teal)"}
        />
        <path
          d="M9 16h1.6M12.4 12.5v7M15.8 9.5v13M19.2 12v8M22.6 14.5v3"
          stroke={light ? "#111111" : "#ffffff"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span
        className={cn(
          "font-serif text-[1.2rem] leading-none font-semibold tracking-[-0.01em]",
          light ? "text-white" : "text-ink",
        )}
      >
        Ai Insegnante
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/progetti/", label: "Progetti", icon: IconFolder },
  { href: "/sessioni/", label: "Le mie sessioni", icon: IconSessions },
  { href: "/materiali/", label: "Materiali", icon: IconBooks },
  { href: "/progressi/", label: "Progressi", icon: IconProgress },
  { href: "/impostazioni/", label: "Impostazioni", icon: IconSettings },
];

/* Telefono: Progetti, Sessioni, "+" (nuova prova, cioè la dashboard), Progressi, Impostazioni. */
const MOBILE_NAV = [
  { href: "/progetti/", label: "Progetti", icon: IconFolder },
  { href: "/sessioni/", label: "Sessioni", icon: IconSessions },
  { href: "/", label: "Nuova", icon: IconHome },
  { href: "/progressi/", label: "Progressi", icon: IconProgress },
  { href: "/impostazioni/", label: "Impostazioni", icon: IconSettings },
];

const isActive = (pathname: string, href: string) =>
  href === "/"
    ? pathname === "/"
    : pathname.startsWith(href.replace(/\/$/, ""));

function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/accedi/");
  }, [auth.status, router]);
  return auth;
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy="true">
      <p className="text-sm text-ink-soft">Caricamento…</p>
    </div>
  );
}

/** Pagine a schermo pieno (esame): solo il controllo di accesso, niente menu. */
export function FocusShell({ children }: { children: React.ReactNode }) {
  const auth = useRequireAuth();
  return auth.status === "ready" ? <>{children}</> : <Loading />;
}

function SideLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof IconHome;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
        active
          ? "bg-white font-medium text-black shadow-[0_8px_20px_-10px_rgb(0_0_0/0.6)]"
          : "text-white/75 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon />
      {label}
    </Link>
  );
}

/** La voce attiva dipende anche da ?tipo=, quindi serve useSearchParams (dentro Suspense). */
function SideNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const tipo = params.get("tipo");
  const onSessions = isActive(pathname, "/sessioni/");
  return (
    <nav aria-label="Principale" className="mt-8 space-y-6">
      <ul className="space-y-1">
        <li>
          {/* Come il "+" del telefono: avvia una nuova interrogazione o verifica. */}
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className={cn(
              "mb-2 flex h-12 items-center gap-3 rounded-2xl bg-white pr-4 pl-1.5 text-[15px] font-semibold text-black shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)] transition-colors hover:bg-white/90",
              pathname === "/" && "ring-2 ring-white/60",
            )}
          >
            <span
              className="grid size-9 place-items-center rounded-xl bg-white/20 text-2xl leading-none font-normal"
              aria-hidden="true"
            >
              +
            </span>
            Nuova prova
          </Link>
        </li>
        {NAV.map(({ href, label, icon }) => (
          <li key={href}>
            <SideLink
              href={href}
              label={label}
              icon={icon}
              active={
                href === "/sessioni/"
                  ? onSessions && !tipo
                  : href === "/progetti/"
                    ? isActive(pathname, href) && !params.get("cartella")
                    : isActive(pathname, href)
              }
            />
          </li>
        ))}
      </ul>
      <SideModes
        tipo={tipo}
        progetto={params.get("progetto")}
        onSessions={onSessions}
        cartella={
          isActive(pathname, "/progetti/") ? params.get("cartella") : null
        }
      />
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useRequireAuth();
  const pathname = usePathname();

  if (auth.status !== "ready") return <Loading />;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17.5rem_1fr]">
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:shadow-[var(--shadow-lift)]"
      >
        Vai al contenuto
      </a>

      {/* Barra laterale (desktop e tablet): vetro scuro sospeso */}
      <aside className="glass-dark sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-[22px] [scrollbar-width:thin] [scrollbar-color:rgb(255_255_255/0.25)_transparent] px-3 py-5 md:flex">
        <Logo className="px-2" light />
        <Suspense fallback={null}>
          <SideNav />
        </Suspense>
        <p className="mt-auto px-3 pt-6 text-xs leading-relaxed text-white/60">
          {auth.store.kind === "local"
            ? "Modalità prova: i dati restano in questo browser."
            : auth.email}
        </p>
      </aside>

      <main
        id="contenuto"
        className="glass-sheet m-2 mt-[calc(0.5rem+env(safe-area-inset-top))] min-h-[calc(100dvh-1rem)] min-w-0 rounded-[24px] pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:my-3 md:mr-3 md:ml-0 md:min-h-[calc(100dvh-1.5rem)] md:pb-0"
      >
        <Suspense fallback={children}>
          <PageEnter>{children}</PageEnter>
        </Suspense>
      </main>

      {/* Barra in basso (telefono) */}
      <nav
        aria-label="Principale"
        className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5 items-center">
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            if (href === "/")
              return (
                <li key={href} className="grid place-items-center">
                  <Link
                    href="/"
                    aria-label="Nuova prova"
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "-mt-5 grid size-14 place-items-center rounded-full bg-white text-black shadow-[0_10px_24px_-8px_rgb(0_0_0/0.7)] ring-4 ring-black/60 transition-transform active:scale-95",
                      active && "ring-white/30",
                    )}
                  >
                    <svg
                      width="26"
                      height="26"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </Link>
                </li>
              );
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] leading-none",
                    active ? "font-medium text-white" : "text-white/70",
                  )}
                >
                  <Icon size={22} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Rimonta il contenuto a ogni cambio di pagina o di ?tipo=, ?progetto=…, così parte la dissolvenza. */
function PageEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <div key={`${pathname}?${search}`} className="page-enter">
      {children}
    </div>
  );
}
