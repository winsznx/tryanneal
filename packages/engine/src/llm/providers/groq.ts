/** Groq adapter — OpenAI-compatible chat-completions endpoint.
 *
 * Endpoint: https://api.groq.com/openai/v1/chat/completions
 * Auth:     Authorization: Bearer <GROQ_API_KEY>
 *
 * Default model is `llama-3.3-70b-versatile` — Groq runs this on LPUs at very
 * low TTFT, so it's our fast critic. Switch via `GROQ_MODEL` env override.
 *
 * Supports `response_format: { type: "json_object" }` for JSON mode.
 */
import { LLMError } from "../types.js";
import {
  type ChatRequest,
  type ChatResponse,
  type LLMProvider,
  type ProviderConfig,
  DEFAULT_CRITIC_TIMEOUT_MS,
} from "./types.js";

export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export function createGroqProvider(config: ProviderConfig): LLMProvider {
  if (!config.apiKey) throw new LLMError("GROQ_API_KEY missing", "MISSING_KEY", "groq");
  const model = config.model ?? GROQ_DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_CRITIC_TIMEOUT_MS;
  const fetchFn = config.fetchFn ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);

  return {
    id: "groq",
    model,
    defaultTimeoutMs: timeoutMs,
    async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt },
        ],
        max_tokens: req.maxOutputTokens ?? 4096,
        ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
      };
      const res = await fetchFn(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) {
        const t = await safeText(res);
        throw new LLMError(`Groq HTTP ${res.status}: ${t.slice(0, 300)}`, "API_ERROR", "groq");
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new LLMError("Groq returned empty content", "PARSE_ERROR", "groq");
      return { text, provider: "groq", model };
    },
  };
}

async function safeText(res: { text(): Promise<string> }): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
