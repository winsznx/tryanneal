"""AgentReentrancy — cross-agent reentrancy via ERC-8004 identity calls.

Distinct from classical reentrancy: looks for the agent-orchestration pattern
where contract A calls into another agent contract B (identified via ERC-8004
heuristics) before completing its own state mutations. B can re-enter A's
state-modifying surface through the agent invocation path.
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification

from .._helpers import (
    function_external_call_targets,
    function_has_external_call,
    looks_like_agent_contract,
    state_writes_in_function,
)


class AgentReentrancy(AbstractDetector):
    ARGUMENT = "agent-reentrancy"
    HELP = "External call to an ERC-8004 agent before state writes complete"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.HIGH

    WIKI = "https://github.com/winsznx/tryanneal/blob/main/packages/detectors/README.md"
    WIKI_TITLE = "Agent Reentrancy"
    WIKI_DESCRIPTION = (
        "Calls into another ERC-8004 agent before the caller finishes its state mutations. "
        "Because agents are mutually invocable and identity-routed, the callee can re-enter "
        "the caller through the agent invocation graph, even if the direct callsite looks safe."
    )
    WIKI_EXPLOIT_SCENARIO = (
        "Agent A's `executeTask()` writes intermediate state, then calls agent B for a "
        "subtask. B's handler invokes back into A.executeTask() via the agent registry, "
        "observing partial state. Classic checks-effects-interactions violation in a "
        "multi-agent topology."
    )
    WIKI_RECOMMENDATION = (
        "Apply checks-effects-interactions strictly across agent boundaries. Add a "
        "reentrancy guard on every agent-facing entrypoint, or commit state before "
        "any external agent call."
    )

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            if not looks_like_agent_contract(contract):
                continue
            for fn in contract.functions:
                if not fn.is_implemented or fn.view or fn.pure:
                    continue
                if not function_has_external_call(fn):
                    continue
                writes = state_writes_in_function(fn)
                if not writes:
                    continue
                # Crude ordering: if the function writes state AND calls into
                # another contract that itself looks like an agent target,
                # raise. (Full call-graph reachability is post-hack.)
                targets = list(function_external_call_targets(fn))
                if not targets:
                    continue
                if any(t and looks_like_agent_contract(t) for t in targets):
                    info = [
                        "Agent reentrancy risk: ",
                        fn,
                        " calls another agent before completing state writes (",
                        ", ".join(sorted(v.name for v in writes if hasattr(v, "name"))) or "n/a",
                        ").\n",
                    ]
                    res = self.generate_result(info)
                    results.append(res)
        return results
