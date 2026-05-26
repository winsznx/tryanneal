import {
  LLMError,
  type AuditResult,
  type SlitherCrossRef,
} from "./types.js";
import { runPreScreen, type AnthropicMessageClient, type PreScreenResult } from "./prescreen.js";
import {
  callOpusCritic,
  callGeminiCritic,
  callGrokCritic,
  runCritics,
  type CriticModelName,
  type FetchLike,
} from "./critic.js";
import { computeConsensus, computeVerdictScore } from "./consensus.js";

export interface OrchestratorDeps {
  anthropic: AnthropicMessageClient | null;
  fetchFn: FetchLike;
  geminiKey: string | null;
  xaiKey: string | null;
}

export interface OrchestratorOptions {
  quick?: boolean;
  prescreenTimeoutMs?: number;
  criticTimeoutMs?: number;
  costEstimateUSD?: { opus?: number; gemini?: number; grok?: number };
}

const DEFAULT_COSTS = { opus: 0.18, gemini: 0.04, grok: 0.06 };

export async function auditWithLLM(
  sourceCode: string,
  slitherCrossRef: SlitherCrossRef[],
  deps: OrchestratorDeps,
  opts: OrchestratorOptions = {},
): Promise<AuditResult> {
  const start = Date.now();
  if (!deps.anthropic) {
    throw new LLMError("ANTHROPIC_API_KEY not set (required for Haiku pre-screen)", "MISSING_KEY", "haiku");
  }

  // === Stage 1: Pre-screen ===
  const pre: PreScreenResult = await runPreScreen(sourceCode, deps.anthropic, {
    timeoutMs: opts.prescreenTimeoutMs,
  });

  const modelsUsed: string[] = ["haiku"];
  const modelsTimedOut: string[] = [];
  let estimatedCostUSD = pre.costUSD;

  // Early return if quick mode or nothing high/critical to escalate
  const skipCritic = opts.quick === true || !pre.hasCriticalOrHigh;
  if (skipCritic) {
    const findings = computeConsensus({
      prescreen: pre.findings,
      critics: {},
      slither: slitherCrossRef,
      modelsResponded: 1,
    });
    return {
      verdictScore: computeVerdictScore(findings),
      findings,
      modelsUsed,
      modelsTimedOut,
      timeTakenMs: Date.now() - start,
      estimatedCostUSD,
      prescreenOnly: true,
    };
  }

  // === Stage 2: Critic cascade ===
  const costs = { ...DEFAULT_COSTS, ...(opts.costEstimateUSD ?? {}) };

  const result = await runCritics({
    opus: deps.anthropic
      ? () => callOpusCritic(deps.anthropic!, sourceCode, pre.findings, { timeoutMs: opts.criticTimeoutMs })
      : undefined,
    gemini: deps.geminiKey
      ? () => callGeminiCritic(deps.fetchFn, deps.geminiKey!, sourceCode, pre.findings, { timeoutMs: opts.criticTimeoutMs })
      : undefined,
    grok: deps.xaiKey
      ? () => callGrokCritic(deps.fetchFn, deps.xaiKey!, sourceCode, pre.findings, { timeoutMs: opts.criticTimeoutMs })
      : undefined,
  });

  for (const name of Object.keys(result.byModel) as CriticModelName[]) {
    modelsUsed.push(name);
    estimatedCostUSD += costs[name];
  }
  for (const name of result.timedOut) modelsTimedOut.push(name);

  const respondedCount = 1 + Object.keys(result.byModel).length;
  if (respondedCount < 1) {
    throw new LLMError("No models responded successfully", "NO_MODELS");
  }

  const findings = computeConsensus({
    prescreen: pre.findings,
    critics: result.byModel,
    slither: slitherCrossRef,
    modelsResponded: respondedCount,
  });

  return {
    verdictScore: computeVerdictScore(findings),
    findings,
    modelsUsed,
    modelsTimedOut,
    timeTakenMs: Date.now() - start,
    estimatedCostUSD,
    prescreenOnly: Object.keys(result.byModel).length === 0,
  };
}
