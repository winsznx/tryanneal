// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPriceFeed {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

contract OracleNoStaleness {
    IPriceFeed public feed;

    function valueOf(uint256 amount) external view returns (uint256) {
        (, int256 price, , , ) = feed.latestRoundData();
        require(price > 0, "bad");
        return amount * uint256(price);
    }
}
