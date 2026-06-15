# `anneal` CLI — Usage & Demo Guide

The `anneal` CLI is the fastest way to run TryAnneal and the centrepiece of the
demo. This guide covers one-time setup, every flag, and copy-paste demo recipes.

## One-time setup

```bash
# from the repo root
pnpm install
pnpm --filter @tryanneal/engine build

# Static analysis (for findings beyond the LLM layer). macOS specifics:
#   see packages/contracts/SLITHER_SETUP.md
unset VIRTUAL_ENV
export PATH="$HOME/.local/bin:$PATH"   # where slither + solc live
slither --version    # 0.11.5
solc --version       # 0.8.24

# API keys — all optional; the CLI degrades gracefully without them.
cp .env.example .env  # then fill in the keys you have
```

Load the keys into your shell before a run:

```bash
set -a && source .env && set +a
```

Run the CLI either of these ways:

```bash
# via pnpm (dev)
pnpm --filter @tryanneal/cli start audit <file> [flags]

# or directly with tsx
cd packages/cli && npx tsx src/index.ts audit <file> [flags]
```

## Commands

| command | description |
|---|---|
| `anneal audit <file>` | Audit a Solidity file. Prints findings, gas profile, verdict. |
| `anneal register` | Pointer to the on-chain agent registration script. |
| `anneal status --agent-id <id>` | Pointer to the on-chain status read script. |

## `anneal audit` flags

| flag | default | effect |
|---|---|---|
| `-n, --network <net>` | `mantle` | `mantle` (mainnet, chain 5000) or `mantle-sepolia`. Affects the Arsia gas RPC + attestation target. |
| `--quick` | off | Pre-screen only (ChainGPT). Skips the Groq Llama + GPT-OSS critic cascade — fast, cheap. The full cascade runs by default. |
| `--no-llm` | off | Static analysis only (Slither + Aderyn + corpus). No API keys needed. Fully deterministic. |
| `--gas-only` | off | Skip the security audit; only profile Arsia gas. |
| `--no-aderyn` | off | Skip the Aderyn (Rust) static-analysis layer. |
| `--detectors <mode>` | `all` | `all`, `builtin` (stock Slither), or `tryanneal` (our 15 detectors only). |
| `--no-encrypt` | off | Don't AES-encrypt / store the findings. |
| `--reports-dir <dir>` | `./reports` | Where encrypted reports land (local fallback for Arweave). |
| `--attest` | off | Post the verdict on-chain via `AnnealValidation.postVerdict`. Requires `DEPLOYER_PRIVATE_KEY`. |
| `--validation <addr>` | from deployments | Override the `AnnealValidation` address used by `--attest`. |
| `--report-uri <uri>` | encrypted report path | Override the report URI written on-chain. |
| `--timeout <ms>` | `30000` | Slither timeout. |

Exit code is `1` when a high/critical finding is present (handy in CI), `0` otherwise.

The cascade is resilient and never false-cleans. If nothing could analyze a
contract (e.g. a single `.sol` with unresolved imports that won't compile and no
model response), the verdict is flagged `analysisIncomplete` and is **never**
reported as `safe` / `100/100` — it states that it could not complete the audit.

**Deterministic, reproducible audits.** "AI audits are non-deterministic" is the
usual objection — TryAnneal's answer is that the same contract always returns the
same verdict. Every model decodes at temperature 0 (greedy, seeded); a
corroboration rule requires each reported finding to have ≥2 independent sources
(≥2 models, or a model + Slither) when the full panel runs, so a single-model
hunch never drives the verdict; scoring is confidence-weighted; and the Telegram
bot and the hosted MCP memoize by code hash (keccak/sha3 of the source), so
identical source returns the identical audit.

## Demo recipes

### 1. The headline run — full multi-LLM cascade

```bash
set -a && source .env && set +a
unset VIRTUAL_ENV && export PATH="$HOME/.local/bin:$PATH"

pnpm --filter @tryanneal/cli start audit \
  packages/contracts/contracts/audit-targets/SampleVault.sol \
  --network mantle-sepolia --no-encrypt
```

What to point at on screen:

- The corpus banner: `Audited against TryAnneal corpus: 113 exploit patterns | $10.1B losses | 2020-2026`
- The CRITICAL reentrancy finding with `Sources: chaingpt, groq, gpt-oss` — multi-LLM consensus plus Slither cross-validation.
- The **`Models: chaingpt, groq, gpt-oss, slither`** line at the bottom — ChainGPT pre-screen plus the two-critic cascade (Groq Llama-3.3-70B + OpenAI GPT-OSS-120B, with Gemini 2.5 Pro optional), cross-validated against Slither.
- The 3-column Arsia gas table (L2 exec / L1 data / operator).

> Tip: if a critic is rate-limited (e.g. a 429), the cascade still runs with the
> rest. The two default critics (Groq Llama-3.3-70B + OpenAI GPT-OSS-120B) are
> served on Groq and cross-validate each other; Gemini 2.5 Pro is an optional
> third critic, off by default because its key is rate-limited. A ChainGPT
> pre-screen failure is non-fatal too — the critics still run. To debug, prefix
> with `ANNEAL_DEBUG_CRITICS=1`.
>
> Tencent Hunyuan powers a separate **translation** layer (not an audit critic):
> the audit runs in English, then Hunyuan-MT (Tencent Cloud TokenHub) translates
> the finished verdict + findings into the reader's language for multilingual
> reports — surfaced in the Telegram bot (`/audit <url|address> <lang>`) and the
> web `/try` page.

### 2. Deterministic run — no API keys (great for judges)

```bash
unset VIRTUAL_ENV && export PATH="$HOME/.local/bin:$PATH"
pnpm --filter @tryanneal/cli start audit \
  packages/contracts/contracts/audit-targets/SampleVault.sol \
  --no-llm --no-encrypt
```

Slither + Aderyn + corpus only. Same result every time — this is what the
[benchmark suite](../packages/engine/benchmarks/README.md) runs.

### 3. Gas profile only

```bash
pnpm --filter @tryanneal/cli start audit MyContract.sol --gas-only
```

### 4. Audit + post the verdict on-chain (mainnet)

```bash
set -a && source .env && set +a   # needs DEPLOYER_PRIVATE_KEY
pnpm --filter @tryanneal/cli start audit MyContract.sol \
  --network mantle --attest
```

Posts to `AnnealValidation` at `0xf02C982D19184c11b86BC34672441C45fBF0f93E`
as agentId 131, then anyone can read it back:

```bash
curl https://tryanneal.xyz/api/safety/<codeHash>
```

## Recording checklist

- Terminal font ≥ 18pt, dark theme, ≥ 120 cols.
- `set -a && source .env && set +a` **before** recording (don't show the keys).
- Do a dry run first so model latency doesn't surprise you (cascade ≈ 12–20s).
- Keep the SampleVault run — its CRITICAL reentrancy is the cleanest visual.
- Full timestamped storyboard: [docs/DEMO_SCRIPT.md](DEMO_SCRIPT.md).
