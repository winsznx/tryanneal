# @tryanneal/cli — `anneal`

**The security check agents (and developers) run before they trust a contract.**

TryAnneal is a Mantle-native, multi-model smart-contract audit engine. The CLI runs the full pipeline locally and returns a deterministic verdict you can gate CI on.

```
npx @tryanneal/cli audit ./Vault.sol
```

```
is_this_safe()  ✗ UNSAFE  — 1 critical, 0 high
🔴 CRITICAL (99%) Reentrancy
   Lines 14-20 | Sources: chaingpt, groq, gpt-oss, slither
   The withdraw function makes an external call before updating state.
   Fix: Apply checks-effects-interactions; add a nonReentrant guard.
VERDICT: 70/100   Models: chaingpt, groq, gpt-oss, slither
Audited against TryAnneal corpus: 98 exploit patterns | $7.1B losses | 2020-2026
```

## What it does

- **Multi-model, cross-validated.** ChainGPT pre-screen → two architecturally-distinct critics on Groq (Llama-3.3-70B + OpenAI GPT-OSS-120B) → Slither + Aderyn static analysis + **16 custom detectors** → a **98-pattern, $7.1B** exploit corpus. A finding needs **≥2 independent sources** to survive — single-model hunches are dropped, and the same issue from multiple engines is merged into one finding listing every source.
- **Deterministic.** Temperature-0, seeded decoding + memoization by code hash → the **same contract always returns the same verdict**. Run it twice, byte-identical.
- **Mantle-native gas.** 3-component Arsia fee profile (L2 exec + L1 data + operator) with optimization suggestions.
- **`is_this_safe()` verdict.** A clear `SAFE / UNSAFE / INCONCLUSIVE` answer plus a 0–100 score.
- **On-chain attestable.** `--attest` posts the verdict to the AnnealValidation registry (ERC-8004) on Mantle.

## Install

```bash
npm i -g @tryanneal/cli      # or: npx @tryanneal/cli audit <file>
```

Requires [Slither](https://github.com/crytic/slither) on `PATH` (`pip install slither-analyzer`). LLM keys are optional — without them the CLI runs deterministic Slither + detectors + corpus (`--no-llm`).

## Usage

```bash
anneal audit <file.sol> [options]
```

| Option | Description |
|---|---|
| `--threshold <score>` | **CI gate** — exit non-zero if the verdict score < N (0 = severity-only; fails on any high/critical). |
| `-n, --network <net>` | `mantle` (default) or `mantle-sepolia`. |
| `--quick` | Pre-screen only (skip the critic cascade). |
| `--no-llm` | Slither + detectors + corpus only (no keys needed, fully deterministic). |
| `--no-aderyn` | Skip Aderyn. |
| `--gas-only` | Only the Arsia gas profile. |
| `--attest` | Post the verdict on-chain (needs `DEPLOYER_PRIVATE_KEY` + `--validation <addr>`). |

The process **exits non-zero on risk**, so it drops straight into a pre-commit hook, Makefile, or CI step:

```bash
anneal audit contracts/Vault.sol --no-llm --threshold 80 || exit 1
```

### Environment

`CHAINGPT_API_KEY` (pre-screen), `GROQ_API_KEY` (the two critics), `HUNYUAN_API_KEY` (14-language report translation), `GEMINI_API_KEY` (optional 3rd critic, off by default).

## Use it in CI (GitHub Action)

Audit changed Solidity on every PR and **block the merge** on risk — **no API keys required** (the `--no-llm` run is deterministic Slither + 16 detectors + corpus, so it's safe on forked PRs and needs nothing configured):

```yaml
name: TryAnneal Security Audit
on:
  pull_request:
    paths: ["**/*.sol"]
permissions: { contents: read, pull-requests: write }
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      # tryanneal-detectors brings Slither + the 16 custom detectors + corpus matcher
      - run: pip install tryanneal-detectors solc-select && solc-select install 0.8.24 && solc-select use 0.8.24
      - run: npx @tryanneal/cli audit contracts/*.sol --no-llm --threshold 80
```

The audit posts a **✅ PASSED / ❌ BLOCKED** PR comment and a red/green **check-run** — wire it into branch protection to block merges that score below the threshold.

## Links

- Live: [tryanneal.xyz](https://tryanneal.xyz) · try it: [/try](https://tryanneal.xyz/try) · docs: [/docs](https://tryanneal.xyz/docs)
- Hosted MCP (for agents in Claude/Cursor): `mcp.tryanneal.xyz`
- Safety Oracle (read any verdict): `https://tryanneal.xyz/api/safety/<codeHash>?network=mantle`

MIT © TryAnneal
