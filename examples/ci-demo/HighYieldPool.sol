// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// Fixed: checks-effects-interactions — balance zeroed BEFORE the external call.
contract HighYieldPool {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 bal = balances[msg.sender];
        balances[msg.sender] = 0; // state update BEFORE the external call
        (bool ok, ) = msg.sender.call{value: bal}("");
        require(ok, "transfer failed");
    }
}
