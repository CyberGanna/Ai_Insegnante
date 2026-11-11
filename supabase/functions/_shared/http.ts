// Utilità comuni delle Edge Functions: CORS, risposte JSON, utente autenticato.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const fail = (message: string, status = 400) => json({ error: message }, status);

export class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/**
 * Client Supabase con il token dell'utente: ogni query passa dalla RLS,
 * quindi la funzione vede solo i dati di chi la chiama.
 */
export async function userClient(req: Request): Promise<{ supabase: SupabaseClient; userId: string }> {
  const auth = req.headers.get("Authorization");
  if (!auth) throw new HttpError("Accesso richiesto.", 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, (Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY"))!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new HttpError("Sessione scaduta: accedi di nuovo.", 401);
  return { supabase, userId: data.user.id };
}

/** Avvolge un handler: CORS, solo POST, errori in italiano e in JSON. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return fail("Metodo non consentito.", 405);
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      console.error(e);
      return fail("Errore del fornitore AI. Riprova tra poco.", 502);
    }
  });
}
