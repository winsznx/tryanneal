# TRYANNEAL — Claude Code Project Instructions

## What This Is
TryAnneal: Agent trust infrastructure for the agentic era. Multi-LLM audit engine + Mantle-native gas profiler + ERC-8004 on-chain attestation + privacy-first findings.

## Hackathon
Mantle Turing Test 2026 — AI DevTools Track. Deadline: June 15, 2026. Demo Day: July 2-3.

## Stack
- **Frontend:** Next.js 16.2, TailwindCSS 4, Motion (motion.dev), TanStack Query
- **Backend:** Node.js/TypeScript, Bull Queue (Redis), Postgres + pgvector
- **LLM:** Haiku 4.5 (pre-screen) → Opus 4.7 + Gemini 2.5 Pro + Grok 4.3 (critic cascade)
- **Static Analysis:** Slither 0.11.5 (spawn CLI, parse JSON) + Aderyn 0.6.8
- **On-Chain:** Hardhat, ethers.js, Mantle (chain 5000, Sepolia 5003)
- **Indexing:** Envio HyperIndex (mantle.hypersync.xyz) or SSE + RPC polling
- **Storage:** Arweave (encrypted reports), Lit Protocol (access control)
- **Hosting:** Vercel (FE), Railway (API)
- **Fonts:** Geist + Geist Mono (NOT Cofo Sans — paid)
- **Design:** Vana-inspired dark terminal (#161616 bg, #0000ff accent, 2px radius)

## Critical Architecture Facts
- Multi-LLM takes 10-30s (NOT <500ms — Opus TTFT is 25.6s)
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