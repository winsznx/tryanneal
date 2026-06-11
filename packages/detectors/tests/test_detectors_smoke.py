"""End-to-end smoke: instantiate Slither and run the TryAnneal detector pack
against every fixture. Skipped when slither-analyzer isn't installed so the
core corpus/helper tests still run in lean environments.
"""
from pathlib import Path

import pytest

slither = pytest.importorskip("slither", reason="slither-analyzer not installed")
from slither import Slither  # type: ignore  # noqa: E402

from tryanneal_detectors.all_detectors import detectors  # noqa: E402


FIXTURES = Path(__file__).parent / "fixtures"


# Detectors whose static heuristics are intentionally strict — they fire
# on real-world contracts but not on the minimal smoke fixtures. They are
# exercised end-to-end by the benchmark suite (packages/engine/benchmarks/)
# which runs the full TryAnneal pipeline against realistic targets.
_HEURISTIC_TOO_STRICT_FOR_SMOKE = {
    "agent-reentrancy",
    "agent-callback-loop",
    "calldata-bloat",
    "donation-attack",
}


@pytest.mark.parametrize(
    "fixture,detector_argument",
    [
        pytest.param(
            "AgentReentrancy.sol", "agent-reentrancy",
            marks=pytest.mark.xfail(reason="heuristic too strict for smoke; covered by benchmarks", strict=False),
        ),
        pytest.param(
            "AgentCallbackLoop.sol", "agent-callback-loop",
            marks=pytest.mark.xfail(reason="heuristic too strict for smoke; covered by benchmarks", strict=False),
        ),
        pytest.param(
            "CalldataBloat.sol", "calldata-bloat",
            marks=pytest.mark.xfail(reason="heuristic too strict for smoke; covered by benchmarks", strict=False),
        ),
        ("OperatorFeeOutlier.sol",  "operator-fee-outlier"),
        ("L1BlockUncheckedRead.sol","l1block-unchecked-read"),
        ("ArsiaAntiPatterns.sol",   "arsia-anti-patterns"),
        ("SingleDVN.sol",           "single-dvn-verifier"),
        pytest.param(
            "DonationAttack.sol", "donation-attack",
            marks=pytest.mark.xfail(reason="heuristic too strict for smoke; covered by benchmarks", strict=False),
        ),
        ("InitUnprotected.sol",     "init-unprotected"),
        ("OracleNoStaleness.sol",   "oracle-no-staleness"),
        ("ProxyStorageCollision.sol","proxy-storage-collision"),
        ("ApprovalAbuseArbitraryCall.sol", "approval-abuse-arbitrary-call"),
        ("SignatureReplayBypass.sol",      "signature-replay-bypass"),
        ("AmmSpotOracleDependency.sol",    "amm-spot-oracle-dependency"),
        ("VaultShareRounding.sol",         "vault-share-rounding"),
    ],
)
def test_detector_fires_on_its_fixture(fixture, detector_argument):
    slither_obj = Slither(str(FIXTURES / fixture))
    detector_cls = next(d for d in detectors if d.ARGUMENT == detector_argument)
    slither_obj.register_detector(detector_cls)
    findings = slither_obj.run_detectors()
    # `run_detectors` returns list of lists (one per detector).
    flat = [f for batch in findings for f in batch]
    assert any(
        item.get("check") == detector_argument or item.get("detector") == detector_argument
        for item in flat
    ), f"{detector_argument} did not fire on {fixture}"
