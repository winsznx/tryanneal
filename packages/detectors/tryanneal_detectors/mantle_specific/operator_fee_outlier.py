"""OperatorFeeOutlier — gas-heavy functions where Arsia operator fee dominates.

The Arsia operator fee = operatorFeeConstant + operatorFeeScalar * 100 * gasUsed.
For high-gas functions on configurations where the operator fee scalar is
non-zero, the operator component can exceed 25% of total tx cost.
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification


# We don't have profiling here so we use loop/SSTORE heuristics as a stand-in
# for "this function does lots of compute".
LOOP_KEYWORDS = ("for (", "while (")


def _function_text(function) -> str:
    try:
        sm = function.source_mapping
        with open(sm.filename.absolute, "r", encoding="utf-8") as fh:
            data = fh.read()
        return data[sm.start : sm.start + sm.length]
    except Exception:
        return ""


class OperatorFeeOutlier(AbstractDetector):
    ARGUMENT = "operator-fee-outlier"
    HELP = "Compute-heavy function — Arsia operator fee likely dominates"
    IMPACT = DetectorClassification.LOW
    CONFIDENCE = DetectorClassification.HIGH

    WIKI = "https://github.com/winsznx/tryanneal/blob/main/packages/detectors/README.md"
    WIKI_TITLE = "Operator Fee Outlier (Mantle Arsia)"
    WIKI_DESCRIPTION = (
        "Mantle Arsia introduced a third fee component — operator fee — on top of L2 "
        "execution and L1 data fees. Functions with heavy loops and many SSTOREs see "
        "the operator fee dominate."
    )
    WIKI_EXPLOIT_SCENARIO = (
        "A reward distribution function iterates a 500-entry array with one SSTORE per "
        "entry. L2 exec is the largest single component, but the operator-fee scalar "
        "(applied to gasUsed) makes the operator fee a quarter of the total — surprising "
        "to callers who didn't expect three components."
    )
    WIKI_RECOMMENDATION = (
        "Batch in O(log n), use unchecked arithmetic where safe, prefer EVENTS over storage "
        "writes for off-chain consumers, or move heavy computation off-chain."
    )

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            for fn in contract.functions:
                if not fn.is_implemented:
                    continue
                if fn.view or fn.pure:
                    continue
                src = _function_text(fn)
                loops = sum(src.count(k) for k in LOOP_KEYWORDS)
                state_writes = len(fn.all_state_variables_written() or [])
                if loops >= 1 and state_writes >= 2:
                    info = [
                        "Operator fee outlier risk: ",
                        fn,
                        f" — {loops} loop(s) + {state_writes} state writes. "
                        "Arsia operator fee component likely >25% of total cost.\n",
                    ]
                    results.append(self.generate_result(info))
        return results
