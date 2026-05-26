// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-8004 Identity Registry interface (subset).
/// @dev Mantle deployment: 0x8004A3718bD35CF767BC0E718bf21Ec4073502f0
interface IIdentityRegistry {
    function register(address owner) external returns (uint256 agentId);
    function register(address owner, string calldata agentURI) external returns (uint256 agentId);
    function register(
        address owner,
        string calldata agentURI,
        bytes calldata walletSignature
    ) external returns (uint256 agentId);
    function setAgentURI(uint256 agentId, string calldata agentURI) external;
    function setAgentWallet(uint256 agentId, address wallet, bytes calldata signature) external;
    function getMetadata(uint256 agentId)
        external
        view
        returns (string memory agentURI, address wallet);
}

/// @title AnnealAgent — thin facade for registering and managing a TryAnneal agent
///        identity in the ERC-8004 Identity Registry on Mantle.
contract AnnealAgent {
    IIdentityRegistry public immutable registry;
    address public immutable owner;

    uint256 public agentId;
    bool public registered;

    event Registered(uint256 indexed agentId, address indexed owner, string agentURI);
    event AgentURIUpdated(uint256 indexed agentId, string agentURI);

    error AlreadyRegistered();
    error NotRegistered();
    error NotOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(IIdentityRegistry _registry, address _owner) {
        registry = _registry;
        owner = _owner;
    }

    function registerAgent(string calldata agentURI) external onlyOwner returns (uint256) {
        if (registered) revert AlreadyRegistered();
        uint256 id = registry.register(owner, agentURI);
        agentId = id;
        registered = true;
        emit Registered(id, owner, agentURI);
        return id;
    }

    function updateAgentURI(string calldata agentURI) external onlyOwner {
        if (!registered) revert NotRegistered();
        registry.setAgentURI(agentId, agentURI);
        emit AgentURIUpdated(agentId, agentURI);
    }

    function readMetadata() external view returns (string memory agentURI, address wallet) {
        if (!registered) revert NotRegistered();
        return registry.getMetadata(agentId);
    }
}
