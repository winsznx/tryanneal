// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Fixture: KelpDAO/LayerZero April 2026 DVN drain (~$292M).
// LayerZero OApp configured with a 1-of-N DVN verifier — single operator
// compromise unlocks cross-chain message authority and forges withdrawals
// against the destination chain's restaking vault.

interface ILayerZeroEndpoint {
    function send(uint16 dstChainId, bytes calldata payload) external payable;
}

contract LayerZeroDVN {
    ILayerZeroEndpoint public endpoint;
    address[] public requiredDVNs = new address[](1);
    uint8 public requiredDVNCount = 1;

    function setup(ILayerZeroEndpoint _endpoint, address dvn) external {
        endpoint = _endpoint;
        requiredDVNs[0] = dvn;
    }
}
