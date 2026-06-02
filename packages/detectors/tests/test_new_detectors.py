"""Heuristic unit tests for the four corpus-driven detectors.

The full Slither smoke pass is in `test_detectors_smoke.py` (skipped when
`slither-analyzer` is unavailable). These tests exercise the textual signals
each detector relies on against the fixtures, so the heuristics stay honest
in lean CI.
"""
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def src(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8").lower()


# ---------------------------------------------------------------------------
# ApprovalAbuseArbitraryCall
# ---------------------------------------------------------------------------

def test_approval_abuse_fixture_carries_all_required_signals():
    s = src("ApprovalAbuseArbitraryCall.sol")
    # holds approvals + low-level call + user-supplied target + user-supplied calldata
    assert "transferfrom(" in s
    assert ".call{" in s
    assert "address target" in s
    assert "bytes calldata data" in s
    # has no whitelist guard
    assert "whitelist" not in s
    assert "allowedtarget" not in s


def test_clean_contract_does_not_match_approval_abuse_signals():
    s = src("Clean.sol")
    assert "transferfrom(" not in s
    assert ".call{" not in s


# ---------------------------------------------------------------------------
# SignatureReplayBypass
# ---------------------------------------------------------------------------

def test_signature_replay_fixture_uses_ecrecover_without_nonce_tracking():
    s = src("SignatureReplayBypass.sol")
    assert "ecrecover(" in s
    # No nonce tracking primitives
    assert "usednonces" not in s
    assert "processed[" not in s
    assert "nonces[" not in s


# ---------------------------------------------------------------------------
# AmmSpotOracleDependency
# ---------------------------------------------------------------------------

def test_amm_spot_oracle_fixture_reads_spot_without_twap():
    s = src("AmmSpotOracleDependency.sol")
    assert "getreserves(" in s
    assert "twap" not in s
    assert "observe(" not in s
    # the function is clearly pricing-shaped
    assert "function getprice" in s


# ---------------------------------------------------------------------------
# VaultShareRounding
# ---------------------------------------------------------------------------

def test_vault_share_rounding_fixture_lacks_explicit_rounding_direction():
    s = src("VaultShareRounding.sol")
    # ratio math present
    assert " * " in s and " / " in s
    # no explicit rounding direction
    assert "rounding.up" not in s
    assert "rounding.ceil" not in s
    assert "muldiv" not in s
    # functions of interest
    assert "function borrow" in s
    assert "function repay" in s


# ---------------------------------------------------------------------------
# all_detectors registration
# ---------------------------------------------------------------------------

def test_all_detectors_registry_size_grows_to_fifteen():
    # Import lazily so this test doesn't require slither.
    import importlib

    try:
        mod = importlib.import_module("tryanneal_detectors.all_detectors")
    except ModuleNotFoundError:
        # slither not installed → skip via the smoke suite; this test is best-effort.
        import pytest
        pytest.skip("slither-analyzer not installed")
    # 11 originals + 4 new = 15 (plus CorpusMatch = 16; CorpusMatch already counted in originals)
    args = {cls.ARGUMENT for cls in mod.detectors}
    for new_arg in (
        "approval-abuse-arbitrary-call",
        "signature-replay-bypass",
        "amm-spot-oracle-dependency",
        "vault-share-rounding",
    ):
        assert new_arg in args, f"missing {new_arg}"
    assert len(mod.detectors) >= 15
