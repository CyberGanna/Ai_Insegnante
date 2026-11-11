// Il "cervello": un'interfaccia, due fornitori. Si sceglie con LLM_PROVIDER=anthropic|openai.
import Anthropic from "npm:@anthropic-ai/sdk@1.5.0";

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
}

export interface Llm {
  json<T>(req: JsonRequest): Promise<T>;
}

function anthropicLlm(): Llm {
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
  return {
    async json<T>({ system, user, schema, attachments = [], maxTokens = 4000 }: JsonRequest) {
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

export function getLlm(): Llm {
  return (Deno.env.get("LLM_PROVIDER") ?? "anthropic") === "openai" ? openAiLlm() : anthropicLlm();
}
