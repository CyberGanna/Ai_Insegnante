// Trascrizione e voce: STT_PROVIDER=openai|gemini, TTS_PROVIDER=elevenlabs|openai.

// Gemini ascolta l'audio direttamente: trascrizione gratuita (con limiti) senza OpenAI.
async function transcribeWithGemini(audio: File): Promise<string> {
  const bytes = new Uint8Array(await audio.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": Deno.env.get("GEMINI_API_KEY") ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: (audio.type || "audio/webm").split(";")[0], data: btoa(binary) } },
              {
                text: "Trascrivi parola per parola questo audio in italiano. Rispondi solo con la trascrizione, senza commenti.",
              },
            ],
          },
        ],
      }),
    },
  );
  if (res.status === 429) throw new Error("Limite gratuito di Gemini raggiunto: riprova tra poco.");
  if (!res.ok) throw new Error(`Trascrizione ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
}

export async function transcribe(audio: File): Promise<string> {
  const provider =
    Deno.env.get("STT_PROVIDER") ?? (Deno.env.get("LLM_PROVIDER") === "gemini" ? "gemini" : "openai");
  if (provider === "gemini") return transcribeWithGemini(audio);
  if (provider !== "openai") throw new Error(`STT_PROVIDER non supportato: ${provider}`);
  const form = new FormData();
  form.append("file", audio, audio.name || "risposta.webm");
  form.append("model", Deno.env.get("OPENAI_STT_MODEL") ?? "gpt-4o-mini-transcribe");
  form.append("language", "it");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Trascrizione ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.text as string) ?? "";
}

export type Voice = "calma" | "severa";

export async function speak(text: string, voice: Voice): Promise<Response> {
  const provider = Deno.env.get("TTS_PROVIDER") ?? "elevenlabs";
  if (provider === "elevenlabs") {
    const voiceId =
      voice === "severa" ? Deno.env.get("ELEVENLABS_VOICE_SEVERA") : Deno.env.get("ELEVENLABS_VOICE_CALMA");
    if (!voiceId) throw new Error("Manca l'ID della voce ElevenLabs.");
    return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY")!, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: Deno.env.get("ELEVENLABS_MODEL") ?? "eleven_multilingual_v2",
        language_code: "it",
        voice_settings: voice === "severa" ? { stability: 0.7, style: 0.2 } : { stability: 0.5, style: 0.35 },
      }),
    });
  }
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TTS_MODEL") ?? "gpt-4o-mini-tts",
      voice: voice === "severa" ? "onyx" : "sage",
      input: text,
      instructions:
        voice === "severa"
          ? "Parla in italiano come un professore esigente: tono asciutto, ritmo deciso, nessuna esitazione."
          : "Parla in italiano come un insegnante paziente e incoraggiante: tono caldo, ritmo tranquillo.",
      response_format: "mp3",
    }),
  });
}
