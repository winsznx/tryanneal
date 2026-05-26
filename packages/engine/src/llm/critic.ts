import {
  LLMError,
  type CriticFinding,
  type LLMSeverity,
  type PreScreenFinding,
} from "./types.js";
import { parseLLMJson, withTimeout } from "./json.js";
import { type AnthropicMessageClient } from "./prescreen.js";

export const OPUS_MODEL = "claude-opus-4-7-20250219";
export const GEMINI_MODEL = "gemini-2.5-pro";
export const GROK_MODEL = "grok-4.3";
export const CRITIC_TIMEOUT_MS = 60_000;

export type CriticModelName = "opus" | "gemini" | "grok";

export function buildCriticSystemPrompt(haikuFindings: PreScreenFinding[]): string {
  return (
    "You are a senior smart contract security researcher reviewing a pre-screen audit. " +
    `The pre-screener found these issues: ${JSON.stringify(haikuFindings)}. ` +
    "For each finding, confirm or reject it. Add any NEW vulnerabilities the pre-screener missed. " +
    "Respond with JSON: [{vuln_class, severity, line_start, line_end, description, confidence_pct (0-100), confirmed_by_prescreener (bool)}]"
  );
}

interface RawCriticFinding {
  vuln_class?: string;
  vulnClass?: string;
  severity?: string;
  line_start?: number;
  lineStart?: number;
  line_end?: number;
  lineEnd?: number;
  description?: string;
  recommendation?: string;
  confidence_pct?: number;
  confidencePct?: number;
  confirmed_by_prescreener?: boolean;
  confirmedByPrescreener?: boolean;
}

function normSeverity(s: string | undefined): LLMSeverity {
  const v = (s ?? "info").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low" || v === "info") return v;
  if (v === "informational") return "info";
  return "info";
}

function normalize(r: RawCriticFinding): CriticFinding {
  return {
    vulnClass: String(r.vuln_class ?? r.vulnClass ?? "unknown"),
    severity: normSeverity(r.severity),
    lineStart: Number(r.line_start ?? r.lineStart ?? 0),
    lineEnd: Number(r.line_end ?? r.lineEnd ?? r.line_start ?? r.lineStart ?? 0),
    description: String(r.description ?? ""),
    recommendation: String(r.recommendation ?? ""),
    confidencePct: clamp(Number(r.confidence_pct ?? r.confidencePct ?? 50), 0, 100),
    confirmedByPrescreener: Boolean(r.confirmed_by_prescreener ?? r.confirmedByPrescreener ?? false),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function parseCriticArray(text: string, model: string): CriticFinding[] {
  const raw = parseLLMJson<RawCriticFinding[]>(text, model);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalize);
}

// === Opus (Anthropic SDK) ===
export async function callOpusCritic(
  client: AnthropicMessageClient,
  sourceCode: string,
  haikuFindings: PreScreenFinding[],
  opts: { timeoutMs?: number; model?: string } = {},
): Promise<CriticFinding[]> {
  const model = opts.model ?? OPUS_MODEL;
  const res = await withTimeout(
    client.create({
      model,
      max_tokens: 4096,
      system: buildCriticSystemPrompt(haikuFindings),
      messages: [{ role: "user", content: sourceCode }],
    }),
    opts.timeoutMs ?? CRITIC_TIMEOUT_MS,
    "opus",
  );
  const text = res.content.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("\n").trim();
  if (!text) throw new LLMError("Opus returned empty content", "PARSE_ERROR", "opus");
  return parseCriticArray(text, "opus");
}

// === Gemini 2.5 Pro (REST) ===
export interface FetchLike {
  (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }): Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
    json(): Promise<unknown>;
  }>;
}

export async function callGeminiCritic(
  fetchFn: FetchLike,
  apiKey: string,
  sourceCode: string,
  haikuFindings: PreScreenFinding[],
  opts: { timeoutMs?: number; model?: string } = {},
): Promise<CriticFinding[]> {
  if (!apiKey) throw new LLMError("GEMINI_API_KEY not set", "MISSING_KEY", "gemini");
  const model = opts.model ?? GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const body = {
    system_instruction: { parts: [{ text: buildCriticSystemPrompt(haikuFindings) }] },
    contents: [{ role: "user", parts: [{ text: sourceCode }] }],
    generationConfig: { response_mime_type: "application/json", max_output_tokens: 4096 },
  };

  const res = await withTimeout(
    fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    }),
    opts.timeoutMs ?? CRITIC_TIMEOUT_MS,
    "gemini",
    controller,
  );
  if (!res.ok) throw new LLMError(`Gemini HTTP ${res.status}: ${await res.text()}`, "API_ERROR", "gemini");
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n").trim() ?? "";
  if (!text) throw new LLMError("Gemini returned empty content", "PARSE_ERROR", "gemini");
  return parseCriticArray(text, "gemini");
}

// === Grok (xAI, OpenAI-compatible) ===
export async function callGrokCritic(
  fetchFn: FetchLike,
  apiKey: string,
  sourceCode: string,
  haikuFindings: PreScreenFinding[],
  opts: { timeoutMs?: number; model?: string } = {},
): Promise<CriticFinding[]> {
  if (!apiKey) throw new LLMError("XAI_API_KEY not set", "MISSING_KEY", "grok");
  const model = opts.model ?? GROK_MODEL;
  const controller = new AbortController();
  const body = {
    model,
    messages: [
      { role: "system", content: buildCriticSystemPrompt(haikuFindings) },
      { role: "user", content: sourceCode },
    ],
    response_format: { type: "json_object" },
    max_tokens: 4096,
  };
  const res = await withTimeout(
    fetchFn("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    }),
    opts.timeoutMs ?? CRITIC_TIMEOUT_MS,
    "grok",
    controller,
  );
  if (!res.ok) throw new LLMError(`Grok HTTP ${res.status}: ${await res.text()}`, "API_ERROR", "grok");
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new LLMError("Grok returned empty content", "PARSE_ERROR", "grok");
  // Grok may return either {findings:[…]} or [...] directly.
  try {
    return parseCriticArray(text, "grok");
  } catch {
    const obj = parseLLMJson<{ findings?: RawCriticFinding[] }>(text, "grok");
    const arr = Array.isArray(obj) ? (obj as RawCriticFinding[]) : obj?.findings ?? [];
    return arr.map(normalize);
  }
}

export interface CriticResult {
  byModel: Partial<Record<CriticModelName, CriticFinding[]>>;
  timedOut: CriticModelName[];
  failed: { model: CriticModelName; error: string }[];
}

export interface CriticRunners {
  opus?: () => Promise<CriticFinding[]>;
  gemini?: () => Promise<CriticFinding[]>;
  grok?: () => Promise<CriticFinding[]>;
}

/** Run all configured critics in parallel; return per-model results. */
export async function runCritics(runners: CriticRunners): Promise<CriticResult> {
  const entries = (Object.entries(runners) as [CriticModelName, (() => Promise<CriticFinding[]>) | undefined][])
    .filter((e): e is [CriticModelName, () => Promise<CriticFinding[]>] => typeof e[1] === "function");

  const settled = await Promise.allSettled(entries.map(async ([name, fn]) => ({ name, findings: await fn() })));

  const byModel: Partial<Record<CriticModelName, CriticFinding[]>> = {};
  const timedOut: CriticModelName[] = [];
  const failed: { model: CriticModelName; error: string }[] = [];

  settled.forEach((r, i) => {
    const name = entries[i]![0];
    if (r.status === "fulfilled") {
      byModel[name] = r.value.findings;
    } else {
      const err = r.reason;
      if (err instanceof LLMError && err.code === "TIMEOUT") timedOut.push(name);
      else failed.push({ model: name, error: err instanceof Error ? err.message : String(err) });
    }
  });

  return { byModel, timedOut, failed };
}
