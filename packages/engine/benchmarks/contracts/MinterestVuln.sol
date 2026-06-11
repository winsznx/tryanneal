// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Fixture: Minterest July 2024 reentrancy (~$1.4M on Mantle).
// The flaw — an external token transfer happens BEFORE the borrower's state
// is finalized, letting the same borrow path re-enter via the ERC777 hook.

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract MinterestVuln {
    mapping(address => uint256) public borrowed;
    mapping(address => uint256) public collateral;
    IERC20 public token;

    constructor(IERC20 _token) { token = _token; }

    function borrow(uint256 amount) external {
        require(collateral[msg.sender] >= amount * 2, "undercollateralized");
        // External call BEFORE state update — reentrancy vector.
        token.transfer(msg.sender, amount);
        borrowed[msg.sender] += amount;
    }

    function repay(uint256 amount) external {
        borrowed[msg.sender] -= amount;
    }
}
