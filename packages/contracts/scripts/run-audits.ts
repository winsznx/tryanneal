import { ethers, network } from "hardhat";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

// @tryanneal/engine is ESM; hardhat's ts-node loader is CJS by default. Use
// type-only imports here and load the runtime entries via dynamic import()
// inside main() — that path works under both loaders.
import type { FullAuditResult, MantleGasReport } from "@tryanneal/engine";

interface RowResult {
  contract: string;
  path: string;
  score: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  codeHash: string;
  reportURI: string;
  reportSource: "arweave" | "local-fallback";
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

const TARGETS: { contract: string; path: string }[] = [
  { contract: "SimpleToken.sol",   path: "contracts/audit-targets/SimpleToken.sol" },
  { contract: "SampleVault.sol",   path: "contracts/audit-targets/SampleVault.sol" },
  { contract: "UnsafeOracle.sol",  path: "contracts/audit-targets/UnsafeOracle.sol" },
  { contract: "ProxyAdmin.sol",    path: "contracts/audit-targets/ProxyAdmin.sol" },
  { contract: "BatchTransfer.sol", path: "contracts/audit-targets/BatchTransfer.sol" },
];

const VALIDATION_ABI = [
  "function postVerdict(uint256 agentId, bytes32 codeHash, uint8 verdictScore, uint8 criticalCount, uint8 highCount, uint8 mediumCount, uint8 lowCount, string reportURI, bytes32 gasReportHash) external",
];

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

async function loadManifest(): Promise<Record<string, { address?: string } | unknown>> {
  const p = resolve(__dirname, `../deployments/${network.name}.json`);
  return JSON.parse(await readFile(p, "utf8"));
}

async function main() {
  const [signer] = await ethers.getSigners();
  if (!signer) throw new Error("No signer — set DEPLOYER_PRIVATE_KEY in .env");

  // Dynamic import: engine ships as ESM and the hardhat ts-node loader is CJS.
  const engine = await import("@tryanneal/engine");
  const {
    runAudit,
    generateAuditKey,
    encryptFindings,
    serializeEncryptedReport,
    uploadToArweave,
    profileMantleGas,
    toFunctionInputs,
  } = engine;

  const manifest = await loadManifest();
  // Treat empty strings (`FOO=` in .env) as unset.
  const envOrUndef = (k: string) => {
    const v = process.env[k];
    return v && v.trim() ? v : undefined;
  };
  const validationAddr =
    envOrUndef("VALIDATION_CONTRACT") ?? (manifest.annealValidation as { address?: string } | undefined)?.address;
  if (!validationAddr) throw new Error("No AnnealValidation address — run deploy-all.ts first or set VALIDATION_CONTRACT");

  const agentId = Number(
    envOrUndef("ANNEAL_AGENT_ID") ?? (manifest.identityRegistry as { agentId?: string } | undefined)?.agentId ?? 0,
  );
  console.log(`network:    ${network.name}`);
  console.log(`signer:     ${signer.address}`);
  console.log(`validation: ${validationAddr}`);
  console.log(`agentId:    ${agentId}\n`);

  const validation = new ethers.Contract(validationAddr, VALIDATION_ABI, signer);
  const reportsDir = process.env.REPORTS_DIR ?? "./reports";
  const useLlm = Boolean(process.env.CHAINGPT_API_KEY);
  const quick = !process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY;
  if (!useLlm) console.log("(no CHAINGPT_API_KEY — running Slither-only)\n");

  // Slither pre-flight: fail loudly if neither LLM nor static analysis is
  // available. Otherwise every audit silently scores 100/100 with 0 findings.
  const { spawnSync } = await import("node:child_process");
  const slitherCheck = spawnSync("slither", ["--version"], { stdio: "ignore" });
  const slitherAvailable = slitherCheck.status === 0;
  if (!useLlm && !slitherAvailable) {
    throw new Error(
      "Pre-flight failed: no LLM keys set AND `slither` not found on PATH. " +
        "Either `pip install slither-analyzer` or set CHAINGPT_API_KEY (+GEMINI_API_KEY/GROQ_API_KEY). " +
        "Refusing to post 5 empty verdicts on-chain.",
    );
  }
  if (!slitherAvailable) {
    console.warn("⚠️  slither not on PATH — LLM-only audits. Cross-validation boost disabled.\n");
  }

  const rows: RowResult[] = [];

  for (const t of TARGETS) {
    const abs = resolve(__dirname, "..", t.path);
    console.log(`→ auditing ${t.contract}`);
    let audit: FullAuditResult;
    let gas: MantleGasReport;
    try {
      audit = await runAudit(abs, {
        network: network.name === "mantleMainnet" ? "mantle" : "mantle-sepolia",
        quick,
        noLlm: !useLlm,
        chaingptKey: process.env.CHAINGPT_API_KEY ?? null,
        geminiKey: process.env.GEMINI_API_KEY ?? null,
        groqKey: process.env.GROQ_API_KEY ?? null,
      });

      // Profile gas via a fresh run (runAudit doesn't include gas yet).
      const source = await readFile(abs, "utf8");
      gas = await profileMantleGas({
        functions: toFunctionInputs(source),
        deployment: { bytecode: new Uint8Array(Math.max(2000, source.length * 2)), l2GasUsed: 1_200_000n },
      });
    } catch (err) {
      const e = (err as Error).message;
      console.error(`  audit failed: ${e}`);
      rows.push({
        contract: t.contract,
        path: t.path,
        score: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        codeHash: "0x",
        reportURI: "",
        reportSource: "local-fallback",
        error: e,
      });
      continue;
    }

    const counts = countSev(audit);
    const source = await readFile(abs, "utf8");
    const codeHash = "0x" + createHash("sha3-256").update(source).digest("hex");

    // Encrypt + store
    const key = generateAuditKey();
    const enc = encryptFindings(audit.findings, gas, key);
    const blob = serializeEncryptedReport(enc);
    const upload = await uploadToArweave(blob, {
      agentId,
      codeHash,
      verdictScore: audit.verdictScore,
      network: network.name,
      timestamp: new Date().toISOString(),
    }, { localFallbackDir: reportsDir });

    const row: RowResult = {
      contract: t.contract,
      path: t.path,
      score: audit.verdictScore,
      critical: counts.critical,
      high: counts.high,
      medium: counts.medium,
      low: counts.low,
      codeHash,
      reportURI: upload.uri,
      reportSource: upload.source,
    };

    // Persist decryption key locally (decrypt.json next to report)
    await mkdir(reportsDir, { recursive: true });
    await writeFile(
      resolve(reportsDir, `${codeHash.replace(/^0x/, "")}.key.txt`),
      `0x${key.toString("hex")}\n`,
    );

    // Post on-chain
    try {
      const gasReportHash =
        "0x" +
        createHash("sha3-256")
          .update(JSON.stringify(gas, (_k, v) => (typeof v === "bigint" ? v.toString() : v)))
          .digest("hex");
      const tx = await validation.postVerdict(
        agentId,
        codeHash,
        Math.max(0, Math.min(255, Math.round(audit.verdictScore))),
        counts.critical,
        counts.high,
        counts.medium,
        counts.low,
        upload.uri,
        gasReportHash,
      );
      const rcpt = await tx.wait();
      row.txHash = rcpt?.hash;
      row.blockNumber = rcpt?.blockNumber;
      row.gasUsed = rcpt?.gasUsed.toString();
      console.log(`  ✓ posted tx ${row.txHash} (gas ${row.gasUsed})`);
    } catch (err) {
      row.error = (err as Error).message;
      console.error(`  ✗ postVerdict failed: ${row.error}`);
    }

    rows.push(row);
  }

  // === Summary ===
  console.log("\n\nTRYANNEAL AUDIT BATCH — " + network.name);
  console.log("━".repeat(72));
  console.log(
    "Contract".padEnd(20) +
      "Score".padEnd(7) +
      "Findings".padEnd(14) +
      "Tx Hash".padEnd(20) +
      "Gas",
  );
  for (const r of rows) {
    const findings = `${r.critical}C ${r.high}H ${r.medium}M ${r.low}L`;
    const tx = r.txHash ? r.txHash.slice(0, 14) + "…" : "—";
    console.log(
      r.contract.padEnd(20) +
        String(r.score).padEnd(7) +
        findings.padEnd(14) +
        tx.padEnd(20) +
        (r.gasUsed ?? "—"),
    );
  }
  const posted = rows.filter((r) => r.txHash).length;
  console.log("\nTotal on-chain verdicts: " + posted);

  // Persist batch results
  const out = resolve(__dirname, `../deployments/${network.name}.audits.json`);
  await writeFile(out, JSON.stringify({ network: network.name, agentId, runAt: new Date().toISOString(), results: rows }, null, 2));
  console.log(`saved → ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
