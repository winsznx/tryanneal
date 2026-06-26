// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// A "high-yield" pool an agent might be tempted to deposit into.
/// withdraw() makes the external call BEFORE zeroing the balance — classic reentrancy.
/// FILM NOTE: to go green on camera, move `balances[msg.sender] = 0;` ABOVE the call.
contract HighYieldPool {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 bal = balances[msg.sender];
        (bool ok, ) = msg.sender.call{value: bal}("");
        require(ok, "transfer failed");
        balances[msg.sender] = 0; // state update AFTER the external call
    }
}
