// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract InitUnprotected {
    address public owner;
    address public admin;
    bytes32 public trustedRoot;

    function initialize(address _owner, address _admin, bytes32 _root) external {
        owner = _owner;
        admin = _admin;
        trustedRoot = _root;
    }
}
