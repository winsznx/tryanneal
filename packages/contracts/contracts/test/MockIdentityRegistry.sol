// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIdentityRegistry} from "../AnnealAgent.sol";

/// @notice Minimal in-memory ERC-8004 Identity Registry for tests.
contract MockIdentityRegistry is IIdentityRegistry {
    struct Agent {
        address owner;
        address wallet;
        string agentURI;
        bool exists;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Agent) public agents;

    function register(address agentOwner) external returns (uint256) {
        return _register(agentOwner, "", address(0));
    }

    function register(address agentOwner, string calldata agentURI) external returns (uint256) {
        return _register(agentOwner, agentURI, address(0));
    }

    function register(
        address agentOwner,
        string calldata agentURI,
        bytes calldata
    ) external returns (uint256) {
        return _register(agentOwner, agentURI, address(0));
    }

    function setAgentURI(uint256 agentId, string calldata agentURI) external {
        require(agents[agentId].exists, "no agent");
        agents[agentId].agentURI = agentURI;
    }

    function setAgentWallet(uint256 agentId, address wallet, bytes calldata) external {
        require(agents[agentId].exists, "no agent");
        agents[agentId].wallet = wallet;
    }

    function getMetadata(uint256 agentId)
        external
        view
        returns (string memory agentURI, address wallet)
    {
        Agent storage a = agents[agentId];
        require(a.exists, "no agent");
        return (a.agentURI, a.wallet);
    }

    function _register(address agentOwner, string memory agentURI, address wallet)
        internal
        returns (uint256 id)
    {
        id = nextId++;
        agents[id] = Agent({owner: agentOwner, wallet: wallet, agentURI: agentURI, exists: true});
    }
}
