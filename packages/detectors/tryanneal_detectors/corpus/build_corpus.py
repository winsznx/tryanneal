"""Build the canonical patterns.json from raw research dumps + manual entries.

Pipeline:
  1. Walk research/*.json, recovering entries even when the file is malformed
     (research.json has embedded newlines, research4.json was truncated).
  2. Deduplicate by `id`.
  3. Normalize each rich research entry to the matcher schema.
  4. Merge with the existing handwritten entries; the research version wins on
     `id` collision, but handwritten entries get a `manual_override: true`
     flag preserved when no research equivalent exists.
  5. Emit `patterns.json` (formatted, deterministic order).
  6. Print a summary line for commit messages and CLI banners.

Run with: `python build_corpus.py` (or `python -m tryanneal_detectors.corpus.build_corpus`).
Idempotent.
"""
from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Local imports are made relative so the script runs either as
# `python build_corpus.py` (CWD = corpus dir) or
# `python -m tryanneal_detectors.corpus.build_corpus` (CWD = repo root).
HERE = Path(__file__).parent
RESEARCH_DIR = HERE / "research"
OUT_PATH = HERE / "patterns.json"

# Manual handwritten patterns we shipped in v1. Preserve unless a research
# entry with the same id overrides them.
MANUAL_FALLBACK_PATH = HERE / "patterns.manual.json"


# ----------------------------------------------------------------------------
# JSON recovery
# ----------------------------------------------------------------------------

def _recover_array(text: str) -> List[dict]:
    """Greedy object-by-object recovery for malformed JSON arrays.

    Used when the file was truncated mid-write or contains embedded control
    characters that strict JSON rejects. Returns what we could parse.
    """
    text = text.lstrip()
    if not text.startswith("["):
        return []
    out: List[dict] = []
    i, n = 1, len(text)
    while i < n:
        ch = text[i]
        if ch in " \t\r\n,":
            i += 1
            continue
        if ch == "]":
            break
        if ch != "{":
            break
        start, depth, in_str, esc = i, 0, False, False
        while i < n:
            c = text[i]
            if in_str:
                if esc:
                    esc = False
                elif c == "\\":
                    esc = True
                elif c == '"':
                    in_str = False
            else:
                if c == '"':
                    in_str = True
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        i += 1
                        break
            i += 1
        try:
            out.append(json.loads(text[start:i], strict=False))
        except Exception:
            break
    return out


def load_research_files(research_dir: Path) -> Dict[str, dict]:
    """Walk every *.json in `research_dir`, returning a dict keyed by id."""
    out: Dict[str, dict] = {}
    if not research_dir.is_dir():
        return out
    for path in sorted(research_dir.glob("*.json")):
        raw = path.read_text(encoding="utf-8").strip()
        if not raw:
            continue
        try:
            arr = json.loads(raw, strict=False)
            if not isinstance(arr, list):
                arr = []
        except json.JSONDecodeError:
            arr = _recover_array(raw)
        for entry in arr:
            i = entry.get("id")
            if not i:
                continue
            if i in out:
                # Newer file may have richer schema; keep whichever has more
                # populated fields (proxy via field count).
                if _populated_field_count(entry) > _populated_field_count(out[i]):
                    out[i] = entry
            else:
                out[i] = entry
    return out


def _populated_field_count(e: dict) -> int:
    return sum(1 for v in e.values() if v not in (None, "", [], {}))


# ----------------------------------------------------------------------------
# Normalize research → patterns.json
# ----------------------------------------------------------------------------

CHAIN_LANG: Dict[str, str] = {
    "ethereum": "solidity",
    "arbitrum": "solidity",
    "optimism": "solidity",
    "polygon": "solidity",
    "base": "solidity",
    "bsc": "solidity",
    "avalanche": "solidity",
    "fantom": "solidity",
    "blast": "solidity",
    "mantle": "solidity",
    "solana": "rust",
    "near": "rust",
    "bitcoin": "script",
    "multi": "solidity",
}

CATEGORY_BUCKETS: List[Tuple[str, str]] = [
    ("reentrancy", "reentrancy"),
    ("oracle", "oracle"),
    ("price", "oracle"),
    ("amm", "economic"),
    ("rounding", "economic"),
    ("precision", "economic"),
    ("share", "economic"),
    ("debt_share", "economic"),
    ("flash", "economic"),
    ("bonding", "economic"),
    ("liquidity", "economic"),
    ("infinite_mint", "economic"),
    ("arbitrary", "approval_abuse"),
    ("call injection", "approval_abuse"),
    ("approval", "approval_abuse"),
    ("signature", "signature"),
    ("ecdsa", "signature"),
    ("nonce", "signature"),
    ("merkle", "signature"),
    ("bridge", "cross_chain"),
    ("cross", "cross_chain"),
    ("governance", "governance"),
    ("voting", "governance"),
    ("proxy", "proxy"),
    ("storage", "proxy"),
    ("uninitialized", "proxy"),
    ("init", "proxy"),
    ("access control", "access_control"),
    ("missing_access", "access_control"),
    ("missing-access", "access_control"),
    ("rug", "rug"),
    ("backdoor", "rug"),
    ("insider", "rug"),
    ("key compromise", "key_compromise"),
    ("signer compromise", "key_compromise"),
    ("seed phrase", "key_compromise"),
    ("private key", "key_compromise"),
    ("vanity address", "key_compromise"),
    ("validator-key", "key_compromise"),
    ("admin_key", "key_compromise"),
    ("admin-key", "key_compromise"),
    ("deployer-key", "key_compromise"),
    ("custodial", "key_compromise"),
]

# Keywords extracted from root_cause_short → fingerprint features.
KEYWORD_TO_FEATURE: List[Tuple[str, str]] = [
    ("flash loan", "flashloan"),
    ("flash-loan", "flashloan"),
    ("flashloan", "flashloan"),
    ("donation", "no_dead_shares"),
    ("first depositor", "no_dead_shares"),
    ("dead share", "dead_shares"),
    ("delegatecall", "delegatecall"),
    ("delegate call", "delegatecall"),
    ("callback", "callback"),
    ("reenter", "reentrancy"),
    ("reentrancy", "reentrancy"),
    ("approval", "user_approvals"),
    ("approve", "user_approvals"),
    ("transferfrom", "transferfrom"),
    ("arbitrary call", "arbitrary_external_call"),
    ("arbitrary target", "arbitrary_external_call"),
    ("user-supplied target", "arbitrary_external_call"),
    ("user-supplied calldata", "arbitrary_external_call"),
    ("low-level call", "low_level_call"),
    ("ecrecover", "ecrecover"),
    ("signature replay", "signature_replay"),
    ("nonce reuse", "nonce_reuse"),
    ("merkle proof", "merkle_proof"),
    ("merkle root", "merkle_proof"),
    ("oracle", "oracle"),
    ("spot price", "spot_only"),
    ("twap", "twap"),
    ("constant product", "constant_product"),
    ("amm", "amm_spot_oracle"),
    ("share price", "share_price"),
    ("share rounding", "share_rounding"),
    ("rounding", "rounding"),
    ("precision", "precision"),
    ("bonding curve", "bonding_curve"),
    ("infinite mint", "infinite_mint"),
    ("initialize", "initialize"),
    ("uninitialized", "uninitialized_proxy"),
    ("reinitialization", "reinitialization"),
    ("proxy", "proxy"),
    ("storage collision", "storage_collision"),
    ("storage layout", "storage_layout"),
    ("governance", "governance"),
    ("voting", "voting"),
    ("multisig", "multisig"),
    ("signer", "signer_set"),
    ("validator", "validator_set"),
    ("layerzero", "layerzero"),
    ("dvn", "dvn"),
    ("bridge", "bridge"),
    ("cross-chain", "cross_chain"),
    ("cross chain", "cross_chain"),
    ("missing access", "missing_access_control"),
    ("missing-access", "missing_access_control"),
    ("missing call", "missing_validation"),
    ("event spoofing", "event_spoofing"),
    ("deposit", "deposit"),
    ("withdraw", "withdraw"),
    ("borrow", "borrow"),
    ("metapool", "metapool"),
    ("lp token", "lp_token"),
    ("collateral", "collateral_pricing"),
    ("erc4626", "erc4626"),
    ("vault", "vault"),
]


def bucket_category(bug_class_primary: str) -> str:
    s = (bug_class_primary or "").lower()
    for needle, bucket in CATEGORY_BUCKETS:
        if needle in s:
            return bucket
    return "other"


def derive_fingerprint(entry: dict) -> List[str]:
    """3–6 short identifying features."""
    feats: set = set()
    bcp = (entry.get("bug_class_primary") or "").lower()
    if bcp:
        feats.add(_normalize_feature(bcp))
    for c in entry.get("bug_class_contributing") or []:
        feats.add(_normalize_feature(c))
    for p in entry.get("prerequisites") or []:
        feats.add(_normalize_feature(p))
    root = (entry.get("root_cause_short") or "").lower()
    for needle, feat in KEYWORD_TO_FEATURE:
        if needle in root:
            feats.add(feat)
    # Cap to 8 — beyond that Jaccard noise grows.
    cleaned = [f for f in feats if f and len(f) <= 60]
    cleaned.sort(key=lambda x: (len(x), x))
    return cleaned[:8]


def _normalize_feature(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s


def derive_name(entry: dict) -> str:
    proto = (entry.get("protocol") or "unknown").strip()
    bug = (entry.get("bug_class_primary") or "exploit").strip()
    return f"{proto} — {bug}"


def derive_year_month(entry: dict) -> Tuple[Optional[int], Optional[int]]:
    d = (entry.get("date_utc") or "").strip()
    m = re.match(r"(\d{4})-(\d{2})", d)
    if not m:
        return None, None
    return int(m.group(1)), int(m.group(2))


def derive_language(entry: dict) -> str:
    chain = ((entry.get("chain_primary") or entry.get("chain") or "ethereum")).lower()
    return CHAIN_LANG.get(chain, "solidity")


def derive_fix(entry: dict) -> str:
    mitigation = (entry.get("mitigation_class") or "").strip()
    invariant = (entry.get("invariant_broken") or "").strip()
    parts = []
    if mitigation:
        parts.append(f"Apply mitigation class: {mitigation}.")
    if invariant:
        parts.append(f"Restore invariant: {invariant}.")
    if not parts:
        parts.append("See linked post-mortem for remediation.")
    return " ".join(parts)


def derive_reference_url(entry: dict) -> str:
    sources = entry.get("sources") or []
    if isinstance(sources, list) and sources:
        first = sources[0]
        if isinstance(first, dict):
            return str(first.get("url") or first.get("href") or "")
        return str(first)
    return entry.get("poc_url") or entry.get("fix_commit_url") or ""


def normalize_research_entry(entry: dict) -> Optional[dict]:
    if not entry.get("id"):
        return None
    year, month = derive_year_month(entry)
    pattern = {
        "id": str(entry["id"]),
        "name": derive_name(entry),
        "year": year if year is not None else 0,
        "language": derive_language(entry),
        "category": bucket_category(entry.get("bug_class_primary") or ""),
        "vulnerability_class": (entry.get("bug_class_primary") or "unknown").lower().strip(),
        "code_signature": entry.get("root_cause_short") or "",
        "fingerprint_features": derive_fingerprint(entry),
        "recommended_fix": derive_fix(entry),
        "reference_url": derive_reference_url(entry),
        "losses_usd": int(entry.get("loss_usd_approx") or 0),
        # passthrough rich fields used by the enhanced matcher / CLI
        "chain": entry.get("chain_primary") or entry.get("chain") or "",
        "detection_difficulty": entry.get("detection_difficulty") or "",
        "threat_actor": entry.get("threat_actor") or "",
        "linked_incident": entry.get("linked_incident") or "",
        "protocol": entry.get("protocol") or "",
        "source": "research",
    }
    if month is not None:
        pattern["month"] = month
    return pattern


# ----------------------------------------------------------------------------
# Build
# ----------------------------------------------------------------------------

@dataclass
class BuildReport:
    research_loaded: int
    manual_kept: int
    final_count: int
    total_losses_usd: int
    chains: List[str]
    years: Tuple[int, int]

    def summary(self) -> str:
        loss_b = self.total_losses_usd / 1_000_000_000
        years = f"{self.years[0]}-{self.years[1]}" if self.years[0] else "n/a"
        return (
            f"Expanded corpus from {self.manual_kept} entries to {self.final_count} entries "
            f"covering ${loss_b:.2f}B in losses across {len(self.chains)} chains ({years})."
        )


def load_manual_fallback(path: Path) -> List[dict]:
    """Manual patterns shipped in v1 — kept under manual_override: true unless
    research-side ids supersede them."""
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    return data.get("patterns", []) if isinstance(data, dict) else []


def build(research_dir: Path = RESEARCH_DIR, manual_path: Path = MANUAL_FALLBACK_PATH) -> Tuple[List[dict], BuildReport]:
    research = load_research_files(research_dir)
    normalized: Dict[str, dict] = {}
    for entry in research.values():
        norm = normalize_research_entry(entry)
        if norm:
            normalized[norm["id"]] = norm

    manual = load_manual_fallback(manual_path)
    manual_kept = 0
    for m in manual:
        mid = m.get("id")
        if not mid:
            continue
        if mid in normalized:
            # research wins; carry over manual-only enrichments if absent
            for k, v in m.items():
                if k not in normalized[mid] or normalized[mid][k] in (None, "", [], {}):
                    normalized[mid][k] = v
            continue
        # No research equivalent: keep the manual entry verbatim, flagged.
        m_copy = dict(m)
        m_copy["manual_override"] = True
        m_copy.setdefault("source", "manual")
        normalized[mid] = m_copy
        manual_kept += 1

    patterns = list(normalized.values())
    patterns.sort(key=lambda p: (-(p.get("losses_usd") or 0), p["id"]))

    chains = sorted({p.get("chain") for p in patterns if p.get("chain")})
    years = [p["year"] for p in patterns if isinstance(p.get("year"), int) and p["year"]]
    year_range = (min(years), max(years)) if years else (0, 0)
    report = BuildReport(
        research_loaded=len(research),
        manual_kept=manual_kept,
        final_count=len(patterns),
        total_losses_usd=sum(p.get("losses_usd") or 0 for p in patterns),
        chains=chains,
        years=year_range,
    )
    return patterns, report


def write_patterns(patterns: List[dict], out_path: Path = OUT_PATH) -> None:
    doc = {"version": 2, "patterns": patterns}
    out_path.write_text(json.dumps(doc, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def main() -> int:
    patterns, report = build()
    write_patterns(patterns)
    print(report.summary())
    print(f"Wrote {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
