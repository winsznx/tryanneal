// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
}

/// @dev SwapNet/Li.Fi/SocketGateway-class — forwards user-supplied target + calldata
///      while the contract holds open user approvals.
contract ApprovalAbuseArbitraryCall {
    function swap(address target, bytes calldata data, IERC20 inputToken, uint256 amount) external payable {
        // Pulls input via approval — exactly what victims grant.
        inputToken.transferFrom(msg.sender, address(this), amount);
        (bool ok, ) = target.call{value: msg.value}(data);
        require(ok, "external call failed");
    }
}
