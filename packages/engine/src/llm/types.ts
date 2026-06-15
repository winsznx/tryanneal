export type LLMSeverity = "critical" | "high" | "medium" | "low" | "info";
/** Provider id ∪ legacy aliases ∪ the slither cross-validation tag. */
export type ModelSource = "chaingpt" | "gemini" | "groq" | "gpt-oss" | "hunyuan" | "anthropic" | "haiku" | "opus" | "grok" | "slither";

export interface PreScreenFinding {
  vulnClass: string;
  severity: LLMSeverity;
  lineStart: number;
  lineEnd: number;
  description: string;
  recommendation: string;
}

export interface CriticFinding extends PreScreenFinding {
  confidencePct: number;
  confirmedByPrescreener: boolean;
}

export interface LLMFinding {
  vulnClass: string;
  severity: LLMSeverity;
  lineStart: number;
  lineEnd: number;
  description: string;
  recommendation: string;
  confidencePct: number;
  sources: ModelSource[];
}

export interface AuditResult {
  verdictScore: number;
  findings: LLMFinding[];
  modelsUsed: string[];
  modelsTimedOut: string[];
  timeTakenMs: number;
  estimatedCostUSD: number;
  prescreenOnly: boolean;
  /** True when no analyzer actually ran — the pre-screen failed and no critic
   *  responded. The verdict is meaningless; renderers must NOT report "safe". */
  analysisIncomplete?: boolean;
  /** Snapshot of corpus stats + per-audit match counts. Populated by the
   *  orchestrator from `buildCorpusContext()`. */
  corpusContext?: {
    totalPatterns: number;
    totalLossesUSD: number;
    totalLossesHuman: string;
    yearMin: number;
    yearMax: number;
    chains: string[];
    matchesFound: number;
    bestMatchSimilarity: number;
  };
}

export interface SlitherCrossRef {
  vulnClass: string;
  lineStart: number;
  lineEnd: number;
}

export const SEVERITY_RANK: Record<LLMSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export const SEVERITY_PENALTY: Record<LLMSeverity, number> = {
  critical: 30,
  high: 20,
  medium: 10,
  low: 3,
  info: 0,
};

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: "TIMEOUT" | "MISSING_KEY" | "API_ERROR" | "PARSE_ERROR" | "NO_MODELS",
    public readonly model?: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
