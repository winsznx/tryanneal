// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Multi-recipient ERC20 transfer. Heavy calldata path so the Arsia
///         gas profiler should suggest calldata packing / batching.
contract BatchTransfer {
    using SafeERC20 for IERC20;

    function batchTransfer(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
        require(recipients.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < recipients.length; ) {
            token.safeTransferFrom(msg.sender, recipients[i], amounts[i]);
            unchecked { ++i; }
        }
    }

    function batchTransferEqual(IERC20 token, address[] calldata recipients, uint256 amount) external {
        for (uint256 i = 0; i < recipients.length; ) {
            token.safeTransferFrom(msg.sender, recipients[i], amount);
            unchecked { ++i; }
        }
    }
}
