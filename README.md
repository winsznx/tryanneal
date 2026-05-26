# TryAnneal

Agent trust infrastructure for the agentic era. Multi-LLM smart-contract audits, Mantle-native gas profiling, and ERC-8004 on-chain attestation with privacy-preserving encrypted reports.

Built for the **Mantle Turing Test 2026** — AI DevTools Track.

## What it does

- **Multi-LLM audit engine** — Haiku 4.5 pre-screen → Opus 4.7 + Gemini 2.5 Pro + Grok 4.3 critic cascade with consensus scoring. Cross-validates against Slither.
- **Arsia gas profiler** — 3-component fee breakdown (L2 exec + L1 data + operator) using live `L1Block` and `GasPriceOracle` predeploy data, 3-provider RPC consensus, and FastLZ size estimation.
- **ERC-8004 identity + on-chain attestation** — registers a portable agent identity on Mantle's Identity Registry; posts verdicts to a standalone `AnnealValidation` registry with severity counts, report URI, and gas-report hash.
- **AES-256-GCM encrypted findings** — fresh key per audit, stored on Arweave (with local fallback). Crypto-shred by destroying the key. Verdict score stays public on-chain, vulnerability details stay private.
- **Auditor staking with slashing** — MNT/USDC vault with 7-day cooldown, 2.5%/10% slash floor/cap, 60/30/10 fee split (auditor/stakers/treasury), reward distribution via `accRewardPerShare`.

## Quick start

```bash
pnpm install

# Slither-only audit (no API keys needed)
cd packages/cli
npx anneal audit ../contracts/contracts/audit-targets/SampleVault.sol --no-llm

# Full LLM ensemble
ANTHROPIC_API_KEY=... GEMINI_API_KEY=... XAI_API_KEY=... \
  npx anneal audit ./MyContract.sol

# Audit + on-chain attestation + encrypted Arweave storage
DEPLOYER_PRIVATE_KEY=0x... \
ANNEAL_AGENT_ID=42 \
  npx anneal audit ./MyContract.sol --attest \
    --validation 0x...AnnealValidation
```

CLI flags:

| flag | effect |
|---|---|
| `--quick` | Haiku pre-screen only, skip critic cascade |
| `--no-llm` | Slither only, no API calls |
| `--gas-only` | Skip security audit, only profile gas |
| `--attest` | Post verdict on-chain via `AnnealValidation.postVerdict` |
| `--no-encrypt` | Skip AES-GCM encryption / report storage |
| `--reports-dir <dir>` | Local fallback dir for encrypted reports |
| `-n, --network` | `mantle` or `mantle-sepolia` |

## Architecture

```
packages/
├── cli/         anneal CLI (Commander.js)
├── engine/      Slither wrapper, LLM ensemble, Arsia profiler, privacy, attestation
├── contracts/   Hardhat — AnnealAgent, AnnealValidation, AnnealStaking
└── web/         Next.js 16 dashboard + API routes (FE work happens on the FE branch)
```

Audit flow:

```
.sol file
   │
   ▼
runAudit() ──► Slither (best-effort)
   │
   ├─► Haiku pre-screen (3-5s)
   │      │
   │      └─► no high/critical?  → early return
   │
   ├─► Critic cascade in parallel (≤60s)
   │      ├─ Opus 4.7
   │      ├─ Gemini 2.5 Pro
   │      └─ Grok 4.3
   │
   ├─► Consensus scorer
   │      ├─ line-overlap dedup
   │      ├─ Slither cross-validation (+15, cap 99)
   │      ├─ single-model floor (33%)
   │      └─ <20% cull
   │
   ├─► Arsia gas profiler (3 RPC providers, 2/3 vote)
   ├─► AES-256-GCM encrypt findings
   ├─► Arweave upload (or local fallback)
   └─► AnnealValidation.postVerdict on Mantle
```

## Deployed contracts

> **Mantle Sepolia** (chain 5003) — populated after the first `deploy-all.ts` run.
> See [`packages/contracts/deployments/mantleSepolia.json`](packages/contracts/deployments/mantleSepolia.json).

| contract | address | mantlescan |
|---|---|---|
| `AnnealAgent` | TBD | TBD |
| `AnnealValidation` | TBD | TBD |
| `AnnealStaking` | TBD | TBD |
| `MockERC20` (stake token) | TBD | TBD |
| ERC-8004 Identity Registry | `0x8004A3718bD35CF767BC0E718bf21Ec4073502f0` | — |
| ERC-8004 Reputation Registry | `0x8004B1BcAb4228199Af728fF90Ed23dCc9b0Fa63` | — |
| **Anneal agent ID** | TBD | — |

## Deploying

```bash
cd packages/contracts
DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-all.ts --network mantleSepolia
```

`deploy-all.ts` deploys `AnnealAgent` → registers on ERC-8004 → deploys `AnnealValidation` → deploys `MockERC20` + `AnnealStaking`. Attempts `verify:verify` on mantlescan for each. Writes the full manifest to `deployments/mantleSepolia.json`. Identity-Registry failures are non-fatal — the remaining deploys still proceed.

## Running a batch of real audits

After deploy, exercise the full pipeline:

```bash
cd packages/contracts
DEPLOYER_PRIVATE_KEY=0x... \
ANTHROPIC_API_KEY=... \
GEMINI_API_KEY=... \
XAI_API_KEY=... \
  npx hardhat run scripts/run-audits.ts --network mantleSepolia
```

Audits five targets in `contracts/audit-targets/`: `SimpleToken`, `SampleVault` (reentrant), `UnsafeOracle`, `ProxyAdmin`, `BatchTransfer`. Encrypts findings, uploads to Arweave (or local fallback), posts on-chain to `AnnealValidation`. Saves a results manifest to `deployments/<network>.audits.json`.

## Tech stack

- **Engine** — TypeScript, Slither 0.11.5 (spawn), Claude SDK, Gemini REST, Grok REST
- **Contracts** — Solidity 0.8.19/0.8.24, Hardhat, OpenZeppelin 5
- **Storage** — Arweave (encrypted blobs); local `./reports/{codeHash}.enc` fallback
- **Frontend** — Next.js 16 App Router, TailwindCSS 4 (FE work on `FE` branch)
- **Test** — Vitest (engine), Hardhat/Mocha (contracts)

## Tests

```bash
pnpm install

# Engine: 37 tests across Slither, LLM ensemble, Arsia profiler, privacy
pnpm --filter @tryanneal/engine test

# Contracts: 19 Hardhat tests across AnnealAgent, AnnealValidation, AnnealStaking
pnpm --filter @tryanneal/contracts exec hardhat test
```

56 tests total, all passing.

## Hackathon

Mantle Turing Test 2026 — AI DevTools Track. Submission deadline June 15, 2026.

## License

MIT
