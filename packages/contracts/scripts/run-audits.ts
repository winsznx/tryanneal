import { ethers, network } from "hardhat";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

import {
  runAudit,
  generateAuditKey,
  encryptFindings,
  serializeEncryptedReport,
  uploadToArweave,
  type FullAuditResult,
  type MantleGasReport,
} from "@tryanneal/engine";

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

  const manifest = await loadManifest();
  const validationAddr =
    process.env.VALIDATION_CONTRACT ?? (manifest.annealValidation as { address?: string } | undefined)?.address;
  if (!validationAddr) throw new Error("No AnnealValidation address — run deploy-all.ts first or set VALIDATION_CONTRACT");

  const agentId = Number(
    process.env.ANNEAL_AGENT_ID ?? (manifest.identityRegistry as { agentId?: string } | undefined)?.agentId ?? 0,
  );
  console.log(`network:    ${network.name}`);
  console.log(`signer:     ${signer.address}`);
  console.log(`validation: ${validationAddr}`);
  console.log(`agentId:    ${agentId}\n`);

  const validation = new ethers.Contract(validationAddr, VALIDATION_ABI, signer);
  const reportsDir = process.env.REPORTS_DIR ?? "./reports";
  const useLlm = Boolean(process.env.ANTHROPIC_API_KEY);
  const quick = !process.env.GEMINI_API_KEY && !process.env.XAI_API_KEY;
  if (!useLlm) console.log("(no ANTHROPIC_API_KEY — running Slither-only)\n");

  const rows: RowResult[] = [];

  for (const t of TARGETS) {
    const abs = resolve(__dirname, "..", t.path);
    console.log(`→ auditing ${t.contract}`);
    let audit: FullAuditResult;
    let gas: MantleGasReport;
    try {
      const Anthropic = useLlm ? (await import("@anthropic-ai/sdk")).default : null;
      const anthropic = Anthropic && process.env.ANTHROPIC_API_KEY
        ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        : null;

      audit = await runAudit(abs, {
        network: network.name === "mantleMainnet" ? "mantle" : "mantle-sepolia",
        quick,
        noLlm: !useLlm,
        anthropic: anthropic as never,
        geminiKey: process.env.GEMINI_API_KEY ?? null,
        xaiKey: process.env.XAI_API_KEY ?? null,
      });

      // Profile gas via a fresh run (runAudit doesn't include gas yet)
      const { profileMantleGas, toFunctionInputs } = await import("@tryanneal/engine");
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
      const gasReportHash = "0x" + createHash("sha3-256").update(JSON.stringify(gas)).digest("hex");
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
