// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @dev Compound-fork debt-share rounding without explicit rounding direction.
contract VaultShareRounding {
    uint256 public totalDebtShares;
    uint256 public totalDebt;
    mapping(address => uint256) public debtShares;

    function borrow(uint256 amount) external {
        // floor-rounds shares — repay path will round the OPPOSITE way and accumulate dust.
        uint256 shares = totalDebtShares == 0 ? amount : amount * totalDebtShares / totalDebt;
        debtShares[msg.sender] += shares;
        totalDebtShares += shares;
        totalDebt += amount;
    }

    function repay(uint256 amount) external {
        uint256 shares = amount * totalDebtShares / totalDebt;
        debtShares[msg.sender] -= shares;
        totalDebtShares -= shares;
        totalDebt -= amount;
    }
}
