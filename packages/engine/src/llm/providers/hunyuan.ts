/** Tencent Cloud Hunyuan adapter — OpenAI-compatible chat-completions endpoint.
 *
 * Endpoint: https://tokenhub-intl.tencentcloudmaas.com/v1/chat/completions
 *   (international TokenHub gateway; the China-region endpoint is
 *    https://api.hunyuan.cloud.tencent.com/v1 — pick whichever the API key
 *    was issued for. Override via `baseURL` in ProviderConfig or
 *    `HUNYUAN_BASE_URL` env var.)
 *
 * Auth:  Authorization: Bearer <HUNYUAN_API_KEY>
 * Model: `hy-mt2-plus` by default — Hunyuan-MT2-Plus, the int'l TokenHub
 *        gateway's default tier. Switch via `HUNYUAN_MODEL` env override.
 *
 * This is the Tencent Cloud integration for the Mantle Turing Test DevTools
 * track. Hunyuan is NOT an audit critic — its Hunyuan-MT model powers the
 * presentation layer: multilingual report translation AND the per-finding
 * remediation writer (the plain-English "how to fix" for findings the static
 * analyzers report without one). Used for what it's actually good at.
 */
import { LLMError } from "../types.js";
import {
  type ChatRequest,
  type ChatResponse,
  type LLMProvider,
  type ProviderConfig,
  DEFAULT_CRITIC_TIMEOUT_MS,
} from "./types.js";

export const HUNYUAN_DEFAULT_MODEL = "hy-mt2-plus";
export const HUNYUAN_DEFAULT_BASE_URL = "https://tokenhub-intl.tencentcloudmaas.com/v1";

/** Backwards-compat: keep the previous `HUNYUAN_ENDPOINT` export pointing at
 *  the canonical chat-completions path for the default base URL. */
export const HUNYUAN_ENDPOINT = `${HUNYUAN_DEFAULT_BASE_URL}/chat/completions`;

export interface HunyuanProviderConfig extends ProviderConfig {
  /** Override the OpenAI-compatible base URL (no trailing slash). */
  baseURL?: string;
}

export function createHunyuanProvider(config: HunyuanProviderConfig): LLMProvider {
  if (!config.apiKey) throw new LLMError("HUNYUAN_API_KEY missing", "MISSING_KEY", "hunyuan");
  const model = config.model ?? HUNYUAN_DEFAULT_MODEL;
  const baseURL = (config.baseURL ?? HUNYUAN_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const endpoint = `${baseURL}/chat/completions`;
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
        // Deterministic decoding so translation + remediation are reproducible.
        temperature: 0,
        // Hunyuan supports the OpenAI response_format hint for JSON mode.
        ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
      };
      const res = await fetchFn(endpoint, {
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
