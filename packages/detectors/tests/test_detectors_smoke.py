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


@pytest.mark.parametrize(
    "fixture,detector_argument",
    [
        ("AgentReentrancy.sol",     "agent-reentrancy"),
        ("AgentCallbackLoop.sol",   "agent-callback-loop"),
        ("CalldataBloat.sol",       "calldata-bloat"),
        ("OperatorFeeOutlier.sol",  "operator-fee-outlier"),
        ("L1BlockUncheckedRead.sol","l1block-unchecked-read"),
        ("ArsiaAntiPatterns.sol",   "arsia-anti-patterns"),
        ("SingleDVN.sol",           "single-dvn-verifier"),
        ("DonationAttack.sol",      "donation-attack"),
        ("InitUnprotected.sol",     "init-unprotected"),
        ("OracleNoStaleness.sol",   "oracle-no-staleness"),
        ("ProxyStorageCollision.sol","proxy-storage-collision"),
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
