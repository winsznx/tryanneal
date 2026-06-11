import { readFile } from "node:fs/promises";
import { runSlither, type DetectorMode, type RunSlitherOptions } from "./slither.js";
import { type Finding as SlitherFinding } from "./types.js";
import {
  auditWithLLM,
  buildCorpusContext,
  createChainGPTProvider,
  createGeminiProvider,
  createGroqProvider,
  createHunyuanProvider,
  type AuditResult,
  type FetchLike,
  type LLMFinding,
  type LLMProvider,
  type SlitherCrossRef,
} from "./llm/index.js";

export interface RunAuditOptions {
  network?: "mantle" | "mantle-sepolia";
  quick?: boolean;
  noLlm?: boolean;
  timeoutMs?: number;
  /** Detector set: builtin (stock Slither), tryanneal (our pack), all (default). */
  detectors?: DetectorMode;
  /** Path to Python detector plugin dir; forwarded to slither as --detect-path. */
  detectorsPath?: string;
  // ---- LLM provider config ----
  // Either pass keys (engine builds the providers) …
  chaingptKey?: string | null;
  geminiKey?: string | null;
  groqKey?: string | null;
  /** Tencent Cloud Hunyuan key — Stage-2 critic. */
  hunyuanKey?: string | null;
  hunyuanModel?: string;
  // …or inject pre-built providers (tests / advanced wiring).
  prescreenProvider?: LLMProvider | null;
  criticProviders?: LLMProvider[];
  /** Inject a fetch impl for provider HTTP calls. Defaults to globalThis.fetch. */
  fetchFn?: FetchLike;
  slitherRunOverride?: (opts: RunSlitherOptions) => Promise<SlitherFinding[]>;
}

export interface FullAuditResult extends AuditResult {
  slitherFindings: SlitherFinding[];
  filePath: string;
  network: string;
}

function slitherToCrossRef(findings: SlitherFinding[]): SlitherCrossRef[] {
  return findings.map((f) => {
    const loc = f.locations[0];
    return {
      vulnClass: f.detector,
      lineStart: loc?.startLine ?? 0,
      lineEnd: loc?.endLine ?? loc?.startLine ?? 0,
    };
  });
}

function slitherToLLMFinding(f: SlitherFinding): LLMFinding {
  const loc = f.locations[0];
  return {
    vulnClass: f.detector,
    severity: f.severity === "critical" ? "critical" : (f.severity as LLMFinding["severity"]),
    lineStart: loc?.startLine ?? 0,
    lineEnd: loc?.endLine ?? loc?.startLine ?? 0,
    description: f.description,
    recommendation: "",
    confidencePct: f.confidence === "High" ? 85 : f.confidence === "Medium" ? 65 : 45,
    sources: ["slither"],
  };
}

/** Merge unique Slither-only findings into the LLM consensus output. */
function mergeSlitherOnly(llm: LLMFinding[], slither: SlitherFinding[]): LLMFinding[] {
  const have = new Set(llm.map((f) => `${f.vulnClass.toLowerCase()}:${f.lineStart}-${f.lineEnd}`));
  const extras = slither
    .filter((s) => {
      const loc = s.locations[0];
      const key = `${s.detector.toLowerCase()}:${loc?.startLine ?? 0}-${loc?.endLine ?? loc?.startLine ?? 0}`;
      return !have.has(key);
    })
    .map(slitherToLLMFinding);
  return [...llm, ...extras];
}

export async function runAudit(filePath: string, options: RunAuditOptions = {}): Promise<FullAuditResult> {
  const network = options.network ?? "mantle";
  // Ensure file is readable (also forces a clear error before slither runs)
  await readFile(filePath, "utf8");

  const slitherFindings = options.slitherRunOverride
    ? await options.slitherRunOverride({ filePath, timeoutMs: options.timeoutMs })
    : await runSlither({
        filePath,
        timeoutMs: options.timeoutMs,
        detectors: options.detectors,
        detectorsPath: options.detectorsPath,
      }).catch(() => [] as SlitherFinding[]);

  if (options.noLlm) {
    const findings = slitherFindings.map(slitherToLLMFinding);
    const penalty = findings.reduce(
      (s, f) => s + (f.severity === "critical" ? 30 : f.severity === "high" ? 20 : f.severity === "medium" ? 10 : f.severity === "low" ? 3 : 0),
      0,
    );
    return {
      verdictScore: Math.max(0, Math.min(100, 100 - penalty)),
      findings,
      modelsUsed: ["slither"],
      modelsTimedOut: [],
      timeTakenMs: 0,
      estimatedCostUSD: 0,
      prescreenOnly: false,
      corpusContext: buildCorpusContext(findings),
      slitherFindings,
      filePath,
      network,
    };
  }

  const source = await readFile(filePath, "utf8");
  const fetchFn = options.fetchFn ?? ((globalThis as { fetch?: FetchLike }).fetch as FetchLike);

  // Build providers from keys if not explicitly injected.
  const prescreen =
    options.prescreenProvider ??
    (options.chaingptKey ? createChainGPTProvider({ apiKey: options.chaingptKey, fetchFn }) : null);

  const critics: LLMProvider[] = options.criticProviders ?? [];
  if (options.criticProviders === undefined) {
    if (options.geminiKey) critics.push(createGeminiProvider({ apiKey: options.geminiKey, fetchFn }));
    if (options.groqKey) critics.push(createGroqProvider({ apiKey: options.groqKey, fetchFn }));
    if (options.hunyuanKey)
      critics.push(
        createHunyuanProvider({ apiKey: options.hunyuanKey, model: options.hunyuanModel, fetchFn }),
      );
  }

  const audit = await auditWithLLM(
    source,
    slitherToCrossRef(slitherFindings),
    { prescreen, critics },
    { quick: options.quick },
  );

  const merged = mergeSlitherOnly(audit.findings, slitherFindings);

  return {
    ...audit,
    findings: merged,
    slitherFindings,
    filePath,
    network,
  };
}

