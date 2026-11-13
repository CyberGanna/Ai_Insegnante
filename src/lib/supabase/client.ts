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
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: key!,
      ...(isRaw ? {} : { "Content-Type": "application/json" }),
    },
    body: isRaw ? (body as BodyInit) : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Errore del server (${res.status}).`;
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
