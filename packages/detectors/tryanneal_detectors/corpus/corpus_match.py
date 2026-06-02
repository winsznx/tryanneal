"""CorpusMatch — meta-detector that surfaces resemblance to known exploits.

For each contract in the compilation unit, computes Jaccard similarity vs
every pattern in patterns.json. Any match at or above the configured
threshold becomes an informational finding citing the original incident,
losses in USD, and the recommended mitigation.

This is the demo punch: "your code resembles the $292M KelpDAO drain at 78%."
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification

from .._helpers import source_unit_text
from .matcher import DEFAULT_THRESHOLD, find_matches


class CorpusMatch(AbstractDetector):
    ARGUMENT = "corpus-match"
    HELP = "Contract resembles a known historical exploit pattern"
    IMPACT = DetectorClassification.MEDIUM
    CONFIDENCE = DetectorClassification.MEDIUM

    WIKI = "https://github.com/winsznx/tryanneal/blob/main/packages/detectors/README.md"
    WIKI_TITLE = "Corpus Match"
    WIKI_DESCRIPTION = (
        "Cross-references the contract's structural fingerprint against a curated library "
        "of 15+ historical exploits with verified post-mortems. A high similarity score "
        "indicates the contract repeats a pattern that previously cost real users real money."
    )
    WIKI_EXPLOIT_SCENARIO = (
        "See the referenced incident for each match. The detector surfaces the original "
        "losses figure so reviewers can immediately calibrate the threat."
    )
    WIKI_RECOMMENDATION = (
        "Read the referenced post-mortem. Apply the documented mitigation. If your "
        "context differs, document the deviation explicitly."
    )

    def _detect(self):
        results = []
        seen_files = set()
        for contract in self.compilation_unit.contracts_derived:
            file_key = contract.source_mapping.filename.absolute if contract.source_mapping else contract.name
            if file_key in seen_files:
                continue
            seen_files.add(file_key)

            src = source_unit_text(contract)
            if not src:
                continue
            for match in find_matches(src, threshold=DEFAULT_THRESHOLD):
                pct = round(match.similarity * 100, 1)
                losses_m = (
                    f"${match.losses_usd / 1_000_000_000:.1f}B"
                    if match.losses_usd >= 1_000_000_000
                    else f"${match.losses_usd / 1_000_000:.1f}M"
                    if match.losses_usd >= 1_000_000
                    else f"${match.losses_usd:,}"
                )
                extra = []
                if match.threat_actor:
                    extra.append(f"actor: {match.threat_actor}")
                if match.linked_incident:
                    extra.append(f"linked: {match.linked_incident}")
                if match.chain:
                    extra.append(f"chain: {match.chain}")
                extra_str = (" | " + "; ".join(extra)) if extra else ""
                info = [
                    "Corpus match in ",
                    contract,
                    f": {pct}% similar to {match.name} ({match.year}) — {losses_m} lost{extra_str}. "
                    f"Fix: {match.recommended_fix} See: {match.reference_url}\n",
                ]
                results.append(self.generate_result(info))
        return results
