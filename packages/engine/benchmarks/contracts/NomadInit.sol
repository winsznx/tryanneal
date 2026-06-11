// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Fixture: Nomad Bridge August 2022 replay (~$190M).
// initialize() sets privileged state without an `initializer` modifier or
// an `initialized` boolean guard — anyone re-invokes it and resets owner,
// admin, and trusted root.

contract NomadInit {
    address public owner;
    address public admin;
    bytes32 public trustedRoot;

    // No `initializer` modifier. No `if (initialized) revert`.
    function initialize(address _owner, address _admin, bytes32 _root) external {
        owner = _owner;
        admin = _admin;
        trustedRoot = _root;
    }
}
