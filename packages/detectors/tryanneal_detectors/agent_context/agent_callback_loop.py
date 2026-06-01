"""AgentCallbackLoop — re-triggerable agent callbacks.

Detects agent-orchestration callbacks that register a handler on a remote agent
without guarding against repeated or out-of-order delivery. The same callback
can fire multiple times (delivery retries, race in the registry) and execute
unsafe logic each time.
"""
from slither.detectors.abstract_detector import AbstractDetector, DetectorClassification

from .._helpers import function_source, looks_like_agent_contract


CALLBACK_NAME_HINTS = ("oncomplete", "callback", "onresult", "fulfill", "handle", "notify")
GUARD_HINTS = ("executed", "fulfilled", "completed", "processed", "delivered", "nonce")


class AgentCallbackLoop(AbstractDetector):
    ARGUMENT = "agent-callback-loop"
    HELP = "Agent callback handler that lacks idempotency / replay protection"
    IMPACT = DetectorClassification.HIGH
    CONFIDENCE = DetectorClassification.MEDIUM

    WIKI = "https://github.com/winsznx/tryanneal/blob/main/packages/detectors/README.md"
    WIKI_TITLE = "Agent Callback Loop"
    WIKI_DESCRIPTION = (
        "ERC-8004 agent callbacks can be re-delivered (retry, race, or malicious replay). "
        "Handlers that mutate state without a per-call guard execute their side effects "
        "multiple times."
    )
    WIKI_EXPLOIT_SCENARIO = (
        "Agent B registers `onComplete(bytes32 jobId, bytes result)` with agent A. "
        "A delivers the callback once; transport retry delivers it again. B's handler "
        "credits the reward twice."
    )
    WIKI_RECOMMENDATION = (
        "Gate callbacks on a per-job nonce or processed-set, e.g. "
        "`require(!processed[jobId], 'replayed'); processed[jobId] = true;`."
    )

    def _detect(self):
        results = []
        for contract in self.compilation_unit.contracts_derived:
            if not looks_like_agent_contract(contract):
                continue
            for fn in contract.functions:
                if not fn.is_implemented or fn.view or fn.pure:
                    continue
                name = fn.name.lower()
                if not any(h in name for h in CALLBACK_NAME_HINTS):
                    continue
                if not fn.all_state_variables_written():
                    continue
                src = function_source(fn).lower()
                if any(g in src for g in GUARD_HINTS):
                    continue
                info = [
                    "Agent callback ",
                    fn,
                    " mutates state with no idempotency guard. Repeat delivery will replay side effects.\n",
                ]
                results.append(self.generate_result(info))
        return results
