// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IL1Block {
    function baseFeeScalar() external view returns (uint256);
    function l1BaseFee() external view returns (uint256);
}

contract L1BlockUncheckedRead {
    IL1Block constant L1 = IL1Block(0x4200000000000000000000000000000000000015);

    function discountedPrice(uint256 base) external view returns (uint256) {
        uint256 scalar = L1.baseFeeScalar();
        // No validation — silently divides by zero post-upgrade if field renamed.
        return base / scalar;
    }
}
