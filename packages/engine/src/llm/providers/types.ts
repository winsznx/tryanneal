/** Unified LLM provider adapter surface.
 *
 * Every concrete provider implements `chat()`. Callers (prescreen, critic) do
 * not know whether the response came from ChainGPT, Gemini, or Groq — they
 * just hold an `LLMProvider` and ask for a completion. This is the only
 * abstraction the orchestrator depends on.
 */
import type { FetchLike } from "../json.js";

export type ProviderId = "chaingpt" | "gemini" | "groq" | "anthropic" | string;

export interface ChatRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Output token cap. Adapters translate to their provider's field name. */
  maxOutputTokens?: number;
  /** Optional JSON-mode hint; adapters use the provider-native equivalent when available. */
  jsonMode?: boolean;
}

export interface ChatResponse {
  text: string;
  provider: ProviderId;
  model: string;
}

export interface LLMProvider {
  id: ProviderId;
  model: string;
  /** Pre-AbortController-applied timeout for the underlying request, in ms. */
  defaultTimeoutMs: number;
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
}

export interface ProviderConfig {
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: FetchLike;
}

export const DEFAULT_PRESCREEN_TIMEOUT_MS = 30_000;
export const DEFAULT_CRITIC_TIMEOUT_MS = 60_000;
