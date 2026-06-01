# TRYANNEAL — Claude Code Project Instructions

## What This Is
TryAnneal: Agent trust infrastructure for the agentic era. Multi-LLM audit engine + Mantle-native gas profiler + ERC-8004 on-chain attestation + privacy-first findings.

## Hackathon
Mantle Turing Test 2026 — AI DevTools Track. Deadline: June 15, 2026. Demo Day: July 2-3.

## Stack
- **Frontend:** Next.js 16.2, TailwindCSS 4, Motion (motion.dev), TanStack Query
- **Backend:** Node.js/TypeScript, Bull Queue (Redis), Postgres + pgvector
- **LLM:** ChainGPT (pre-screen) → Gemini 2.5 Pro + Groq Llama 3.3 70B (critic cascade). Anthropic optional fallback.
- **Static Analysis:** Slither 0.11.5 (spawn CLI, parse JSON) + Aderyn 0.6.8
- **On-Chain:** Hardhat, ethers.js, Mantle (chain 5000, Sepolia 5003)
- **Indexing:** Envio HyperIndex (mantle.hypersync.xyz) or SSE + RPC polling
- **Storage:** Arweave (encrypted reports), Lit Protocol (access control)
- **Hosting:** Vercel (FE), Railway (API)
- **Fonts:** Geist + Geist Mono (NOT Cofo Sans — paid)
- **Design:** Vana-inspired dark terminal (#161616 bg, #0000ff accent, 2px radius)

## Critical Architecture Facts
- Multi-LLM takes 8-25s (ChainGPT pre-screen ~3-5s; Gemini/Groq critics fan out in parallel — Groq via LPU returns in 2-4s, Gemini 8-15s)
- LLM layer is a clean adapter pattern: packages/engine/src/llm/providers/{chaingpt,gemini,groq}.ts each implement the LLMProvider interface; orchestrator is provider-agnostic. Swap providers by injecting a different LLMProvider — no orchestrator changes required.
- Env vars: CHAINGPT_API_KEY (pre-screen, required), GEMINI_API_KEY + GROQ_API_KEY (critics, both optional but at least one preferred). ANTHROPIC_API_KEY is reserved for optional fallback (not wired by default).
- Mantle gas: 3-component Arsia model (L2 exec + L1 data + operator fee)
- L1Block predeploy: 0x4200000000000000000000000000000000000015
- GasPriceOracle: 0x420000000000000000000000000000000000000F
- ERC-8004 Identity Registry (Mantle): 0x8004A3718bD35CF767BC0E718bf21Ec4073502f0
- ERC-8004 Reputation Registry (Mantle): 0x8004B1BcAb4228199Af728fF90Ed23dCc9b0Fa63
- ValidationRegistry: NOT confirmed on Mantle — deploy our own if missing
- DA is EIP-4844 blobs (NOT EigenDA, post-Arsia Apr 22, 2026)
- Mantle is Stage 0: single EOA sequencer, instant upgrades, 6/14 multisig
- No EIP-7706 in Mantle
- Slither is Python-only — spawn CLI from TS, parse JSON output
- Staking uses MNT/USDC (NOT $ANN token)
- Slashing: 2.5% default, 10% cap, 3/5 multisig arbitrator
- Next.js does NOT host WebSockets — use SSE via Route Handlers

## TryAnneal Deployments (Mantle Sepolia)
> Filled in after running `packages/contracts/scripts/deploy-all.ts --network mantleSepolia`.
> Canonical record at [packages/contracts/deployments/mantleSepolia.json](packages/contracts/deployments/mantleSepolia.json).

- AnnealAgent:      TBD
- AnnealValidation: TBD
- AnnealStaking:    TBD
- MockERC20 (stake): TBD
- Anneal agent ID:  TBD (registered against ERC-8004 IdentityRegistry)
- Deployer:         TBD

## Custom Slither Detectors (packages/detectors/)
Python plugin auto-registered via `slither_analyzer.plugin` entry point. Inventory:
- agent_context/agent_reentrancy.py — `agent-reentrancy` (HIGH/HIGH)
- agent_context/agent_callback_loop.py — `agent-callback-loop` (HIGH/MEDIUM)
- mantle_specific/calldata_bloat.py — `calldata-bloat` (MEDIUM/HIGH)
- mantle_specific/operator_fee_outlier.py — `operator-fee-outlier` (LOW/HIGH)
- mantle_specific/l1block_unchecked_read.py — `l1block-unchecked-read` (MEDIUM/MEDIUM)
- mantle_specific/arsia_anti_patterns.py — `arsia-anti-patterns` (MEDIUM/MEDIUM)
- exploit_patterns/single_dvn_verifier.py — `single-dvn-verifier` (HIGH/HIGH) — KelpDAO Apr 2026 $292M
- exploit_patterns/donation_attack.py — `donation-attack` (HIGH/MEDIUM) — Euler 2023 $197M
- exploit_patterns/init_unprotected.py — `init-unprotected` (HIGH/HIGH) — Nomad 2022 $190M
- exploit_patterns/oracle_no_staleness.py — `oracle-no-staleness` (MEDIUM/HIGH)
- exploit_patterns/proxy_storage_collision.py — `proxy-storage-collision` (HIGH/HIGH)
- corpus/corpus_match.py — `corpus-match` (MEDIUM/MEDIUM) — Jaccard vs 16 vetted exploit fingerprints, >$2B total losses

Corpus matcher is importable without Slither (`tryanneal_detectors.corpus.matcher.find_matches(source)`).

## Mantle RPC
- Mainnet: https://rpc.mantle.xyz (wss://wss.mantle.xyz)
- Sepolia: https://rpc.sepolia.mantle.xyz
- Chain ID: 5000 (mainnet), 5003 (Sepolia)

## ERC-8004 Interfaces (Key Methods)
- Identity: register(), setAgentURI(), setAgentWallet(), getMetadata()
- Reputation: giveFeedback(), revokeFeedback(), getSummary(), readFeedback()
- Validation: validationRequest(), validationResponse(), getValidationStatus()
- Gas: register ~200-250k, giveFeedback ~150k, validationRequest ~110k, validationResponse ~90k

## Build Rules
- No git commits during build — batch commit at end of build window
- One concern per prompt, defined deliverable before next prompt
- Tests as spec — write test first, then implementation
- No mock data — real on-chain or realistic static data
- Architecture decisions documented in code comments
- Every assumption verified by Tryponcho research (PRD v3 is canonical)

## File Structure (Target)
```
tryanneal/
├── CLAUDE.md                    # This file
├── packages/
│   ├── cli/                     # anneal audit CLI (TypeScript)
│   ├── contracts/               # Solidity (Hardhat)
│   ├── web/                     # Next.js 16.2 dashboard + landing
│   ├── engine/                  # LLM ensemble + Slither integration
│   └── indexer/                 # Envio or SSE+RPC polling
├── research/                    # Tryponcho research outputs
└── docs/                        # Architecture, design system
```

## Key Dependencies
- slither-analyzer (Python, installed separately)
- @anthropic-ai/sdk (Claude API)
- ethers (Mantle RPC + contract interaction)
- arweave (report storage)
- @lit-protocol/access-control-conditions
- pino (logging)
- zod (validation)
- vitest (testing)