"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./providers";
import {
  IconBooks,
  IconHome,
  IconProgress,
  IconSessions,
  IconSettings,
} from "./icons";
import { cn } from "./ui";

export function Logo({ className }: { className?: string }) {
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
        <circle cx="16" cy="16" r="15" fill="var(--color-teal)" />
        <path
          d="M9 16h1.6M12.4 12.5v7M15.8 9.5v13M19.2 12v8M22.6 14.5v3"
          stroke="#F7F5F0"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-serif text-[1.2rem] leading-none font-semibold tracking-[-0.01em] text-ink">
        Ai Insegnante
      </span>
    </Link>
  );
}

const NAV = [
  { href: "/sessioni/", label: "Le mie sessioni", icon: IconSessions },
  { href: "/materiali/", label: "Materiali", icon: IconBooks },
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const auth = useRequireAuth();
  const pathname = usePathname();

  if (auth.status !== "ready") return <Loading />;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:shadow-[var(--shadow-lift)]"
      >
        Vai al contenuto
      </a>

      {/* Barra laterale (desktop e tablet) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line/80 px-4 py-6 md:flex">
        <Logo className="px-2" />
        <nav aria-label="Principale" className="mt-10">
          <ul className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors",
                      active
                        ? "bg-card font-medium text-ink shadow-[var(--shadow-card)]"
                        : "text-ink-soft hover:bg-paper-deep hover:text-ink",
                    )}
                  >
                    <Icon className={active ? "text-teal" : undefined} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <p className="mt-auto px-3 text-xs leading-relaxed text-ink-faint">
          {auth.store.kind === "local"
            ? "Modalità prova: i dati restano in questo browser."
            : auth.email}
        </p>
      </aside>

      {/* Intestazione (telefono) */}
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-line/80 bg-paper/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <Logo />
      </header>

      <main
        id="contenuto"
        className="min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        {children}
      </main>

      {/* Barra in basso (telefono) */}
      <nav
        aria-label="Principale"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {[{ href: "/", label: "Oggi", icon: IconHome }, ...NAV].map(
            ({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              const short = label === "Le mie sessioni" ? "Sessioni" : label;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-[11px] leading-none",
                      active ? "font-medium text-teal" : "text-ink-soft",
                    )}
                  >
                    <Icon size={22} />
                    {short}
                  </Link>
                </li>
              );
            },
          )}
        </ul>
      </nav>
    </div>
  );
}
