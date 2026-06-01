"""Jaccard-similarity matcher for the exploit corpus.

v1 is intentionally simple: extract a feature set from a contract (imports,
inheritance, function names, modifier names, oracle calls, sentinel string
fragments) and compute Jaccard similarity vs each pattern's
`fingerprint_features`. Vector-embedding matching is post-hack.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Set


PATTERNS_PATH = Path(__file__).with_name("patterns.json")
DEFAULT_THRESHOLD = 0.6


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
        }


def load_corpus(path: Optional[Path] = None) -> List[dict]:
    p = path or PATTERNS_PATH
    with p.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("patterns", [])


# Positive-presence features. Names match patterns.json (lowercase).
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
    # Oracle
    ("oracle", "oracle"),
    ("oracle", "latestrounddata"),
    ("spot_only", "ireserve"),
    ("uniswap_spot", "uniswapv2"),
    ("curve_spot_price", "icurve"),
    ("collateral_pricing", "collateral"),
    # Reentrancy / locks
    ("nonreentrant_decorator", "@nonreentrant"),
    ("erc777_hook", "erc777"),
    # Init / governance
    ("initialize", "function initialize"),
    ("governance", "governance"),
    ("stake_weighted_vote", "votes"),
    ("multisig_threshold", "threshold"),
    ("validator_set", "validator"),
    # Proxy
    ("proxy", "delegatecall"),
    # Compiler
    ("vyper", "vyper"),
    ("old_compiler", "pragma solidity 0.5"),
    # Selector / privileged
    ("selector_collision", "function selector"),
    ("privileged_setter", "onlyowner"),
    ("ecrecover_only_auth", "ecrecover"),
    # Concentrated liquidity
    ("concentrated_liquidity", "tick"),
    ("uniswap_v3_fork", "uniswapv3"),
    ("tick_math", "tickmath"),
    ("rounding", "round"),
    ("boundary_crossing", "boundary"),
    # Math / atomic
    ("flashloan", "flashloan"),
    ("atomic_oracle", "atomic"),
    ("atomic_oracle_arb", "flashloan"),
    ("leveraged_position", "leverage"),
    # Restaking / specific tokens
    ("rseth_restaking", "rseth"),
    # Centralization
    ("centralized_signer", "owner ="),
    ("admin_path", "admin"),
    ("owner_multisig", "owner"),
    # Auth context
    ("setup", "function setup"),
    ("sets_owner", "owner ="),
    ("sets_owner", "owner ="),
    ("sentinel_root", "trustedroot"),
)

# Detection of "missing-mitigation" features needs negative tokens.
_NEGATIVE_PRESENCE = {
    "no_virtual_offset": ("_decimalsoffset", "decimalsoffset", "virtualassets"),
    "no_dead_shares": ("deadshares", "1e3", "10 ** 3"),
    "no_donation_protection": ("donation", "skim"),
    "no_zero_address_check": ("address(0)",),
    "no_initialized_bool": ("initialized",),
    "no_geographic_separation": (),  # untestable in code, skip
    "no_threshold_check": ("threshold",),
    "no_caller_check": ("msg.sender",),
    "no_circuit_breaker": ("circuitbreaker", "breaker"),
    "no_anomaly_detection": (),  # untestable in code, skip
    "no_simulation_gate": (),
    "no_voting_delay": ("votingdelay",),
    "no_timelock_post_vote": ("timelock",),
    "no_on_chain_governance": ("governor",),
    "no_explicit_guard": ("reentrancyguard",),
}


def extract_features(source: str) -> Set[str]:
    """Extract a feature set from raw Solidity source code."""
    s = source.lower()
    feats: Set[str] = set()

    # Positive presence tokens
    for feature, needle in _FEATURE_TOKENS:
        if needle in s:
            feats.add(feature)

    # Inheritance fast-pull: `is X, Y, Z`
    for match in re.finditer(r"contract\s+\w+\s+is\s+([\w\s,]+)\s*{", s):
        for base in match.group(1).split(","):
            b = base.strip().lower()
            if b:
                feats.add(b)

    # Negative-presence (missing-mitigation) features
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
    """Score `source` against every pattern; return matches at or above `threshold`."""
    patterns = patterns or load_corpus()
    contract_features = extract_features(source)
    out: List[PatternMatch] = []
    for p in patterns:
        pat_features: Set[str] = set(f.lower() for f in p.get("fingerprint_features", []))
        sim = jaccard(contract_features, pat_features)
        if sim < threshold:
            continue
        out.append(
            PatternMatch(
                pattern_id=p["id"],
                name=p["name"],
                year=p["year"],
                losses_usd=p["losses_usd"],
                similarity=sim,
                matched_features=sorted(contract_features & pat_features),
                missing_features=sorted(pat_features - contract_features),
                recommended_fix=p["recommended_fix"],
                reference_url=p["reference_url"],
                category=p.get("category", "unknown"),
            )
        )
    out.sort(key=lambda m: m.similarity, reverse=True)
    return out
