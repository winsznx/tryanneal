# TryAnneal — Architecture

Three layers. One primitive.

```
                       ┌─────────────────────────────────────────────┐
                       │  AGENT / DEVELOPER / CI / JUDGE             │
                       │  • CLI:  anneal audit ./Vault.sol --attest  │
                       │  • HTTP: GET /api/safety/{codeHash}         │
                       └────────────────────┬────────────────────────┘
                                            │
                ┌───────────────────────────┴───────────────────────────┐
                ▼                                                       ▼
   ┌────────────────────────┐                          ┌────────────────────────────┐
   │  ENGINE  (TypeScript)  │                          │  SAFETY ORACLE (Next.js)   │
   │  packages/engine       │                          │  packages/web/app/api/     │
   │  + packages/detectors  │                          │  safety/                   │
   │                        │                          │                            │
   │  1. Slither + custom   │                          │  GET  → on-chain read      │
   │     detectors (15+1)   │                          │  POST → runs engine,       │
   │                        │   ┌──────────────────┐   │         returns key once   │
   │  2. LLM cascade        │   │  CORPUS          │   │                            │
   │     ChainGPT pre-screen│◀──│  113 patterns    │   │  CORS open · 30s cache     │
   │     ↓                  │   │  $10.1B losses   │   │  rate-limit 1/5min/IP      │
   │     Gemini + Groq      │   │  2020 → 2026     │   └────────────────────────────┘
   │     parallel critics   │   │  13 chains       │                  │
   │                        │   │                  │                  │ ethers.read
   │  3. Consensus scoring  │   │  TF-IDF cosine + │                  ▼
   │     line-overlap dedup │   │  vuln-class +    │   ┌────────────────────────────┐
   │     Slither cross-val  │   │  difficulty      │   │  AGENT INFRA (Solidity)    │
   │                        │   │  downgrade       │   │  packages/contracts        │
   │  4. Arsia gas profiler │   └──────────────────┘   │                            │
   │     L2 + L1 + operator │            ▲             │  AnnealValidation          │
   │     3-RPC consensus    │            │             │  AnnealAgent (ERC-8004)    │
   │                        │            └─── used by ─┤  AnnealStaking + MockERC20 │
   │  5. AES-GCM encrypt    │                          │                            │
   │     key returned once  │                          │  Mantle Sepolia · 5003     │
   │                        │                          │  all 4 verified on         │
   └──────────┬─────────────┘                          │  mantlescan                │
              │                                        └──────────┬─────────────────┘
              │       runAudit() → postAuditOnChain()             │
              └───────────────────────────────────────────────────▶│
                                                       AnnealValidation.postVerdict()
```

## Layer 1 — Engine

[`packages/engine`](../packages/engine/src) is a TypeScript library. Single
public entry point: `runAudit(filePath, options) → AuditResult`. Composes five
stages.

| stage | module | depth |
|---|---|---|
| Slither + custom detectors | [`slither.ts`](../packages/engine/src/slither.ts), [`packages/detectors`](../packages/detectors) | spawn `slither --json -`, parse, map severity |
| LLM cascade | [`llm/`](../packages/engine/src/llm) | provider adapter pattern; injected providers |
| Consensus scoring | [`llm/consensus.ts`](../packages/engine/src/llm/consensus.ts) | line-overlap dedup, Slither +15 cross-val, single-model floor 33, sub-20 cull |
| Arsia gas profiler | [`gas/`](../packages/engine/src/gas) | live `L1Block` + `GasPriceOracle` reads via 3-RPC vote, 60s cache |
| Encryption | [`privacy/encrypt.ts`](../packages/engine/src/privacy/encrypt.ts) | AES-256-GCM, 12-byte IV, 16-byte auth tag |

### Provider adapter

```
packages/engine/src/llm/providers/
├── chaingpt.ts   (pre-screen)
├── gemini.ts     (critic)
└── groq.ts       (critic)
```

Each implements the same `LLMProvider` interface. Orchestrator
([`llm/orchestrator.ts`](../packages/engine/src/llm/orchestrator.ts)) is
provider-agnostic — swap by injecting a different adapter. Critic stage uses
`Promise.allSettled` with per-call `AbortController`; one failed critic
degrades gracefully.

### Custom detectors

15 Slither detectors live in [`packages/detectors/tryanneal_detectors/`](../packages/detectors/tryanneal_detectors):

- **Agent-context (2)** — `agent-reentrancy`, `agent-callback-loop`. Net-new IP for ERC-8004 contract patterns.
- **Mantle-specific (4)** — `calldata-bloat`, `operator-fee-outlier`, `l1block-unchecked-read`, `arsia-anti-patterns`.
- **Exploit patterns (9)** — `single-dvn-verifier`, `donation-attack`, `init-unprotected`, `oracle-no-staleness`, `proxy-storage-collision`, `approval-abuse-arbitrary-call`, `signature-replay-bypass`, `amm-spot-oracle-dependency`, `vault-share-rounding`.
- **Meta (1)** — `corpus-match` (TF-IDF cosine ≥ 0.65 against any of 113 corpus entries; Jaccard fallback).

## Layer 2 — Agent Infrastructure (Solidity)

[`packages/contracts`](../packages/contracts/contracts).

```
AnnealValidation                      AnnealStaking                AnnealAgent
─────────────────                     ─────────────                ──────────────────
mapping(bytes32 => AuditVerdict)      AccessControl + Pausable     Facade over
mapping(uint256 => bytes32[])         7-day cooldown               IIdentityRegistry
                                      2.5% / 10% slash floor/cap
event AuditPosted(                    60/30/10 fee split           registerAgent()
  uint256 agentId indexed,            (auditor / stakers /         updateAgentURI()
  bytes32 codeHash indexed,           treasury)                    readMetadata()
  uint8 verdictScore,
  string reportURI,                   accRewardPerShare
  uint256 timestamp                   distribution
);
```

Read path used by the safety oracle:
- `AnnealValidation.getVerdict(bytes32)` — single `eth_call`, no signer.

Write path used by `--attest`:
- `AnnealValidation.postVerdict(...)` — only the registered agent's wallet
  may successfully post (enforced off-chain today, will move on-chain as the
  ERC-8004 registry lands on Sepolia).

## Layer 3 — Safety Oracle (HTTP)

[`packages/web/app/api/safety/`](../packages/web/app/api/safety).

```
GET  /api/safety/{codeHash}        → reads on-chain, returns verdict
GET  /api/safety?codeHash=...      → same, query-string form
POST /api/safety/audit             → runs engine, returns findings + key
```

Implementation notes:

- **Read** path: cached `JsonRpcProvider` per network, ABI fragment for
  `getVerdict` only — no SDK, no signer, no key. 30s edge cache.
- **Write** path: `runAudit()` with the engine providers fed from
  server-side env. Falls back to Slither-only with `mode: "static-only"` if
  no LLM keys. In-memory IP rate limit: 1 audit / 5 min.
- **CORS** open by design — any agent on any chain can query.
- **Runtime: nodejs** — engine pulls ethers + node:crypto.

## Data flow — full audit + attestation

```
 user/agent ── 1 ──▶  anneal CLI ── 2 ──▶  runAudit()
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                   Slither + custom    LLM cascade         Arsia gas RPC
                   detectors           (ChainGPT →         (3-provider vote
                                       Gemini + Groq)      against L1Block
                                                          + GasPriceOracle)
                          │                   │                   │
                          └───────────────────┴───────────────────┘
                                              │
                                              ▼
                                    Consensus scoring
                                              │
                                              ▼
                            AES-GCM(findings, gasReport, key)
                                              │
                          ┌───────────────────┴──────────────────┐
                          ▼                                      ▼
            postAuditOnChain                            return decryptionKey
            (AnnealValidation                            to caller — once
             .postVerdict via
             ethers signer)
                          │
                          ▼
                    AuditPosted event
                    on Mantle Sepolia
                          │
                          ▼
              Anyone can now:
              • read getVerdict(codeHash) directly
              • GET /api/safety/{codeHash}
              • see source on mantlescan (all 4 contracts verified)
```

## Trust assumptions

| trusted | not trusted |
|---|---|
| The Anneal deployer key (for attestation) | The LLM cascade outputs — Slither cross-validates every flagged line |
| The Mantle Sepolia sequencer (Stage 0; this is a testnet) | Any single LLM provider — minimum 1 critic must respond; 3 raise confidence |
| `JsonRpcProvider` for reads | The off-chain audit transcript — encrypted before storage, key returned once |
| Slither's `reentrancy-eth` / `controlled-delegatecall` built-ins | The corpus matcher's similarity score — surfaced as informational, not blocking |

## Composability

The unit of composition is `bytes32 codeHash`. Any agent can:

1. `keccak256(sourceCode)` locally.
2. `curl /api/safety/<codeHash>` — 30 ms cached response.
3. Refuse to compose if `safe === false`.

This is the entire interface. The contract registry, the LLM ensemble, the
gas profiler, the corpus matcher — every layer exists to make that single
boolean trustworthy.
