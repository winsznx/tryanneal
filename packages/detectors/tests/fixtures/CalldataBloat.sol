// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CalldataBloat {
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes[] calldata payloads,
        string[] calldata memos
    ) external {
        for (uint256 i; i < recipients.length; ++i) {
            // pretend work
        }
    }
}
