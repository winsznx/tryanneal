# TryAnneal — DoraHacks Submission

Copy-paste ready for the Mantle Turing Test 2026 submission form.

---

## Project Name
**TryAnneal**

## One-liner (≤140 chars)
The `is_this_safe()` trust layer for the agent economy — a deterministic, multi-model smart-contract auditor, Mantle-native, every verdict posted on-chain.

## Track
**AI DevTools** (Exclusively Supported by Tencent Cloud).

## Tagline (≤240 chars)
Any agent, any chain, one call to a verdict read straight from on-chain. Multi-model cross-validation + 16 custom detectors + a 98-pattern / $7.1B exploit corpus — deterministic, gated in CI, verifiable.

---

## Description

**The agent economy has a trust problem.** AI agents now write, deploy, and compose with contracts faster than humans can review them. Capital moves autonomously; trust is still manual. A $30,000, month-long PDF audit can't answer the only question an agent needs before it routes funds: *is this contract safe?*

**TryAnneal is that primitive.** A contract — source or a deployed address — goes in; a verdict comes back in ~30s for ~$0.04, posted on-chain to a verified registry on Mantle, readable by any agent with one HTTP call, no SDK or key:

```bash
curl "https://tryanneal.xyz/api/safety/<codeHash>?network=mantle"
# → {"safe": true, "score": 100, "attestedByAgentId": 131, ...}
```

**How the verdict is made — and why you can trust it.** ChainGPT pre-screens, then two architecturally-distinct critics on Groq — **Llama-3.3-70B + OpenAI GPT-OSS-120B** — cross-validate each other (Gemini 2.5 Pro is an optional third, off by default), over **Slither + Aderyn + 16 custom detectors** and a 98-pattern corpus. The moat is corroboration: a finding needs **≥2 independent sources** to survive, and the same issue from multiple engines is deduped into one finding listing every source (`Reentrancy — chaingpt, groq, gpt-oss, slither`). Single-model hallucinations never reach the verdict — signal, not generic LLM commentary.

**It's deterministic.** Temperature-0 seeded decoding + memoization by code hash → the **same contract always returns the same verdict**. Run it twice, byte-identical. That is TryAnneal's answer to "AI audits are non-deterministic slop," and it's what makes an on-chain verdict meaningful.

**Mantle-native.** The gas profiler reads Arsia's three-component fee model — L2 execution, L1 data (FastLZ-estimated), operator fee — live from the L1Block predeploy + GasPriceOracle via 3-provider consensus, and ships **measured before/after** optimization benchmarks (batch −90% L1, calldata-packing −6.3%, storage −7.2%, reproducible via `pnpm benchmark:gas`). 16 custom Slither detectors — Mantle-specific (`arsia-anti-patterns`, `calldata-bloat`, `l1block-unchecked-read`, `operator-fee-outlier`) and agent-context (`agent-reentrancy`, `agent-callback-loop`). Contracts deployed + verified on Mantle mainnet + Sepolia.

**Tencent Cloud Hunyuan.** Hunyuan-MT on Tencent Cloud TokenHub writes the plain-English remediation for every finding and translates the finished report into **14 languages** (Telegram `/audit <addr> zh`, web `/try` language chips) — a security report any developer on earth can read.

**The corpus is the moat.** 98 vetted historical exploits across 13 chains, **$7.1B** in losses (2020–2026, one incident each — no double-counting), shipped as a published PyPI plugin. TF-IDF cosine match surfaces the threat actor and linked incident: *"36% similar to the Euler donation attack that lost $197M."*

**Verifiable, not a black box.** A reproducible benchmark over 4 real exploits (Minterest $1.4M on Mantle, Euler $197M, Nomad $190M, KelpDAO $292M) + 2 clean contracts: **Precision 100% · Recall 100% · F1 1.00** (`pnpm --filter @tryanneal/engine benchmark`). Determinism gives run-to-run reproducibility, the gas savings are measured rather than estimated, and the headline audit is live on-chain — every claim is independently checkable.

**It fits the developer's workflow.** One engine, exposed where developers and agents already work: a published **CLI** (`npx @tryanneal/cli audit Vault.sol --threshold 80`, exit-coded so it gates a build), an **MCP server** so agents in Claude/Cursor call `is_this_safe()` natively, and a **drop-in GitHub Action** that audits changed Solidity on every PR and posts a **✅ PASSED / ❌ BLOCKED** check-run that branch protection can use to block merges — **zero API keys, zero secrets** (it runs Slither + the 16 detectors + corpus deterministically via `pip install tryanneal-detectors`). Audit-before-you-merge becomes one line.

**One engine, five surfaces.** CLI · MCP · Telegram bot + Mini App (paste any address; `eth_getCode`-grounded multichain resolution across 8 chains) · public REST oracle · web dashboard with a zero-login `/try` that returns a `SAFE / UNSAFE` verdict — "cross-validated by 5 engines" — in ~8 seconds, translatable in one click.

**Live on Mantle mainnet, with receipts.** `AnnealAgent`, `AnnealValidation` (verdict registry), `AnnealStaking` (slashing-backed auditor accountability, WMNT) — all verified. TryAnneal is registered **ERC-8004 agent #131** on the official mainnet Identity Registry, and it audited **Merchant Moe's live LB Router (~$60M TVL) → 100/100, posted on Mantle mainnet** — a real, public, queryable attestation for a production protocol.

**Business.** TryAnneal is security *infrastructure*, not a one-off audit: usage-based API access, continuous contract monitoring, enterprise security subscriptions, and agent reputation/attestation services. As autonomous software moves more value on-chain, machine-readable trust becomes a required layer — and our goal is to be the default trust oracle for agents and contracts.

68 engine tests plus the contract and Python detector suites, all green, alongside the reproducible benchmark. Published on npm (`@tryanneal/cli`, `@tryanneal/engine`) and PyPI (`tryanneal-detectors`). Built to ship.

---

## Try it now
```bash
# audit any local contract (deterministic; no keys with --no-llm)
npx @tryanneal/cli audit ./MyContract.sol --no-llm --threshold 80

# read a live on-chain verdict — no SDK, no key
curl "https://tryanneal.xyz/api/safety/0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab?network=mantle"
# → Merchant Moe verdict, posted on Mantle mainnet by agent #131
```

## Submission Links
| | URL |
|---|---|
| **GitHub** | https://github.com/winsznx/tryanneal |
| **npm — CLI** | https://www.npmjs.com/package/@tryanneal/cli |
| **npm — engine** | https://www.npmjs.com/package/@tryanneal/engine |
| **PyPI — detectors** | https://pypi.org/project/tryanneal-detectors/ |
| **Live `/try`** | https://tryanneal.xyz/try |
| **Safety Oracle API** | https://tryanneal.xyz/api/safety |
| **Dashboard** | https://tryanneal.xyz/dashboard |
| **Docs** | https://tryanneal.xyz/docs |
| **Telegram bot** | https://t.me/tryannealbot |
| **MCP server** | `mcp.tryanneal.xyz` — `is_this_safe`, `audit_contract`, `tryanneal_corpus_stats` |
| **Demo video** | https://x.com/tryanneal/status/2066582313517924820 |
| **Architecture doc** | https://github.com/winsznx/tryanneal/blob/main/docs/ARCHITECTURE.md |

## Deployed Contracts — Mantle Mainnet (chain 5000)
All verified on mantlescan — source browseable.

| contract | address | verified source |
|---|---|---|
| AnnealValidation | `0xf02C982D19184c11b86BC34672441C45fBF0f93E` | [view](https://mantlescan.xyz/address/0xf02C982D19184c11b86BC34672441C45fBF0f93E#code) |
| AnnealAgent | `0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924` | [view](https://mantlescan.xyz/address/0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924#code) |
| AnnealStaking (WMNT) | `0xf9f3A9F5F3a2F4138FB680D5cDfa635FD4312372` | [view](https://mantlescan.xyz/address/0xf9f3A9F5F3a2F4138FB680D5cDfa635FD4312372#code) |

- **ERC-8004 agent #131** on registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` — [register tx](https://mantlescan.xyz/tx/0x599ff14f168dbe6dd31fe66125138f3fc64a4a50961e88e651aeb221be14a945)
- **Live audit:** Merchant Moe LB Router (~$60M TVL) → 100/100, [posted on-chain](https://mantlescan.xyz/tx/0x94f3e516821fd7378c24c0f78179dd9f26cfc49f64eb30f904eb7d23c4d5dd96)
- Also deployed + verified on Mantle Sepolia (chain 5003, same addresses) with a 5-audit / 20-finding batch.

Deployer: `0xF97933dF45EB549a51Ce4c4e76130c61d08F1ab5`.

## Benchmark Results (reproducible)
| Contract | Exploit analog | Loss | Detected |
|---|---|---:|---|
| `MinterestVuln.sol` | Minterest Jul-2024 (Mantle) | $1.4M | ✅ HIGH |
| `EulerDonation.sol` | Euler Finance Mar-2023 | $197M | ✅ HIGH |
| `NomadInit.sol` | Nomad Bridge Aug-2022 | $190M | ✅ HIGH |
| `LayerZeroDVN.sol` | KelpDAO LayerZero Apr-2026 | $292M | ✅ HIGH |
| `Clean1.sol` / `Clean2.sol` | — | — | ✅ CLEAN (0 FP) |

**Precision 100% · Recall 100% · F1 1.00.** Re-run with `pnpm --filter @tryanneal/engine benchmark`. Measured gas before/after (batch −90% L1, calldata −6.3%, storage −7.2%) at [`/docs/benchmarks`](https://tryanneal.xyz/docs/benchmarks).

## Tech Stack
- **Engine** — TypeScript; Slither 0.11.5 + Aderyn + 16 custom detectors; ChainGPT pre-screen + Groq Llama-3.3-70B + OpenAI GPT-OSS-120B critics (Gemini 2.5 Pro optional, off by default); deterministic + reproducible (temperature-0 decoding, ≥2-source corroboration, codeHash memoization); Tencent Cloud Hunyuan-MT translation + remediation.
- **Contracts** — Solidity 0.8.24, Hardhat, OpenZeppelin 5, hardhat-verify v2.
- **Frontend** — Next.js 16, TailwindCSS 4, React Three Fiber, recharts.
- **Packages** — npm: `@tryanneal/cli` v0.1.5, `@tryanneal/engine` v0.1.3 · PyPI: `tryanneal-detectors` v0.1.0.
- **Tests** — Vitest (engine, 68) + Hardhat/Mocha (contracts) + pytest (detectors) + reproducible benchmark.

## Where each capability lives
| Area | Where it lives |
|---|---|
| Audit quality | ≥2-source corroboration + dedup; 16 custom detectors modeling real hacks; 98-pattern / $7.1B corpus matcher — findings cite function, line, confidence, sources, and the linked incident (beyond generic LLM output). |
| Tencent Cloud + Mantle | Hunyuan-MT for 14-language reports + per-finding remediation; Arsia 3-component gas (measured before/after); ERC-8004 on-chain attestation; agent #131 live on mainnet. |
| Developer productivity | npm CLI with a `--threshold` exit-code gate; MCP server agents call natively; a no-keys GitHub Action that blocks merges via a check-run; `pip install tryanneal-detectors`. |
| Verifiability | Reproducible P/R/F1 = 1.00 benchmark; measured gas deltas; deterministic run-to-run; a real $60M protocol audit live on-chain. |
| Execution / UX | Five surfaces incl. a zero-login `/try`; live on Mantle mainnet; reproducible setup; 2-min demo video. |

## What the demo shows
One `anneal audit` run boots the engine (Slither + Aderyn in parallel → ChainGPT pre-screen → the two Groq critics → consensus), lands on a reentrancy finding cross-validated by four engines, runs it twice to show an identical verdict, scrolls the measured Arsia gas before/after, resolves the live Merchant Moe verdict via `curl /api/safety/<hash>?network=mantle`, shows a PR going red ❌ → green ✅ through the GitHub Action gate, and closes on the on-chain `postVerdict` transaction for agent #131. See [`docs/DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).

## Composability — the DevTool working where agents live
The `is_this_safe()` primitive is built to be *called by other agents*. As proof, `anneal-safety-gate` is an Agent Skill that a Byreal trading agent chains **before** it deploys capital: the agent reads market context, audits the target contract, and autonomously decides to proceed or abort (verified end-to-end: Merchant Moe → proceed; a malicious pool → abort, capital preserved). Code at `integrations/byreal/`, installable via `npx skills add winsznx/tryanneal/integrations/byreal/anneal-safety-gate`. A developer tool is only as good as the workflows it slots into — this is ours slotting into an autonomous agent's.

## Contact
- GitHub: [@winsznx](https://github.com/winsznx)
- Email: xidoncapitals@gmail.com
