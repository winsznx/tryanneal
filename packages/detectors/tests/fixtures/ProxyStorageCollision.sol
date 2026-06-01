// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ProxyStorageCollision {
    bytes32 internal constant _IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    address public admin;       // collides with implementation slot 0
    uint256 public adminCounter; // collides with implementation slot 1

    fallback() external payable {
        address impl;
        assembly { impl := sload(_IMPL_SLOT) }
        assembly {
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok case 0 { revert(0, returndatasize()) } default { return(0, returndatasize()) }
        }
    }
    receive() external payable {}
}
