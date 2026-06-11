/** Tencent Cloud Hunyuan adapter — OpenAI-compatible chat-completions endpoint.
 *
 * Endpoint: https://api.hunyuan.cloud.tencent.com/v1/chat/completions
 * Auth:     Authorization: Bearer <HUNYUAN_API_KEY>
 *
 * Default model is `hunyuan-turbos-latest` — Tencent's web3-aware tier. Switch
 * via `HUNYUAN_MODEL` env override.
 *
 * This is the Tencent Cloud integration for the Mantle Turing Test DevTools
 * track. Hunyuan runs alongside Gemini and Groq as a Stage-2 critic.
 */
import { LLMError } from "../types.js";
import {
  type ChatRequest,
  type ChatResponse,
  type LLMProvider,
  type ProviderConfig,
  DEFAULT_CRITIC_TIMEOUT_MS,
} from "./types.js";

export const HUNYUAN_DEFAULT_MODEL = "hunyuan-turbos-latest";
export const HUNYUAN_ENDPOINT = "https://api.hunyuan.cloud.tencent.com/v1/chat/completions";

export function createHunyuanProvider(config: ProviderConfig): LLMProvider {
  if (!config.apiKey) throw new LLMError("HUNYUAN_API_KEY missing", "MISSING_KEY", "hunyuan");
  const model = config.model ?? HUNYUAN_DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_CRITIC_TIMEOUT_MS;
  const fetchFn = config.fetchFn ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);

  return {
    id: "hunyuan",
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
        // Hunyuan supports the OpenAI response_format hint for JSON mode.
        ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
      };
      const res = await fetchFn(HUNYUAN_ENDPOINT, {
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
        throw new LLMError(`Hunyuan HTTP ${res.status}: ${t.slice(0, 300)}`, "API_ERROR", "hunyuan");
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new LLMError("Hunyuan returned empty content", "PARSE_ERROR", "hunyuan");
      return { text, provider: "hunyuan", model };
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
