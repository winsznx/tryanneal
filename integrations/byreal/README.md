# Byreal × TryAnneal — safety-gated DeFi agent

> Agentic Economy Track (Byreal). A pre-trade **safety gate** that chains in front of Byreal's trading skills: an autonomous agent reads Byreal market context, **audits the target contract with TryAnneal's `is_this_safe()` before it deploys capital**, and decides — proceed or abort — on its own. Every verdict is verifiable on-chain (ERC-8004, agent #131, Mantle mainnet).

## Why this exists
Byreal makes agents that *move* money. The missing piece in the agentic economy is the question an agent should ask **before** it commits capital: *is this contract safe?* `anneal-safety-gate` is that step — an [Agent Skill](./anneal-safety-gate/SKILL.md) any Byreal/RealClaw agent can chain in front of `positions open` / `swaps`.

It doesn't distort either product: Byreal executes, TryAnneal verifies. Capital preservation before yield.

## What's here
- **`anneal-safety-gate/SKILL.md`** — the Agent Skill (open Agent-Skills standard). Wraps TryAnneal's hosted MCP `is_this_safe` / the REST oracle / the CLI. Installable:
  ```bash
  npx skills add winsznx/tryanneal/integrations/byreal/anneal-safety-gate
  ```
- **`agent.mjs`** — a runnable agent loop proving the chain end-to-end.

## Run it
```bash
npm install
npm run agent        # node agent.mjs
```
What it does (all real except the trade, which is simulated — non-custodial, never signs):
1. **Perceives** live Byreal DEX context via the Byreal Agent Skills CLI (`byreal overview -o json` → TVL, pools, volume).
2. **Decision ①** — wants to LP into Merchant Moe's LB Router (Mantle, ~$60M TVL) → chains `is_this_safe` → **SAFE 100/100, attested by agent #131** → proceeds to `byreal positions open`.
3. **Decision ②** — offered an unknown "high-yield" pool → audits the source → **UNSAFE: HIGH Reentrancy** (cross-validated by chaingpt, groq, gpt-oss, slither) → **aborts, capital preserved.**

```
① Merchant Moe → SAFE 100/100 (agent #131) → DECISION: proceed
② unknown pool → UNSAFE (HIGH Reentrancy) → DECISION: abort → capital preserved
```

## How it maps to the track
- **Byreal integration depth** — chains as an extensible Agent Skill in front of Byreal's `positions`/`swaps`, consuming the Byreal CLI's JSON. (We add a safety capability; we don't recreate Byreal.)
- **Agent autonomy** — a genuine perceive → audit → **decide** → (proceed or recover) loop with a real branch; no human in the loop.
- **Use case clarity** — "agents shouldn't deploy capital into unaudited contracts" — a sharp, defensible, real use case for any agent moving real money.
- **Verifiability** — every verdict is deterministic (same contract → same verdict) and posted on-chain via ERC-8004 (agent #131); the demo is reproducible.

## Honest scope
TryAnneal is a **safety gate, not a trader** — it verifies the contracts a Byreal agent enters; it doesn't manage an LP book or run perps itself. That's deliberate: it's the trust layer the agentic economy is missing, not another trading bot. Byreal's CLMM is Solana-native; this gate covers the **EVM/Mantle** contracts a cross-ecosystem (RealClaw) agent reaches.

Engine: multi-model cross-validation + 16 detectors + 98-pattern / $7.1B corpus, deterministic. See https://tryanneal.xyz/docs.
