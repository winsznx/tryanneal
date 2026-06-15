/** Audit ensemble orchestrator.
 *
 * Stage 1: pre-screen with the injected `prescreen` provider (default
 *   ChainGPT). Early-return if pre-screen finds nothing high/critical or if
 *   quick mode is requested.
 * Stage 2: fan out to all `critics` providers in parallel (default Gemini +
 *   Groq). Drop timeouts/failures from the agreement count.
 * Stage 3: consensus scorer merges everything into LLMFinding[] with verdict
 *   score.
 *
 * The orchestrator is provider-agnostic. Tests inject mock providers via the
 * same `OrchestratorDeps` shape; production wiring injects the real ChainGPT/
 * Gemini/Groq adapters from `audit.ts`.
 */
import { LLMError, type AuditResult, type SlitherCrossRef } from "./types.js";
import { runPreScreen, type PreScreenResult } from "./prescreen.js";
import { runCritics } from "./critic.js";
import { computeConsensus, computeVerdictScore } from "./consensus.js";
import { buildCorpusContext } from "./corpus_stats.js";
import type { LLMProvider } from "./providers/types.js";

export interface OrchestratorDeps {
  /** Required: provider used for the pre-screen pass. */
  prescreen: LLMProvider | null;
  /** Optional: zero or more critic providers fanned out in parallel. */
  critics: LLMProvider[];
}

export interface OrchestratorOptions {
  quick?: boolean;
  /** Always run the full critic cascade, even on a clean pre-screen. For
   *  interactive, single-contract audits where coverage beats cost. */
  thorough?: boolean;
  prescreenTimeoutMs?: number;
  criticTimeoutMs?: number;
  /** Override per-provider USD cost estimate. Keyed by provider id. */
  costEstimateUSD?: Record<string, number>;
}

const DEFAULT_CRITIC_COSTS: Record<string, number> = {
  gemini: 0.04,
  groq: 0.01,
  // legacy / optional providers
  opus: 0.18,
  grok: 0.06,
};

export async function auditWithLLM(
  sourceCode: string,
  slitherCrossRef: SlitherCrossRef[],
  deps: OrchestratorDeps,
  opts: OrchestratorOptions = {},
): Promise<AuditResult> {
  const start = Date.now();
  if (!deps.prescreen) {
    throw new LLMError(
      "No pre-screen provider configured (set CHAINGPT_API_KEY or pass --no-llm)",
      "MISSING_KEY",
      "prescreen",
    );
  }

  // === Stage 1: pre-screen (non-fatal) ===
  // A pre-screen failure (rate limit, oversized contract, provider down) must
  // not abort the audit — the critics read raw source and need no pre-screen.
  let pre: PreScreenResult;
  let preScreenFailed = false;
  try {
    pre = await runPreScreen(sourceCode, deps.prescreen, { timeoutMs: opts.prescreenTimeoutMs });
  } catch (err) {
    if (deps.critics.length === 0) throw err; // no other analyzer to fall back to
    preScreenFailed = true;
    pre = {
      findings: [],
      hasCriticalOrHigh: false,
      costUSD: 0,
      providerId: deps.prescreen.id,
      model: deps.prescreen.model,
      rawResponse: "",
    };
  }

  const modelsUsed: string[] = preScreenFailed ? [] : [pre.providerId];
  const modelsTimedOut: string[] = [];
  let estimatedCostUSD = pre.costUSD;

  // Run the critic cascade when asked to be thorough, or when the pre-screen
  // failed (critics are then the only analysis available). Skip only as a cost
  // optimization: quick mode or a clean pre-screen, with no override.
  const mustRunCritics = opts.thorough === true || preScreenFailed;
  const skipCritic =
    deps.critics.length === 0 || (!mustRunCritics && (opts.quick === true || !pre.hasCriticalOrHigh));
  if (skipCritic) {
    const findings = computeConsensus({
      prescreen: pre.findings,
      critics: {},
      slither: slitherCrossRef,
      modelsResponded: 1,
      prescreenSource: pre.providerId as import("./types.js").ModelSource,
    });
    return {
      verdictScore: computeVerdictScore(findings),
      findings,
      modelsUsed,
      modelsTimedOut,
      timeTakenMs: Date.now() - start,
      estimatedCostUSD,
      prescreenOnly: true,
      analysisIncomplete: false,
      corpusContext: buildCorpusContext(findings),
    };
  }

  // === Stage 2: critic cascade ===
  const costs = { ...DEFAULT_CRITIC_COSTS, ...(opts.costEstimateUSD ?? {}) };
  const result = await runCritics(deps.critics, sourceCode, pre.findings, {
    timeoutMs: opts.criticTimeoutMs,
  });

  for (const id of Object.keys(result.byProvider)) {
    modelsUsed.push(id);
    estimatedCostUSD += costs[id] ?? 0;
  }
  modelsTimedOut.push(...result.timedOut);
  // Surface critic failures only when ANNEAL_DEBUG_CRITICS=1 — a degraded
  // cascade (e.g. one provider 429s) shouldn't pollute normal stderr.
  if (process.env.ANNEAL_DEBUG_CRITICS === "1" && result.failed.length) {
    for (const f of result.failed) {
      console.error(`  [critic failed] ${f.provider}: ${f.error.slice(0, 400)}`);
    }
  }

  const criticsResponded = Object.keys(result.byProvider).length;
  const respondedCount = (preScreenFailed ? 0 : 1) + criticsResponded;

  const findings = computeConsensus({
    prescreen: pre.findings,
    critics: result.byProvider as Record<string, import("./types.js").CriticFinding[]>,
    slither: slitherCrossRef,
    modelsResponded: respondedCount,
    prescreenSource: pre.providerId as import("./types.js").ModelSource,
  });

  return {
    verdictScore: computeVerdictScore(findings),
    findings,
    modelsUsed,
    modelsTimedOut,
    timeTakenMs: Date.now() - start,
    estimatedCostUSD,
    prescreenOnly: criticsResponded === 0,
    analysisIncomplete: respondedCount === 0,
    corpusContext: buildCorpusContext(findings),
  };
}
