/** Stage 1 — Pre-screen.
 *
 * Default provider: ChainGPT. The web3-tuned model produces tighter
 * pre-screen output on Solidity than a generic frontier model at lower cost
 * and latency. The contract is the same regardless of which provider gets
 * injected: take Solidity source in, return PreScreenFinding[].
 *
 * Output contract:
 *   - JSON array of findings, one object per vulnerability.
 *   - We ask for JSON-fenced output and parse with markdown-fence + first-array
 *     fallback so models that hedge with prose don't break us.
 *   - Empty array is a valid (clean) result.
 */
import { LLMError, SEVERITY_RANK, type LLMSeverity, type PreScreenFinding } from "./types.js";
import { parseLLMJson, withTimeout } from "./json.js";
import type { LLMProvider } from "./providers/types.js";

export const PRESCREEN_TIMEOUT_MS = 30_000;

export const PRESCREEN_SYSTEM_PROMPT =
  "You are a smart contract security auditor. Analyze this Solidity code. " +
  "For each vulnerability found, respond with a JSON array, enclosed in a ```json fenced block, " +
  "with one object per finding: " +
  "[{vuln_class, severity (critical/high/medium/low/info), line_start, line_end, description, recommendation}]. " +
  "If no vulnerabilities, return []. Be precise — false positives waste developer time. " +
  "Output ONLY the JSON array; no prose before or after.";

export interface PreScreenResult {
  findings: PreScreenFinding[];
  hasCriticalOrHigh: boolean;
  rawResponse: string;
  costUSD: number;
  providerId: string;
  model: string;
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

/** ChainGPT pricing is bundled per-question on most plans; estimate via tokens
 * proxy. Off by a constant factor is fine — we only display this to the user. */
function estimateCost(provider: string, inputText: string): number {
  const inTokens = Math.ceil(inputText.length / 4);
  const outTokens = 600;
  // chaingpt: ~$0.0005/1k in, $0.0015/1k out (rough peg)
  // generic fallback: assume similar tier
  const inRate = provider === "chaingpt" ? 0.5 : 1.0; // per MTok
  const outRate = provider === "chaingpt" ? 1.5 : 5.0;
  return (inTokens / 1_000_000) * inRate + (outTokens / 1_000_000) * outRate;
}

export async function runPreScreen(
  sourceCode: string,
  provider: LLMProvider,
  opts: { timeoutMs?: number } = {},
): Promise<PreScreenResult> {
  const timeoutMs = opts.timeoutMs ?? provider.defaultTimeoutMs ?? PRESCREEN_TIMEOUT_MS;
  const controller = new AbortController();
  const call = provider.chat(
    {
      systemPrompt: PRESCREEN_SYSTEM_PROMPT,
      userPrompt: sourceCode,
      maxOutputTokens: 2048,
      jsonMode: true,
    },
    controller.signal,
  );

  const res = await withTimeout(call, timeoutMs, provider.id, controller);
  const text = res.text.trim();
  if (!text) throw new LLMError(`${provider.id} returned empty content`, "PARSE_ERROR", provider.id);

  let raw: RawFinding[];
  try {
    raw = parseLLMJson<RawFinding[]>(text, provider.id);
  } catch (err) {
    // Model insisted on prose — treat clear "no issues" as empty rather than a hard fail.
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
    costUSD: estimateCost(provider.id, sourceCode),
    providerId: provider.id,
    model: provider.model,
  };
}
