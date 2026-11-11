"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useAuth } from "./providers";
import { SideModes } from "./side-modes";
import {
  IconBooks,
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
        <circle cx="16" cy="16" r="15" fill="var(--color-teal)" />
        <path
          d="M9 16h1.6M12.4 12.5v7M15.8 9.5v13M19.2 12v8M22.6 14.5v3"
          stroke="#F7F5F0"
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
          ? "bg-gradient-to-b from-[#33c2b1] to-[#12877e] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_8px_20px_-8px_rgb(45_212_191/0.7)]"
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
          <SideLink
            href="/"
            label="Oggi"
            icon={IconHome}
            active={pathname === "/"}
          />
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
      <aside className="glass-dark sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] flex-col overflow-y-auto rounded-[22px] px-3 py-5 md:flex">
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

      {/* Intestazione (telefono) */}
      <header className="glass-bar sticky top-0 z-30 flex h-14 items-center border-b px-4 pt-[env(safe-area-inset-top)] md:hidden">
        <Logo light />
      </header>

      <main
        id="contenuto"
        className="glass-sheet m-2 min-h-[calc(100dvh-1rem)] min-w-0 rounded-[24px] pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:my-3 md:mr-3 md:ml-0 md:min-h-[calc(100dvh-1.5rem)] md:pb-0"
      >
        {children}
      </main>

      {/* Barra in basso (telefono) */}
      <nav
        aria-label="Principale"
        className="glass-bar fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
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
                      active ? "font-medium text-[#5eead4]" : "text-white/70",
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
