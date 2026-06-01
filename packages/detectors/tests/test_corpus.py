"""Tests for the exploit-corpus loader and Jaccard matcher.

These run without Slither installed — they exercise the standalone matcher
that any detector can call. End-to-end Slither integration is exercised by
test_detectors_smoke.py (skipped when slither-analyzer is unavailable).
"""
from pathlib import Path

from tryanneal_detectors.corpus.matcher import (
    extract_features,
    find_matches,
    jaccard,
    load_corpus,
)


FIXTURES = Path(__file__).parent / "fixtures"


def read(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_corpus_loads_with_at_least_fifteen_real_exploits():
    # #given
    patterns = load_corpus()
    # #then
    assert len(patterns) >= 15
    # every entry has the contract every detector relies on
    for p in patterns:
        assert {"id", "name", "year", "losses_usd", "fingerprint_features", "recommended_fix", "reference_url"} <= p.keys()
        assert p["losses_usd"] > 0
        assert len(p["fingerprint_features"]) >= 3


def test_corpus_total_losses_exceeds_two_billion():
    # the curated set should reflect real-money historical incidents
    patterns = load_corpus()
    total = sum(p["losses_usd"] for p in patterns)
    assert total > 2_000_000_000


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
    matches = find_matches(read("DonationAttack.sol"), threshold=0.3)
    ids = [m.pattern_id for m in matches]
    assert "euler-donation-2023" in ids
    euler = next(m for m in matches if m.pattern_id == "euler-donation-2023")
    assert euler.losses_usd == 197_000_000
    assert euler.similarity > 0.3


def test_single_dvn_fixture_matches_kelpdao_layerzero_entry():
    matches = find_matches(read("SingleDVN.sol"), threshold=0.2)
    ids = [m.pattern_id for m in matches]
    assert "kelpdao-layerzero-dvn-2026-04" in ids
    kelp = next(m for m in matches if m.pattern_id == "kelpdao-layerzero-dvn-2026-04")
    assert kelp.losses_usd == 292_000_000


def test_init_unprotected_fixture_matches_nomad_entry():
    matches = find_matches(read("InitUnprotected.sol"), threshold=0.2)
    ids = [m.pattern_id for m in matches]
    assert "nomad-init-2022" in ids


def test_clean_fixture_does_not_trip_high_thresholds():
    # Plain ERC20 has no business matching exploit fingerprints at high confidence.
    matches = find_matches(read("Clean.sol"), threshold=0.6)
    assert matches == []


def test_match_serialization_round_trip():
    matches = find_matches(read("DonationAttack.sol"), threshold=0.3)
    assert matches
    d = matches[0].to_dict()
    assert d["pattern_id"]
    assert d["similarity_pct"] > 0
    assert isinstance(d["matched_features"], list)
    assert d["reference_url"].startswith("http")
