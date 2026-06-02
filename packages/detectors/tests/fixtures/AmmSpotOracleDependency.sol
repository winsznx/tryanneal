// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112, uint112, uint32);
}

contract AmmSpotOracleDependency {
    IUniswapV2Pair public pair;

    function getPrice() external view returns (uint256 price) {
        (uint112 r0, uint112 r1, ) = pair.getReserves();
        // Direct AMM read, no median, just spot.
        price = uint256(r1) * 1e18 / uint256(r0);
    }
}
