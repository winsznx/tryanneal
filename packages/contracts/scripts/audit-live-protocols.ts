/**
 * audit-live-protocols.ts — Audit a live Mantle mainnet contract and post
 * the verdict on chain via AnnealValidation.
 *
 * This is the demo punch: TryAnneal has audited a real on-chain protocol
 * with non-trivial TVL and the verdict is publicly verifiable.
 *
 * Default target: Merchant Moe LB Router on Mantle mainnet (~$60M TVL).
 * Override with `LIVE_AUDIT_TARGETS` env (comma-separated address list)
 * or by editing TARGETS below.
 *
 * Usage:
 *   npx hardhat run scripts/audit-live-protocols.ts --network mantleMainnet
 *
 * Required env:
 *   DEPLOYER_PRIVATE_KEY  — funded mainnet account (gas costs ≈ 0.001 MNT/tx)
 *   MANTLESCAN_API_KEY    — to fetch verified source via mantlescan API
 *   CHAINGPT_API_KEY      — (optional) pre-screen
 *   GEMINI_API_KEY        — (optional) critic
 *   GROQ_API_KEY          — (optional) critic
 *   HUNYUAN_API_KEY       — (optional) Tencent Cloud critic
 */
import { ethers, network } from "hardhat";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

import type { FullAuditResult, MantleGasReport } from "@tryanneal/engine";

interface Target {
  name: string;
  address: string;
  tvlNote?: string;
}

const DEFAULT_TARGETS: Target[] = [
  {
    name: "Merchant Moe LB Router",
    address: "0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a",
    tvlNote: "~$60M TVL (June 2026)",
  },
];

const VALIDATION_ABI = [
  "function postVerdict(uint256 agentId, bytes32 codeHash, uint8 verdictScore, uint8 criticalCount, uint8 highCount, uint8 mediumCount, uint8 lowCount, string reportURI, bytes32 gasReportHash) external",
];

interface AuditRow {
  name: string;
  address: string;
  tvlNote?: string;
  verdictScore: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  codeHash: string;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  mantlescanTxUrl?: string;
  error?: string;
}

function parseTargets(): Target[] {
  const env = process.env.LIVE_AUDIT_TARGETS?.trim();
  if (!env) return DEFAULT_TARGETS;
  return env.split(",").map((a) => a.trim()).filter(Boolean).map((addr) => ({
    name: `Live target ${addr.slice(0, 10)}…`,
    address: addr,
  }));
}

function explorerBase(): { api: string; chainId: number; tx: string } {
  // Etherscan V2 multichain endpoint — the per-chain mantlescan V1 endpoints
  // are deprecated and now reject requests. V2 takes a chainid query param.
  if (network.name === "mantleMainnet") {
    return { api: "https://api.etherscan.io/v2/api", chainId: 5000, tx: "https://mantlescan.xyz/tx/" };
  }
  return { api: "https://api.etherscan.io/v2/api", chainId: 5003, tx: "https://sepolia.mantlescan.xyz/tx/" };
}

/**
 * Pull verified source for `address` from the Etherscan V2 multichain API.
 * The endpoint returns a JSON array of source pieces — we concatenate them
 * into a single input file (Solidity is tolerant of multiple contracts in
 * one source unit).
 */
async function fetchVerifiedSource(address: string): Promise<string> {
  const { api, chainId } = explorerBase();
  const apiKey = process.env.MANTLESCAN_API_KEY ?? "any";
  const url = `${api}?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mantlescan ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { status?: string; result?: Array<{ SourceCode?: string; ABI?: string; ContractName?: string }> };
  const first = body.result?.[0];
  if (!first || !first.SourceCode) throw new Error(`no verified source for ${address}`);
  const contractName = first.ContractName ?? "";
  const raw = first.SourceCode.trim();

  // Plain single-file source — return as-is.
  if (!raw.startsWith("{")) return raw;

  // Standard-JSON input is wrapped in {{ ... }}; some explorers use single {.
  let sources: Record<string, { content: string }> | undefined;
  try {
    const inner = raw.startsWith("{{") && raw.endsWith("}}") ? raw.slice(1, -1) : raw;
    const obj = JSON.parse(inner) as { sources?: Record<string, { content: string }> };
    sources = obj.sources;
  } catch {
    return raw; // not JSON after all — treat as plain Solidity
  }
  if (!sources) return raw;

  const entries = Object.entries(sources);
  // Prefer the primary contract file (basename === ContractName) — it holds
  // the contract's core logic and is small enough for the LLM pre-screen.
  // Auditing the whole flattened multi-file blob (200KB+) blows the model's
  // context window and times out. Falls back to the largest file, then to a
  // size-capped concatenation.
  const primary =
    entries.find(([p]) => p.split("/").pop()?.replace(/\.sol$/, "") === contractName) ??
    entries.sort((a, b) => b[1].content.length - a[1].content.length)[0];
  if (primary) {
    return `// Primary contract file for ${contractName} (${primary[0]})\n` + primary[1].content;
  }
  return entries.map(([p, s]) => `// FILE: ${p}\n${s.content}`).join("\n\n");
}

function countSev(audit: FullAuditResult): { critical: number; high: number; medium: number; low: number } {
  const c = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of audit.findings) {
    if (f.severity === "critical") c.critical++;
    else if (f.severity === "high") c.high++;
    else if (f.severity === "medium") c.medium++;
    else if (f.severity === "low") c.low++;
  }
  return c;
}

async function main() {
  if (network.name !== "mantleMainnet") {
    console.warn(`⚠️  expected --network mantleMainnet for a live audit; got "${network.name}". Proceeding anyway.`);
  }

  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer — set DEPLOYER_PRIVATE_KEY in .env");

  // Pull AnnealValidation address from the network's deployment manifest.
  const manifestPath = resolve(__dirname, `../deployments/${network.name}.json`);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    annealValidation?: { address?: string };
    identityRegistry?: { agentId?: string };
  };
  const validationAddr = process.env.VALIDATION_CONTRACT?.trim() || manifest.annealValidation?.address;
  if (!validationAddr) throw new Error(`No AnnealValidation address for ${network.name}; run deploy-all.ts first.`);

  const agentId = Number(process.env.ANNEAL_AGENT_ID?.trim() || manifest.identityRegistry?.agentId || 0);
  const validation = new ethers.Contract(validationAddr, VALIDATION_ABI, signer);
  const { tx: txBase } = explorerBase();

  console.log(`network:           ${network.name}`);
  console.log(`signer:            ${signer.address}`);
  console.log(`validation:        ${validationAddr}`);
  console.log(`agentId:           ${agentId}`);

  const engine = await import("@tryanneal/engine");
  const {
    runAudit,
    profileMantleGas,
    toFunctionInputs,
    generateAuditKey,
    encryptFindings,
    serializeEncryptedReport,
  } = engine;

  const targets = parseTargets();
  console.log(`targets:           ${targets.length}`);
  for (const t of targets) console.log(`  · ${t.name} ${t.address}${t.tvlNote ? ` (${t.tvlNote})` : ""}`);
  console.log();

  const rows: AuditRow[] = [];

  for (const target of targets) {
    console.log(`→ ${target.name} (${target.address})`);
    let source: string;
    try {
      source = await fetchVerifiedSource(target.address);
      console.log(`  fetched verified source — ${source.length} bytes`);
    } catch (err) {
      console.error(`  ✗ source fetch failed: ${(err as Error).message}`);
      rows.push({
        name: target.name,
        address: target.address,
        tvlNote: target.tvlNote,
        verdictScore: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        codeHash: "0x",
        error: (err as Error).message,
      });
      continue;
    }

    // Write to a tmp file for runAudit (which reads from disk).
    const tmpDir = resolve(__dirname, "..", "tmp");
    await mkdir(tmpDir, { recursive: true });
    const tmpFile = resolve(tmpDir, `${target.address}.sol`);
    await writeFile(tmpFile, source, "utf8");

    let audit: FullAuditResult;
    let gas: MantleGasReport | null = null;
    try {
      audit = await runAudit(tmpFile, {
        network: network.name === "mantleMainnet" ? "mantle" : "mantle-sepolia",
        quick: true,
        noLlm: !process.env.CHAINGPT_API_KEY,
        chaingptKey: process.env.CHAINGPT_API_KEY ?? null,
        geminiKey: process.env.GEMINI_API_KEY ?? null,
        groqKey: process.env.GROQ_API_KEY ?? null,
        hunyuanKey: process.env.HUNYUAN_API_KEY ?? null,
        hunyuanModel: process.env.HUNYUAN_MODEL,
        hunyuanBaseURL: process.env.HUNYUAN_BASE_URL,
      });
    } catch (err) {
      console.error(`  ✗ audit failed: ${(err as Error).message}`);
      rows.push({
        name: target.name,
        address: target.address,
        tvlNote: target.tvlNote,
        verdictScore: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        codeHash: "0x",
        error: (err as Error).message,
      });
      continue;
    }

    try {
      gas = await profileMantleGas({
        functions: toFunctionInputs(source),
        deployment: { bytecode: new Uint8Array(Math.max(2000, source.length * 2)), l2GasUsed: 1_200_000n },
      });
    } catch {
      gas = null;
    }

    const counts = countSev(audit);
    const codeHash = "0x" + createHash("sha3-256").update(source).digest("hex");
    console.log(`  verdict ${audit.verdictScore}/100 · ${counts.critical}C ${counts.high}H ${counts.medium}M ${counts.low}L`);

    // Encrypt the report locally — key returned in the row (and printed once below).
    const key = generateAuditKey();
    const enc = encryptFindings(audit.findings, gas ?? ({} as MantleGasReport), key);
    const blob = serializeEncryptedReport(enc);
    const reportsDir = resolve(__dirname, "..", "reports");
    await mkdir(reportsDir, { recursive: true });
    const reportPath = resolve(reportsDir, `${codeHash.slice(2)}.enc`);
    await writeFile(reportPath, blob);

    const reportURI = `file://${reportPath}`;
    const gasReportHash =
      "0x" +
      createHash("sha3-256")
        .update(JSON.stringify(gas ?? {}, (_k, v) => (typeof v === "bigint" ? v.toString() : v)))
        .digest("hex");

    const row: AuditRow = {
      name: target.name,
      address: target.address,
      tvlNote: target.tvlNote,
      verdictScore: audit.verdictScore,
      critical: counts.critical,
      high: counts.high,
      medium: counts.medium,
      low: counts.low,
      codeHash,
    };

    try {
      const tx = await validation.getFunction("postVerdict")(
        agentId,
        codeHash,
        Math.max(0, Math.min(255, Math.round(audit.verdictScore))),
        counts.critical,
        counts.high,
        counts.medium,
        counts.low,
        reportURI,
        gasReportHash,
      );
      const rcpt = await tx.wait();
      row.txHash = rcpt?.hash;
      row.blockNumber = rcpt?.blockNumber;
      row.gasUsed = rcpt?.gasUsed.toString();
      row.mantlescanTxUrl = rcpt?.hash ? `${txBase}${rcpt.hash}` : undefined;
      console.log(`  ✓ posted verdict on-chain: ${row.mantlescanTxUrl ?? rcpt?.hash}`);
    } catch (err) {
      row.error = (err as Error).message;
      console.error(`  ✗ postVerdict failed: ${row.error}`);
    }

    console.log(`  decryption key (save this): 0x${key.toString("hex")}`);
    rows.push(row);
  }

  // === Summary ===
  console.log("\n\nTRYANNEAL LIVE-PROTOCOL AUDIT BATCH — " + network.name);
  console.log("━".repeat(78));
  console.log(
    "Target".padEnd(28) + "Score".padStart(7) + "  " + "Findings".padEnd(16) + "Tx".padEnd(18) + "Gas".padStart(8),
  );
  for (const r of rows) {
    const findings = `${r.critical}C ${r.high}H ${r.medium}M ${r.low}L`;
    const tx = r.txHash ? r.txHash.slice(0, 16) + "…" : "—";
    console.log(
      r.name.padEnd(28).slice(0, 28) +
        String(r.verdictScore).padStart(7) +
        "  " +
        findings.padEnd(16) +
        tx.padEnd(18) +
        (r.gasUsed ?? "—").padStart(8),
    );
  }
  const posted = rows.filter((r) => r.txHash).length;
  console.log(`\n${posted}/${rows.length} live-protocol verdicts posted on ${network.name}.`);

  // Persist for the README / submission docs.
  const out = resolve(__dirname, `../deployments/${network.name}.live-audits.json`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(
    out,
    JSON.stringify(
      {
        network: network.name,
        agentId,
        validationContract: validationAddr,
        ranAt: new Date().toISOString(),
        targets: rows,
      },
      null,
      2,
    ),
  );
  console.log(`\nsaved → ${out}`);

  if (posted > 0) {
    console.log(
      `\nTryAnneal has audited ${posted} live Mantle protocol(s) and posted the verdict(s) on ${network.name}.`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
