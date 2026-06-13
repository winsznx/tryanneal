/** Stage 2 — Critic cascade.
 *
 * Fans out to N injected providers (default: Gemini + Groq). Each receives the
 * pre-screen findings and the original source, must either confirm or reject
 * every pre-screen item and may surface new ones the pre-screener missed.
 *
 * All calls fire in parallel via Promise.allSettled with a per-call
 * AbortController. A provider that fails or times out is dropped from the
 * critic set; we continue with whoever responded. Minimum of one provider
 * must respond for the cascade to produce results (orchestrator may decide
 * to fall through to prescreen-only).
 */
import { LLMError, type CriticFinding, type LLMSeverity, type PreScreenFinding } from "./types.js";
import { parseLLMJson, withTimeout } from "./json.js";
import type { LLMProvider, ProviderId } from "./providers/types.js";

export const CRITIC_TIMEOUT_MS = 60_000;

export function buildCriticSystemPrompt(haikuFindings: PreScreenFinding[]): string {
  return (
    "You are a senior smart contract security researcher reviewing a pre-screen audit. " +
    `The pre-screener found these issues: ${JSON.stringify(haikuFindings)}. ` +
    "For each finding, confirm or reject it. Add any NEW vulnerabilities the pre-screener missed. " +
    "Respond with a JSON array (no prose, no markdown fences are required but allowed): " +
    "[{vuln_class, severity, line_start, line_end, description, confidence_pct (0-100), confirmed_by_prescreener (bool)}]."
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

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
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

function parseCriticArray(text: string, providerId: ProviderId): CriticFinding[] {
  try {
    const arr = parseLLMJson<RawCriticFinding[]>(text, String(providerId));
    if (Array.isArray(arr)) return arr.map(normalize);
  } catch {
    // fall through to object-wrapper attempt
  }
  try {
    // Some models wrap with `{findings:[…]}`.
    const obj = parseLLMJson<{ findings?: RawCriticFinding[] }>(text, String(providerId));
    const arr = Array.isArray(obj) ? (obj as RawCriticFinding[]) : obj?.findings ?? [];
    return arr.map(normalize);
  } catch (err) {
    if (process.env.ANNEAL_DEBUG_CRITICS) {
      console.error(`  [parseCriticArray ${providerId} failed] raw response:\n${text.slice(0, 800)}`);
    }
    throw err;
  }
}

/** Run a single critic provider with the standard prompt + timeout. */
export async function callCritic(
  provider: LLMProvider,
  sourceCode: string,
  prescreenFindings: PreScreenFinding[],
  opts: { timeoutMs?: number } = {},
): Promise<CriticFinding[]> {
  const timeoutMs = opts.timeoutMs ?? provider.defaultTimeoutMs ?? CRITIC_TIMEOUT_MS;
  const controller = new AbortController();
  const promise = provider.chat(
    {
      systemPrompt: buildCriticSystemPrompt(prescreenFindings),
      userPrompt: sourceCode,
      maxOutputTokens: 4096,
      jsonMode: true,
    },
    controller.signal,
  );
  const res = await withTimeout(promise, timeoutMs, String(provider.id), controller);
  if (!res.text.trim()) throw new LLMError(`${provider.id} returned empty content`, "PARSE_ERROR", provider.id);
  return parseCriticArray(res.text, provider.id);
}

export interface CriticResult {
  /** Per-provider findings, keyed by provider id (e.g. "gemini", "groq"). */
  byProvider: Record<string, CriticFinding[]>;
  /** Providers that timed out (subset of failed). */
  timedOut: string[];
  /** Providers that errored for any other reason. */
  failed: { provider: string; error: string }[];
}

/** Fan out to every configured critic provider in parallel. */
export async function runCritics(
  providers: LLMProvider[],
  sourceCode: string,
  prescreenFindings: PreScreenFinding[],
  opts: { timeoutMs?: number } = {},
): Promise<CriticResult> {
  const settled = await Promise.allSettled(
    providers.map(async (p) => ({ id: String(p.id), findings: await callCritic(p, sourceCode, prescreenFindings, opts) })),
  );

  const byProvider: Record<string, CriticFinding[]> = {};
  const timedOut: string[] = [];
  const failed: { provider: string; error: string }[] = [];

  settled.forEach((r, i) => {
    const id = String(providers[i]!.id);
    if (r.status === "fulfilled") {
      byProvider[id] = r.value.findings;
      return;
    }
    const err = r.reason;
    if (err instanceof LLMError && err.code === "TIMEOUT") timedOut.push(id);
    else failed.push({ provider: id, error: err instanceof Error ? err.message : String(err) });
  });

  return { byProvider, timedOut, failed };
}
