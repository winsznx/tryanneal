/** Google Gemini 2.5 Pro adapter.
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
 * Auth: ?key=<GEMINI_API_KEY>
 *
 * Gemini supports response_mime_type=application/json which we use when the
 * caller asks for JSON mode.
 */
import { LLMError } from "../types.js";
import {
  type ChatRequest,
  type ChatResponse,
  type LLMProvider,
  type ProviderConfig,
  DEFAULT_CRITIC_TIMEOUT_MS,
} from "./types.js";

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-pro";

export function createGeminiProvider(config: ProviderConfig): LLMProvider {
  if (!config.apiKey) throw new LLMError("GEMINI_API_KEY missing", "MISSING_KEY", "gemini");
  const model = config.model ?? GEMINI_DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_CRITIC_TIMEOUT_MS;
  const fetchFn = config.fetchFn ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);

  return {
    id: "gemini",
    model,
    defaultTimeoutMs: timeoutMs,
    async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        config.apiKey,
      )}`;
      const body: Record<string, unknown> = {
        system_instruction: { parts: [{ text: req.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: req.userPrompt }] }],
        generationConfig: {
          maxOutputTokens: req.maxOutputTokens ?? 4096,
          // Deterministic decoding — same contract, same verdict (no resampling).
          temperature: 0,
          topP: 1,
          seed: 7,
          ...(req.jsonMode ? { response_mime_type: "application/json" } : {}),
        },
      };

      const res = await fetchFn(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (!res.ok) {
        const t = await safeText(res);
        throw new LLMError(`Gemini HTTP ${res.status}: ${t.slice(0, 300)}`, "API_ERROR", "gemini");
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text =
        json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n").trim() ?? "";
      if (!text) throw new LLMError("Gemini returned empty content", "PARSE_ERROR", "gemini");
      return { text, provider: "gemini", model };
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
