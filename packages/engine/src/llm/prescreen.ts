import { LLMError, SEVERITY_RANK, type LLMSeverity, type PreScreenFinding } from "./types.js";
import { parseLLMJson, withTimeout } from "./json.js";

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
export const PRESCREEN_TIMEOUT_MS = 30_000;

export const PRESCREEN_SYSTEM_PROMPT =
  "You are a smart contract security auditor. Analyze this Solidity code. " +
  "For each vulnerability found, respond with JSON array: " +
  "[{vuln_class, severity (critical/high/medium/low/info), line_start, line_end, description, recommendation}]. " +
  "If no vulnerabilities, return empty array. Be precise — false positives waste developer time.";

export interface AnthropicMessageClient {
  create(req: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: { role: "user" | "assistant"; content: string }[];
  }): Promise<{ content: Array<{ type: string; text?: string }> }>;
}

export interface PreScreenResult {
  findings: PreScreenFinding[];
  hasCriticalOrHigh: boolean;
  rawResponse: string;
  costUSD: number;
}

interface RawFinding {
  vuln_class?: string;
  vulnClass?: string;
  severity?: string;
  line_start?: number;
  lineStart?: number;
  line_end?: number;
  lineEnd?: number;
  description?: string;
  recommendation?: string;
}

function normalizeSeverity(s: string | undefined): LLMSeverity {
  const v = (s ?? "info").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low" || v === "info") return v;
  if (v === "informational") return "info";
  return "info";
}

function normalizeFinding(r: RawFinding): PreScreenFinding {
  return {
    vulnClass: String(r.vuln_class ?? r.vulnClass ?? "unknown"),
    severity: normalizeSeverity(r.severity),
    lineStart: Number(r.line_start ?? r.lineStart ?? 0),
    lineEnd: Number(r.line_end ?? r.lineEnd ?? r.line_start ?? r.lineStart ?? 0),
    description: String(r.description ?? ""),
    recommendation: String(r.recommendation ?? ""),
  };
}

// Haiku 4.5: ~$1/MTok input, ~$5/MTok output (rough est). Assume avg 3k in / 1k out.
function estimateHaikuCost(text: string): number {
  const inTokens = Math.ceil(text.length / 4);
  const outTokens = 600;
  return (inTokens / 1_000_000) * 1 + (outTokens / 1_000_000) * 5;
}

export async function runPreScreen(
  sourceCode: string,
  client: AnthropicMessageClient,
  opts: { timeoutMs?: number; model?: string } = {},
): Promise<PreScreenResult> {
  const timeoutMs = opts.timeoutMs ?? PRESCREEN_TIMEOUT_MS;
  const model = opts.model ?? HAIKU_MODEL;

  const call = client.create({
    model,
    max_tokens: 2048,
    system: PRESCREEN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: sourceCode }],
  });

  const res = await withTimeout(call, timeoutMs, "haiku");

  const text = res.content.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("\n").trim();
  if (!text) throw new LLMError("Haiku returned empty content", "PARSE_ERROR", "haiku");

  // Empty array is a valid response.
  let raw: RawFinding[];
  try {
    raw = parseLLMJson<RawFinding[]>(text, "haiku");
  } catch (err) {
    // If model insisted on prose, treat as no findings rather than failing the whole audit.
    if (/no (vulnerab|issues|findings)/i.test(text)) raw = [];
    else throw err;
  }
  if (!Array.isArray(raw)) raw = [];

  const findings = raw.map(normalizeFinding);
  const hasCriticalOrHigh = findings.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK.high);

  return {
    findings,
    hasCriticalOrHigh,
    rawResponse: text,
    costUSD: estimateHaikuCost(sourceCode),
  };
}
