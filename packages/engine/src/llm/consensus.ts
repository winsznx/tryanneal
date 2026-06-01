import {
  SEVERITY_PENALTY,
  SEVERITY_RANK,
  type CriticFinding,
  type LLMFinding,
  type LLMSeverity,
  type ModelSource,
  type PreScreenFinding,
  type SlitherCrossRef,
} from "./types.js";

const MIN_CONFIDENCE = 20;
const SLITHER_BOOST = 15;
const SINGLE_MODEL_FLOOR = 33;
const MAX_CONFIDENCE = 99;

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function normalizeClass(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

interface Bucket {
  vulnClass: string;
  severity: LLMSeverity;
  lineStart: number;
  lineEnd: number;
  description: string;
  recommendation: string;
  sources: Set<ModelSource>;
}

function mergeInto(bucket: Bucket, finding: { vulnClass: string; severity: LLMSeverity; lineStart: number; lineEnd: number; description: string; recommendation?: string }, source: ModelSource): void {
  bucket.sources.add(source);
  // Take the more severe rating.
  if (SEVERITY_RANK[finding.severity] > SEVERITY_RANK[bucket.severity]) bucket.severity = finding.severity;
  // Widen the line range to cover both.
  bucket.lineStart = Math.min(bucket.lineStart, finding.lineStart || bucket.lineStart);
  bucket.lineEnd = Math.max(bucket.lineEnd, finding.lineEnd || bucket.lineEnd);
  // Prefer the longest description (most signal).
  if (finding.description.length > bucket.description.length) bucket.description = finding.description;
  if (finding.recommendation && finding.recommendation.length > bucket.recommendation.length) {
    bucket.recommendation = finding.recommendation;
  }
}

function findBucket(buckets: Bucket[], cls: string, lineStart: number, lineEnd: number): Bucket | undefined {
  const normCls = normalizeClass(cls);
  return buckets.find(
    (b) => normalizeClass(b.vulnClass) === normCls && rangesOverlap(b.lineStart, b.lineEnd, lineStart, lineEnd),
  );
}

export interface ConsensusInput {
  prescreen: PreScreenFinding[];
  critics: Record<string, CriticFinding[]>;
  /** Provider id used for the pre-screen. Defaults to "chaingpt". */
  prescreenSource?: ModelSource;
  slither: SlitherCrossRef[];
  modelsResponded: number; // Haiku + however many critics returned
}

export function computeConsensus(input: ConsensusInput): LLMFinding[] {
  const buckets: Bucket[] = [];
  const totalModels = Math.max(1, input.modelsResponded);

  const add = (f: { vulnClass: string; severity: LLMSeverity; lineStart: number; lineEnd: number; description: string; recommendation?: string }, source: ModelSource) => {
    const existing = findBucket(buckets, f.vulnClass, f.lineStart, f.lineEnd);
    if (existing) {
      mergeInto(existing, f, source);
    } else {
      buckets.push({
        vulnClass: f.vulnClass,
        severity: f.severity,
        lineStart: f.lineStart,
        lineEnd: f.lineEnd,
        description: f.description,
        recommendation: f.recommendation ?? "",
        sources: new Set<ModelSource>([source]),
      });
    }
  };

  const prescreenSource: ModelSource = input.prescreenSource ?? "chaingpt";
  for (const f of input.prescreen) add(f, prescreenSource);
  for (const [name, findings] of Object.entries(input.critics) as [ModelSource, CriticFinding[]][]) {
    for (const f of findings) add(f, name);
  }

  // Cross-validate against Slither (does not count toward model agreement, but boosts confidence).
  const slitherHit = (b: Bucket) =>
    input.slither.some(
      (s) => normalizeClass(s.vulnClass) === normalizeClass(b.vulnClass) && rangesOverlap(b.lineStart, b.lineEnd, s.lineStart, s.lineEnd),
    );

  const out: LLMFinding[] = buckets.map((b) => {
    const llmAgrees = [...b.sources].filter((s) => s !== "slither").length;
    let confidence = Math.round((llmAgrees / totalModels) * 100);
    const hasSlither = slitherHit(b);
    if (hasSlither) {
      confidence = Math.min(MAX_CONFIDENCE, confidence + SLITHER_BOOST);
      b.sources.add("slither");
    }
    // Single-model floor only applies when Slither did NOT independently flag it.
    if (llmAgrees === 1 && !hasSlither) confidence = Math.max(confidence, SINGLE_MODEL_FLOOR);
    return {
      vulnClass: b.vulnClass,
      severity: b.severity,
      lineStart: b.lineStart,
      lineEnd: b.lineEnd,
      description: b.description,
      recommendation: b.recommendation,
      confidencePct: confidence,
      sources: [...b.sources],
    };
  });

  return out
    .filter((f) => f.confidencePct >= MIN_CONFIDENCE)
    .sort((a, b) => {
      const r = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      if (r !== 0) return r;
      return b.confidencePct - a.confidencePct;
    });
}

export function computeVerdictScore(findings: LLMFinding[]): number {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
