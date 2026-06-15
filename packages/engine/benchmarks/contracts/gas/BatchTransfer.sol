// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * Batch-vs-per-item benchmark pair.
 *
 * NaivePayments exposes a single-recipient transfer. To pay N recipients you
 * send N separate transactions — each one re-pays the 4-byte selector, the
 * 32-byte zero-padded address word and the 32-byte amount word, plus the
 * fixed tx envelope FastLZ cannot compress away.
 *
 * BatchPayments takes two tight arrays (address[] + uint256[]) in one call.
 * The runner compares the TOTAL calldata across N=10 operations: 10 single
 * calls vs 1 batched call. The batched calldata amortises the selector and
 * the array overhead across all 10 items, so the FastLZ-driven L1-data fee
 * drops materially.
 */
contract NaivePayments {
    mapping(address => uint256) public paid;

    function pay(address to, uint256 amount) external {
        paid[to] += amount;
    }
}

contract BatchPayments {
    mapping(address => uint256) public paid;

    function payBatch(address[] calldata to, uint256[] calldata amount) external {
        uint256 n = to.length;
        require(n == amount.length, "len");
        for (uint256 i = 0; i < n; ++i) {
            paid[to[i]] += amount[i];
        }
    }
}
