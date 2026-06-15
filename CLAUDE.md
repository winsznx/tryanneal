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
- Multi-LLM takes 8-25s (ChainGPT pre-screen ~3-5s; Gemini/Groq/Hunyuan critics fan out in parallel — Groq via LPU returns in 2-4s, Gemini 8-15s, Hunyuan 5-10s)
- LLM layer is a clean adapter pattern: packages/engine/src/llm/providers/{chaingpt,gemini,groq,hunyuan}.ts each implement the LLMProvider interface; orchestrator is provider-agnostic. Swap providers by injecting a different LLMProvider — no orchestrator changes required.
- Env vars: CHAINGPT_API_KEY (pre-screen, required), GEMINI_API_KEY + GROQ_API_KEY + **HUNYUAN_API_KEY** (critics, all optional but at least one preferred). Hunyuan is the Tencent Cloud integration for the DevTools track; HUNYUAN_MODEL defaults to `hunyuan-turbos-latest`. ANTHROPIC_API_KEY is reserved for optional fallback (not wired by default).
- Arsia gas profiler is post-upgrade accurate: the `tokenRatio()` selector (`0xfd32aa0f`) was retired in April 2026 and now reverts on the GasPriceOracle predeploy. `fetchArsiaParams` no longer queries it; `ArsiaParams.tokenRatio` is pinned to `1n`. Regression test at `packages/engine/src/gas/__tests__/gas.test.ts` ("never sends the retired tokenRatio() selector").
- Benchmark suite at `packages/engine/benchmarks/` — 4 vulnerable fixtures (Minterest/Euler/Nomad/KelpDAO) + 2 clean, runs `runAudit({ noLlm: true })`, writes structured results to `benchmarks/results/latest.json`. Reproduce: `pnpm --filter @tryanneal/engine benchmark`. Current run: P=100%, R=100%, F1=1.00.
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

## TryAnneal Deployments — MAINNET (Mantle, chain 5000)
> Canonical record at [packages/contracts/deployments/mantleMainnet.json](packages/contracts/deployments/mantleMainnet.json). All verified on mantlescan.

- AnnealAgent:      0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924  (verified)
- AnnealValidation: 0xf02C982D19184c11b86BC34672441C45fBF0f93E  (verified)
- AnnealStaking:    0xf9f3A9F5F3a2F4138FB680D5cDfa635FD4312372  (verified, WMNT-staked)
- Stake token:      WMNT 0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8
- ERC-8004 IdentityRegistry (mainnet): 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (ERC1967 proxy → impl 0x7274e874ca62410a93bd8bf61c69d8045e399c02; ERC-721-based)
- **Anneal agent ID: 131** — registered via `register(string)` from the deployer EOA (the real registry is ERC-721-based; the AnnealAgent facade's legacy 2-arg `register(address,string)` reverts). Owner: deployer. Register tx: 0x599ff14f168dbe6dd31fe66125138f3fc64a4a50961e88e651aeb221be14a945
- Deployer:         0xF97933dF45EB549a51Ce4c4e76130c61d08F1ab5
- Deployed:         2026-06-15, block ~96692458
- **Live-protocol audit:** Merchant Moe LB Router (0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a, ~$60M TVL) — verdict 100/100 (clean), posted on-chain by agentId 131. Tx: 0x94f3e516821fd7378c24c0f78179dd9f26cfc49f64eb30f904eb7d23c4d5dd96. See packages/contracts/deployments/mantleMainnet.live-audits.json.

## TryAnneal Deployments — Sepolia (testnet, chain 5003)
> Canonical record at [packages/contracts/deployments/mantleSepolia.json](packages/contracts/deployments/mantleSepolia.json).

- Same CREATE addresses as mainnet (deterministic from deployer nonce sequence). AnnealAgent/AnnealValidation/AnnealStaking verified.
- Agent ID: not registered (ERC-8004 IdentityRegistry not deployed on Sepolia — registerAgent() reverted).
- Audit batch: 5 verdicts posted, 20 findings across SampleVault/UnsafeOracle/ProxyAdmin. See packages/contracts/deployments/mantleSepolia.audits.json.

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
- exploit_patterns/approval_abuse_arbitrary_call.py — `approval-abuse-arbitrary-call` (HIGH/HIGH) — SwapNet/Li.Fi/SocketGateway class
- exploit_patterns/signature_replay_bypass.py — `signature-replay-bypass` (HIGH/HIGH) — $1.19B cluster
- exploit_patterns/amm_spot_oracle_dependency.py — `amm-spot-oracle-dependency` (HIGH/MEDIUM) — flash-loanable spot reads
- exploit_patterns/vault_share_rounding.py — `vault-share-rounding` (HIGH/MEDIUM) — Sonne/Onyx/zkLend share-math class
- corpus/corpus_match.py — `corpus-match` (MEDIUM/MEDIUM) — TF-IDF cosine (Jaccard fallback) vs **113 vetted entries totalling ~$10.1B in losses (2020-2026, 13 chains)**

Corpus is regenerated by `python packages/detectors/tryanneal_detectors/corpus/build_corpus.py` from raw research dumps in `corpus/research/`. The build script tolerates malformed JSON (truncated files, embedded control characters) via greedy object-level recovery. Manual handwritten entries in `patterns.manual.json` are merged in unless a research entry with the same id overrides them.

Matcher is importable without Slither (`tryanneal_detectors.corpus.matcher.find_matches(source)`) and now boosts +0.20 on exact `vulnerability_class` match, downgrades -0.15 on `detection_difficulty in {manual, symbolic, operational}`, and surfaces `threat_actor` / `linked_incident` / `chain` for the demo punchline.

Engine ships `CORPUS_SNAPSHOT` (`packages/engine/src/llm/corpus_stats.ts`) — regenerate when the corpus changes. CLI prints the banner:
  `Audited against TryAnneal corpus: 113 exploit patterns | $10.1B losses | 2020-2026`

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