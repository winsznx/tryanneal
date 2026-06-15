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
// A single LLM, uncorroborated by Slither or another model, is weak evidence.
// Cap (don't floor) its confidence so a lone critic can't read as near-certain —
// especially when it's the only model that responded (ratio would give 100%).
const SINGLE_MODEL_CAP = 45;
const MAX_CONFIDENCE = 99;

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

// Whether two findings of the SAME canonical class should be treated as one.
// LLMs routinely omit precise line numbers (report 0), so a strict overlap
// requirement leaves Slither's "reentrancy-eth" un-merged from the LLMs'
// "Reentrancy" — the same bug shown twice, which understates corroboration.
// Unknown lines act as a wildcard; otherwise overlap with a small drift tolerance.
export function linesCompatible(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  if (aStart <= 0 || bStart <= 0) return true;
  const TOL = 3;
  return aStart - TOL <= bEnd && bStart - TOL <= aEnd;
}

// Slither detector ids, LLM free-text labels, and our custom detectors all name
// the same vulnerability differently ("reentrancy-eth" vs "Reentrancy" vs
// "Reentrancy Vulnerability"). Collapse them to a canonical class so the
// corroboration rule actually fires (a Slither + LLM agreement on reentrancy is
// counted as one corroborated finding, not two separate ones).
const CANONICAL_ALIASES: { canonical: string; match: RegExp }[] = [
  { canonical: "reentrancy", match: /reentran/ },
  { canonical: "access-control", match: /access-?control|unprotected|unauthori|init-?unprotected|missing-?(owner|admin|auth)|suicidal/ },
  { canonical: "arbitrary-send", match: /arbitrary-?send|unprotected-?(transfer|withdraw|ether)/ },
  { canonical: "unchecked-return", match: /unchecked-?(transfer|lowlevel|low-?level|send|call|return)|low-?level-?call/ },
  { canonical: "integer-overflow", match: /overflow|underflow|arithmetic/ },
  { canonical: "division-by-zero", match: /division-?by-?zero|divide-?by-?zero|div.*zero|zero-?division/ },
  { canonical: "tx-origin", match: /tx-?origin/ },
  { canonical: "weak-randomness", match: /random|prng|entropy/ },
  { canonical: "timestamp", match: /timestamp|block-?time/ },
  { canonical: "delegatecall", match: /delegatecall/ },
  { canonical: "uninitialized", match: /uninitialized|uninit/ },
  { canonical: "oracle-staleness", match: /stale|oracle-?no-?staleness/ },
  { canonical: "share-inflation", match: /donation|share-?(inflation|rounding)|first-?deposit|vault-?share/ },
  { canonical: "denial-of-service", match: /denial-?of-?service|(^|[^a-z])dos([^a-z]|$)|gas-?limit|unbounded-?loop|callback-?loop/ },
  { canonical: "signature-replay", match: /signature-?replay|replay/ },
  { canonical: "proxy-storage-collision", match: /proxy-?storage|storage-?collision/ },
  { canonical: "solc-version", match: /solc-?version|^pragma$|compiler-?version/ },
];

export function normalizeClass(s: string): string {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  for (const { canonical, match } of CANONICAL_ALIASES) {
    if (match.test(base)) return canonical;
  }
  return base;
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

function findBucket(buckets: Bucket[], cls: string, _lineStart: number, _lineEnd: number): Bucket | undefined {
  // Dedupe by vulnerability class. LLMs guess line numbers imprecisely, so the
  // same issue gets reported at slightly different lines by different models —
  // collapse them into one finding rather than showing five copies.
  const normCls = normalizeClass(cls);
  return buckets.find((b) => normalizeClass(b.vulnClass) === normCls);
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
  const criticsResponded = Object.keys(input.critics).length;
  for (const f of input.prescreen) add(f, prescreenSource);
  for (const [name, findings] of Object.entries(input.critics) as [ModelSource, CriticFinding[]][]) {
    for (const f of findings) add(f, name);
  }

  // Cross-validate against Slither (does not count toward model agreement, but boosts confidence).
  const slitherHit = (b: Bucket) =>
    input.slither.some(
      (s) => normalizeClass(s.vulnClass) === normalizeClass(b.vulnClass) && linesCompatible(b.lineStart, b.lineEnd, s.lineStart, s.lineEnd),
    );

  const out: LLMFinding[] = buckets.map((b) => {
    const llmAgrees = [...b.sources].filter((s) => s !== "slither").length;
    let confidence = Math.round((llmAgrees / totalModels) * 100);
    const hasSlither = slitherHit(b);
    if (hasSlither) {
      confidence = Math.min(MAX_CONFIDENCE, confidence + SLITHER_BOOST);
      b.sources.add("slither");
    }
    // A lone LLM with no Slither corroboration is capped — never inflated to
    // near-certain just because few models responded (ratio alone gives 100%
    // when only one critic is up).
    if (llmAgrees === 1 && !hasSlither) confidence = Math.min(confidence, SINGLE_MODEL_CAP);
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

  // Require corroboration when the panel is full. A reported finding needs >=2
  // independent sources (>=2 models, or a model + Slither). Single-model hunches
  // are the main source of run-to-run flicker (LLMs aren't perfectly
  // deterministic even at temperature 0) and of false positives — only what the
  // panel agrees on survives. When fewer than 2 critics responded (thin panel),
  // keep single-source findings rather than risk a false clean.
  const enoughPanel = criticsResponded >= 2;

  return out
    .filter((f) => f.confidencePct >= MIN_CONFIDENCE)
    .filter((f) => !(enoughPanel && f.sources.length < 2))
    .sort((a, b) => {
      const r = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      if (r !== 0) return r;
      return b.confidencePct - a.confidencePct;
    });
}

export function computeVerdictScore(findings: LLMFinding[]): number {
  // Weight each penalty by the finding's confidence, so a low-confidence,
  // single-source finding that may flicker between runs barely moves the score —
  // the verdict stays stable, and only well-corroborated issues sink it.
  const penalty = findings.reduce(
    (sum, f) => sum + SEVERITY_PENALTY[f.severity] * (f.confidencePct / 100),
    0,
  );
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}
