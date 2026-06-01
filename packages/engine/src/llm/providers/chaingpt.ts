/** ChainGPT Web3 LLM API adapter.
 *
 * ChainGPT exposes a chat endpoint optimized for web3 and smart-contract
 * context. We use it for the audit pre-screen since the model was tuned on
 * Solidity / on-chain data — preliminary signal is sharper than a generic
 * frontier model at a fraction of the cost.
 *
 * Endpoint: POST https://api.chaingpt.org/chat/stream
 *   Body: { model, question, chatHistory: "off" | "on" }
 *   Auth: Authorization: Bearer <CHAINGPT_API_KEY>
 *
 * The endpoint streams plain-text tokens. We don't consume the stream
 * incrementally — we wait for the full body and then JSON-extract from it.
 * `chatHistory: "off"` keeps each call stateless.
 */
import { LLMError } from "../types.js";
import {
  type ChatRequest,
  type ChatResponse,
  type LLMProvider,
  type ProviderConfig,
  DEFAULT_PRESCREEN_TIMEOUT_MS,
} from "./types.js";

export const CHAINGPT_DEFAULT_MODEL = "general_assistant";
export const CHAINGPT_ENDPOINT = "https://api.chaingpt.org/chat/stream";

export function createChainGPTProvider(config: ProviderConfig): LLMProvider {
  if (!config.apiKey) throw new LLMError("CHAINGPT_API_KEY missing", "MISSING_KEY", "chaingpt");
  const model = config.model ?? CHAINGPT_DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_PRESCREEN_TIMEOUT_MS;
  const fetchFn = config.fetchFn ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);

  return {
    id: "chaingpt",
    model,
    defaultTimeoutMs: timeoutMs,
    async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
      const composed = req.systemPrompt
        ? `${req.systemPrompt.trim()}\n\n=== USER ===\n${req.userPrompt.trim()}`
        : req.userPrompt;

      const res = await fetchFn(CHAINGPT_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          question: composed,
          chatHistory: "off",
        }),
        signal,
      });

      if (!res.ok) {
        const body = await safeText(res);
        throw new LLMError(`ChainGPT HTTP ${res.status}: ${body.slice(0, 300)}`, "API_ERROR", "chaingpt");
      }

      const text = (await safeText(res)).trim();
      if (!text) throw new LLMError("ChainGPT returned empty body", "PARSE_ERROR", "chaingpt");
      return { text, provider: "chaingpt", model };
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
