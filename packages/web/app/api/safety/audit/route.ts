/**
 * POST /api/safety/audit
 *
 * Live audit submission. Body: { sourceCode, network? }. Writes the source
 * to a tmp file, calls runAudit() from the engine, returns the verdict +
 * findings + gas report + decryption key.
 *
 * Rate-limited to 1 request per IP per 5 minutes (in-memory). If no LLM keys
 * are configured, falls back to Slither-only and reports `mode: "static-only"`.
 *
 * The decryptionKey is the AES-GCM key used to encrypt the report. It is
 * returned ONCE in this response and nowhere else — TryAnneal does not store
 * it. Treat it the way you'd treat a wallet seed.
 */
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

import {
  clientIp,
  corsHeaders,
  rateLimit,
  resolveNetwork,
  type SafetyNetwork,
} from "../_safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AuditRequest {
  sourceCode?: string;
  contractName?: string;
  network?: string;
}

const MAX_SOURCE_BYTES = 200_000; // generous; ~5k LOC

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request): Promise<Response> {
  // === 1. Rate limit ===
  const ip = clientIp(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return json(
      {
        error: "rate_limited",
        message: `One audit per 5 minutes per IP. Retry in ${rl.retryAfterSeconds}s.`,
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      429,
      { "retry-after": String(rl.retryAfterSeconds ?? 300) },
    );
  }

  // === 2. Parse body ===
  let body: AuditRequest;
  try {
    body = (await req.json()) as AuditRequest;
  } catch {
    return json({ error: "invalid_json", message: "Body must be JSON." }, 400);
  }
  const sourceCode = (body.sourceCode ?? "").trim();
  if (!sourceCode) {
    return json(
      {
        error: "missing_sourceCode",
        message: "Provide `sourceCode`: the full Solidity source as a string.",
      },
      400,
    );
  }
  if (Buffer.byteLength(sourceCode, "utf8") > MAX_SOURCE_BYTES) {
    return json(
      {
        error: "source_too_large",
        message: `Limit is ${MAX_SOURCE_BYTES} bytes; got ${Buffer.byteLength(sourceCode, "utf8")}.`,
      },
      413,
    );
  }
  const network: SafetyNetwork = resolveNetwork(body.network);
  const contractName = body.contractName?.trim() || "Submitted.sol";

  // === 3. Mode selection ===
  const chaingptKey = process.env.CHAINGPT_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const hunyuanKey = process.env.HUNYUAN_API_KEY?.trim();
  const hasLlm = Boolean(chaingptKey);
  const mode = hasLlm ? "llm-cascade" : "static-only";

  // === 4. Audit ===
  let tmpDir: string | null = null;
  try {
    tmpDir = await mkdtemp(join(tmpdir(), "tryanneal-audit-"));
    const filePath = resolve(tmpDir, contractName.endsWith(".sol") ? contractName : `${contractName}.sol`);
    await writeFile(filePath, sourceCode, "utf8");

    const engine = await import("@tryanneal/engine");
    const {
      runAudit,
      profileMantleGas,
      toFunctionInputs,
      generateAuditKey,
      encryptFindings,
      serializeEncryptedReport,
    } = engine;

    const audit = await runAudit(filePath, {
      network,
      quick: false,
      noLlm: !hasLlm,
      chaingptKey: chaingptKey ?? null,
      geminiKey: geminiKey ?? null,
      groqKey: groqKey ?? null,
      hunyuanKey: hunyuanKey ?? null,
      hunyuanModel: process.env.HUNYUAN_MODEL,
      hunyuanBaseURL: process.env.HUNYUAN_BASE_URL,
    });

    // Gas profile (best-effort; falls back to defaults if RPC quirks).
    let gasReport: Awaited<ReturnType<typeof profileMantleGas>> | null = null;
    try {
      gasReport = await profileMantleGas({
        functions: toFunctionInputs(sourceCode),
        deployment: { bytecode: new Uint8Array(Math.max(2000, sourceCode.length * 2)), l2GasUsed: 1_200_000n },
      });
    } catch {
      gasReport = null;
    }

    const codeHash = "0x" + createHash("sha3-256").update(sourceCode).digest("hex");

    // Encrypt — verdict score stays public, raw findings stay private.
    const key = generateAuditKey();
    const encrypted = encryptFindings(
      audit.findings,
      gasReport ?? ({} as Awaited<ReturnType<typeof profileMantleGas>>),
      key,
    );
    const blobBytes = serializeEncryptedReport(encrypted).length;

    const counts = countSev(audit.findings);
    const safe = counts.critical === 0 && counts.high === 0;

    return json({
      safe,
      score: audit.verdictScore,
      codeHash,
      network,
      contractName,
      mode,
      modelsUsed: audit.modelsUsed,
      modelsTimedOut: audit.modelsTimedOut,
      timeTakenMs: audit.timeTakenMs,
      estimatedCostUSD: audit.estimatedCostUSD,
      criticalCount: counts.critical,
      highCount: counts.high,
      mediumCount: counts.medium,
      lowCount: counts.low,
      findings: audit.findings.map((f, i) => ({
        id: `F-${String(i + 1).padStart(3, "0")}`,
        severity: f.severity,
        vulnClass: f.vulnClass,
        title: f.vulnClass,
        description: f.description,
        recommendation: f.recommendation,
        lineStart: f.lineStart,
        lineEnd: f.lineEnd,
        confidence: f.confidencePct,
        sources: f.sources,
      })),
      gasReport: gasReport
        ? {
            deploymentGas: Number(gasReport.deployment.totalGas),
            deploymentCostMNT: gasReport.deployment.totalCostMNT,
            deploymentCostUSD: gasReport.deployment.totalCostUSD,
            l2ExecutionMNT: gasReport.deployment.l2ExecutionFee.toString(),
            l1DataMNT: gasReport.deployment.l1DataFee.toString(),
            operatorMNT: gasReport.deployment.operatorFee.toString(),
            functionCount: gasReport.functions.length,
            optimizations: gasReport.optimizations.map((o) => ({
              type: o.type,
              description: o.description,
              estimatedSavingPct: o.estimatedSavingPct,
              affectedFunctions: o.affectedFunctions,
            })),
            arsiaParamsSource: gasReport.params.source,
          }
        : null,
      corpusContext: audit.corpusContext ?? null,
      privacy: {
        encryptedReportBytes: blobBytes,
        decryptionKey: "0x" + key.toString("hex"),
        decryptionNote:
          "AES-256-GCM key. Returned ONCE here. TryAnneal does not store it. Lose this and the encrypted report is irrecoverable (crypto-shred).",
      },
      attestation: {
        posted: false,
        note: "POST /api/safety/audit performs analysis only. To attest on-chain, run `anneal audit <file> --attest` from the CLI with DEPLOYER_PRIVATE_KEY set.",
      },
    });
  } catch (err) {
    return json(
      { error: "audit_failed", message: (err as Error).message ?? "unknown failure" },
      500,
    );
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

interface Sev { critical: number; high: number; medium: number; low: number }
function countSev(findings: { severity: string }[]): Sev {
  const c: Sev = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (f.severity === "critical") c.critical++;
    else if (f.severity === "high") c.high++;
    else if (f.severity === "medium") c.medium++;
    else if (f.severity === "low") c.low++;
  }
  return c;
}
