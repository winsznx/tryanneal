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

  // === Stage 1: pre-screen ===
  const pre: PreScreenResult = await runPreScreen(sourceCode, deps.prescreen, {
    timeoutMs: opts.prescreenTimeoutMs,
  });

  const modelsUsed: string[] = [pre.providerId];
  const modelsTimedOut: string[] = [];
  let estimatedCostUSD = pre.costUSD;

  const skipCritic = opts.quick === true || !pre.hasCriticalOrHigh || deps.critics.length === 0;
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

  const respondedCount = 1 + Object.keys(result.byProvider).length;

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
    prescreenOnly: Object.keys(result.byProvider).length === 0,
    corpusContext: buildCorpusContext(findings),
  };
}
