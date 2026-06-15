import { readFile } from "node:fs/promises";
import { runSlither, type DetectorMode, type RunSlitherOptions } from "./slither.js";
import { runAderyn, type RunAderynOptions } from "./aderyn.js";
import { type Finding as SlitherFinding } from "./types.js";
import {
  auditWithLLM,
  buildCorpusContext,
  createChainGPTProvider,
  createGeminiProvider,
  createGroqProvider,
  createHunyuanProvider,
  fillRemediations,
  normalizeClass,
  rangesOverlap,
  type AuditResult,
  type FetchLike,
  type LLMFinding,
  type LLMProvider,
  type SlitherCrossRef,
} from "./llm/index.js";

export interface RunAuditOptions {
  network?: "mantle" | "mantle-sepolia";
  quick?: boolean;
  /** Run the full critic cascade even on a clean pre-screen (single-contract audits). */
  thorough?: boolean;
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
  /** Override the Hunyuan OpenAI-compatible base URL. Default is the
   *  international TokenHub gateway; set `HUNYUAN_BASE_URL` to the
   *  China-region endpoint if your key was issued for that domain. */
  hunyuanBaseURL?: string;
  // …or inject pre-built providers (tests / advanced wiring).
  prescreenProvider?: LLMProvider | null;
  criticProviders?: LLMProvider[];
  /** Inject a fetch impl for provider HTTP calls. Defaults to globalThis.fetch. */
  fetchFn?: FetchLike;
  slitherRunOverride?: (opts: RunSlitherOptions) => Promise<SlitherFinding[]>;
  /** Disable Aderyn (default: run if installed). */
  noAderyn?: boolean;
  aderynRunOverride?: (opts: RunAderynOptions) => Promise<SlitherFinding[]>;
}

export interface FullAuditResult extends AuditResult {
  slitherFindings: SlitherFinding[];
  /** Aderyn findings (empty if Aderyn not installed or disabled). */
  aderynFindings: SlitherFinding[];
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

function staticFindingToLLMFinding(f: SlitherFinding): LLMFinding {
  const loc = f.locations[0];
  // Tag with the underlying source so the CLI can distinguish slither / aderyn.
  const source: LLMFinding["sources"][number] =
    f.source === "aderyn" ? "slither" /* fold into static bucket */ : "slither";
  return {
    vulnClass: f.detector,
    severity: f.severity === "critical" ? "critical" : (f.severity as LLMFinding["severity"]),
    lineStart: loc?.startLine ?? 0,
    lineEnd: loc?.endLine ?? loc?.startLine ?? 0,
    description: f.description,
    recommendation: "",
    confidencePct: f.confidence === "High" ? 85 : f.confidence === "Medium" ? 65 : 45,
    sources: [source],
  };
}

/** Normalize a vulnerability class for dedup — strip prefixes like `aderyn:`. */
function dedupKey(vulnClass: string, lineStart: number, lineEnd: number): string {
  const cls = vulnClass.toLowerCase().replace(/^(?:aderyn|slither_builtin|tryanneal):/, "");
  return `${cls}:${lineStart}-${lineEnd}`;
}

/** Merge unique static-analyzer findings (Slither + Aderyn) into the LLM consensus output. */
function mergeStaticOnly(llm: LLMFinding[], staticFindings: SlitherFinding[]): LLMFinding[] {
  // Add Slither/Aderyn findings that the LLM consensus doesn't already cover —
  // matched by CANONICAL class + line OVERLAP, so Slither's "reentrancy-eth" is
  // recognized as the same issue as the LLM's "Reentrancy" (already corroborated
  // in consensus) and isn't double-reported.
  const kept: LLMFinding[] = [...llm];
  const extras: LLMFinding[] = [];
  for (const s of staticFindings) {
    const loc = s.locations[0];
    const sStart = loc?.startLine ?? 0;
    const sEnd = loc?.endLine ?? loc?.startLine ?? 0;
    const sCls = normalizeClass(s.detector);
    const already = kept.some(
      (f) => normalizeClass(f.vulnClass) === sCls && rangesOverlap(f.lineStart, f.lineEnd, sStart, sEnd),
    );
    if (already) continue;
    const conv = staticFindingToLLMFinding(s);
    extras.push(conv);
    kept.push(conv);
  }
  return [...llm, ...extras];
}

export async function runAudit(filePath: string, options: RunAuditOptions = {}): Promise<FullAuditResult> {
  const network = options.network ?? "mantle";
  // Ensure file is readable (also forces a clear error before slither runs)
  await readFile(filePath, "utf8");

  // Run Slither and Aderyn in parallel — they read the same file but are
  // independent processes. Failures are non-fatal: a missing binary or a
  // parse error drops that analyzer's findings to [] and the audit
  // continues with whatever survived.
  const slitherPromise = options.slitherRunOverride
    ? options.slitherRunOverride({ filePath, timeoutMs: options.timeoutMs })
    : runSlither({
        filePath,
        timeoutMs: options.timeoutMs,
        detectors: options.detectors,
        detectorsPath: options.detectorsPath,
      });

  const aderynPromise = options.noAderyn
    ? Promise.resolve<SlitherFinding[]>([])
    : options.aderynRunOverride
      ? options.aderynRunOverride({ filePath, timeoutMs: options.timeoutMs })
      : runAderyn({ filePath, timeoutMs: options.timeoutMs });

  const [slitherSettled, aderynSettled] = await Promise.allSettled([slitherPromise, aderynPromise]);
  const slitherFindings: SlitherFinding[] =
    slitherSettled.status === "fulfilled" ? slitherSettled.value : [];
  const aderynFindings: SlitherFinding[] =
    aderynSettled.status === "fulfilled" ? aderynSettled.value : [];
  const staticFindings = mergeStaticByKey(slitherFindings, aderynFindings);
  // A Slither rejection (e.g. a single file that imports @openzeppelin or local
  // files it can't resolve) means static analysis never actually ran. Tracked so
  // we never present an empty result as "clean".
  const slitherFailed = slitherSettled.status === "rejected";

  /** Build a static-only result from Slither + Aderyn findings. Used both for
   *  explicit --no-llm runs and as the fallback when the LLM stage fails
   *  entirely (e.g. every provider times out on a very large contract). */
  const staticOnlyResult = (note?: string): FullAuditResult => {
    const findings = staticFindings.map(staticFindingToLLMFinding);
    const penalty = findings.reduce(
      (s, f) => s + (f.severity === "critical" ? 30 : f.severity === "high" ? 20 : f.severity === "medium" ? 10 : f.severity === "low" ? 3 : 0),
      0,
    );
    return {
      verdictScore: Math.max(0, Math.min(100, 100 - penalty)),
      findings,
      modelsUsed: [
        ...(slitherFindings.length ? ["slither"] : []),
        ...(aderynFindings.length ? ["aderyn"] : []),
      ],
      modelsTimedOut: note ? ["llm-cascade"] : [],
      timeTakenMs: 0,
      estimatedCostUSD: 0,
      prescreenOnly: false,
      // Nothing analyzed the contract: Slither couldn't compile it and no LLM ran.
      analysisIncomplete: slitherFailed && staticFindings.length === 0,
      corpusContext: buildCorpusContext(findings),
      slitherFindings,
      aderynFindings,
      filePath,
      network,
    };
  };

  if (options.noLlm) {
    return staticOnlyResult();
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
    if (options.groqKey) {
      critics.push(createGroqProvider({ apiKey: options.groqKey, fetchFn }));
      // A second, architecturally-distinct critic on the same Groq backend
      // (GPT-OSS, not Llama) so findings get genuine cross-validation even when
      // Gemini is unavailable — a lone model can no longer drive the verdict.
      critics.push(createGroqProvider({ apiKey: options.groqKey, model: "openai/gpt-oss-120b", id: "gpt-oss", fetchFn }));
    }
    // NB: Hunyuan is intentionally NOT a critic — its TokenHub gateway serves a
    // Hunyuan-MT translation model, which emits prose/garbage as audit JSON.
    // hunyuanKey is consumed by the translation layer (multilingual reports),
    // not here.
  }

  // The LLM stage is non-fatal: if the pre-screen times out or every provider
  // fails (common on very large contracts that blow the context window), we
  // still return a static + corpus verdict rather than failing the whole
  // audit. An audit tool should degrade, not crash.
  let audit: AuditResult;
  try {
    audit = await auditWithLLM(
      source,
      slitherToCrossRef(staticFindings),
      { prescreen, critics },
      { quick: options.quick, thorough: options.thorough },
    );
  } catch (err) {
    if (process.env.ANNEAL_DEBUG_CRITICS === "1") {
      console.error(`  [llm stage failed → static fallback] ${(err as Error).message}`);
    }
    return staticOnlyResult(`llm stage failed: ${(err as Error).message}`);
  }

  const merged = mergeStaticOnly(audit.findings, staticFindings);

  // Tencent Hunyuan fills the plain-English "how to fix" for findings the static
  // analyzers report without one (best-effort, never blocks the verdict).
  if (options.hunyuanKey) {
    const remediator = createHunyuanProvider({
      apiKey: options.hunyuanKey,
      model: options.hunyuanModel,
      baseURL: options.hunyuanBaseURL,
      fetchFn,
    });
    await fillRemediations(merged, remediator, { timeoutMs: 30_000 });
  }

  return {
    ...audit,
    findings: merged,
    modelsUsed: [
      ...audit.modelsUsed,
      ...(slitherFindings.length ? ["slither"] : []),
      ...(aderynFindings.length ? ["aderyn"] : []),
    ],
    slitherFindings,
    aderynFindings,
    filePath,
    network,
  };
}

/** Merge Slither + Aderyn finding lists, deduplicating by class+lineRange. */
function mergeStaticByKey(slither: SlitherFinding[], aderyn: SlitherFinding[]): SlitherFinding[] {
  const seen = new Set<string>();
  const out: SlitherFinding[] = [];
  for (const f of [...slither, ...aderyn]) {
    const loc = f.locations[0];
    const key = dedupKey(f.detector, loc?.startLine ?? 0, loc?.endLine ?? loc?.startLine ?? 0);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

