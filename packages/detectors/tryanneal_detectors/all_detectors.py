"""Registers every TryAnneal detector with Slither."""
from .agent_context.agent_reentrancy import AgentReentrancy
from .agent_context.agent_callback_loop import AgentCallbackLoop

from .mantle_specific.calldata_bloat import CalldataBloat
from .mantle_specific.operator_fee_outlier import OperatorFeeOutlier
from .mantle_specific.l1block_unchecked_read import L1BlockUncheckedRead
from .mantle_specific.arsia_anti_patterns import ArsiaAntiPatterns

from .exploit_patterns.single_dvn_verifier import SingleDVNVerifier
from .exploit_patterns.donation_attack import DonationAttack
from .exploit_patterns.init_unprotected import InitUnprotected
from .exploit_patterns.oracle_no_staleness import OracleNoStaleness
from .exploit_patterns.proxy_storage_collision import ProxyStorageCollision
from .exploit_patterns.approval_abuse_arbitrary_call import ApprovalAbuseArbitraryCall
from .exploit_patterns.signature_replay_bypass import SignatureReplayBypass
from .exploit_patterns.amm_spot_oracle_dependency import AmmSpotOracleDependency
from .exploit_patterns.vault_share_rounding import VaultShareRounding

from .corpus.corpus_match import CorpusMatch

detectors = [
    # Agent-context
    AgentReentrancy,
    AgentCallbackLoop,
    # Mantle-specific
    CalldataBloat,
    OperatorFeeOutlier,
    L1BlockUncheckedRead,
    ArsiaAntiPatterns,
    # Exploit patterns
    SingleDVNVerifier,
    DonationAttack,
    InitUnprotected,
    OracleNoStaleness,
    ProxyStorageCollision,
    # Exploit patterns — derived from corpus density (Jun 2026 research)
    ApprovalAbuseArbitraryCall,
    SignatureReplayBypass,
    AmmSpotOracleDependency,
    VaultShareRounding,
    # Meta
    CorpusMatch,
]

printers = []
