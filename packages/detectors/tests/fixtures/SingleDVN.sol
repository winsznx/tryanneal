// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface ILayerZeroEndpoint {
    function send(uint16 dstChainId, bytes calldata payload) external payable;
}

/// @dev OApp configured with a single DVN — mirrors the April 2026 KelpDAO/LayerZero pattern.
contract SingleDVN {
    ILayerZeroEndpoint public endpoint;
    address[] public requiredDVNs = new address[](1);
    uint8 public requiredDVNCount = 1;

    function setup(ILayerZeroEndpoint _e, address dvn) external {
        endpoint = _e;
        requiredDVNs[0] = dvn;
    }
}
