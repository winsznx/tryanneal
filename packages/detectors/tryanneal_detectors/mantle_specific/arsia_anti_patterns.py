"""ArsiaAntiPatterns — pre-Arsia assumptions baked into Solidity.

Catches three classes:
  - Hardcoded 0.02 gwei (20_000_000 wei) base-fee floor — was Mantle's
    pre-Arsia baseline; Arsia made base fee dynamic.
  - References to EigenDA cost model — Mantle migrated to EIP-4844 blobs
    after Arsia (April 22, 2026).
  - Calls into precompiles / predeploys that were removed or renamed at the
    Arsia upgrade.
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification

from .._helpers import source_unit_text


HARDCODED_BASEFEE_NEEDLES = (
    "0.02 gwei",
    "20_000_000",
    "20000000",
    "block.basefee == 20000000",
    "block.basefee < 20000000",
)
EIGEN_DA_HINTS = ("eigenda", "eigen_da", "eigenlayer dda")
RETIRED_PRECOMPILES = (
    # historical retro precompiles that did not survive the Arsia upgrade.
    # Detector matches the literal address — false positives are rare since
    # these are 0x42... operator-controlled addresses.
    "0x4200000000000000000000000000000000000007",  # legacy l2tol1messagepasser
    "0x4200000000000000000000000000000000000016",  # legacy gas calc
)


class ArsiaAntiPatterns(AbstractDetector):
    ARGUMENT = "arsia-anti-patterns"
    HELP = "Pre-Arsia assumptions baked into Mantle Solidity (basefee floor, EigenDA, retired precompiles)"
    IMPACT = DetectorClassification.MEDIUM
    CONFIDENCE = DetectorClassification.MEDIUM

    WIKI = "https://github.com/winsznx/tryanneal/blob/main/packages/detectors/README.md"
    WIKI_TITLE = "Arsia Anti-Patterns"
    WIKI_DESCRIPTION = (
        "Mantle's Arsia upgrade (Apr 22, 2026) made base fee dynamic, migrated DA from "
        "EigenDA to EIP-4844 blobs, and retired a handful of precompiles. Solidity "
        "that hardcoded the old assumptions silently mis-prices or reverts."
    )
    WIKI_EXPLOIT_SCENARIO = (
        "A protocol fee oracle compares `block.basefee` to the 0.02 gwei pre-Arsia "
        "floor. Post-upgrade, fees rise above the floor and the oracle returns stale "
        "pricing data, letting attackers buy assets below market."
    )
    WIKI_RECOMMENDATION = (
        "Replace hardcoded floors with live GasPriceOracle reads. Migrate any EigenDA "
        "cost assumptions to the blob fee. Drop references to retired predeploys."
    )

    def _detect(self):
        results = []
        seen = set()
        for contract in self.compilation_unit.contracts_derived:
            src = source_unit_text(contract)
            if not src:
                continue
            lowered = src.lower()
            file_key = contract.source_mapping.filename.absolute if contract.source_mapping else contract.name
            if file_key in seen:
                continue
            seen.add(file_key)

            hits = []
            for needle in HARDCODED_BASEFEE_NEEDLES:
                if needle.lower() in lowered:
                    hits.append(f"hardcoded basefee floor `{needle}`")
            for needle in EIGEN_DA_HINTS:
                if needle in lowered:
                    hits.append(f"EigenDA reference `{needle}`")
            for addr in RETIRED_PRECOMPILES:
                if addr.lower() in lowered:
                    hits.append(f"retired precompile `{addr}`")

            if not hits:
                continue
            info = [
                "Arsia anti-pattern in ",
                contract,
                ": " + "; ".join(hits) + ".\n",
            ]
            results.append(self.generate_result(info))
        return results
