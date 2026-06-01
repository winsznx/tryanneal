// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Plain ERC20 — should produce no findings.
contract Clean {
    string public constant name = "Clean";
    string public constant symbol = "CLN";
    uint8 public constant decimals = 18;
    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;

    constructor(uint256 supply) {
        totalSupply = supply;
        balanceOf[msg.sender] = supply;
    }
}
