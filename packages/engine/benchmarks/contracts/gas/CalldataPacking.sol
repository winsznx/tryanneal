// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * Calldata-packing benchmark pair.
 *
 * Both contracts ingest a batch of orders, each carrying a market id, a bid and
 * ask price, an amount, an expiry and a flag. NaiveOrders takes the flat
 * uint256[] the fields would naturally ABI-encode to — six full 32-byte words
 * per order, almost all of them zero-padding. PackedOrders takes a single tight
 * `bytes` blob where each order is hand-packed into the widths that actually fit
 * the domain (uint32 id, uint96 prices, uint64 amount, uint40 expiry, bool):
 * 42 bytes per order instead of 192.
 *
 * On Mantle the L1-data component of the fee is driven by the FastLZ-compressed
 * calldata size. ABI's mandatory 32-byte word alignment is exactly what packing
 * removes, so the dense `bytes` blob is the measured win. The L2 path is held
 * identical (one keccak over the payload) so the comparison isolates calldata.
 */
contract NaiveOrders {
    bytes32 public last;

    /// 6 words per order: [marketId, bidPrice, askPrice, amount, expiry, flag] × N.
    function recordMany(uint256[] calldata words) external {
        last = keccak256(abi.encodePacked(words));
    }
}

contract PackedOrders {
    bytes32 public last;

    /// Each order packed into 42 bytes: uint32|uint96|uint96|uint64|uint40|uint8.
    function recordManyPacked(bytes calldata orders) external {
        last = keccak256(orders);
    }
}
