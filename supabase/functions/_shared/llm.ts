// Il "cervello": un'interfaccia, più fornitori. Si sceglie con
// LLM_PROVIDER = anthropic | openai | gemini | compatibile.
//   gemini       Google Gemini (ha una versione gratuita): GEMINI_API_KEY, GEMINI_MODEL.
//   compatibile  qualunque servizio con API in stile OpenAI (OpenRouter per Qwen,
//                DeepSeek, Llama…): LLM_BASE_URL, LLM_API_KEY, LLM_MODEL.
// Gli SDK pesanti si caricano solo quando servono: all'avvio la funzione resta leggera
// e non supera il limite di CPU di Supabase (errore 546).
import type Anthropic from "npm:@anthropic-ai/sdk@1.5.0";

export type Attachment =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; base64: string; mediaType: string };

export interface JsonRequest {
  /** Parte stabile del prompt (istruzioni + materiali): viene messa in cache. */
  system: string;
  /** Parte che cambia a ogni chiamata. */
  user: string;
  schema: Record<string, unknown>;
  attachments?: Attachment[];
  maxTokens?: number;
  /** Risposta breve e veloce (domanda orale): poco ragionamento. */
  fast?: boolean;
}

export interface Llm {
  json<T>(req: JsonRequest): Promise<T>;
}

function anthropicLlm(): Llm {
  let client: Anthropic | null = null;
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
  return {
    async json<T>({ system, user, schema, attachments = [], maxTokens = 4000 }: JsonRequest) {
      if (!client) {
        const { default: Sdk } = await import("npm:@anthropic-ai/sdk@1.5.0");
        client = new Sdk({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
      }
      const content: Anthropic.Beta.BetaContentBlockParam[] = [
        ...attachments.map((a): Anthropic.Beta.BetaContentBlockParam =>
          a.kind === "pdf"
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } }
            : {
                type: "image",
                source: {
                  type: "base64",
                  media_type: a.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                  data: a.base64,
                },
              },
        ),
        { type: "text", text: user },
      ];
      const res = await client.beta.messages.create({
        model,
        max_tokens: maxTokens,
        // Se un filtro di sicurezza rifiuta la richiesta, il server riprova su un modello di riserva.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Domande brevi a voce: poco ragionamento, risposta rapida.
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
      });
      if (res.stop_reason === "refusal") throw new Error("Richiesta rifiutata dal modello.");
      const text = res.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") throw new Error("Risposta vuota dal modello.");
      return JSON.parse(text.text) as T;
    },
  };
}

function openAiLlm(): Llm {
  const key = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini";
  return {
    async json<T>({ system, user, schema, attachments = [], maxTokens = 4000 }: JsonRequest) {
      const parts: unknown[] = attachments.map((a) =>
        a.kind === "pdf"
          ? { type: "file", file: { filename: "materiale.pdf", file_data: `data:application/pdf;base64,${a.base64}` } }
          : { type: "image_url", image_url: { url: `data:${a.mediaType};base64,${a.base64}` } },
      );
      parts.push({ type: "text", text: user });
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          max_completion_tokens: maxTokens,
          response_format: { type: "json_schema", json_schema: { name: "risposta", strict: true, schema } },
          messages: [
            { role: "system", content: system },
            { role: "user", content: parts },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return JSON.parse(data.choices[0].message.content) as T;
    },
  };
}

/** Legge il JSON anche se il modello lo avvolge in ```json … ``` o aggiunge una frase. */
function parseLoose<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1)) as T;
    throw new Error("Il modello non ha risposto in JSON.");
  }
}

const schemaHint = (schema: Record<string, unknown>) =>
  `\n\nRispondi solo con un oggetto JSON valido che rispetta questo schema, senza altro testo:\n${JSON.stringify(schema)}`;

/** Google Gemini con la sua API nativa: legge PDF, immagini e audio direttamente. */
function geminiLlm(): Llm {
  const key = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
  return {
    async json<T>({ system, user, schema, attachments = [], maxTokens = 4000, fast = false }: JsonRequest) {
      const parts: unknown[] = attachments.map((a) => ({
        inline_data: { mime_type: a.kind === "pdf" ? "application/pdf" : a.mediaType, data: a.base64 },
      }));
      parts.push({ text: user });
      const call = (thinking: boolean) =>
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": key ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: schema,
              // I modelli che "ragionano" consumano parte dei token: lasciamo margine.
              maxOutputTokens: maxTokens * 2,
              // Per una domanda a voce basta poco ragionamento: risposta in pochi secondi.
              ...(thinking ? { thinkingConfig: { thinkingBudget: 512 } } : {}),
            },
          }),
        });
      let res = await call(fast);
      // Alcuni modelli non accettano il limite al ragionamento: si riprova senza.
      if (fast && res.status === 400) res = await call(false);
      if (res.status === 429) throw new Error("Limite gratuito di Gemini raggiunto: riprova tra poco.");
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("");
      if (!text) throw new Error("Risposta vuota da Gemini.");
      return parseLoose<T>(text);
    },
  };
}

/**
 * Qualunque API in stile OpenAI: OpenRouter (Qwen, DeepSeek, Llama, anche gratis),
 * DeepSeek, Groq, Alibaba DashScope… Non tutti i modelli supportano lo schema JSON
 * rigido: se viene rifiutato, si riprova chiedendo solo JSON con lo schema nel prompt.
 */
function compatibleLlm(): Llm {
  const base = (Deno.env.get("LLM_BASE_URL") ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const key = Deno.env.get("LLM_API_KEY");
  const model = Deno.env.get("LLM_MODEL");
  return {
    async json<T>({ system, user, schema, attachments = [], maxTokens = 4000 }: JsonRequest) {
      if (!model) throw new Error("Manca LLM_MODEL (es. qwen/qwen3-vl-235b-a22b-instruct).");
      const parts: unknown[] = attachments.map((a) =>
        a.kind === "pdf"
          ? { type: "file", file: { filename: "materiale.pdf", file_data: `data:application/pdf;base64,${a.base64}` } }
          : { type: "image_url", image_url: { url: `data:${a.mediaType};base64,${a.base64}` } },
      );
      parts.push({ type: "text", text: user });
      const call = (strict: boolean) =>
        fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "X-Title": "Ai Insegnante",
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            response_format: strict
              ? { type: "json_schema", json_schema: { name: "risposta", strict: true, schema } }
              : { type: "json_object" },
            messages: [
              { role: "system", content: system + schemaHint(schema) },
              { role: "user", content: parts },
            ],
          }),
        });
      let res = await call(true);
      if (res.status === 400) res = await call(false);
      if (res.status === 429) throw new Error("Limite del modello gratuito raggiunto: riprova tra poco.");
      if (!res.ok) throw new Error(`Modello ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("Risposta vuota dal modello.");
      return parseLoose<T>(typeof text === "string" ? text : JSON.stringify(text));
    },
  };
}

export function getLlm(): Llm {
  switch (Deno.env.get("LLM_PROVIDER") ?? "anthropic") {
    case "openai":
      return openAiLlm();
    case "gemini":
      return geminiLlm();
    case "compatibile":
    case "compatible":
      return compatibleLlm();
    default:
      return anthropicLlm();
  }
}
