/**
 * @tryannealbot — Telegram bot wrapper around the TryAnneal audit engine.
 *
 * Commands:
 *   /audit <github_raw_url>     run a full pipeline audit on a GitHub-hosted .sol file
 *   /audit <0xAddress>           pull verified source from mantlescan, then audit
 *   /gas <0xAddress>             gas profile only (Arsia 3-component breakdown)
 *   /check <codeHash>            read on-chain verdict from AnnealValidation
 *   /help                        usage
 *
 * Long operations: send "⏳ Auditing…" first, then edit the message with the
 * formatted result. Hard timeout 60s — if the engine takes longer the bot
 * replies with a partial result rather than hanging.
 *
 * Runtime: `grammy` (a slim, type-safe Telegram bot framework). Run as a
 * separate Railway service. Bot token in TELEGRAM_BOT_TOKEN.
 */
import { Bot, type Context } from "grammy";
import { JsonRpcProvider, Contract } from "ethers";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type {
  FullAuditResult,
  LLMFinding,
  LLMSeverity,
  MantleGasReport,
} from "@tryanneal/engine";

const HARD_TIMEOUT_MS = 60_000;
const VALIDATION_BY_NETWORK: Record<string, string> = {
  mainnet: process.env.VALIDATION_MAINNET ?? "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
  sepolia: process.env.VALIDATION_SEPOLIA ?? "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
};
const RPC_BY_NETWORK: Record<string, string> = {
  mainnet: "https://rpc.mantle.xyz",
  sepolia: "https://rpc.sepolia.mantle.xyz",
};
// Etherscan V2 multichain endpoint — one API key resolves verified source on
// 60+ chains via the chainid param (the per-chain V1 endpoints are deprecated).
const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api";
// A single Etherscan-family key resolves every V2 chain. Set ETHERSCAN_API_KEY
// (free from etherscan.io) for full multichain; falls back to the Mantle key.
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? process.env.MANTLESCAN_API_KEY ?? "any";

// Probed in priority order (Mantle is home) when resolving a bare address.
const SOURCE_CHAINS: { id: number; name: string; explorer: string }[] = [
  { id: 5000, name: "Mantle", explorer: "https://mantlescan.xyz" },
  { id: 5003, name: "Mantle Sepolia", explorer: "https://sepolia.mantlescan.xyz" },
  { id: 1, name: "Ethereum", explorer: "https://etherscan.io" },
  { id: 8453, name: "Base", explorer: "https://basescan.org" },
  { id: 42161, name: "Arbitrum", explorer: "https://arbiscan.io" },
  { id: 10, name: "Optimism", explorer: "https://optimistic.etherscan.io" },
  { id: 56, name: "BNB Chain", explorer: "https://bscscan.com" },
  { id: 137, name: "Polygon", explorer: "https://polygonscan.com" },
  { id: 43114, name: "Avalanche", explorer: "https://snowscan.xyz" },
];

const VALIDATION_ABI = [
  "function getVerdict(bytes32 codeHash) external view returns (tuple(uint256 agentId, bytes32 codeHash, uint8 verdictScore, uint8 criticalCount, uint8 highCount, uint8 mediumCount, uint8 lowCount, string reportURI, uint256 timestamp, bytes32 gasReportHash))",
];

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not set — refusing to start.");
  process.exit(1);
}

const bot = new Bot(token);

// ---------------------------------------------------------------------------
// Help + intro
// ---------------------------------------------------------------------------

const HELP_TEXT = `🔍 *TryAnneal Audit Bot*

Multi-LLM smart-contract audit for the Mantle agent economy.

*Commands*
\`/audit <github_raw_url>\` — audit a .sol file from a public GitHub URL
\`/audit <0xAddress>\` — auto-detect the chain, pull verified source, audit
\`/gas <0xAddress>\` — Arsia 3-component gas profile (no full audit)
\`/check <codeHash>\` — read an on-chain verdict from AnnealValidation
\`/help\` — this message

*Any chain in, one registry out.* Paste a contract address and I find its
verified source across Mantle, Ethereum, Base, Arbitrum, Optimism, BNB,
Polygon or Avalanche. Unverified source? I'll tell you. Every verdict
attests on-chain to AnnealValidation on *Mantle mainnet* (agent #131).

*What you get*
Verdict score (0–100), severity counts, top corpus match, Arsia gas
breakdown — and the *Tencent Cloud Hunyuan* + Gemini + Groq cascade
when API keys are configured server-side.

Repo: github.com/winsznx/tryanneal
Web:  tryanneal.xyz
`;

bot.command(["start", "help"], async (ctx) => {
  await ctx.reply(HELP_TEXT, { parse_mode: "Markdown" });
});

// ---------------------------------------------------------------------------
// /audit
// ---------------------------------------------------------------------------

bot.command("audit", async (ctx) => {
  const arg = ctx.match?.toString().trim();
  if (!arg) {
    await ctx.reply("Usage: `/audit <github_raw_url>` or `/audit <0xAddress>`", {
      parse_mode: "Markdown",
    });
    return;
  }

  const status = await ctx.reply("⏳ Auditing…");
  const editMessage = async (text: string) => {
    try {
      await ctx.api.editMessageText(ctx.chat!.id, status.message_id, text, {
        parse_mode: "Markdown",
      });
    } catch {
      // Long messages may exceed 4096 chars — fall back to a fresh reply.
      await ctx.reply(text, { parse_mode: "Markdown" });
    }
  };

  try {
    const resolved = await fetchSource(arg);
    const { audit } = await withDeadline(runFullAudit(resolved.name, resolved.source), HARD_TIMEOUT_MS);
    await editMessage(formatAudit(audit, resolved));
  } catch (err) {
    await editMessage(`❌ ${(err as Error).message ?? "audit failed"}`);
  }
});

// ---------------------------------------------------------------------------
// /gas
// ---------------------------------------------------------------------------

bot.command("gas", async (ctx) => {
  const arg = ctx.match?.toString().trim();
  if (!arg) {
    await ctx.reply("Usage: `/gas <0xAddress>`", { parse_mode: "Markdown" });
    return;
  }
  const status = await ctx.reply("⏳ Fetching gas profile…");
  try {
    const resolved = await fetchSource(arg);
    const gas = await withDeadline(runGasOnly(resolved.source), HARD_TIMEOUT_MS);
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, formatGas(resolved, gas), {
      parse_mode: "Markdown",
    });
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      status.message_id,
      `❌ ${(err as Error).message ?? "gas profile failed"}`,
    );
  }
});

// ---------------------------------------------------------------------------
// /check (on-chain verdict lookup)
// ---------------------------------------------------------------------------

bot.command("check", async (ctx) => {
  const arg = ctx.match?.toString().trim();
  if (!arg || !/^0x[0-9a-fA-F]{64}$/.test(arg)) {
    await ctx.reply(
      "Usage: `/check <codeHash>` — 0x-prefixed 32-byte hex.",
      { parse_mode: "Markdown" },
    );
    return;
  }
  const status = await ctx.reply("⏳ Reading on-chain verdict…");
  try {
    const result = await readOnChainVerdict(arg);
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, formatOnChainVerdict(arg, result), {
      parse_mode: "Markdown",
    });
  } catch (err) {
    await ctx.api.editMessageText(
      ctx.chat!.id,
      status.message_id,
      `❌ ${(err as Error).message ?? "verdict lookup failed"}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Source resolution
// ---------------------------------------------------------------------------

interface ResolvedSource {
  source: string;
  name: string;
  origin: string; // "GitHub" or the chain name
  chain?: string;
  explorerUrl?: string;
  verified: boolean;
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

async function fetchSource(arg: string): Promise<ResolvedSource> {
  if (/^https?:\/\//i.test(arg)) {
    if (!/raw\.githubusercontent\.com|gist\.githubusercontent\.com/.test(arg) && !arg.endsWith(".sol")) {
      throw new Error("URL must be a GitHub raw .sol file (raw.githubusercontent.com/…)");
    }
    const res = await fetch(arg);
    if (!res.ok) throw new Error(`source fetch ${res.status}`);
    const source = await res.text();
    const name = arg.split("/").pop() ?? "Contract.sol";
    return { source, name, origin: "GitHub", verified: false };
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(arg)) {
    const r = await resolveAddressSource(arg);
    return { source: r.source, name: r.name, origin: r.chain, chain: r.chain, explorerUrl: r.explorerUrl, verified: true };
  }
  throw new Error("Input must be a GitHub raw .sol URL or a 0x… contract address.");
}

interface ChainHit {
  name: string;
  explorer: string;
  verified: boolean;
  exists: boolean;
  contractName?: string;
  source?: string;
}

async function probeChainSource(
  address: string,
  chain: { id: number; name: string; explorer: string },
): Promise<ChainHit> {
  try {
    const url = `${ETHERSCAN_V2}?chainid=${chain.id}&module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return { name: chain.name, explorer: chain.explorer, verified: false, exists: false };
    const body = (await res.json()) as {
      result?: Array<{ SourceCode?: string; ContractName?: string; ABI?: string }>;
    };
    const first = body.result?.[0];
    const raw = first?.SourceCode?.trim();
    if (raw) {
      return {
        name: chain.name,
        explorer: chain.explorer,
        verified: true,
        exists: true,
        contractName: first?.ContractName,
        source: extractPrimarySource(raw, first?.ContractName),
      };
    }
    // Etherscan returns "Contract source code not verified" in ABI when the
    // address has bytecode but no verified source — that's "exists, unverified".
    const exists = (first?.ABI ?? "").toLowerCase().includes("not verified");
    return { name: chain.name, explorer: chain.explorer, verified: false, exists };
  } catch {
    return { name: chain.name, explorer: chain.explorer, verified: false, exists: false };
  }
}

async function resolveAddressSource(
  address: string,
): Promise<{ source: string; name: string; chain: string; explorerUrl: string }> {
  const hits = await Promise.all(SOURCE_CHAINS.map((c) => probeChainSource(address, c)));
  const verified = hits.find((h) => h.verified && h.source);
  if (verified) {
    const explorer = SOURCE_CHAINS.find((c) => c.name === verified.name)!.explorer;
    return {
      source: verified.source!,
      name: verified.contractName || shortAddr(address),
      chain: verified.name,
      explorerUrl: `${explorer}/address/${address}`,
    };
  }
  const seenOn = hits.filter((h) => h.exists).map((h) => h.name);
  if (seenOn.length) {
    throw new Error(
      `Found on *${seenOn.join(", ")}* but the source is *not verified* there — I can only audit verified source. Verify it on the explorer, or paste a GitHub raw .sol URL.`,
    );
  }
  throw new Error(
    `No *verified* contract for \`${shortAddr(address)}\` on Mantle, Ethereum, Base, Arbitrum, Optimism, BNB, Polygon, or Avalanche. If it's on another chain, paste a GitHub raw .sol URL.`,
  );
}

function extractPrimarySource(raw: string, contractName?: string): string {
  if (!raw.startsWith("{")) return raw;
  try {
    const inner = raw.startsWith("{{") && raw.endsWith("}}") ? raw.slice(1, -1) : raw;
    const obj = JSON.parse(inner) as { sources?: Record<string, { content: string }> };
    if (!obj.sources) return raw;
    const entries = Object.entries(obj.sources);
    // Audit the primary contract file (basename === ContractName) — auditing the
    // whole flattened multi-file blob blows the LLM context window and times out.
    const primary =
      entries.find(([p]) => p.split("/").pop()?.replace(/\.sol$/, "") === contractName) ??
      entries.sort((a, b) => b[1].content.length - a[1].content.length)[0];
    return primary ? primary[1].content : raw;
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Engine calls
// ---------------------------------------------------------------------------

async function runFullAudit(name: string, source: string): Promise<{ audit: FullAuditResult; name: string }> {
  const engine = await import("@tryanneal/engine");
  const { runAudit } = engine;
  const tmpDir = await mkdtemp(join(tmpdir(), "anneal-bot-"));
  try {
    // A contract name (or short address) may contain chars illegal in a path;
    // sanitize to a safe basename before writing the temp .sol file.
    const base = (name || "Contract").replace(/[^a-zA-Z0-9_.-]/g, "_");
    const filePath = resolve(tmpDir, base.endsWith(".sol") ? base : `${base}.sol`);
    await writeFile(filePath, source, "utf8");
    const audit = await runAudit(filePath, {
      network: "mantle",
      quick: true,
      noLlm: !process.env.CHAINGPT_API_KEY,
      chaingptKey: process.env.CHAINGPT_API_KEY ?? null,
      geminiKey: process.env.GEMINI_API_KEY ?? null,
      groqKey: process.env.GROQ_API_KEY ?? null,
      hunyuanKey: process.env.HUNYUAN_API_KEY ?? null,
      hunyuanModel: process.env.HUNYUAN_MODEL,
      hunyuanBaseURL: process.env.HUNYUAN_BASE_URL,
    });
    return { audit, name };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runGasOnly(source: string): Promise<MantleGasReport> {
  const engine = await import("@tryanneal/engine");
  const { profileMantleGas, toFunctionInputs } = engine;
  return profileMantleGas({
    functions: toFunctionInputs(source),
    deployment: { bytecode: new Uint8Array(Math.max(2000, source.length * 2)), l2GasUsed: 1_200_000n },
  });
}

interface OnChainVerdict {
  found: boolean;
  network: "mainnet" | "sepolia";
  agentId: number;
  verdictScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  reportURI: string;
  timestampISO: string;
}

async function readOnChainVerdict(codeHash: string): Promise<OnChainVerdict> {
  for (const net of ["mainnet", "sepolia"] as const) {
    const addr = VALIDATION_BY_NETWORK[net];
    if (!addr) continue;
    const provider = new JsonRpcProvider(RPC_BY_NETWORK[net], undefined, { staticNetwork: true });
    const c = new Contract(addr, VALIDATION_ABI, provider);
    try {
      const raw = (await c.getFunction("getVerdict")(codeHash)) as unknown as Array<bigint | string>;
      const ts = Number(raw[8]);
      if (ts === 0) continue;
      return {
        found: true,
        network: net,
        agentId: Number(raw[0]),
        verdictScore: Number(raw[2]),
        criticalCount: Number(raw[3]),
        highCount: Number(raw[4]),
        mediumCount: Number(raw[5]),
        lowCount: Number(raw[6]),
        reportURI: String(raw[7]),
        timestampISO: new Date(ts * 1000).toISOString(),
      };
    } catch {
      continue;
    }
  }
  return {
    found: false,
    network: "sepolia",
    agentId: 0,
    verdictScore: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    reportURI: "",
    timestampISO: "",
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const SEVERITY_EMOJI: Record<LLMSeverity, string> = {
  critical: "🔴",
  high: "🔴",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

function verdictBadge(score: number, criticalOrHigh: boolean): string {
  if (criticalOrHigh) return "⚠️ REVIEW";
  if (score >= 90) return "✅ SAFE";
  if (score >= 70) return "🟡 CAUTION";
  return "🔴 RISK";
}

function formatAudit(audit: FullAuditResult, r: ResolvedSource): string {
  const f = audit.findings ?? [];
  const c = f.filter((x) => x.severity === "critical").length;
  const h = f.filter((x) => x.severity === "high").length;
  const m = f.filter((x) => x.severity === "medium").length;
  const l = f.filter((x) => x.severity === "low").length;

  const subject = r.chain ? `${escape(r.name)}  ·  ${r.chain}${r.verified ? " ✓" : ""}` : escape(r.name);
  const findingsBlock = f.slice(0, 5).map((x) => formatFinding(x)).join("\n\n") || "_no findings — clean_";
  const sourceLine = r.explorerUrl ? `📄 [Verified source ↗](${r.explorerUrl})` : `📄 Source: ${escape(r.origin)}`;
  const models = audit.modelsUsed?.length ? `🧠 ${audit.modelsUsed.join("  ·  ")}` : "";
  const corpus = audit.corpusContext
    ? `_Checked against ${audit.corpusContext.totalPatterns} exploit patterns · ${audit.corpusContext.totalLossesHuman} losses · ${audit.corpusContext.yearMin}–${audit.corpusContext.yearMax}_`
    : "";

  return [
    "🛡️ *TryAnneal Audit*",
    `*${subject}*`,
    "",
    `*Verdict:* ${audit.verdictScore}/100  —  ${verdictBadge(audit.verdictScore, c + h > 0)}`,
    `*Severity:* ${c}C  ${h}H  ${m}M  ${l}L`,
    "",
    findingsBlock,
    "",
    [sourceLine, models].filter(Boolean).join("\n"),
    "",
    corpus,
    "_Verdicts attest on-chain to AnnealValidation · Mantle mainnet · agent #131 · tryanneal.xyz_",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

function formatFinding(f: LLMFinding): string {
  const emoji = SEVERITY_EMOJI[f.severity] ?? "⚪";
  const tag = f.severity.toUpperCase();
  const sources = f.sources?.length ? ` | Sources: ${f.sources.join(", ")}` : "";
  return [
    `${emoji} *${tag}* (${f.confidencePct}%) — ${escape(f.vulnClass)}`,
    `  Lines ${f.lineStart}-${f.lineEnd}${sources}`,
    `  ${escape((f.description ?? "").split("\n")[0] ?? "")}`,
    f.recommendation ? `  Fix: ${escape((f.recommendation ?? "").split("\n")[0] ?? "")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function fmtUSD(weiMNT: bigint, mntUSD = 0.6): string {
  const mnt = Number(weiMNT) / 1e18;
  const usd = mnt * mntUSD;
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatGas(r: ResolvedSource, gas: MantleGasReport): string {
  const dep = gas.deployment;
  const subject = r.chain ? `${escape(r.name)} · ${r.chain}` : escape(r.name);
  const fnLines = gas.functions
    .slice(0, 8)
    .map(
      (f) =>
        `  ${f.name.padEnd(20)} ${fmtUSD(f.l2ExecutionFee)} + ${fmtUSD(f.l1DataFee)} + ${fmtUSD(f.operatorFee)} = ${fmtUSD(f.l2ExecutionFee + f.l1DataFee + f.operatorFee)}`,
    )
    .join("\n");
  return [
    `📊 *Arsia gas profile — ${subject}*`,
    "",
    "*Deployment*",
    `  L2 exec : ${fmtUSD(dep.l2ExecutionFee)}`,
    `  L1 data : ${fmtUSD(dep.l1DataFee)}`,
    `  Operator: ${fmtUSD(dep.operatorFee)}`,
    `  Total   : *${fmtUSD(dep.l2ExecutionFee + dep.l1DataFee + dep.operatorFee)}*`,
    "",
    "*Per-function (top 8)*",
    "```",
    fnLines || "(no callable functions)",
    "```",
    gas.params.source === "live" ? "_Arsia params: live RPC consensus_" : `_Arsia params: ${gas.params.source}_`,
  ].join("\n");
}

function formatOnChainVerdict(codeHash: string, v: OnChainVerdict): string {
  if (!v.found) {
    return `❓ No on-chain verdict found for \`${codeHash}\`.\n\nRun \`/audit <url|address>\` and have it attested with \`anneal audit … --attest\`.`;
  }
  return [
    `🔗 *On-chain verdict — Mantle ${v.network}*`,
    "",
    `  *Score*: ${v.verdictScore}/100`,
    `  *Severity*: ${v.criticalCount}C ${v.highCount}H ${v.mediumCount}M ${v.lowCount}L`,
    `  *Agent*: ${v.agentId}`,
    `  *Posted*: ${v.timestampISO}`,
    `  *Report*: \`${v.reportURI}\``,
    "",
    `_Code hash:_ \`${codeHash}\``,
  ].join("\n");
}

function escape(text: string): string {
  // Telegram Markdown: backticks + asterisks + underscores carry weight.
  return text.replace(/([*_`\[\]])/g, "\\$1");
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolvePromise, rejectPromise) => {
    const t = setTimeout(() => rejectPromise(new Error(`timed out after ${ms / 1000}s`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolvePromise(v);
      },
      (e) => {
        clearTimeout(t);
        rejectPromise(e);
      },
    );
  });
}

bot.catch((err: { ctx?: Context; error?: unknown } | Error) => {
  console.error("bot error", err);
});

void bot.start({ onStart: (me) => console.log(`@${me.username} listening`) });
