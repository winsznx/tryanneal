// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPriceFeed {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @notice Reads an oracle price without staleness or round-completeness checks.
contract UnsafeOracle {
    IPriceFeed public immutable feed;

    constructor(IPriceFeed _feed) {
        feed = _feed;
    }

    function getPrice() external view returns (uint256) {
        // No freshness check on updatedAt, no answeredInRound >= roundId check.
        (, int256 answer, , , ) = feed.latestRoundData();
        require(answer > 0, "bad price");
        return uint256(answer);
    }

    function valueOf(uint256 amount) external view returns (uint256) {
        (, int256 answer, , , ) = feed.latestRoundData();
        return amount * uint256(answer);
    }
}
