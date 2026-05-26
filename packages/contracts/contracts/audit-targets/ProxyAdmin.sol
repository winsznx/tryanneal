// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Minimal upgradeable proxy with admin-controlled implementation slot.
///         Exercises upgradeability/admin-rotation detectors.
contract ProxyAdmin {
    // EIP-1967 implementation slot.
    bytes32 internal constant _IMPL_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // EIP-1967 admin slot.
    bytes32 internal constant _ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    event Upgraded(address indexed implementation);
    event AdminChanged(address indexed previous, address indexed next);

    constructor(address impl, address admin) {
        _setSlot(_IMPL_SLOT, impl);
        _setSlot(_ADMIN_SLOT, admin);
    }

    modifier onlyAdmin() {
        require(msg.sender == _getSlot(_ADMIN_SLOT), "not admin");
        _;
    }

    function upgradeTo(address newImpl) external onlyAdmin {
        _setSlot(_IMPL_SLOT, newImpl);
        emit Upgraded(newImpl);
    }

    function changeAdmin(address newAdmin) external onlyAdmin {
        address prev = _getSlot(_ADMIN_SLOT);
        _setSlot(_ADMIN_SLOT, newAdmin);
        emit AdminChanged(prev, newAdmin);
    }

    function implementation() external view returns (address) {
        return _getSlot(_IMPL_SLOT);
    }

    function admin() external view returns (address) {
        return _getSlot(_ADMIN_SLOT);
    }

    fallback() external payable {
        address impl = _getSlot(_IMPL_SLOT);
        assembly {
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}

    function _setSlot(bytes32 slot, address v) private {
        assembly { sstore(slot, v) }
    }
    function _getSlot(bytes32 slot) private view returns (address v) {
        assembly { v := sload(slot) }
    }
}
