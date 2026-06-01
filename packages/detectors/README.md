# @tryanneal/detectors

Custom Slither detectors for Mantle and ERC-8004 agent-context exploits, plus a curated exploit-corpus matcher.

## Install

```bash
pip install -e packages/detectors
```

Slither discovers the pack automatically via the `slither_analyzer.plugin` entry point. Once installed, `slither contract.sol` runs builtin detectors **and** TryAnneal detectors together.

## Detectors (11)

### Agent-context (novel IP)
| Argument | Impact | Confidence | What it catches |
|---|---|---|---|
| `agent-reentrancy` | HIGH | HIGH | ERC-8004 agent A calls into agent B before completing state writes; B can re-enter A |
| `agent-callback-loop` | HIGH | MEDIUM | Agent callback handler mutates state without idempotency guard; repeated delivery re-credits |

### Mantle-specific (Arsia)
| Argument | Impact | Confidence | What it catches |
|---|---|---|---|
| `calldata-bloat` | MEDIUM | HIGH | Functions whose FastLZ-estimated calldata makes L1 data fee dominate total cost |
| `operator-fee-outlier` | LOW | HIGH | Loops + heavy SSTOREs where Arsia operator fee component > 25% of total |
| `l1block-unchecked-read` | MEDIUM | MEDIUM | Reads `L1Block` predeploy without validating returned value |
| `arsia-anti-patterns` | MEDIUM | MEDIUM | Hardcoded pre-Arsia basefee floor, EigenDA refs, retired predeploys |

### Exploit patterns (encode real April 2026 + historical hacks)
| Argument | Impact | Confidence | Encoded incident |
|---|---|---|---|
| `single-dvn-verifier` | HIGH | HIGH | KelpDAO/LayerZero DVN drain (Apr 2026, ~$292M) — N≤2 verifier threshold |
| `donation-attack` | HIGH | MEDIUM | Euler-class ERC4626 share-price inflation (~$197M) |
| `init-unprotected` | HIGH | HIGH | Nomad-class initializer replay (~$190M) |
| `oracle-no-staleness` | MEDIUM | HIGH | Oracle reads without freshness check (Mango Markets ~$117M and many more) |
| `proxy-storage-collision` | HIGH | HIGH | EIP-1967 proxy with state vars colliding with implementation slots |

### Meta
| Argument | Impact | Confidence | What it catches |
|---|---|---|---|
| `corpus-match` | MEDIUM | MEDIUM | Jaccard similarity ≥ 60% to any of 15+ curated historical exploits — surfaces losses and reference URL |

## Exploit corpus

[`tryanneal_detectors/corpus/patterns.json`](./tryanneal_detectors/corpus/patterns.json) ships 16 vetted entries spanning **>$2B in real historical losses**. Each entry carries:

- Year, month, USD losses, category, vulnerability class
- A `code_signature` description for human review
- `fingerprint_features` — the feature set the Jaccard matcher compares against
- A `recommended_fix` and a `reference_url` to the canonical post-mortem

The `CorpusMatch` detector and the standalone `tryanneal_detectors.corpus.matcher` extract a fingerprint from any Solidity source and report matches above a configurable threshold (default 60%).

```python
from tryanneal_detectors.corpus.matcher import find_matches
matches = find_matches(open("Vault.sol").read())
for m in matches:
    print(f"{m.similarity*100:.0f}% — {m.name} — ${m.losses_usd:,} lost")
```

## Tests

Two suites:

- **`tests/test_corpus.py` + `tests/test_helpers.py`** — pure-Python, no Slither required. Exercises the matcher against fixtures and asserts canonical incidents come back at the expected similarity (11 tests).
- **`tests/test_detectors_smoke.py`** — end-to-end Slither integration. Each fixture is run through the actual detector and we assert the right argument fires. Auto-skips when `slither-analyzer` is not installed.

```bash
cd packages/detectors
pip install -e .[dev]
pytest
```

## CLI integration

The `anneal audit` CLI accepts:

```bash
anneal audit Vault.sol                          # default: builtin + tryanneal
anneal audit Vault.sol --detectors=tryanneal    # only the custom pack
anneal audit Vault.sol --detectors=builtin      # only stock Slither
```

Findings tagged with `source: "tryanneal"` get distinct rendering in the report. Corpus matches get the highlighted call-out:

```
⚠️  CORPUS MATCH (78% similar to known exploit)
    KelpDAO LayerZero DVN Drain — 2026 — $292.0M lost
    Lines 12-34 | Sources: tryanneal
    Fix: Require N≥3 distinct DVN operators with independent infrastructure
    Reference: https://blockaid.io/blog/...
```
