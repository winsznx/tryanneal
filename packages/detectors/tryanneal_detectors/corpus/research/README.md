# Research Corpus — Raw Inputs

This directory holds the raw Web3 security research dumps that feed the
TryAnneal pattern library. Files arrive here in their original schema. The
build step ([`../build_corpus.py`](../build_corpus.py)) normalizes them,
deduplicates by `id`, then runs an incident-level de-dup pass (alias map +
defensive protocol/year/month collapse) so the same real-world exploit is never
counted twice, and emits the canonical [`../patterns.json`](../patterns.json)
that detectors and the matcher consume.

**Do not edit `patterns.json` directly.** Edit the source JSON here (or the
manual handwritten entries the build script preserves) and rerun the build.

## Files

| file | entries | notes |
|---|---:|---|
| `2020-2023_historical.json` | 3 | Hand-curated historical fixtures (Eminence, Bancor, etc.) |
| `2024_defihacklabs.json` | 0 | Empty placeholder — DefiHackLabs scrape pending |
| `2026_research.json` | 21 | 2024–2026 incidents, recent activity |
| `research.json` | 9 | Recovery: file ships with embedded control characters (newlines in strings); loader uses `strict=False` |
| `research4.json` | 65 | Recovery: file was truncated mid-object on write; build script recovers up to last well-formed entry |

**Research-source entries after incident-level dedup: 93** (4 same-incident
duplicates collapsed). Merged with 5 manual-only entries, the shipped
[`../patterns.json`](../patterns.json) holds **98 unique incidents · ≈$7.1 B**.

## Coverage

- **Total losses covered (research-source):** ≈ **$6.65 B**
- **Date range:** 2023-12-31 → 2026-04-01
- **Chains:** ethereum (52), bsc (12), solana (10), arbitrum (4), fantom (4), polygon (4), avalanche (3), bitcoin (2), optimism (2), base (1), blast (1), near (1), multi (1)

## Bug-class density (top 10 by frequency)

```
 8  reentrancy
 7  price-oracle-manipulation
 6  key compromise
 3  amm_spot_price_oracle_manipulation
 2  arbitrary external call
 2  call injection
 2  access control
 2  oracle price manipulation
 2  signer compromise
 2  precision error
```

Many one-off entries collapse into broader clusters once you normalize the
class names. See "Cluster density (detector targeting)" below.

## Cluster density (detector targeting)

Used to decide which new detectors to build. Threshold: ≥ 5 entries OR ≥ $50 M
cumulative losses across entries.

| cluster | entries | losses |
|---|---:|---:|
| `validator_signer_compromise` | 15 | $2,239.6 M |
| `amm_spot_oracle` | 6 | $128.8 M |
| `rounding_share_accounting` | 6 | $92.9 M |
| `approval_arbitrary_call` | 5 | $35.6 M |
| `signature_replay_or_bypass` | 5 | $1,192.3 M |
| `cross_chain_msg_bypass` | 4 | $1,496.9 M |
| `governance_flashloan` | 3 | $209.0 M |
| `infinite_mint_deposit_logic` | 3 | $97.1 M |
| `proxy_init_or_collision` | 2 | $7.9 M |

**Detector picks (4 new):**
- `approval-abuse-arbitrary-call` — 5 entries, exactly meets threshold; the prompt's flagship recommendation
- `signature-replay-bypass` — 5 entries, $1.19 B in cumulative losses
- `amm-spot-oracle-dependency` — 6 entries, $128.8 M; complements existing `oracle-no-staleness`
- `vault-share-rounding` — 6 entries, $92.9 M; complements existing `donation-attack`

**Skipped (below threshold or not statically detectable):**
- `validator_signer_compromise` — operational / off-chain; cannot be detected from source
- `cross_chain_msg_bypass` — 4 entries, partially covered by `single-dvn-verifier` + `signature-replay-bypass`
- `governance_flashloan` / `infinite_mint_deposit_logic` — below 5 entries
- `proxy_init_or_collision` — already covered by `init-unprotected` + `proxy-storage-collision`

## Schema (rich research format)

Each entry carries far more context than the canonical `patterns.json`. The
build script projects the rich fields down to the matcher schema; the rest
travels along as extra metadata for the CLI to surface.

```json
{
  "id": "swapnet_20260125_multi",
  "protocol": "SwapNet",
  "date_utc": "2026-01-25",
  "chain": "multi",
  "chain_primary": "base",
  "loss_usd_approx": 13400000,
  "loss_confidence": "reported_exact",
  "layer": "contract",
  "bug_class_primary": "Arbitrary External Call",
  "bug_class_contributing": [
    "insufficient_input_validation",
    "approval_abuse",
    "missing_call_target_whitelist",
    "closed_source_opacity"
  ],
  "root_cause_short": "Router's swap function accepted user-supplied call target and calldata; attacker drained pulled tokens",
  "exploit_steps": "[step-by-step description]",
  "invariant_broken": "[invariant that should have held but was violated]",
  "prerequisites": ["existing token approvals to router", "external swap data is user-controlled"],
  "detection_difficulty": "static",
  "mitigation_class": "whitelist_call_targets",
  "fix_commit_url": "...",
  "poc_url": "...",
  "sources": ["...post-mortem URL...", "..."],
  "whitehat": false,
  "recovered_usd": 0,
  "notes": "...",
  "linked_incident": "aperture_20240226_multi",
  "threat_actor": "DPRK Citrine Sleet cluster",
  "reconciliation_notes": null
}
```

### How fields map to `patterns.json`

| research field | patterns.json field |
|---|---|
| `id` | `id` |
| `protocol + bug_class_primary` | `name` |
| `date_utc` → year | `year`, `month` |
| `loss_usd_approx` | `losses_usd` |
| `chain_primary` | `chain` |
| chain → solidity/rust/move | `language` |
| `bug_class_primary` → bucketed | `category` |
| `bug_class_primary` | `vulnerability_class` |
| `root_cause_short` | `code_signature` |
| derived from `bug_class_contributing` + `prerequisites` + keyword extraction on `root_cause_short` | `fingerprint_features` |
| `mitigation_class` + `invariant_broken` | `recommended_fix` |
| `sources[0]` | `reference_url` |
| `detection_difficulty` | `detection_difficulty` (passthrough) |
| `threat_actor` | `threat_actor` (passthrough) |
| `linked_incident` | `linked_incident` (passthrough) |

**v3 matcher (TF-IDF, default).** As of June 2026, `corpus_match` and the
standalone `find_matches()` API use scikit-learn TF-IDF cosine similarity
over a bag-of-words built from `vulnerability_class + code_signature +
fingerprint_features`. Word + bigram n-grams, sublinear-tf, max_df 0.95.
Stricter than v2 Jaccard — default threshold 0.65 vs 0.60 — and produces
fewer false positives on contracts that incidentally overlap on
negative-presence features. v2 Jaccard remains importable as
`find_matches_jaccard()` and is the automatic fallback when scikit-learn
is missing.

The matcher uses everything in `patterns.json`. The CLI surfaces `threat_actor`
and `linked_incident` in the corpus-match callout — that's the "linked to
Radiant Capital Oct 2024 (DPRK Citrine Sleet cluster)" punchline.
