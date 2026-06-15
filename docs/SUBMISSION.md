# TryAnneal — DoraHacks Submission

Copy-paste ready for the Mantle Turing Test 2026 submission form.

---

## Project Name

**TryAnneal**

## One-liner (≤ 140 chars)

Agent trust infrastructure for Mantle — multi-LLM smart contract audit, Arsia gas profiling, on-chain attestation, privacy-first findings.

## Track

**AI DevTools**

## Tagline (≤ 240 chars — appears in the project tile)

The `is_this_safe()` primitive for the agent economy: any agent, any chain, one HTTP call to a verdict read directly from on-chain. Backed by a 113-pattern, $10.1B exploit corpus.

## Description (≤ 500 words)

The agent economy is being built right now, and it has a trust problem. Agents compose with code they didn't write. Existing audits cost $30,000 and take a month. There is no machine-readable, low-latency way for an agent to ask "is this contract safe?" before it routes user funds through it.

**TryAnneal is that primitive.** A Solidity contract goes in. A verdict comes back — 30 seconds, $0.04. The verdict is posted on-chain to a verified registry on Mantle (mainnet + Sepolia), queryable by any agent through a public REST endpoint with no SDK or API key required:

```bash
curl https://tryanneal.xyz/api/safety/<codeHash>
# → {"safe": false, "score": 40, "criticalCount": 1, "highCount": 2, ...}
```

The verdict is signed by an LLM ensemble. **ChainGPT** (Web3-tuned, ~4 s) runs the pre-screen. If anything critical or high surfaces, **Gemini 2.5 Pro**, **Groq Llama-3.3-70B**, and **Tencent Cloud Hunyuan-Turbos** fire in parallel as critics — each must either confirm or reject every pre-screen finding and may add what was missed. Consensus scoring with Slither cross-validation. The full cascade runs in under 30 seconds. **Hunyuan is the Tencent Cloud integration for the DevTools track.**

**Mantle-native.** The gas profiler reads Arsia's three-component fee model — L2 execution, L1 data (FastLZ-estimated), operator fee — live from the L1Block predeploy and GasPriceOracle via 3-provider consensus. Six Mantle-specific Slither detectors (`arsia-anti-patterns`, `calldata-bloat`, `l1block-unchecked-read`, `operator-fee-outlier`, `agent-reentrancy`, `agent-callback-loop`) catch what generic tools miss.

**The corpus is the moat.** TryAnneal ships with **113 vetted historical exploits across 13 chains totalling $10.1B in losses (2020–2026)**, regenerated from raw research dumps by `build_corpus.py`. The matcher computes TF-IDF cosine similarity between a contract's structural fingerprint and the corpus, boosts on exact `vulnerability_class` match, downgrades on `detection_difficulty`, and surfaces threat-actor and linked-incident metadata. The demo line: *"Your code is 36% similar to the Euler donation attack pattern that lost $197M in March 2023."*

**Privacy-first.** Findings are AES-256-GCM encrypted before storage. The decryption key is returned once to the caller and never persisted — destroying the key irrecoverably shreds the report (GDPR-style crypto-shredding). Verdict scores stay public on-chain; vulnerability details stay private.

**Live on Mantle mainnet, all verified.** `AnnealAgent`, `AnnealValidation` (verdict registry), `AnnealStaking` (auditor accountability with slashing). TryAnneal is a registered ERC-8004 agent on the official mainnet Identity Registry — **agentId 131**. It audited **Merchant Moe's live LB Router (~$60M TVL)** and posted the verdict on Mantle mainnet: a real, public, queryable attestation for a production protocol.

113 tests across the engine, contracts, and detector suites. Reproducible benchmark: P=100% R=100% F1=1.00. CLI: `anneal audit ./Vault.sol --attest`. Built to ship.

## Submission Links

| | URL |
|---|---|
| **GitHub** | https://github.com/winsznx/tryanneal |
| **Live API** | https://tryanneal-web-production.up.railway.app/api/safety |
| **Live dashboard** | https://tryanneal-web-production.up.railway.app/dashboard |
| **Demo video** | (set after recording) |
| **Architecture doc** | https://github.com/winsznx/tryanneal/blob/main/docs/ARCHITECTURE.md |

Try it now:
```bash
curl "https://tryanneal-web-production.up.railway.app/api/safety/0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab?network=mantle"
# → live Merchant Moe verdict, posted on Mantle mainnet by agentId 131
```

## Deployed Contracts — Mantle Mainnet (chain 5000)

All verified on mantlescan — source browseable.

| contract | address | verified source |
|---|---|---|
| AnnealValidation | `0xf02C982D19184c11b86BC34672441C45fBF0f93E` | [view](https://mantlescan.xyz/address/0xf02C982D19184c11b86BC34672441C45fBF0f93E#code) |
| AnnealAgent | `0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924` | [view](https://mantlescan.xyz/address/0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924#code) |
| AnnealStaking (WMNT) | `0xf9f3A9F5F3a2F4138FB680D5cDfa635FD4312372` | [view](https://mantlescan.xyz/address/0xf9f3A9F5F3a2F4138FB680D5cDfa635FD4312372#code) |

- **ERC-8004 agentId 131** on registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` — [register tx](https://mantlescan.xyz/tx/0x599ff14f168dbe6dd31fe66125138f3fc64a4a50961e88e651aeb221be14a945)
- **Live audit:** Merchant Moe LB Router (~$60M TVL) → verdict 100/100, [posted on-chain](https://mantlescan.xyz/tx/0x94f3e516821fd7378c24c0f78179dd9f26cfc49f64eb30f904eb7d23c4d5dd96)
- Also deployed + verified on Mantle Sepolia (chain 5003, same addresses) with a 5-audit / 20-finding batch.

Deployer: `0xF97933dF45EB549a51Ce4c4e76130c61d08F1ab5`.

## On-chain audits posted at deploy time

| contract | verdict | findings | tx |
|---|---:|---|---|
| SimpleToken.sol | 100/100 | clean | [`0x4f3e9058…`](https://sepolia.mantlescan.xyz/tx/0x4f3e905802b160d2398197000f9d42cc366bf65b27e24b0e8931425e7797ad5f) |
| SampleVault.sol | 40/100 | 1C 2H 1M | [`0x6f1f65ae…`](https://sepolia.mantlescan.xyz/tx/0x6f1f65ae32c5ad3891d56c2b9ffd50ebc2638c30b5881c50d5e174fb38784a3a) |
| UnsafeOracle.sol | 60/100 | 1H 5M | [`0x961ef491…`](https://sepolia.mantlescan.xyz/tx/0x961ef491d12d51abae8a006546ea1ee91b226a7e15383b543ab95896481e2db2) |
| ProxyAdmin.sol | 50/100 | 1C 1H 1M 1L | [`0xa090fb7c…`](https://sepolia.mantlescan.xyz/tx/0xa090fb7c634dff0b82872642cb0e1f596a52a235be927072dd16d04b8d053d61) |
| BatchTransfer.sol | 100/100 | clean | [`0x1ebe5345…`](https://sepolia.mantlescan.xyz/tx/0x1ebe53456820b29c7e555533ea5a6c77094b53c09d19254bf280b61cf0ff899e) |

20 total findings · LLM ensemble active (ChainGPT + Gemini + Groq + Slither).

## Benchmark Results (reproducible)

| Contract | CVE Analog | Losses | Detected |
|---|---|---:|---|
| `MinterestVuln.sol` | Minterest July 2024 (Mantle) | $1.4M | ✅ HIGH |
| `EulerDonation.sol` | Euler Finance March 2023 | $197M | ✅ HIGH |
| `NomadInit.sol` | Nomad Bridge August 2022 | $190M | ✅ HIGH |
| `LayerZeroDVN.sol` | KelpDAO LayerZero April 2026 | $292M | ✅ HIGH |
| `Clean1.sol` | — | — | ✅ CLEAN (0 FP) |
| `Clean2.sol` | — | — | ✅ CLEAN (0 FP) |

**Precision: 100% · Recall: 100% · F1: 1.00.** Re-run with `pnpm --filter @tryanneal/engine benchmark`. Full payload in [`packages/engine/benchmarks/results/latest.json`](../packages/engine/benchmarks/results/latest.json).

## Tech Stack

- **Engine** — TypeScript, Slither 0.11.5, ChainGPT + Gemini 2.5 Pro + Groq Llama-3.3-70B + **Tencent Cloud Hunyuan-Turbos**
- **Contracts** — Solidity 0.8.24, Hardhat, OpenZeppelin 5, hardhat-verify v2
- **Frontend** — Next.js 16.2, TailwindCSS 4, React Three Fiber, recharts
- **Storage** — Arweave (via local fallback for testnet); AES-256-GCM at rest
- **Tests** — Vitest (engine, 62) + Hardhat/Mocha (contracts, 19) + pytest (detectors, 32) = **113 tests passing** + reproducible benchmark

## Judging Criteria Mapping

| Criterion | Where it lives |
|---|---|
| **Innovation 25%** | Agent-context detectors (`agent-reentrancy`, `agent-callback-loop`) are net-new IP. 113-pattern corpus matcher with TF-IDF cosine + vuln-class boost + difficulty downgrade. The safety oracle endpoint is the `is_this_safe()` primitive made concrete. |
| **Tencent Cloud + Mantle integration 25%** | **Hunyuan-Turbos wired as the 4th LLM critic** via the OpenAI-compatible endpoint; visible in `modelsUsed` on every audit output. Mantle Arsia 3-component gas profiler (post-Arsia accurate — the `tokenRatio()` selector removal that breaks naïve profilers was caught in pre-flight). Contracts deployed and verified on Mantle mainnet + Sepolia (incl. a registered ERC-8004 agentId and a live $60M-protocol audit posted on-chain), six Mantle-specific Slither detectors, ERC-8004 facade. |
| **Technical Depth 30%** | **90+ tests** across engine / contracts / detectors. 15 custom Slither detectors plus the corpus meta-detector. End-to-end pipeline: source → Slither + LLM cascade → consensus scoring → AES-GCM encryption → on-chain attestation → public safety endpoint. **Reproducible benchmark** with precision/recall/F1 in `packages/engine/benchmarks/`. |
| **Polish 20%** | One-command CLI with color-coded reports. Spec-format gas tables. Live dashboard with real on-chain data. Mantlescan-verified contracts. 30-second cached safety endpoint with open CORS. GitHub Actions workflow that posts audit comments on every PR. |

## What the demo shows

The video walks through one `anneal audit` invocation that runs the full ChainGPT → Gemini + Groq + Hunyuan cascade against `SampleVault.sol`, prints the verdict (40/100, 1 critical reentrancy), shows the corresponding on-chain `AuditPosted` transaction on mantlescan, then resolves the same verdict via a one-line `curl` against `/api/safety/<codeHash>`. Closes on the corpus moment — TF-IDF cosine match against the Euler Finance pattern.

See [`docs/DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for the timestamped script.

## Contact

- GitHub: [@winsznx](https://github.com/winsznx)
- Email: xidoncapitals@gmail.com
