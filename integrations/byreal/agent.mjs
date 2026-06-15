#!/usr/bin/env node
/**
 * Byreal × TryAnneal — a safety-gated DeFi agent.
 *
 * Demonstrates the `anneal-safety-gate` Agent Skill chaining IN FRONT of a
 * Byreal trade: the agent perceives market context from the Byreal Agent Skills
 * CLI, then — before deploying any capital into a Mantle contract — calls
 * TryAnneal's is_this_safe() and AUTONOMOUSLY decides to proceed or abort.
 * Every verdict is verifiable on-chain (ERC-8004 agent #131, Mantle mainnet).
 *
 *   node agent.mjs
 *
 * Read-only + non-custodial: it never signs a trade. The Byreal "open position"
 * is simulated after a SAFE verdict; the audit + on-chain verdict are real.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { execSync } from "node:child_process";

const MCP_URL = "https://mcp.tryanneal.xyz/mcp";
const C = { dim: "\x1b[2m", grn: "\x1b[32m", red: "\x1b[31m", cyn: "\x1b[36m", b: "\x1b[1m", x: "\x1b[0m" };
const log = (s = "") => console.log(s);

// A vulnerable contract the agent might be asked to enter — used to show the abort branch.
const VULN_SRC = `pragma solidity ^0.8.19;
contract Pool { mapping(address=>uint) bal;
  function deposit() external payable { bal[msg.sender]+=msg.value; }
  function withdraw() external { uint b=bal[msg.sender]; (bool ok,)=msg.sender.call{value:b}(""); require(ok); bal[msg.sender]=0; } }`;

async function byrealContext() {
  // Perceive: read live Byreal DEX context via its Agent Skills CLI (-o json).
  try {
    const raw = execSync("npx -y @byreal-io/byreal-cli@latest overview -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const j = JSON.parse(raw.slice(raw.indexOf("{")));
    return j.data;
  } catch {
    return null;
  }
}

async function gate(client, label, args, toolName) {
  // Chain the anneal-safety-gate skill: is_this_safe / audit_contract.
  const r = await client.callTool({ name: toolName, arguments: args });
  const v = JSON.parse(r.content[0].text);
  const safe = v.safe === true;
  log(`${C.cyn}anneal-safety-gate${C.x} → ${toolName}(${label})`);
  if (v.safe === null) { log(`  ${C.dim}no on-chain verdict yet — treat as unverified${C.x}`); return { safe: false, v }; }
  const crit = v.criticalCount ?? v.counts?.critical ?? 0;
  const high = v.highCount ?? v.counts?.high ?? 0;
  log(`  verdict: ${safe ? `${C.grn}SAFE${C.x}` : `${C.red}UNSAFE${C.x}`}  score ${v.score ?? v.verdictScore}/100  ` +
      `crit ${crit} high ${high}` + (v.attestedByAgentId ? `  ${C.dim}attested by agent #${v.attestedByAgentId}${C.x}` : ""));
  const top = v.findings?.[0];
  if (top) log(`  ${C.dim}top finding: ${(top.severity ?? "").toUpperCase()} ${top.vulnClass}` +
      (top.sources?.length ? ` — flagged by ${top.sources.join(", ")}` : "") + `${C.x}`);
  return { safe, v };
}

async function main() {
  log(`${C.b}Byreal × TryAnneal — safety-gated agent${C.x}\n`);

  const ctx = await byrealContext();
  if (ctx) log(`${C.dim}Byreal DEX context: $${(ctx.tvl/1e6).toFixed(1)}M TVL · ${ctx.pools_count} pools · $${(ctx.volume_24h_usd/1e6).toFixed(1)}M 24h vol${C.x}\n`);
  else log(`${C.dim}(byreal-cli context unavailable — continuing)${C.x}\n`);

  const client = new Client({ name: "byreal-safety-agent", version: "1.0.0" }, { capabilities: {} });
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));

  // ── Decision 1: a real, audited Mantle pool the agent wants to enter ──
  log(`${C.b}① Agent wants to LP into Merchant Moe LB Router (Mantle, ~$60M TVL)${C.x}`);
  const a = await gate(client, "0x013e138…Merchant Moe", { target: "0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a", network: "mantle" }, "is_this_safe");
  log(a.safe
    ? `  ${C.grn}DECISION: proceed${C.x} → chaining byreal \`positions open\` (simulated)\n`
    : `  ${C.red}DECISION: abort${C.x} → capital preserved\n`);

  // ── Decision 2: an unknown contract the agent is asked to deposit into ──
  log(`${C.b}② Agent is offered a new "high-yield" pool — audits the source first${C.x}`);
  const b = await gate(client, "unknown Pool.sol", { sourceCode: VULN_SRC }, "audit_contract");
  log(!b.safe
    ? `  ${C.red}DECISION: abort${C.x} → refused. The contract is reentrant; capital preserved.\n`
    : `  ${C.grn}DECISION: proceed${C.x}\n`);

  await client.close();
  log(`${C.dim}Every verdict above is reproducible and posted on-chain via ERC-8004 (agent #131, Mantle mainnet).${C.x}`);
  log(`${C.dim}The agent perceived context, audited, and decided autonomously — no human in the loop.${C.x}`);
}

main().catch((e) => { console.error(C.red + "agent error: " + e.message + C.x); process.exit(1); });
