// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Intentionally vulnerable vault used as a Slither fixture.
///         Contains a classic checks-after-interaction reentrancy.
contract SampleVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // Reentrancy: external call before state update.
    function withdraw() external {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "no balance");
        (bool ok, ) = msg.sender.call{value: bal}("");
        require(ok, "transfer failed");
        balances[msg.sender] = 0;
    }
}
