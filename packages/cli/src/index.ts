#!/usr/bin/env node
import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import pc from "picocolors";
import figlet from "figlet";
import {
  CORPUS_SNAPSHOT,
  runAudit,
  SlitherError,
  LLMError,
  GasError,
  profileMantleGas,
  toFunctionInputs,
  postAuditOnChain,
  generateAuditKey,
  encryptFindings,
  serializeEncryptedReport,
  uploadToArweave,
  type FullAuditResult,
  type LLMFinding,
  type LLMSeverity,
  type MantleGasReport,
} from "@tryanneal/engine";
import { createHash } from "node:crypto";

// Single source of truth — read the version from package.json so --version
// never drifts from the published package.
const VERSION = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;

// ---------------------------------------------------------------------------
// Animated brand banner — a blue→cyan vertical gradient over a 3D block wordmark,
// revealed line by line. TTY-only (skipped in pipes/CI/--no-banner) so piped
// output stays machine-clean.
// ---------------------------------------------------------------------------
const BANNER_STOPS: ReadonlyArray<readonly [number, number, number]> = [
  [88, 96, 255],
  [70, 150, 255],
  [88, 205, 255],
  [128, 236, 255],
];
function bannerColor(t: number): [number, number, number] {
  const n = BANNER_STOPS.length - 1;
  const x = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  const a = BANNER_STOPS[i]!;
  const b = BANNER_STOPS[i + 1]!;
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}
const truecolor = (r: number, g: number, b: number, s: string): string => `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function showBanner(): Promise<void> {
  if (!process.stdout.isTTY || process.env.ANNEAL_NO_BANNER === "1") return;
  let art: string;
  try {
    art = figlet.textSync("TryAnneal", { font: "ANSI Shadow" });
  } catch {
    return; // a banner must never break the CLI
  }
  const lines = art.split("\n").filter((l) => l.replace(/\s/g, "").length > 0);
  console.log();
  for (let i = 0; i < lines.length; i++) {
    const t = lines.length > 1 ? i / (lines.length - 1) : 0;
    const [r, g, b] = bannerColor(t);
    process.stdout.write("  " + truecolor(r, g, b, lines[i]!) + "\n");
    await sleep(42);
  }
  console.log(pc.dim(`  the security layer agents call before they trust · v${VERSION}`));
  console.log();
}

const program = new Command();

program
  .name("anneal")
  .description("TryAnneal — AI-powered smart contract audit agent for Mantle")
  .version(VERSION);

program
  .command("audit")
  .description("Audit a Solidity file")
  .argument("<file>", "Path to .sol file")
  .option("-n, --network <network>", "Target network (mantle | mantle-sepolia)", "mantle")
  .option("--timeout <ms>", "Slither timeout in ms", "30000")
  .option("--quick", "Haiku pre-screen only (skip critic cascade)", false)
  .option("--threshold <score>", "CI gate: exit non-zero if verdict score < N (0 = severity-only)", "0")
  .option("--no-llm", "Skip LLM ensemble (Slither only)")
  .option("--gas-only", "Skip security audit; only profile gas", false)
  .option("--attest", "Post verdict on-chain after audit (requires DEPLOYER_PRIVATE_KEY)", false)
  .option("--report-uri <uri>", "Report URI to attest (Arweave/IPFS). Defaults to encrypted report URI.")
  .option("--validation <address>", "AnnealValidation contract address (overrides deployments file)")
  .option("--no-encrypt", "Skip encryption + storage of findings")
  .option("--reports-dir <dir>", "Local fallback directory for encrypted reports", "./reports")
  .option("--detectors <mode>", "Slither detector set: all | builtin | tryanneal", "all")
  .option("--detectors-path <dir>", "Path to additional Slither detector plugin dir")
  .option("--no-aderyn", "Skip Aderyn (Cyfrin's Rust-based static analyzer)")
  .action(async (file: string, opts: Record<string, unknown>) => {
    await showBanner();
    const abs = resolve(process.cwd(), file);
    const networkLabel = opts.network === "mantle-sepolia" ? "Mantle Sepolia (Arsia)" : "Mantle Mainnet (Arsia)";
    printHeader(abs, networkLabel);

    const useLlm = opts.llm !== false && opts.gasOnly !== true;
    const t0 = Date.now();

    let auditResult: FullAuditResult | null = null;
    if (!opts.gasOnly) {
      try {
        auditResult = await runAudit(abs, {
          network: opts.network === "mantle-sepolia" ? "mantle-sepolia" : "mantle",
          quick: opts.quick === true,
          // Default to the full critic cascade; `--quick` opts back to a
          // pre-screen-only pass. A single-contract audit should be thorough.
          thorough: opts.quick !== true,
          noLlm: !useLlm,
          timeoutMs: Number(opts.timeout),
          chaingptKey: useLlm ? process.env.CHAINGPT_API_KEY ?? null : null,
          geminiKey: useLlm ? process.env.GEMINI_API_KEY ?? null : null,
          groqKey: useLlm ? process.env.GROQ_API_KEY ?? null : null,
          hunyuanKey: useLlm ? process.env.HUNYUAN_API_KEY ?? null : null,
          hunyuanModel: process.env.HUNYUAN_MODEL,
          hunyuanBaseURL: process.env.HUNYUAN_BASE_URL,
          detectors:
            opts.detectors === "tryanneal" || opts.detectors === "builtin" || opts.detectors === "all"
              ? (opts.detectors as "tryanneal" | "builtin" | "all")
              : undefined,
          detectorsPath: typeof opts.detectorsPath === "string" ? opts.detectorsPath : undefined,
          noAderyn: opts.aderyn === false,
        });
      } catch (err) {
        reportError(err);
        process.exit(1);
      }
    }

    // === Gas profile ===
    let gasReport: MantleGasReport | null = null;
    try {
      const source = await readFile(abs, "utf8");
      const fnInputs = toFunctionInputs(source);
      const bytecode = new Uint8Array(Math.max(2000, source.length * 2));
      gasReport = await profileMantleGas({
        functions: fnInputs,
        deployment: { bytecode, l2GasUsed: 1_200_000n },
      });
    } catch (err) {
      if (err instanceof GasError) {
        console.error(pc.yellow(`gas profile unavailable [${err.code}]: ${err.message}`));
      } else throw err;
    }

    // === Render ===
    if (auditResult) printSecuritySection(auditResult);
    if (gasReport) printGasSection(gasReport);
    if (auditResult) printVerdict(auditResult, Date.now() - t0);

    // === Privacy: encrypt + (best-effort) upload ===
    let reportURI = (opts.reportUri as string | undefined) ?? undefined;
    if (opts.encrypt !== false && auditResult && gasReport) {
      const result = await encryptAndStore(auditResult, gasReport, opts);
      reportURI = reportURI ?? result?.uri;
    }

    // === Attestation ===
    if (opts.attest === true && auditResult && gasReport) {
      await attestOrLog(auditResult, gasReport, opts, reportURI);
    }

    // Exit-code gate so CI / pre-commit / PR review can BLOCK on risk.
    // Fails on any high/critical, or when the verdict score falls below
    // --threshold (default 0 = severity-only). Lets a team enforce e.g.
    // `anneal audit Vault.sol --threshold 80` as a merge gate.
    const findings = auditResult?.findings ?? [];
    const hasCritical = findings.some((f) => f.severity === "high" || f.severity === "critical");
    const threshold = Number(opts.threshold ?? 0);
    const belowThreshold = auditResult != null && threshold > 0 && auditResult.verdictScore < threshold;
    if (belowThreshold) {
      console.log(pc.red(`✗ gate: score ${auditResult!.verdictScore}/100 is below --threshold ${threshold}`));
    }
    process.exit(hasCritical || belowThreshold ? 1 : 0);
  });

program
  .command("register")
  .description("Register an agent in the ERC-8004 Identity Registry")
  .option("-n, --network <network>", "Network", "mantle-sepolia")
  .action(() => {
    console.log(pc.yellow("use: pnpm --filter @tryanneal/contracts hardhat run scripts/register-agent.ts --network mantleSepolia"));
  });

program
  .command("status")
  .description("Read agent status from chain")
  .requiredOption("--agent-id <id>", "Agent ID")
  .action((opts: { agentId: string }) => {
    console.log(pc.yellow(`status for agent ${opts.agentId}: use scripts/read-agent.ts`));
  });

// ============================================================================
// rendering
// ============================================================================

const severityColors: Record<LLMSeverity, (s: string) => string> = {
  critical: pc.bgRed,
  high: pc.red,
  medium: pc.yellow,
  low: pc.cyan,
  info: pc.dim,
};

const severityIcon: Record<LLMSeverity, string> = {
  critical: "🔴",
  high: "🔴",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

function printHeader(filePath: string, network: string): void {
  const name = basename(filePath);
  console.log(pc.bold("ANNEAL AUDIT REPORT"));
  console.log(pc.dim("━".repeat(40)));
  console.log();
  console.log(`File: ${pc.bold(name)}`);
  console.log(`Network: ${network}`);
  console.log(`Audited at: ${new Date().toISOString()}`);
  console.log(
    pc.dim(
      `Audited against TryAnneal corpus: ${CORPUS_SNAPSHOT.totalPatterns} exploit patterns | ` +
        `${CORPUS_SNAPSHOT.totalLossesHuman} losses | ${CORPUS_SNAPSHOT.yearMin}-${CORPUS_SNAPSHOT.yearMax}`,
    ),
  );
  console.log();
}

function printSecuritySection(audit: FullAuditResult): void {
  console.log(pc.bold("[SECURITY FINDINGS]"));
  if (audit.findings.length === 0) {
    console.log(pc.green("✓ no findings"));
    console.log();
    return;
  }
  for (const f of audit.findings) printFinding(f);
}

function printFinding(f: LLMFinding): void {
  // Corpus matches earn a special call-out — the demo punch.
  if (f.vulnClass === "corpus-match" || /corpus match/i.test(f.description)) {
    printCorpusMatch(f);
    return;
  }
  // Defensive lookup: an LLM or static analyzer may emit a severity string
  // outside our 5-tier enum. Fall back to info-style rendering rather than
  // crashing the report mid-stream.
  const sev = (f.severity as LLMSeverity) ?? "info";
  const icon = severityIcon[sev] ?? severityIcon.info;
  const colorize = severityColors[sev] ?? severityColors.info;
  const tag = colorize(String(f.severity ?? "info").toUpperCase());
  console.log(`${icon} ${tag} (${f.confidencePct}%) ${pc.bold(f.vulnClass)}`);
  console.log(pc.dim(`   Lines ${f.lineStart}-${f.lineEnd} | Sources: ${f.sources.join(", ")}`));
  const desc = (f.description ?? "").trim().split("\n")[0] ?? "";
  if (desc) console.log(`   ${desc}`);
  const rec = (f.recommendation ?? "").trim().split("\n")[0] ?? "";
  if (rec) console.log(pc.dim(`   Fix: ${rec}`));
  console.log();
}

function printCorpusMatch(f: LLMFinding): void {
  // Pull "78% similar to X (Y) — $ZM lost. Fix: ... See: URL"
  const desc = f.description.trim();
  const sim = desc.match(/(\d+(?:\.\d+)?)\s*%\s+similar to ([^—]+?)\s*\((\d{4})\)/i);
  const losses = desc.match(/\$([\d.]+)\s*([MK])/i);
  const fix = desc.match(/Fix:\s*([^]+?)(?=\s+See:|\s*$)/i);
  const ref = desc.match(/See:\s*(\S+)/i);

  console.log(pc.bold(pc.yellow(`⚠️  CORPUS MATCH${sim ? ` (${sim[1]}% similar to known exploit)` : ""}`)));
  if (sim) {
    const name = sim[2]!.trim();
    const year = sim[3]!.trim();
    const amount = losses ? `${losses[1]}${losses[2]}` : "?";
    console.log(`    ${pc.bold(name)} — ${year} — $${amount} lost`);
  }
  console.log(pc.dim(`    Lines ${f.lineStart}-${f.lineEnd} | Sources: ${f.sources.join(", ")}`));
  if (fix) console.log(`    Fix: ${fix[1]!.trim()}`);
  if (ref) console.log(pc.dim(`    Reference: ${ref[1]}`));
  console.log();
}

function fmtUSD(weiMNT: bigint, mntUSD = 0.6): string {
  const mnt = Number(weiMNT) / 1e18;
  const usd = mnt * mntUSD;
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function printGasSection(gas: MantleGasReport): void {
  console.log(pc.bold("[GAS PROFILE — MANTLE (Arsia)]"));
  const header = `${"".padEnd(28)}${pc.dim("L2 Exec".padEnd(11))}${pc.dim("L1 Data".padEnd(11))}${pc.dim("Operator".padEnd(11))}${pc.dim("Total")}`;
  console.log(header);
  const dep = gas.deployment;
  console.log(
    `${"Deploy".padEnd(28)}${fmtUSD(dep.l2ExecutionFee).padEnd(11)}${fmtUSD(dep.l1DataFee).padEnd(11)}${fmtUSD(dep.operatorFee).padEnd(11)}${pc.bold(fmtUSD(dep.l2ExecutionFee + dep.l1DataFee + dep.operatorFee))}`,
  );
  for (const f of gas.functions) {
    const total = f.l2ExecutionFee + f.l1DataFee + f.operatorFee;
    console.log(
      `${f.name.padEnd(28).slice(0, 28)}${fmtUSD(f.l2ExecutionFee).padEnd(11)}${fmtUSD(f.l1DataFee).padEnd(11)}${fmtUSD(f.operatorFee).padEnd(11)}${pc.bold(fmtUSD(total))}`,
    );
  }
  console.log();
  for (const o of gas.optimizations) {
    console.log(pc.cyan(`💡 ${o.type}: ${o.description} (~${o.estimatedSavingPct}% saving on ${o.affectedFunctions.join(", ")})`));
  }
  if (gas.params.source !== "live") {
    console.log(pc.dim(`(arsia params: ${gas.params.source})`));
  }
  console.log();
}

function printVerdict(audit: FullAuditResult, totalMs: number): void {
  const v = audit.verdictScore;
  const crit = audit.findings.filter((f) => f.severity === "critical").length;
  const high = audit.findings.filter((f) => f.severity === "high").length;
  // is_this_safe() — the moat answer, framed the same way the web, bot, and MCP do.
  if (audit.analysisIncomplete) {
    console.log(`is_this_safe()  ${pc.bold(pc.yellow("? INCONCLUSIVE"))}  ${pc.dim("— could not analyze; treat as unaudited")}`);
  } else if (crit === 0 && high === 0) {
    console.log(`is_this_safe()  ${pc.bold(pc.green("✓ SAFE"))}  ${pc.dim("— no critical or high findings")}`);
  } else {
    console.log(`is_this_safe()  ${pc.bold(pc.red("✗ UNSAFE"))}  ${pc.dim(`— ${crit} critical, ${high} high`)}`);
  }
  const color = v >= 90 ? pc.green : v >= 70 ? pc.cyan : v >= 50 ? pc.yellow : pc.red;
  console.log(`VERDICT: ${pc.bold(color(`${v}/100`))}`);
  console.log(
    pc.dim(
      `Models: ${audit.modelsUsed.join(", ") || "none"}` +
        (audit.modelsTimedOut.length ? ` (timed out: ${audit.modelsTimedOut.join(", ")})` : ""),
    ),
  );
  console.log(pc.dim(`Time: ${(totalMs / 1000).toFixed(1)}s | Cost: $${audit.estimatedCostUSD.toFixed(4)}`));
  console.log();
}

function reportError(err: unknown): void {
  if (err instanceof SlitherError) {
    console.error(pc.red(`slither error [${err.code}]: ${err.message}`));
    if (err.code === "NOT_INSTALLED") console.error(pc.dim("install: pip install slither-analyzer"));
  } else if (err instanceof LLMError) {
    console.error(pc.red(`llm error [${err.code}] (${err.model ?? "n/a"}): ${err.message}`));
    if (err.code === "MISSING_KEY")
      console.error(pc.dim("set CHAINGPT_API_KEY (pre-screen) and GEMINI_API_KEY / GROQ_API_KEY (critics), or pass --no-llm"));
  } else if (err instanceof GasError) {
    console.error(pc.red(`gas error [${err.code}]: ${err.message}`));
  } else {
    console.error(pc.red(`unexpected error: ${(err as Error).message}`));
  }
}

async function encryptAndStore(
  audit: FullAuditResult,
  gas: MantleGasReport,
  opts: Record<string, unknown>,
): Promise<{ uri: string; codeHash: string } | null> {
  try {
    const key = generateAuditKey();
    const enc = encryptFindings(audit.findings, gas, key);
    const blob = serializeEncryptedReport(enc);
    const source = await readFile(audit.filePath, "utf8");
    const codeHash = "0x" + createHash("sha3-256").update(source).digest("hex");
    const uploaded = await uploadToArweave(blob, {
      agentId: Number(process.env.ANNEAL_AGENT_ID ?? 0),
      codeHash,
      verdictScore: audit.verdictScore,
      network: audit.network,
      timestamp: new Date().toISOString(),
    }, {
      localFallbackDir: opts.reportsDir as string,
    });

    console.log(pc.bold("[PRIVACY]"));
    console.log(pc.green("✓ Findings encrypted (AES-256-GCM)"));
    if (uploaded.source === "arweave") {
      console.log(pc.green(`✓ Report stored: ${uploaded.uri}`));
    } else {
      console.log(pc.yellow(`✓ Report stored locally: ${uploaded.uri} (configure ARWEAVE_JWK for permanent storage)`));
    }
    console.log(pc.bold(`✓ Decryption key: 0x${key.toString("hex")}`));
    console.log(pc.dim("  save this — TryAnneal does not store it"));
    console.log();
    return { uri: uploaded.uri, codeHash };
  } catch (err) {
    console.error(pc.yellow(`encryption/storage skipped: ${(err as Error).message}`));
    return null;
  }
}

async function attestOrLog(
  audit: FullAuditResult,
  gas: MantleGasReport,
  opts: Record<string, unknown>,
  reportURI?: string,
): Promise<void> {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    console.error(pc.red("--attest: DEPLOYER_PRIVATE_KEY not set"));
    return;
  }
  const validation = typeof opts.validation === "string" ? opts.validation : process.env.VALIDATION_CONTRACT;
  if (!validation) {
    console.error(pc.red("--attest: pass --validation <address> or set VALIDATION_CONTRACT"));
    return;
  }
  const agentId = Number(process.env.ANNEAL_AGENT_ID ?? 0);
  const rpcUrl =
    opts.network === "mantle-sepolia" ? "https://rpc.sepolia.mantle.xyz" : "https://rpc.mantle.xyz";
  try {
    const source = await readFile(audit.filePath, "utf8");
    const res = await postAuditOnChain(
      audit,
      gas,
      {
        agentId,
        privateKey: pk,
        validationContractAddress: validation,
        rpcUrl,
        reportURI: reportURI ?? (opts.reportUri as string) ?? "ipfs://pending",
        sourceCode: source,
      },
    );
    const netLabel = opts.network === "mantle-sepolia" ? "Mantle Sepolia" : "Mantle";
    console.log(pc.bold("[ON-CHAIN ATTESTATION]"));
    console.log(pc.green(`✓ Verdict posted to ${netLabel}`));
    console.log(`  Tx: ${res.txHash}`);
    console.log(`  Agent ID: ${agentId}`);
    console.log(`  Code Hash: ${res.codeHash}`);
    console.log(`  Score: ${audit.verdictScore}/100`);
  } catch (err) {
    console.error(pc.red(`\nattest failed: ${(err as Error).message}`));
  }
}

async function main(): Promise<void> {
  // Bare `npx @tryanneal/cli` → show the banner, then help.
  if (process.argv.length <= 2) {
    await showBanner();
    program.outputHelp();
    return;
  }
  await program.parseAsync();
}

main().catch((err) => {
  console.error(pc.red(err.message));
  process.exit(1);
});
