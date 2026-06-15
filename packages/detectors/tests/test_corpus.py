"""Tests for the exploit-corpus loader and matchers.

These run without Slither installed — they exercise the standalone matcher
that any detector can call. End-to-end Slither integration is exercised by
test_detectors_smoke.py (skipped when slither-analyzer is unavailable).

Both matchers are tested:
  - `find_matches` (v3 TF-IDF cosine, default for `corpus_match` detector)
  - `find_matches_jaccard` (v2 fallback, retained for back-compat)
"""
from pathlib import Path

from tryanneal_detectors.corpus.matcher import (
    extract_features,
    find_matches,
    find_matches_jaccard,
    jaccard,
    load_corpus,
)


FIXTURES = Path(__file__).parent / "fixtures"


def read(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_corpus_loads_one_hundred_plus_real_exploits():
    # #given
    patterns = load_corpus()
    # #then
    assert len(patterns) >= 100
    # every entry has the contract every detector relies on
    for p in patterns:
        assert {"id", "name", "year", "losses_usd", "fingerprint_features", "recommended_fix", "reference_url"} <= p.keys()
        assert len(p["fingerprint_features"]) >= 1


def test_corpus_total_losses_exceeds_eight_billion():
    # 100+ historical incidents put us well above the v1 $2B floor.
    patterns = load_corpus()
    total = sum(p["losses_usd"] for p in patterns)
    assert total > 8_000_000_000


def test_jaccard_symmetry_and_extremes():
    assert jaccard(set(), {"a"}) == 0.0
    assert jaccard({"a"}, set()) == 0.0
    assert jaccard({"a", "b"}, {"a", "b"}) == 1.0
    assert jaccard({"a"}, {"b"}) == 0.0
    # 1 of 3 in union
    assert abs(jaccard({"a", "b"}, {"b", "c"}) - (1 / 3)) < 1e-9


def test_extract_features_picks_up_erc4626_and_oracle_signatures():
    feats = extract_features(read("DonationAttack.sol"))
    assert "erc4626" in feats
    assert "deposit" in feats
    assert "totalassets" in feats
    assert "no_virtual_offset" in feats     # negative-presence feature
    assert "no_dead_shares" in feats


def test_donation_fixture_matches_euler_corpus_entry():
    # Jaccard matcher — fixture-based features map directly onto pattern feature sets.
    matches = find_matches_jaccard(read("DonationAttack.sol"), threshold=0.3)
    ids = [m.pattern_id for m in matches]
    assert "euler-donation-2023" in ids
    euler = next(m for m in matches if m.pattern_id == "euler-donation-2023")
    assert euler.losses_usd == 197_000_000
    assert euler.similarity > 0.3


def test_single_dvn_fixture_matches_kelpdao_layerzero_entry():
    matches = find_matches_jaccard(read("SingleDVN.sol"), threshold=0.2)
    ids = [m.pattern_id for m in matches]
    assert "kelpdao-layerzero-dvn-2026-04" in ids
    kelp = next(m for m in matches if m.pattern_id == "kelpdao-layerzero-dvn-2026-04")
    assert kelp.losses_usd == 292_000_000


def test_init_unprotected_fixture_matches_nomad_entry():
    matches = find_matches_jaccard(read("InitUnprotected.sol"), threshold=0.2)
    ids = [m.pattern_id for m in matches]
    assert "nomad-init-2022" in ids


def test_tfidf_match_euler_donation():
    # New v3 TF-IDF test: a contract that's structurally close to the Euler
    # donation pattern should score highly against the Euler corpus entry
    # using full source content, not just the minimal fixture.
    src = """
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.19;

    interface IERC20 { function balanceOf(address) external view returns (uint256); }

    contract Vault4626 {
        IERC20 public asset;
        uint256 public totalSupply;
        mapping(address => uint256) public balanceOf;

        function totalAssets() public view returns (uint256) {
            return asset.balanceOf(address(this));
        }

        function convertToShares(uint256 assets) public view returns (uint256) {
            // No virtual-shares offset, no dead-share floor — donation-vulnerable.
            return totalSupply == 0 ? assets : assets * totalSupply / totalAssets();
        }

        function deposit(uint256 assets) external returns (uint256 shares) {
            shares = convertToShares(assets);
            balanceOf[msg.sender] += shares;
            totalSupply += shares;
        }
    }
    """
    matches = find_matches(src, threshold=0.0)
    ids = [m.pattern_id for m in matches[:5]]
    # Euler should rank as one of the top 5 matches against this Vault4626
    # contract. Absolute cosine scores compress when 98 patterns compete,
    # so the success signal is rank, not absolute magnitude.
    assert "euler-donation-2023" in ids, f"euler-donation-2023 not in top 5: {ids}"
    euler = next(m for m in matches if m.pattern_id == "euler-donation-2023")
    # Must beat random noise — a 98-pattern uniform distribution lands
    # around 1/98 ≈ 0.010; we want significantly above that.
    assert euler.similarity >= 0.05, f"euler similarity {euler.similarity} below 0.05"


def test_clean_fixture_does_not_trip_high_thresholds():
    # Plain ERC20 has no business matching exploit fingerprints at high confidence.
    matches = find_matches(read("Clean.sol"), threshold=0.6)
    assert matches == []


def test_vuln_class_exact_match_boosts_similarity():
    # #given a synthetic pattern whose vulnerability_class appears verbatim in source
    patterns = [
        {
            "id": "synthetic-vc-boost",
            "name": "synthetic vuln-class boost",
            "year": 2025,
            "losses_usd": 1_000_000,
            "fingerprint_features": ["proxy", "delegatecall"],
            "recommended_fix": "n/a",
            "reference_url": "https://example.test",
            "vulnerability_class": "donation",
            "category": "economic",
            "detection_difficulty": "static",
        },
    ]
    src_with_class = "contract X { function donation() external { /* donation pattern */ } }"
    src_without = "contract X { uint256 balance; }"
    # #when
    with_boost = find_matches(src_with_class, threshold=0.0, patterns=patterns)
    without_boost = find_matches(src_without, threshold=0.0, patterns=patterns)
    # #then — both produce matches but the vuln-class-present case is strictly higher
    assert with_boost and without_boost
    assert any("vuln_class_match" in b for b in with_boost[0].boosts_applied)
    assert with_boost[0].similarity > without_boost[0].similarity


def test_detection_difficulty_downgrade_lowers_manual_only_patterns():
    # #given two clones of the same pattern, one marked detection_difficulty=manual.
    #   Boost/downgrade math is shared between matchers; we test it on the
    #   Jaccard path which has predictable input scores for synthetic patterns.
    base = {
        "id": "base",
        "name": "base",
        "year": 2025,
        "losses_usd": 1,
        "fingerprint_features": ["erc4626", "deposit", "totalassets", "no_dead_shares"],
        "recommended_fix": "fix",
        "reference_url": "https://example.test",
        "category": "economic",
    }
    static_p = {**base, "id": "static", "detection_difficulty": "static"}
    manual_p = {**base, "id": "manual", "detection_difficulty": "manual"}
    src = (FIXTURES / "DonationAttack.sol").read_text()
    # #when
    matches = find_matches_jaccard(src, threshold=0.0, patterns=[static_p, manual_p])
    by_id = {m.pattern_id: m for m in matches}
    # #then — same fingerprints, but the manual one is downgraded
    assert by_id["manual"].similarity < by_id["static"].similarity
    assert any("difficulty_downgrade" in b for b in by_id["manual"].boosts_applied)


def test_match_surfaces_threat_actor_and_linked_incident():
    patterns = [
        {
            "id": "with-rich-meta",
            "name": "rich meta",
            "year": 2026,
            "losses_usd": 292_000_000,
            "fingerprint_features": ["layerzero", "dvn"],
            "recommended_fix": "n/a",
            "reference_url": "https://example.test",
            "category": "cross_chain",
            "vulnerability_class": "single_verifier_compromise",
            "chain": "ethereum",
            "threat_actor": "DPRK Citrine Sleet cluster",
            "linked_incident": "radiant-layerzero-2024",
            "detection_difficulty": "static",
        },
    ]
    src = (FIXTURES / "SingleDVN.sol").read_text()
    matches = find_matches(src, threshold=0.0, patterns=patterns)
    assert matches
    d = matches[0].to_dict()
    assert d["threat_actor"] == "DPRK Citrine Sleet cluster"
    assert d["linked_incident"] == "radiant-layerzero-2024"
    assert d["chain"] == "ethereum"


def test_match_serialization_round_trip():
    # Tests dict shape — use Jaccard for deterministic min-fixture matching.
    matches = find_matches_jaccard(read("DonationAttack.sol"), threshold=0.3)
    assert matches
    d = matches[0].to_dict()
    assert d["pattern_id"]
    assert d["similarity_pct"] > 0
    assert isinstance(d["matched_features"], list)
    assert d["reference_url"].startswith("http")
