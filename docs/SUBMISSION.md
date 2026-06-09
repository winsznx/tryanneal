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

**TryAnneal is that primitive.** A Solidity contract goes in. A verdict comes back — 30 seconds, $0.04. The verdict is posted on-chain to a verified registry on Mantle Sepolia, queryable by any agent through a public REST endpoint with no SDK or API key required:

```bash
curl https://tryanneal.xyz/api/safety/<codeHash>
# → {"safe": false, "score": 40, "criticalCount": 1, "highCount": 2, ...}
```

The verdict is signed by an LLM ensemble. **ChainGPT** (Web3-tuned, ~4s) runs the pre-screen. If anything critical or high surfaces, **Gemini 2.5 Pro** and **Groq Llama 3.3 70B** fire in parallel as critics — each must either confirm or reject every pre-screen finding and may add what was missed. Consensus scoring with Slither cross-validation. The full cascade runs in under 30 seconds.

**Mantle-native.** The gas profiler reads Arsia's three-component fee model — L2 execution, L1 data (FastLZ-estimated), operator fee — live from the L1Block predeploy and GasPriceOracle via 3-provider consensus. Six Mantle-specific Slither detectors (`arsia-anti-patterns`, `calldata-bloat`, `l1block-unchecked-read`, `operator-fee-outlier`, `agent-reentrancy`, `agent-callback-loop`) catch what generic tools miss.

**The corpus is the moat.** TryAnneal ships with **113 vetted historical exploits across 13 chains totalling $10.1B in losses (2020–2026)**, regenerated from raw research dumps by `build_corpus.py`. The matcher computes Jaccard similarity between a contract's structural fingerprint and the corpus, boosts on exact `vulnerability_class` match, downgrades on `detection_difficulty`, and surfaces threat-actor and linked-incident metadata. The demo line: *"Your code is 36% similar to the Euler donation attack pattern that lost $197M in March 2023."*

**Privacy-first.** Findings are AES-256-GCM encrypted before storage. The decryption key is returned once to the caller and never persisted — destroying the key irrecoverably shreds the report (GDPR-style crypto-shredding). Verdict scores stay public on-chain; vulnerability details stay private.

**Three contracts on Mantle Sepolia, all verified.** `AnnealAgent` (ERC-8004 identity facade), `AnnealValidation` (verdict registry), `AnnealStaking` (auditor accountability with slashing). Five real audits posted on-chain at deploy time — 20 findings across SampleVault/UnsafeOracle/ProxyAdmin/SimpleToken/BatchTransfer.

87 tests across the engine, contracts, and detector suites. CLI: `anneal audit ./Vault.sol --attest`. Built to ship.

## Submission Links

| | URL |
|---|---|
| **GitHub** | https://github.com/winsznx/tryanneal |
| **Live API** | https://tryanneal.xyz/api/safety (set after web deploy) |
| **Demo video** | (set after recording) |
| **Architecture doc** | https://github.com/winsznx/tryanneal/blob/main/docs/ARCHITECTURE.md |

## Deployed Contracts (Mantle Sepolia · chain 5003)

All four verified on mantlescan — source browseable.

| contract | address | verified source |
|---|---|---|
| AnnealValidation | `0xf02C982D19184c11b86BC34672441C45fBF0f93E` | [view](https://sepolia.mantlescan.xyz/address/0xf02C982D19184c11b86BC34672441C45fBF0f93E#code) |
| AnnealAgent | `0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924` | [view](https://sepolia.mantlescan.xyz/address/0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924#code) |
| AnnealStaking | `0x370Fe4E74027ED0924F51361d61757D866c08eb0` | [view](https://sepolia.mantlescan.xyz/address/0x370Fe4E74027ED0924F51361d61757D866c08eb0#code) |
| MockERC20 (stake) | `0xf9f3A9F5F3a2F4138FB680D5cDfa635FD4312372` | [view](https://sepolia.mantlescan.xyz/address/0xf9f3A9F5F3a2F4138FB680D5cDfa635FD4312372#code) |

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

## Tech Stack

- **Engine** — TypeScript, Slither 0.11.5, ChainGPT + Gemini 2.5 Pro + Groq Llama 3.3 70B + Anthropic fallback
- **Contracts** — Solidity 0.8.24, Hardhat, OpenZeppelin 5, hardhat-verify v2
- **Frontend** — Next.js 16.2, TailwindCSS 4, React Three Fiber, recharts
- **Storage** — Arweave (via local fallback for testnet); AES-256-GCM at rest
- **Tests** — Vitest (engine, 49) + Hardhat/Mocha (contracts, 19) + pytest (detectors, 19) = **87 tests passing**

## Judging Criteria Mapping

| Criterion | Where it lives |
|---|---|
| **Innovation 25%** | Agent-context detectors (`agent-reentrancy`, `agent-callback-loop`) are net-new IP. 113-pattern corpus matcher with Jaccard + vuln-class boost + difficulty downgrade. The safety oracle endpoint is the `is_this_safe()` primitive made concrete. |
| **Mantle Ecosystem 25%** | Arsia 3-component gas profiler. Four contracts deployed and verified on Sepolia. Six Mantle-specific Slither detectors. ERC-8004 facade ready for the registry when it lands on Sepolia. |
| **Technical Depth 30%** | 87 tests across three test suites. 15 custom Slither detectors plus the corpus meta-detector. End-to-end pipeline: source → Slither + LLM cascade → consensus scoring → AES-GCM encryption → on-chain attestation → public safety endpoint. |
| **Polish 20%** | One-command CLI with color-coded reports. Spec-format gas tables. Live dashboard with real on-chain data. Mantlescan-verified contracts. 30-second cached safety endpoint with open CORS. |

## What the demo shows

The video walks through one `anneal audit` invocation that runs the full ChainGPT → Gemini + Groq cascade against `SampleVault.sol`, prints the verdict (40/100, 1 critical reentrancy), shows the corresponding on-chain `AuditPosted` transaction on mantlescan, then resolves the same verdict via a one-line `curl` against `/api/safety/<codeHash>`. Closes on the corpus moment — Jaccard match against the Euler Finance pattern.

See [`docs/DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) for the timestamped script.

## Contact

- GitHub: [@winsznx](https://github.com/winsznx)
- Email: xidoncapitals@gmail.com
