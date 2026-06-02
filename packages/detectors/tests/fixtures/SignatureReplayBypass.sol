// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @dev Bridge-style withdrawal authorized by a signed message — no nonce tracking.
contract SignatureReplayBypass {
    address public signer;
    mapping(address => uint256) public balances;

    function withdraw(address user, uint256 amount, uint8 v, bytes32 r, bytes32 s) external {
        bytes32 hash = keccak256(abi.encodePacked(user, amount));
        address recovered = ecrecover(hash, v, r, s);
        require(recovered == signer, "bad sig");
        // Missing replay-tracking mapping — same (user, amount, v, r, s) replays forever.
        balances[user] -= amount;
        payable(user).transfer(amount);
    }
}
