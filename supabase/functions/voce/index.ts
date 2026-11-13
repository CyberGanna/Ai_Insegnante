// Legge un testo con la voce dell'esaminatore e restituisce l'audio (mp3 o wav).
import { cors, HttpError, serve, userClient } from "../_shared/http.ts";
import { speak, type Voice } from "../_shared/speech.ts";

serve(async (req) => {
  await userClient(req);
  const { text, voice } = (await req.json()) as { text?: string; voice?: Voice };
  if (!text || text.length > 1500) throw new HttpError("Testo mancante o troppo lungo.");
  const res = await speak(text, voice === "severa" ? "severa" : "calma");
  if (!res.ok || !res.body) {
    console.error("TTS", res.status, await res.text());
    throw new Error("Voce non disponibile.");
  }
  return new Response(res.body, { headers: { ...cors, "Content-Type": res.headers.get("Content-Type") ?? "audio/mpeg", "Cache-Control": "no-store" } });
});
