---
name: anneal-safety-gate
description: A pre-trade safety gate for autonomous DeFi agents. Before you deploy capital into a pool, lending market, router, or any contract you did not write, call TryAnneal's is_this_safe() to get a deterministic SAFE/UNSAFE verdict — and refuse to proceed on UNSAFE. Chains in front of Byreal positions/swap skills. Every verdict is verifiable on-chain via ERC-8004.
---

# anneal-safety-gate

The safety check an agent should chain **before** it opens a position, adds liquidity, or composes with an unknown contract. Built on the open Agent Skills standard so it slots in front of Byreal's `positions` / `swaps` skills.

## When to use
Whenever you are about to move real capital into a contract you did not author — a new pool, a token, a lending market, a router. Especially on the Mantle DeFi venues a Byreal/RealClaw agent can reach (Merchant Moe, Agni, Fluxion). Capital preservation comes before yield.

## How to use
1. Resolve the target contract address (e.g. the Mantle pool/router you intend to enter).
2. Ask TryAnneal one of:
   - **MCP** (agents in Claude/Cursor): tool `is_this_safe({ target, network })` on server `mcp.tryanneal.xyz`.
   - **REST**: `curl "https://tryanneal.xyz/api/safety/<codeHash>?network=mantle"`.
   - **CLI** (source files): `npx @tryanneal/cli audit <file> --threshold 80` (exit non-zero = unsafe).
3. Read the verdict JSON:
   ```json
   { "safe": true, "score": 100, "criticalCount": 0, "highCount": 0, "attestedByAgentId": 131 }
   ```
4. **Gate, autonomously:**
   - `safe === false` (or `score` below your threshold) → **DO NOT proceed.** Abort the trade, surface the findings, preserve capital.
   - `safe === true` → proceed to the Byreal `positions open` / `swaps` command.

## Why this matters
Autonomous agents move real money. An agent that deploys into an unaudited or malicious contract loses it. This skill makes "audit before you trade" a single, deterministic, **on-chain-verifiable** step: every verdict is posted via ERC-8004 by TryAnneal agent **#131** on Mantle mainnet, so the gate decision can be audited after the fact. The verdict is reproducible (same contract → same verdict), so two agents gate identically.

## Engine behind it
Multi-model cross-validation (ChainGPT pre-screen → two Groq critics → Slither + Aderyn + 16 custom detectors → a 98-pattern / $7.1B exploit corpus; a finding needs ≥2 independent sources). Deterministic. Mantle-native. See https://tryanneal.xyz/docs.
