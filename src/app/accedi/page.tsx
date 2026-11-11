"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Logo } from "@/components/app-shell";
import { useAuth } from "@/components/providers";
import { Button, Card } from "@/components/ui";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();

  useEffect(() => {
    if (auth.status === "ready") router.replace("/");
  }, [auth.status, router]);

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) return;
    setState("sending");
    setError(null);
    const { error: err } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (err) {
      setError("Non riesco a inviare il link. Controlla l’indirizzo e riprova tra un minuto.");
      setState("idle");
    } else setState("sent");
  }

  async function google() {
    setError(null);
    const { error: err } = await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (err) setError("L’accesso con Google non è disponibile al momento.");
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[25rem]">
        <Logo className="mb-10" />
        <h1 className="text-[2rem] leading-tight font-medium">Allenati all’orale, ad alta voce</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Carichi gli appunti, l’esaminatore ti interroga e ti dice cosa migliorare. Accedi per ritrovare materiali e
          voti.
        </p>

        <Card className="mt-8 p-6">
          {state === "sent" ? (
            <div role="status">
              <p className="font-serif text-xl">Controlla la posta</p>
              <p className="mt-2 leading-relaxed text-ink-soft">
                Ti abbiamo mandato un link a <strong className="font-medium text-ink">{email}</strong>. Aprilo da questo
                dispositivo per entrare.
              </p>
              <button
                type="button"
                onClick={() => setState("idle")}
                className="mt-4 text-sm font-medium text-teal hover:underline"
              >
                Usa un altro indirizzo
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={sendLink}>
                <label htmlFor={emailId} className="text-[15px] font-medium">
                  Email
                </label>
                <input
                  id={emailId}
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@esempio.it"
                  className="mt-2 block h-11 w-full rounded-[10px] bg-card px-3.5 text-[15px] ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-teal focus:outline-none"
                />
                <Button type="submit" className="mt-4 w-full" disabled={state === "sending" || !isSupabaseConfigured}>
                  {state === "sending" ? "Invio il link…" : "Ricevi il link per entrare"}
                </Button>
              </form>
              <div className="my-5 flex items-center gap-3 text-sm text-ink-faint">
                <span className="h-px flex-1 bg-line" />
                oppure
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="secondary" className="w-full" onClick={google} disabled={!isSupabaseConfigured}>
                Continua con Google
              </Button>
            </>
          )}
          <p aria-live="polite" className="mt-3 text-sm text-danger">
            {error}
          </p>
        </Card>
      </div>
    </main>
  );
}
