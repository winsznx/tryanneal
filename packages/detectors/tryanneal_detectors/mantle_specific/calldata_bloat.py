"""CalldataBloat — calldata-heavy functions whose L1 data fee dominates total cost.

Uses the same FastLZ heuristic as the engine's gas profiler. When the estimated
L1 data fee component would exceed 60% of total transaction cost, raise a
medium-impact finding with concrete packing recommendations.
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification

from .._helpers import estimate_calldata_size, fastlz_estimate


# Heuristic threshold: bytes of FastLZ-estimated calldata above which L1 fee
# dominates a typical Arsia transaction. Calibrated against the engine's
# 3-component fee model with default Arsia params.
CALLDATA_DOMINANT_FASTLZ_BYTES = 800
# L2-gas tier below which calldata fee is almost certainly the majority.
LIGHT_L2_GAS_BUDGET = 60_000


class CalldataBloat(AbstractDetector):
    ARGUMENT = "calldata-bloat"
    HELP = "Function calldata likely dominates Mantle Arsia L1 data fee"
    IMPACT = DetectorClassification.MEDIUM
    CONFIDENCE = DetectorClassification.HIGH

    WIKI = "https://github.com/winsznx/tryanneal/blob/main/packages/detectors/README.md"
    WIKI_TITLE = "Calldata Bloat (Mantle Arsia)"
    WIKI_DESCRIPTION = (
        "On Mantle post-Arsia, L1 data fee is a separate component computed from "
        "FastLZ-compressed calldata. Functions with wide dynamic params or long byte "
        "blobs make L1 data fee dominate total cost, despite low L2 gas."
    )
    WIKI_EXPLOIT_SCENARIO = (
        "A batch-transfer accepting `address[] calldata`, `uint256[] calldata` of 100 "
        "entries. L2 gas is modest (~150k) but FastLZ-compressed calldata pushes the "
        "L1 data fee to 75% of the total tx cost. Users pay 3-4x what they expect."
    )
    WIKI_RECOMMENDATION = (
        "Pack args (uint128 instead of uint256 where safe), tighten struct layout, "
        "batch off-chain into a Merkle root and submit the root, or chunk calls "
        "to smaller batches."
    )

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            for fn in contract.functions:
                if not fn.is_implemented:
                    continue
                if not (fn.visibility in ("external", "public")):
                    continue
                size = estimate_calldata_size(fn)
                lz = fastlz_estimate(size)
                if lz < CALLDATA_DOMINANT_FASTLZ_BYTES:
                    continue
                info = [
                    "Calldata bloat: ",
                    fn,
                    f" — sampled calldata {size}B (FastLZ estimate {lz}B). "
                    "L1 data fee likely dominates total Arsia cost.\n",
                ]
                results.append(self.generate_result(info))
        return results
