"""L1BlockUncheckedRead — reads from the L1Block predeploy without validation.

Mantle Arsia introduced new L1Block fields (baseFeeScalar, blobBaseFeeScalar,
operatorFeeScalar, operatorFeeConstant) and renamed/removed others. Contracts
that read L1Block values without checking for zero or staleness can silently
mis-price actions on a chain upgrade.
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification

from .._helpers import L1_BLOCK_PREDEPLOY, source_unit_text


L1_GETTERS = (
    "basefeescalar",
    "blobbasefeescalar",
    "operatorfeescalar",
    "operatorfeeconstant",
    "l1basefee",
    "l1blockhash",
    "hash",
    "sequencenum",
)
VALIDATION_HINTS = ("require(", "if (", "!= 0", "!= address(0)", ">", "<")


class L1BlockUncheckedRead(AbstractDetector):
    ARGUMENT = "l1block-unchecked-read"
    HELP = "Reads L1Block predeploy without validating the returned value"
    IMPACT = DetectorClassification.MEDIUM
    CONFIDENCE = DetectorClassification.MEDIUM

    WIKI = "https://github.com/winsznx/tryanneal/blob/main/packages/detectors/README.md"
    WIKI_TITLE = "L1Block Unchecked Read"
    WIKI_DESCRIPTION = (
        "L1Block predeploy at 0x4200000000000000000000000000000000000015 is the source "
        "of truth for Mantle's L1 fee components. Reading values without sanity checks "
        "is a footgun: a chain upgrade can return 0 or rename the field, silently "
        "breaking on-chain pricing logic."
    )
    WIKI_EXPLOIT_SCENARIO = (
        "Pricing contract reads `IL1Block(0x4200...).baseFeeScalar()` directly into a "
        "discount calculation. Post-upgrade, the field's semantics change; the discount "
        "is now applied to the wrong base, draining the protocol's subsidy budget."
    )
    WIKI_RECOMMENDATION = (
        "Validate L1Block reads: require value != 0, sanity-check magnitude, and "
        "implement a feed-fallback for upgrade transitions."
    )

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            src = (source_unit_text(contract) or "").lower()
            if not src:
                continue
            if L1_BLOCK_PREDEPLOY.lower() not in src and "il1block" not in src:
                continue
            for fn in contract.functions:
                fsrc = ""
                try:
                    sm = fn.source_mapping
                    with open(sm.filename.absolute, "r", encoding="utf-8") as fh:
                        d = fh.read()
                    fsrc = d[sm.start : sm.start + sm.length].lower()
                except Exception:
                    continue
                if not any(g in fsrc for g in L1_GETTERS):
                    continue
                if any(h in fsrc for h in VALIDATION_HINTS):
                    continue
                info = [
                    "L1Block read in ",
                    fn,
                    " lacks any validation. Returned value is used directly downstream.\n",
                ]
                results.append(self.generate_result(info))
        return results
