// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AgentCallbackLoop {
    uint256 public agentId;
    mapping(bytes32 => uint256) public rewardsCredited;

    function onComplete(bytes32 jobId, uint256 reward) external {
        // No `processed[jobId]` guard — repeat delivery re-credits.
        rewardsCredited[jobId] += reward;
    }
}
