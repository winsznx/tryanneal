// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title AnnealValidation — minimal on-chain audit verdict registry for TryAnneal.
/// @notice Stands in for ERC-8004 ValidationRegistry until/unless an official
///         deployment is confirmed on Mantle. The schema is forward-compatible:
///         postVerdict() carries enough data to be re-published into the official
///         registry once available.
contract AnnealValidation {
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
    ) external {
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
