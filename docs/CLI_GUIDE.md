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
| `--quick` | off | Pre-screen only (ChainGPT). Skips the Gemini/Groq/Hunyuan critic cascade — fast, cheap. |
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

## Demo recipes

### 1. The headline run — full multi-LLM cascade (shows Hunyuan)

```bash
set -a && source .env && set +a
unset VIRTUAL_ENV && export PATH="$HOME/.local/bin:$PATH"

pnpm --filter @tryanneal/cli start audit \
  packages/contracts/contracts/audit-targets/SampleVault.sol \
  --network mantle-sepolia --no-encrypt
```

What to point at on screen:

- The corpus banner: `Audited against TryAnneal corpus: 113 exploit patterns | $10.1B losses | 2020-2026`
- The CRITICAL reentrancy finding with `Sources: chaingpt, groq, hunyuan` — multi-LLM consensus plus Slither cross-validation.
- The **`Models: chaingpt, groq, hunyuan, slither`** line at the bottom — `hunyuan` is the Tencent Cloud integration, visible on every audit.
- The 3-column Arsia gas table (L2 exec / L1 data / operator).

> Tip: if a provider is rate-limited (e.g. Gemini 429), the cascade still runs
> with the rest. To debug, prefix with `ANNEAL_DEBUG_CRITICS=1`.

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
