import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Chiave pubblicabile (sb_publishable_...) o, per progetti vecchi, la chiave anon.
// Mai la chiave service_role: tutto ciò che inizia con NEXT_PUBLIC_ finisce nel browser.
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase non è configurato.");
  if (!client) {
    // App statica: la sessione vive nel browser e il link magico torna con un codice PKCE.
    client = createClient(url, key, {
      auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
    });
  }
  return client;
}

/**
 * Chiama una Edge Function con il token dell’utente.
 * Usa fetch e non functions.invoke perché la voce torna come audio/mpeg.
 */
export async function callFunction(
  name: string,
  body: BodyInit | Record<string, unknown>,
  as: "json" | "blob" = "json",
): Promise<unknown> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Accedi di nuovo per continuare.");

  const isRaw = body instanceof FormData || body instanceof Blob;
  const send = () =>
    fetch(`${url}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: key!,
        ...(isRaw ? {} : { "Content-Type": "application/json" }),
      },
      body: isRaw ? (body as BodyInit) : JSON.stringify(body),
    });
  let res = await send();
  // 546 e 503: la funzione si è avviata male o era sovraccarica. Un secondo tentativo di solito basta.
  if (res.status === 546 || res.status === 503) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await send();
  }
  if (!res.ok) {
    let message =
      res.status === 546
        ? "Il server dell’esaminatore ha superato i suoi limiti. Riprova tra qualche secondo."
        : `Errore del server (${res.status}).`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      /* risposta non JSON */
    }
    throw new Error(message);
  }
  return as === "blob" ? res.blob() : res.json();
}
