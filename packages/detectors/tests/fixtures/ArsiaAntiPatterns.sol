// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @dev Pre-Arsia assumption baked in: 0.02 gwei basefee floor.
contract ArsiaAntiPatterns {
    // EigenDA reference — Mantle migrated off EigenDA after Arsia.
    address constant EIGENDA_BRIDGE = 0x0000000000000000000000000000000000000123;

    function priceFloor() external view returns (uint256) {
        if (block.basefee < 20000000) return 20000000; // 0.02 gwei
        return block.basefee;
    }
}
