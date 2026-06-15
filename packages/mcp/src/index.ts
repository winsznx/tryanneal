#!/usr/bin/env node
/**
 * TryAnneal MCP server.
 *
 * Exposes the is_this_safe() primitive and the full audit engine as Model
 * Context Protocol tools, so ANY MCP-capable AI agent — Claude Desktop,
 * Cursor, Claude Code, a custom agent — can ask "is this contract safe?"
 * before composing with unknown code, and get a verdict read straight from
 * the on-chain AnnealValidation registry on Mantle.
 *
 * Tools:
 *   - is_this_safe(target, network)      — on-chain verdict lookup (no keys)
 *   - audit_contract(sourceCode, ...)    — full engine audit (Slither/Aderyn +
 *                                          LLM cascade + corpus)
 *   - tryanneal_corpus_stats()           — the 113-pattern, $10.1B exploit corpus
 *
 * Run: `tryanneal-mcp` (stdio). See README.md for client config.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { JsonRpcProvider, Contract } from "ethers";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const RPC: Record<string, string> = {
  mantle: "https://rpc.mantle.xyz",
  "mantle-sepolia": "https://rpc.sepolia.mantle.xyz",
};
const VALIDATION: Record<string, string> = {
  mantle: "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
  "mantle-sepolia": "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
};
const EXPLORER_TX: Record<string, string> = {
  mantle: "https://mantlescan.xyz/tx/",
  "mantle-sepolia": "https://sepolia.mantlescan.xyz/tx/",
};
const CHAIN_ID: Record<string, number> = { mantle: 5000, "mantle-sepolia": 5003 };

const VALIDATION_ABI = [
  "function getVerdict(bytes32 codeHash) external view returns (tuple(uint256 agentId, bytes32 codeHash, uint8 verdictScore, uint8 criticalCount, uint8 highCount, uint8 mediumCount, uint8 lowCount, string reportURI, uint256 timestamp, bytes32 gasReportHash))",
];

type Network = "mantle" | "mantle-sepolia";

function providerFor(network: Network): JsonRpcProvider {
  return new JsonRpcProvider(RPC[network], undefined, { staticNetwork: true });
}

/** Fetch verified source for an address via the Etherscan V2 multichain API. */
async function fetchVerifiedSource(address: string, network: Network): Promise<string> {
  const apiKey = process.env.MANTLESCAN_API_KEY ?? "any";
  const url = `https://api.etherscan.io/v2/api?chainid=${CHAIN_ID[network]}&module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`explorer ${res.status}`);
  const body = (await res.json()) as { result?: Array<{ SourceCode?: string; ContractName?: string }> };
  const first = body.result?.[0];
  if (!first?.SourceCode) throw new Error(`no verified source for ${address}`);
  const raw = first.SourceCode.trim();
  if (!raw.startsWith("{")) return raw;
  try {
    const inner = raw.startsWith("{{") && raw.endsWith("}}") ? raw.slice(1, -1) : raw;
    const obj = JSON.parse(inner) as { sources?: Record<string, { content: string }> };
    if (!obj.sources) return raw;
    const entries = Object.entries(obj.sources);
    const primary =
      entries.find(([p]) => p.split("/").pop()?.replace(/\.sol$/, "") === first.ContractName) ??
      entries.sort((a, b) => b[1].content.length - a[1].content.length)[0];
    return primary ? primary[1].content : raw;
  } catch {
    return raw;
  }
}

function sha3Hash(s: string): string {
  return "0x" + createHash("sha3-256").update(s).digest("hex");
}

async function readVerdict(codeHash: string, network: Network) {
  const contract = new Contract(VALIDATION[network]!, VALIDATION_ABI, providerFor(network));
  const raw = (await contract.getFunction("getVerdict")(codeHash)) as Array<bigint | string>;
  const v = {
    agentId: Number(raw[0]),
    verdictScore: Number(raw[2]),
    criticalCount: Number(raw[3]),
    highCount: Number(raw[4]),
    mediumCount: Number(raw[5]),
    lowCount: Number(raw[6]),
    reportURI: String(raw[7]),
    timestamp: Number(raw[8]),
  };
  if (v.timestamp === 0) return null;
  return v;
}

const NETWORK_SCHEMA = z
  .enum(["mantle", "mantle-sepolia"])
  .default("mantle")
  .describe("Mantle network: 'mantle' (mainnet, chain 5000) or 'mantle-sepolia' (chain 5003).");

const server = new McpServer({ name: "tryanneal", version: "0.1.0" });

// ---------------------------------------------------------------------------
// is_this_safe — the primitive. On-chain verdict, no keys, no Slither.
// ---------------------------------------------------------------------------
server.registerTool(
  "is_this_safe",
  {
    title: "is_this_safe",
    description:
      "Check whether a smart contract has a TryAnneal safety verdict on-chain before composing with it. " +
      "Pass a 32-byte code hash, or a deployed contract address (its verified source is fetched and hashed). " +
      "Reads directly from the AnnealValidation registry on Mantle — the same call any agent makes. " +
      "Returns safe/unsafe, a 0-100 score, severity counts, and the attesting ERC-8004 agent.",
    inputSchema: {
      target: z
        .string()
        .describe("A 0x-prefixed 32-byte code hash, OR a deployed 20-byte contract address."),
      network: NETWORK_SCHEMA,
    },
  },
  async ({ target, network }) => {
    try {
      const t = target.trim().toLowerCase();
      let codeHash: string;
      let resolvedFrom: string | undefined;
      if (/^0x[0-9a-f]{64}$/.test(t)) {
        codeHash = t;
      } else if (/^0x[0-9a-f]{40}$/.test(t)) {
        const source = await fetchVerifiedSource(t, network);
        codeHash = sha3Hash(source);
        resolvedFrom = `address ${t} → codeHash ${codeHash}`;
      } else {
        return {
          isError: true,
          content: [{ type: "text", text: "Invalid target: expected a 0x 32-byte code hash or a 20-byte address." }],
        };
      }
      const v = await readVerdict(codeHash, network);
      if (!v) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  safe: null,
                  codeHash,
                  network,
                  message:
                    "No on-chain verdict yet. Run audit_contract to analyze it, or `anneal audit <file> --attest` to post one.",
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      const safe = v.criticalCount === 0 && v.highCount === 0;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                safe,
                score: v.verdictScore,
                codeHash,
                network,
                resolvedFrom,
                criticalCount: v.criticalCount,
                highCount: v.highCount,
                mediumCount: v.mediumCount,
                lowCount: v.lowCount,
                attestedByAgentId: v.agentId,
                attestedAt: new Date(v.timestamp * 1000).toISOString(),
                registry: VALIDATION[network],
                recommendation: safe
                  ? "No critical/high findings on record. Still review medium/low before high-value use."
                  : "Has critical or high findings — do NOT compose without remediation.",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `is_this_safe failed: ${(err as Error).message}` }] };
    }
  },
);

// ---------------------------------------------------------------------------
// audit_contract — the full engine. Needs Slither (and optional LLM keys).
// ---------------------------------------------------------------------------
server.registerTool(
  "audit_contract",
  {
    title: "audit_contract",
    description:
      "Run a full TryAnneal audit on Solidity source: Slither + Aderyn static analysis, the multi-LLM cascade " +
      "(ChainGPT/Gemini/Groq/Tencent Hunyuan when keys are set), and the 113-pattern exploit corpus. " +
      "Returns a verdict score, findings with sources + confidence, and corpus context. " +
      "Requires `slither` on PATH; LLM keys (CHAINGPT_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, HUNYUAN_API_KEY) are optional.",
    inputSchema: {
      sourceCode: z.string().describe("Full Solidity source to audit."),
      contractName: z.string().default("Contract.sol").describe("Optional file name for the report."),
      network: NETWORK_SCHEMA,
    },
  },
  async ({ sourceCode, contractName, network }) => {
    let dir: string | null = null;
    try {
      const engine = await import("@tryanneal/engine");
      dir = await mkdtemp(join(tmpdir(), "tryanneal-mcp-"));
      const file = resolve(dir, contractName.endsWith(".sol") ? contractName : `${contractName}.sol`);
      await writeFile(file, sourceCode, "utf8");
      const hasLlm = Boolean(process.env.CHAINGPT_API_KEY);
      const audit = await engine.runAudit(file, {
        network,
        quick: false,
        noLlm: !hasLlm,
        chaingptKey: process.env.CHAINGPT_API_KEY ?? null,
        geminiKey: process.env.GEMINI_API_KEY ?? null,
        groqKey: process.env.GROQ_API_KEY ?? null,
        hunyuanKey: process.env.HUNYUAN_API_KEY ?? null,
        hunyuanModel: process.env.HUNYUAN_MODEL,
        hunyuanBaseURL: process.env.HUNYUAN_BASE_URL,
      });
      const codeHash = sha3Hash(sourceCode);
      const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const f of audit.findings) {
        const cur = counts[f.severity];
        if (cur !== undefined) counts[f.severity] = cur + 1;
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                verdictScore: audit.verdictScore,
                safe: counts.critical === 0 && counts.high === 0,
                codeHash,
                mode: hasLlm ? "llm-cascade" : "static-only",
                modelsUsed: audit.modelsUsed,
                counts,
                findings: audit.findings.map((f) => ({
                  severity: f.severity,
                  vulnClass: f.vulnClass,
                  lines: `${f.lineStart}-${f.lineEnd}`,
                  confidence: f.confidencePct,
                  sources: f.sources,
                  description: f.description.slice(0, 280),
                  recommendation: f.recommendation?.slice(0, 280),
                })),
                corpus: audit.corpusContext,
                note: "To make this verdict public + queryable, post it on-chain: `anneal audit <file> --attest`.",
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `audit_contract failed: ${(err as Error).message}. ` +
              "If this is 'slither not installed', install it: `pip install slither-analyzer` + solc 0.8.24.",
          },
        ],
      };
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  },
);

// ---------------------------------------------------------------------------
// tryanneal_corpus_stats — the moat, as a tool. No deps.
// ---------------------------------------------------------------------------
server.registerTool(
  "tryanneal_corpus_stats",
  {
    title: "tryanneal_corpus_stats",
    description:
      "Return the stats of the TryAnneal exploit corpus that every audit cross-references: " +
      "the number of vetted historical exploit patterns, total documented losses, years, and chains covered.",
    inputSchema: {},
  },
  async () => {
    try {
      const engine = await import("@tryanneal/engine");
      const snap = (engine as { CORPUS_SNAPSHOT?: unknown }).CORPUS_SNAPSHOT ?? {
        totalPatterns: 113,
        totalLossesHuman: "$10.1B",
        yearMin: 2020,
        yearMax: 2026,
      };
      return { content: [{ type: "text", text: JSON.stringify(snap, null, 2) }] };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: `corpus_stats failed: ${(err as Error).message}` }] };
    }
  },
);

void EXPLORER_TX; // reserved for a future "get the on-chain tx" tool

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP channel.
  console.error("TryAnneal MCP server running on stdio. Tools: is_this_safe, audit_contract, tryanneal_corpus_stats.");
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
