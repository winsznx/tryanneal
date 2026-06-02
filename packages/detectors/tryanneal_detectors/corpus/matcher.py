"""Jaccard-similarity matcher for the exploit corpus (v2 schema).

v2 enhancements over v1:
  - Still uses Jaccard over `fingerprint_features`.
  - NEW: exact match on `vulnerability_class` boosts similarity by +0.20.
  - NEW: `detection_difficulty` is respected — patterns marked `manual` or
    `symbolic` are downgraded by -0.15, reflecting that the original was hard
    to detect statically, so a surface-level match is less likely real.
  - NEW: matches surface rich passthrough fields (`chain`, `threat_actor`,
    `linked_incident`) so the CLI can produce the punchline:
      "linked to Radiant Capital Oct 2024 (DPRK Citrine Sleet cluster)".
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Set


PATTERNS_PATH = Path(__file__).with_name("patterns.json")
DEFAULT_THRESHOLD = 0.6
DEFAULT_VULN_CLASS_BOOST = 0.20
DETECTION_DIFFICULTY_DOWNGRADE = 0.15
DOWNGRADED_DIFFICULTIES = {"manual", "symbolic", "operational"}


@dataclass
class PatternMatch:
    pattern_id: str
    name: str
    year: int
    losses_usd: int
    similarity: float
    matched_features: List[str]
    missing_features: List[str]
    recommended_fix: str
    reference_url: str
    category: str
    vulnerability_class: str = ""
    chain: str = ""
    threat_actor: str = ""
    linked_incident: str = ""
    detection_difficulty: str = ""
    boosts_applied: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "pattern_id": self.pattern_id,
            "name": self.name,
            "year": self.year,
            "losses_usd": self.losses_usd,
            "similarity_pct": round(self.similarity * 100, 1),
            "matched_features": self.matched_features,
            "missing_features": self.missing_features,
            "recommended_fix": self.recommended_fix,
            "reference_url": self.reference_url,
            "category": self.category,
            "vulnerability_class": self.vulnerability_class,
            "chain": self.chain,
            "threat_actor": self.threat_actor,
            "linked_incident": self.linked_incident,
            "detection_difficulty": self.detection_difficulty,
            "boosts_applied": self.boosts_applied,
        }


def load_corpus(path: Optional[Path] = None) -> List[dict]:
    p = path or PATTERNS_PATH
    with p.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("patterns", [])


_FEATURE_TOKENS = (
    # Cross-chain / messaging
    ("layerzero", "ilayerzero"),
    ("layerzero", "layerzero"),
    ("dvn", "dvn"),
    ("endpoint", "endpoint"),
    ("bridge", "bridge"),
    ("mpc", "mpc"),
    # Vault / lending
    ("erc4626", "erc4626"),
    ("deposit", "function deposit"),
    ("converttoshares", "converttoshares"),
    ("totalassets", "totalassets"),
    ("directly_reads_balanceof", "balanceof("),
    ("compound_fork", "comptroller"),
    ("vault_share_as_price", "priceperShare"),
    ("yield_strategy", "strategy"),
    ("lending", "ctoken"),
    ("borrow", "borrow"),
    ("vault", "vault"),
    # Oracle
    ("oracle", "oracle"),
    ("oracle", "latestrounddata"),
    ("spot_only", "ireserve"),
    ("uniswap_spot", "uniswapv2"),
    ("curve_spot_price", "icurve"),
    ("collateral_pricing", "collateral"),
    ("amm_spot_oracle", "getreserves"),
    ("amm_spot_oracle", "balanceof(address(this))"),
    ("constant_product", "amount0"),
    # Reentrancy / locks
    ("nonreentrant_decorator", "@nonreentrant"),
    ("erc777_hook", "erc777"),
    # Init / governance
    ("initialize", "function initialize"),
    ("governance", "governance"),
    ("voting", "votes"),
    ("multisig", "threshold"),
    ("validator_set", "validator"),
    ("signer_set", "signer"),
    # Approval / arbitrary call
    ("user_approvals", "transferfrom(msg.sender"),
    ("user_approvals", "safetransferfrom(msg.sender"),
    ("user_approvals", "approve"),
    ("low_level_call", ".call{"),
    ("low_level_call", ".call("),
    ("arbitrary_external_call", "call(data"),
    ("arbitrary_external_call", "swapdata"),
    ("arbitrary_external_call", "calldata target"),
    # Signature
    ("ecrecover", "ecrecover"),
    ("signature_replay", "ecrecover"),
    ("nonce_reuse", "nonce"),
    ("merkle_proof", "merkleproof"),
    ("merkle_proof", "verifyproof"),
    # Proxy
    ("proxy", "delegatecall"),
    ("storage_collision", "_implementation"),
    # Compiler / etc
    ("vyper", "vyper"),
    ("old_compiler", "pragma solidity 0.5"),
    # Concentrated liquidity
    ("concentrated_liquidity", "tick"),
    ("uniswap_v3_fork", "uniswapv3"),
    ("tick_math", "tickmath"),
    # Math / atomic
    ("flashloan", "flashloan"),
    ("atomic_oracle", "atomic"),
    # Restaking / specific tokens
    ("rseth_restaking", "rseth"),
    # Auth context
    ("admin_path", "admin"),
    ("setup", "function setup"),
    ("sentinel_root", "trustedroot"),
    ("sets_owner", "owner ="),
    ("sets_owner", "owner = _owner"),
    ("layerzero", "ilayerzeroendpoint"),
)

_NEGATIVE_PRESENCE = {
    "no_virtual_offset": ("_decimalsoffset", "decimalsoffset", "virtualassets"),
    "no_dead_shares": ("deadshares", "1e3", "10 ** 3"),
    "no_donation_protection": ("donation", "skim"),
    "no_zero_address_check": ("address(0)",),
    "no_initialized_bool": ("initialized",),
    "no_initializer_modifier": ("initializer ", "modifier initializer", "_initializing"),
    "no_threshold_check": ("threshold",),
    "no_caller_check": ("msg.sender",),
    "no_circuit_breaker": ("circuitbreaker", "breaker"),
    "no_explicit_guard": ("reentrancyguard",),
    "no_target_whitelist": ("whitelist", "allowedtarget", "trustedtargets", "allowedtargets"),
    "no_nonce_tracking": ("usednonce", "noncesused", "processed[nonce", "nonces["),
    "no_staleness_check": ("updatedat", "publishtime", "answeredinround", "max_age", "staleness"),
}

# Positive "sets_owner" / "sentinel_root" / etc. — feature names used by manual entries.
_FEATURE_NAME_ALIASES = (
    ("sets_owner", "owner ="),
    ("sets_owner", "owner ="),
    ("sentinel_root_unset", "trustedroot"),
)


def extract_features(source: str) -> Set[str]:
    """Extract a feature set from raw Solidity source code."""
    s = source.lower()
    feats: Set[str] = set()

    for feature, needle in _FEATURE_TOKENS:
        if needle in s:
            feats.add(feature)

    for match in re.finditer(r"contract\s+\w+\s+is\s+([\w\s,]+)\s*{", s):
        for base in match.group(1).split(","):
            b = base.strip().lower()
            if b:
                feats.add(b)

    for feat, needles in _NEGATIVE_PRESENCE.items():
        if not needles:
            continue
        if not any(n in s for n in needles):
            feats.add(feat)

    return feats


def jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = a & b
    union = a | b
    return len(inter) / len(union) if union else 0.0


def find_matches(
    source: str,
    threshold: float = DEFAULT_THRESHOLD,
    patterns: Optional[List[dict]] = None,
) -> List[PatternMatch]:
    """Score `source` against every pattern; return matches above `threshold`."""
    patterns = patterns or load_corpus()
    contract_features = extract_features(source)
    out: List[PatternMatch] = []
    for p in patterns:
        pat_features: Set[str] = set(f.lower() for f in p.get("fingerprint_features", []))
        sim = jaccard(contract_features, pat_features)
        boosts: List[str] = []

        # Vulnerability-class exact match boost.
        vc = (p.get("vulnerability_class") or "").lower().strip()
        if vc and _vuln_class_present(vc, contract_features, source):
            sim = min(1.0, sim + DEFAULT_VULN_CLASS_BOOST)
            boosts.append(f"vuln_class_match:{vc}")

        # Detection-difficulty downgrade — a pattern that was only ever caught
        # by manual review or symbolic execution is less likely to be a real
        # match when our Jaccard fires on signatures alone.
        diff = (p.get("detection_difficulty") or "").lower().strip()
        if diff in DOWNGRADED_DIFFICULTIES:
            sim = max(0.0, sim - DETECTION_DIFFICULTY_DOWNGRADE)
            boosts.append(f"difficulty_downgrade:{diff}")

        if sim < threshold:
            continue
        out.append(
            PatternMatch(
                pattern_id=p["id"],
                name=p["name"],
                year=int(p.get("year") or 0),
                losses_usd=int(p.get("losses_usd") or 0),
                similarity=sim,
                matched_features=sorted(contract_features & pat_features),
                missing_features=sorted(pat_features - contract_features),
                recommended_fix=p.get("recommended_fix", ""),
                reference_url=p.get("reference_url", ""),
                category=p.get("category", "unknown"),
                vulnerability_class=vc,
                chain=p.get("chain", ""),
                threat_actor=p.get("threat_actor", ""),
                linked_incident=p.get("linked_incident", ""),
                detection_difficulty=diff,
                boosts_applied=boosts,
            )
        )
    out.sort(key=lambda m: m.similarity, reverse=True)
    return out


def _vuln_class_present(vc: str, feats: Set[str], source: str) -> bool:
    """Heuristic check: does the contract source carry traces of this vuln class?

    A pattern's `vulnerability_class` is the canonical bug-class name from the
    research data. We treat it as a textual hint and boost the score if the
    source clearly references the same concept.
    """
    needle = vc.replace("_", " ").replace("-", " ")
    if needle in source.lower():
        return True
    # Token-form: does the vuln_class appear in the extracted feature set?
    tok = re.sub(r"[^a-z0-9]+", "_", vc).strip("_")
    return tok in feats


def corpus_summary(patterns: Optional[List[dict]] = None) -> dict:
    """Aggregate stats for the CLI/banner."""
    pats = patterns or load_corpus()
    total = sum(int(p.get("losses_usd") or 0) for p in pats)
    chains = sorted({p.get("chain", "") for p in pats if p.get("chain")})
    years = [int(p["year"]) for p in pats if isinstance(p.get("year"), int) and p["year"]]
    year_min, year_max = (min(years), max(years)) if years else (0, 0)
    return {
        "totalPatterns": len(pats),
        "totalLossesUSD": total,
        "totalLossesHuman": _human_usd(total),
        "yearMin": year_min,
        "yearMax": year_max,
        "chains": chains,
    }


def _human_usd(amount: int) -> str:
    if amount >= 1_000_000_000:
        return f"${amount / 1_000_000_000:.1f}B"
    if amount >= 1_000_000:
        return f"${amount / 1_000_000:.1f}M"
    return f"${amount:,}"
