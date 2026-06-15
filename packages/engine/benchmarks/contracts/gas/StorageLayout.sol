// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * Storage-layout benchmark pair (deploy-time L1 data).
 *
 * Both contracts expose the same ten protocol configuration values. The naive
 * StorageConfig keeps them in regular storage slots and writes them once in the
 * constructor — so the deploy bytecode (init code) carries ten full SSTOREs,
 * and every reader pays an SLOAD at runtime.
 *
 * ConstantConfig marks them `constant`: solc inlines the values at compile time
 * and drops every SSTORE from the constructor. The init code posted to L1 as
 * deploy calldata is smaller, so the FastLZ-driven L1-data fee on deploy is
 * lower. The runner compares the two init-code blobs as the size-driven L1
 * component.
 *
 * NB: marking values `immutable` instead would INFLATE the runtime bytecode
 * (solc inlines them into code, which is posted on deploy), so it is NOT a
 * deploy-time L1-data win — only true compile-time `constant`s are. Measured,
 * not assumed.
 */
contract StorageConfig {
    uint256 public feeBps;
    uint256 public maxLeverage;
    uint256 public liquidationThreshold;
    uint256 public oracleStaleness;
    uint256 public minCollateral;
    uint256 public protocolReserve;
    uint256 public maxSlippage;
    uint256 public cooldownPeriod;
    uint256 public rewardRate;
    uint256 public capacityCap;

    constructor() {
        feeBps = 30;
        maxLeverage = 10;
        liquidationThreshold = 8000;
        oracleStaleness = 3600;
        minCollateral = 1e18;
        protocolReserve = 5000;
        maxSlippage = 50;
        cooldownPeriod = 86400;
        rewardRate = 1.25e18;
        capacityCap = 100_000_000e18;
    }

    function sum() external view returns (uint256) {
        return
            feeBps +
            maxLeverage +
            liquidationThreshold +
            oracleStaleness +
            minCollateral +
            protocolReserve +
            maxSlippage +
            cooldownPeriod +
            rewardRate +
            capacityCap;
    }
}

contract ConstantConfig {
    uint256 public constant feeBps = 30;
    uint256 public constant maxLeverage = 10;
    uint256 public constant liquidationThreshold = 8000;
    uint256 public constant oracleStaleness = 3600;
    uint256 public constant minCollateral = 1e18;
    uint256 public constant protocolReserve = 5000;
    uint256 public constant maxSlippage = 50;
    uint256 public constant cooldownPeriod = 86400;
    uint256 public constant rewardRate = 1.25e18;
    uint256 public constant capacityCap = 100_000_000e18;

    function sum() external pure returns (uint256) {
        return
            feeBps +
            maxLeverage +
            liquidationThreshold +
            oracleStaleness +
            minCollateral +
            protocolReserve +
            maxSlippage +
            cooldownPeriod +
            rewardRate +
            capacityCap;
    }
}
