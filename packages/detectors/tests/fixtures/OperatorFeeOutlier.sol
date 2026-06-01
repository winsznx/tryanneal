// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract OperatorFeeOutlier {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public rewards;

    function distribute(address[] calldata users, uint256[] calldata amounts) external {
        for (uint256 i; i < users.length; ++i) {
            balances[users[i]] += amounts[i];
            rewards[users[i]] += amounts[i] / 10;
        }
    }
}
