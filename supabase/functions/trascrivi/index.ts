// Riceve l'audio della risposta (multipart, campo "audio") e restituisce { text }.
import { HttpError, json, serve, userClient } from "../_shared/http.ts";
import { transcribe } from "../_shared/speech.ts";

const MAX_BYTES = 15 * 1024 * 1024;

serve(async (req) => {
  await userClient(req);
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) throw new HttpError("Manca l'audio della risposta.");
  if (audio.size > MAX_BYTES) throw new HttpError("Risposta troppo lunga: prova a dividerla in due.");
  return json({ text: (await transcribe(audio)).trim() });
});
