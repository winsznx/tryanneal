// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AnnealValidationV2 — access-controlled on-chain audit verdict registry.
/// @notice V2 = V1 (AnnealValidation.sol) + ATTESTER_ROLE access control on
///         postVerdict(). Everything else — the AuditVerdict struct, storage
///         layout (verdicts / agentAudits / totalAudits), getters, the
///         AuditPosted event, and input validation (InvalidScore / EmptyCodeHash)
///         — is preserved verbatim so V2 is a drop-in replacement.
///
/// @dev    V1 integrity hole: postVerdict() had NO access control, so anyone
///         could post or overwrite any verdict for any agentId — e.g. forge a
///         clean 100/100 for a malicious contract under agent #131. V2 closes
///         this: only holders of ATTESTER_ROLE may write verdicts. The deployer
///         is granted DEFAULT_ADMIN_ROLE and ATTESTER_ROLE at construction; the
///         admin manages attesters via OpenZeppelin's grantRole / revokeRole.
///
/// @dev    NOT YET DEPLOYED. Canonical live registry remains the V1
///         AnnealValidation deployment (see deployments/mantleMainnet.json).
///         This file is authored for review/audit; deploying it is a separate,
///         explicit step.
contract AnnealValidationV2 is AccessControl {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    struct AuditVerdict {
        uint256 agentId;
        bytes32 codeHash;
        uint8 verdictScore;
        uint8 criticalCount;
        uint8 highCount;
        uint8 mediumCount;
        uint8 lowCount;
        string reportURI;
        uint256 timestamp;
        bytes32 gasReportHash;
    }

    mapping(bytes32 => AuditVerdict) public verdicts;
    mapping(uint256 => bytes32[]) public agentAudits;

    uint256 public totalAudits;

    event AuditPosted(
        uint256 indexed agentId,
        bytes32 indexed codeHash,
        uint8 verdictScore,
        string reportURI,
        uint256 timestamp
    );

    error InvalidScore(uint8 score);
    error EmptyCodeHash();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ATTESTER_ROLE, msg.sender);
    }

    function postVerdict(
        uint256 agentId,
        bytes32 codeHash,
        uint8 verdictScore,
        uint8 criticalCount,
        uint8 highCount,
        uint8 mediumCount,
        uint8 lowCount,
        string calldata reportURI,
        bytes32 gasReportHash
    ) external onlyRole(ATTESTER_ROLE) {
        if (verdictScore > 100) revert InvalidScore(verdictScore);
        if (codeHash == bytes32(0)) revert EmptyCodeHash();

        verdicts[codeHash] = AuditVerdict({
            agentId: agentId,
            codeHash: codeHash,
            verdictScore: verdictScore,
            criticalCount: criticalCount,
            highCount: highCount,
            mediumCount: mediumCount,
            lowCount: lowCount,
            reportURI: reportURI,
            timestamp: block.timestamp,
            gasReportHash: gasReportHash
        });

        agentAudits[agentId].push(codeHash);
        unchecked { totalAudits++; }

        emit AuditPosted(agentId, codeHash, verdictScore, reportURI, block.timestamp);
    }

    /// @notice Convenience wrapper over AccessControl.grantRole for the attester
    ///         role; callable only by DEFAULT_ADMIN_ROLE (the role admin).
    function grantAttester(address attester) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ATTESTER_ROLE, attester);
    }

    /// @notice Convenience wrapper over AccessControl.revokeRole for the attester
    ///         role; callable only by DEFAULT_ADMIN_ROLE (the role admin).
    function revokeAttester(address attester) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ATTESTER_ROLE, attester);
    }

    function getVerdict(bytes32 codeHash) external view returns (AuditVerdict memory) {
        return verdicts[codeHash];
    }

    function hasAuditedCodeHash(bytes32 codeHash) external view returns (bool) {
        return verdicts[codeHash].timestamp > 0;
    }

    function getAgentAuditCount(uint256 agentId) external view returns (uint256) {
        return agentAudits[agentId].length;
    }

    function getAgentAudits(uint256 agentId) external view returns (bytes32[] memory) {
        return agentAudits[agentId];
    }
}
