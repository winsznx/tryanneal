// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Fixture: a tiny owner-gated treasury. No reentrancy, no rounding traps,
// no privileged init. Should produce zero high/critical findings.

contract Clean2 {
    address public immutable owner;
    uint256 private _balance;

    error NotOwner();
    error InsufficientBalance();

    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner) {
        owner = _owner;
    }

    function deposit() external payable {
        _balance += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount, address payable to) external onlyOwner {
        if (amount > _balance) revert InsufficientBalance();
        _balance -= amount;
        emit Withdraw(to, amount);
        to.transfer(amount);
    }

    function balance() external view returns (uint256) {
        return _balance;
    }
}
