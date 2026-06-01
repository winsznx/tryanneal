// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IIdentityRegistry {
    function getMetadata(uint256 agentId) external view returns (string memory, address);
}

interface IRemoteAgent {
    function executeTask(bytes calldata payload) external returns (bytes memory);
    function agentId() external view returns (uint256);
}

contract AgentReentrancy {
    IIdentityRegistry public constant REGISTRY = IIdentityRegistry(0x8004A3718bD35CF767BC0E718bf21Ec4073502f0);
    uint256 public agentId;
    mapping(uint256 => uint256) public taskRewards;

    function executeTask(uint256 jobId, IRemoteAgent partner, bytes calldata payload) external {
        taskRewards[jobId] += 1;            // state write
        partner.executeTask(payload);       // external call into another agent — reentry vector
        taskRewards[jobId] += 1;            // state write after the external call
    }
}
