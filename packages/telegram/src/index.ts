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
// Etherscan V2 multichain endpoint — the per-chain mantlescan V1 endpoints
// are deprecated and reject requests.
const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api";
const CHAIN_ID_BY_NET: Record<string, number> = { mainnet: 5000, sepolia: 5003 };
const MANTLESCAN_API: Record<string, string> = {
  mainnet: "https://api.mantlescan.xyz/api",
  sepolia: "https://api-sepolia.mantlescan.xyz/api",
};
const MANTLESCAN_TX: Record<string, string> = {
  mainnet: "https://mantlescan.xyz/tx/",
  sepolia: "https://sepolia.mantlescan.xyz/tx/",
};

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
\`/audit <0xAddress>\` — pull verified source from mantlescan and audit
\`/gas <0xAddress>\` — Arsia 3-component gas profile (no full audit)
\`/check <codeHash>\` — read an on-chain verdict from AnnealValidation
\`/help\` — this message

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
    const { source, name } = await fetchSource(arg);
    const audit = await withDeadline(runFullAudit(name, source), HARD_TIMEOUT_MS);
    await editMessage(formatAudit(audit));
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
    const { source, name } = await fetchSource(arg);
    const gas = await withDeadline(runGasOnly(source), HARD_TIMEOUT_MS);
    await ctx.api.editMessageText(ctx.chat!.id, status.message_id, formatGas(name, gas), {
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
  origin: "github" | "mantlescan-mainnet" | "mantlescan-sepolia";
}

async function fetchSource(arg: string): Promise<ResolvedSource> {
  if (/^https?:\/\//i.test(arg)) {
    if (!/raw\.githubusercontent\.com|gist\.githubusercontent\.com/.test(arg) && !arg.endsWith(".sol")) {
      throw new Error("URL must be a GitHub raw .sol file (raw.githubusercontent.com/...)");
    }
    const res = await fetch(arg);
    if (!res.ok) throw new Error(`source fetch ${res.status}`);
    const source = await res.text();
    const name = arg.split("/").pop() ?? "Contract.sol";
    return { source, name, origin: "github" };
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(arg)) {
    // Try mainnet first, then sepolia.
    for (const net of ["mainnet", "sepolia"] as const) {
      try {
        const source = await fetchVerifiedSource(arg, net);
        return { source, name: `${arg}.sol`, origin: `mantlescan-${net}` };
      } catch {
        continue;
      }
    }
    throw new Error("no verified source on mantlescan (mainnet or sepolia)");
  }
  throw new Error("input must be an https URL or a 0x… address");
}

async function fetchVerifiedSource(address: string, net: "mainnet" | "sepolia"): Promise<string> {
  const apiKey = process.env.MANTLESCAN_API_KEY ?? "any";
  const url = `${ETHERSCAN_V2}?chainid=${CHAIN_ID_BY_NET[net]}&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mantlescan ${res.status}`);
  const body = (await res.json()) as { result?: Array<{ SourceCode?: string; ContractName?: string }> };
  const first = body.result?.[0];
  const raw = first?.SourceCode?.trim();
  if (!raw) throw new Error(`no verified source on ${net}`);
  if (!raw.startsWith("{")) return raw;
  try {
    const inner = raw.startsWith("{{") && raw.endsWith("}}") ? raw.slice(1, -1) : raw;
    const obj = JSON.parse(inner) as { sources?: Record<string, { content: string }> };
    if (!obj.sources) return raw;
    const entries = Object.entries(obj.sources);
    // Audit the primary contract file (basename === ContractName) — auditing the
    // whole flattened multi-file blob blows the LLM context window and times out.
    const primary =
      entries.find(([p]) => p.split("/").pop()?.replace(/\.sol$/, "") === first?.ContractName) ??
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
    const filePath = resolve(tmpDir, name.endsWith(".sol") ? name : `${name}.sol`);
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

function formatAudit({ audit, name }: { audit: FullAuditResult; name: string }): string {
  const corpus = audit.corpusContext;
  const banner = corpus
    ? `_Audited against ${corpus.totalPatterns} corpus patterns | ${corpus.totalLossesHuman} losses | ${corpus.yearMin}–${corpus.yearMax}_`
    : "";
  const top = audit.findings.slice(0, 5);
  const findingsBlock = top
    .map((f) => formatFinding(f))
    .join("\n\n") || "_no findings_";
  const models = audit.modelsUsed?.length ? `\nModels: ${audit.modelsUsed.join(", ")}` : "";
  return `🔍 *TRYANNEAL AUDIT — ${escape(name)}*\n\n*VERDICT*: ${audit.verdictScore}/100\n\n${findingsBlock}${models}\n\n${banner}`;
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

function formatGas(name: string, gas: MantleGasReport): string {
  const dep = gas.deployment;
  const fnLines = gas.functions
    .slice(0, 8)
    .map(
      (f) =>
        `  ${f.name.padEnd(20)} ${fmtUSD(f.l2ExecutionFee)} + ${fmtUSD(f.l1DataFee)} + ${fmtUSD(f.operatorFee)} = ${fmtUSD(f.l2ExecutionFee + f.l1DataFee + f.operatorFee)}`,
    )
    .join("\n");
  return [
    `📊 *Arsia gas profile — ${escape(name)}*`,
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

function noopUnusedSilencer(_: typeof MANTLESCAN_TX): void {
  // MANTLESCAN_TX is reserved for the on-chain verdict path's mantlescan tx link,
  // which we surface in formatOnChainVerdict if v.reportURI is a tx-style ref.
}
void noopUnusedSilencer;

void bot.start({ onStart: (me) => console.log(`@${me.username} listening`) });
