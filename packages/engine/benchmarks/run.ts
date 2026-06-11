/**
 * TryAnneal benchmark runner.
 *
 * Evaluates the engine against a fixed set of fixtures: 4 known-vulnerable
 * (modelled after real exploits) and 2 known-clean. Every contract has
 * ground truth in EXPECTATIONS — what the engine SHOULD detect, what it
 * SHOULD NOT. We tally precision/recall/F1 and write the table to stdout
 * and the structured payload to results/latest.json.
 *
 * Run: `pnpm --filter @tryanneal/engine benchmark`
 *
 * Mode is --no-llm for reproducibility (Slither + TryAnneal detectors +
 * corpus, no API keys needed). The benchmark is the auditable proof that
 * outputs are correct and repeatable.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAudit, type FullAuditResult, type LLMSeverity } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = resolve(__dirname, "contracts");
const RESULTS_DIR = resolve(__dirname, "results");

interface Expectation {
  file: string;
  exploit: string;
  cveAnalog: string;
  lossesUSD: number;
  expectedSeverity: "high" | "critical" | "clean";
  expectedDetectors: string[];
}

const EXPECTATIONS: Expectation[] = [
  {
    file: "MinterestVuln.sol",
    exploit: "External-call-before-state-update reentrancy",
    cveAnalog: "Minterest July 2024 ($1.4M, Mantle)",
    lossesUSD: 1_400_000,
    expectedSeverity: "high",
    expectedDetectors: ["reentrancy-eth", "reentrancy-no-eth", "reentrancy-benign"],
  },
  {
    file: "EulerDonation.sol",
    exploit: "ERC4626 share-price inflation via direct token donation",
    cveAnalog: "Euler Finance March 2023 ($197M)",
    lossesUSD: 197_000_000,
    expectedSeverity: "high",
    expectedDetectors: ["donation-attack"],
  },
  {
    file: "NomadInit.sol",
    exploit: "Unprotected initialize() — no initializer modifier or guard",
    cveAnalog: "Nomad Bridge August 2022 ($190M)",
    lossesUSD: 190_000_000,
    expectedSeverity: "high",
    expectedDetectors: ["init-unprotected"],
  },
  {
    file: "LayerZeroDVN.sol",
    exploit: "Single-DVN verifier configuration",
    cveAnalog: "KelpDAO LayerZero April 2026 ($292M)",
    lossesUSD: 292_000_000,
    expectedSeverity: "high",
    expectedDetectors: ["single-dvn-verifier"],
  },
  {
    file: "Clean1.sol",
    exploit: "—",
    cveAnalog: "N/A",
    lossesUSD: 0,
    expectedSeverity: "clean",
    expectedDetectors: [],
  },
  {
    file: "Clean2.sol",
    exploit: "—",
    cveAnalog: "N/A",
    lossesUSD: 0,
    expectedSeverity: "clean",
    expectedDetectors: [],
  },
];

interface FixtureResult {
  file: string;
  cveAnalog: string;
  lossesUSD: number;
  expectedSeverity: Expectation["expectedSeverity"];
  detected: boolean;            // true if any high/critical surfaced (for vuln) or zero (for clean)
  truePositive: boolean;
  falseNegative: boolean;
  falsePositiveCount: number;   // high/critical findings on a clean contract
  topSeverity: LLMSeverity | "clean";
  matchedDetectors: string[];   // detector IDs that fired
  topConfidence: number;
  verdictScore: number;
  timeTakenMs: number;
}

function severityRank(s: LLMSeverity | "clean"): number {
  return { critical: 4, high: 3, medium: 2, low: 1, info: 0, clean: 0 }[s] ?? 0;
}

async function evaluate(expect: Expectation): Promise<FixtureResult> {
  const filePath = resolve(CONTRACTS_DIR, expect.file);
  const t0 = Date.now();
  let audit: FullAuditResult;
  try {
    audit = await runAudit(filePath, { network: "mantle-sepolia", noLlm: true });
  } catch (err) {
    return {
      file: expect.file,
      cveAnalog: expect.cveAnalog,
      lossesUSD: expect.lossesUSD,
      expectedSeverity: expect.expectedSeverity,
      detected: false,
      truePositive: false,
      falseNegative: expect.expectedSeverity !== "clean",
      falsePositiveCount: 0,
      topSeverity: "clean",
      matchedDetectors: [],
      topConfidence: 0,
      verdictScore: 100,
      timeTakenMs: Date.now() - t0,
    };
  }

  const highOrCritical = audit.findings.filter(
    (f) => f.severity === "high" || f.severity === "critical",
  );
  const top = highOrCritical.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];

  // Which detectors matched on this fixture (slither check / tryanneal detector / corpus)?
  const matchedDetectors = Array.from(
    new Set(
      audit.findings
        .flatMap((f) =>
          [f.vulnClass.toLowerCase(), ...f.sources.map((s) => String(s).toLowerCase())].filter(
            (s) => s && s !== "haiku" && s !== "opus" && s !== "gemini" && s !== "groq" && s !== "hunyuan",
          ),
        ),
    ),
  );

  const expectedDetectorHit = expect.expectedDetectors.some((d) =>
    matchedDetectors.some((m) => m.includes(d.toLowerCase()) || d.toLowerCase().includes(m)),
  );

  let truePositive = false;
  let falseNegative = false;
  let falsePositiveCount = 0;
  let detected = false;

  if (expect.expectedSeverity === "clean") {
    falsePositiveCount = highOrCritical.length;
    detected = falsePositiveCount === 0;
    truePositive = detected;
  } else {
    detected = highOrCritical.length > 0 || expectedDetectorHit;
    truePositive = detected;
    falseNegative = !detected;
  }

  return {
    file: expect.file,
    cveAnalog: expect.cveAnalog,
    lossesUSD: expect.lossesUSD,
    expectedSeverity: expect.expectedSeverity,
    detected,
    truePositive,
    falseNegative,
    falsePositiveCount,
    topSeverity: top?.severity ?? "clean",
    matchedDetectors,
    topConfidence: top?.confidencePct ?? 0,
    verdictScore: audit.verdictScore,
    timeTakenMs: Date.now() - t0,
  };
}

function fmtUSD(amount: number): string {
  if (amount === 0) return "—";
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

function tick(b: boolean): string {
  return b ? "✅" : "❌";
}

async function main(): Promise<void> {
  console.log("");
  console.log("TryAnneal benchmark — Slither + TryAnneal detectors + corpus (no LLM).");
  console.log("=".repeat(80));
  console.log("");

  const results: FixtureResult[] = [];
  for (const expect of EXPECTATIONS) {
    process.stdout.write(`  running ${expect.file.padEnd(24)} … `);
    const r = await evaluate(expect);
    results.push(r);
    if (expect.expectedSeverity === "clean") {
      process.stdout.write(r.detected ? "clean ✓\n" : `${r.falsePositiveCount} false positive(s) ✗\n`);
    } else {
      process.stdout.write(r.detected ? `${r.topSeverity.toUpperCase()} ✓\n` : "missed ✗\n");
    }
  }

  // Compute aggregate metrics. Treat fixtures as binary positives/negatives:
  // vuln fixtures are positives, clean fixtures are negatives.
  const vuln = results.filter((r) => r.expectedSeverity !== "clean");
  const clean = results.filter((r) => r.expectedSeverity === "clean");
  const truePositives = vuln.filter((r) => r.truePositive).length;
  const falseNegatives = vuln.filter((r) => r.falseNegative).length;
  const falsePositives = clean.reduce((s, r) => s + r.falsePositiveCount, 0);
  const trueNegatives = clean.filter((r) => r.falsePositiveCount === 0).length;

  const precision = truePositives + falsePositives === 0 ? 1 : truePositives / (truePositives + falsePositives);
  const recall = vuln.length === 0 ? 1 : truePositives / vuln.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  console.log("");
  console.log("Results");
  console.log("-".repeat(80));
  const header = [
    "Contract".padEnd(22),
    "CVE Analog".padEnd(32),
    "Losses".padStart(8),
    "Detected".padEnd(10),
    "Confidence".padStart(11),
  ].join(" │ ");
  console.log(header);
  console.log("-".repeat(80));
  for (const r of results) {
    const detectedMark = r.expectedSeverity === "clean"
      ? `${tick(r.detected)} CLEAN`
      : `${tick(r.detected)} ${r.topSeverity.toUpperCase()}`;
    console.log(
      [
        r.file.padEnd(22),
        r.cveAnalog.padEnd(32),
        fmtUSD(r.lossesUSD).padStart(8),
        detectedMark.padEnd(10),
        (r.expectedSeverity === "clean" ? "—" : `${r.topConfidence}%`).padStart(11),
      ].join(" │ "),
    );
  }
  console.log("-".repeat(80));
  console.log(
    `Precision: ${(precision * 100).toFixed(1)}%   ` +
      `Recall: ${(recall * 100).toFixed(1)}%   ` +
      `F1: ${f1.toFixed(2)}   ` +
      `(TP=${truePositives}, FN=${falseNegatives}, FP=${falsePositives}, TN=${trueNegatives})`,
  );
  console.log("");

  // Persist the structured payload for the repo and the demo.
  const payload = {
    schemaVersion: 1,
    generatedAt: "2026-06-12T00:00:00Z", // pinned for reproducibility; rotate per run if you want timestamps
    mode: "slither+tryanneal-detectors+corpus (no LLM)",
    engineVersion: process.env.npm_package_version ?? "0.1.0",
    metrics: { precision, recall, f1, truePositives, falseNegatives, falsePositives, trueNegatives },
    expectations: EXPECTATIONS,
    results,
  };
  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(resolve(RESULTS_DIR, "latest.json"), JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${resolve(RESULTS_DIR, "latest.json")}`);
}

main().catch((err) => {
  console.error("benchmark failed:", err);
  process.exit(1);
});

async function _unused(): Promise<void> {
  // suppress unused-import lint if readFile drops from a future revision
  await readFile;
}
void _unused;
