// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Plain ERC20. Should audit clean.
contract SimpleToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("SimpleToken", "STK") {
        _mint(msg.sender, initialSupply);
    }
}
