# TryAnneal Benchmark Suite

Reproducible benchmark of the TryAnneal audit engine against fixtures
modelled after real on-chain exploits. The intent is to make the engine's
outputs auditable: anyone can clone the repo, run `pnpm benchmark`, and
verify the same precision / recall numbers we publish.

## Methodology

Six fixtures live under [`contracts/`](./contracts):

| Fixture | Pattern | CVE Analog | Losses |
|---|---|---|---:|
| `MinterestVuln.sol` | External call before state update | Minterest July 2024 (Mantle) | $1.4M |
| `EulerDonation.sol` | ERC4626 share-price inflation via donation | Euler Finance March 2023 | $197M |
| `NomadInit.sol` | Unprotected initializer | Nomad Bridge August 2022 | $190M |
| `LayerZeroDVN.sol` | Single-DVN verifier config | KelpDAO LayerZero April 2026 | $292M |
| `Clean1.sol` | Plain ERC20 — no vulnerability | — | — |
| `Clean2.sol` | Owner-gated treasury — no vulnerability | — | — |

Each fixture has a hand-coded ground truth in `EXPECTATIONS` inside
[`run.ts`](./run.ts) — what severity the engine SHOULD return and which
detector classes SHOULD fire.

The runner invokes `runAudit({ noLlm: true })` on each fixture. **No LLM
keys are used** — the benchmark is deterministic across runs because:

- Slither is deterministic given the same source + solc version (0.8.24).
- The TryAnneal detector plugin is deterministic Python.
- The corpus matcher uses Jaccard (v1) / TF-IDF cosine (v2) over a fixed
  patterns.json snapshot, no API calls.

This is the auditable proof — judges and contributors can re-run the suite
and get the same numbers.

## Metrics

A fixture is a **true positive** when:
- Vulnerable fixture: any HIGH or CRITICAL finding surfaces, OR a detector
  matching the expected pattern fires.
- Clean fixture: zero HIGH / CRITICAL findings.

A fixture is a **false negative** when a vulnerable fixture produces zero
HIGH / CRITICAL findings AND none of the expected detectors fire. A **false
positive** is a HIGH / CRITICAL finding on a clean fixture.

```
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 * Precision * Recall / (Precision + Recall)
```

## Latest results

> Snapshot from `results/latest.json`. Reproduce with `pnpm benchmark`.

| Contract | CVE Analog | Losses | Detected | Top Confidence |
|---|---|---:|---|---:|
| `MinterestVuln.sol` | Minterest July 2024 (Mantle) | $1.4M | ✅ HIGH | 65% |
| `EulerDonation.sol` | Euler Finance March 2023 | $197M | ✅ HIGH | 65% |
| `NomadInit.sol` | Nomad Bridge August 2022 | $190M | ✅ HIGH | 85% |
| `LayerZeroDVN.sol` | KelpDAO LayerZero April 2026 | $292M | ✅ HIGH | 85% |
| `Clean1.sol` | — | — | ✅ CLEAN (0 FP) | — |
| `Clean2.sol` | — | — | ✅ CLEAN (0 FP) | — |

**Precision: 100% · Recall: 100% · F1: 1.00 · (TP=4, FN=0, FP=0, TN=2)**

## Running

```bash
# 1. Engine + detector plugin must be installed and on PATH.
#    See packages/contracts/SLITHER_SETUP.md for the macOS setup.

unset VIRTUAL_ENV
export PATH="$HOME/.local/bin:$PATH"

# 2. Run the benchmark.
pnpm --filter @tryanneal/engine benchmark
```

The runner prints a table to stdout and writes the structured payload to
[`results/latest.json`](./results/latest.json). That file is committed.

## Caveats

- The benchmark intentionally uses six fixtures. A larger suite — including
  held-out test set with adversarial near-misses — is the post-hackathon
  follow-up. The point here is reproducibility, not a research benchmark.
- Confidence percentages reflect the engine's consensus scoring, not the
  ground-truth match quality. A 65% confidence finding is still a true
  positive — it just means fewer models / detectors agreed on the exact
  line range.
- `LayerZeroDVN.sol` ships a minimal OFT skeleton, not a full LayerZero
  endpoint. The detector matches the structural signal (single-DVN config)
  regardless.
