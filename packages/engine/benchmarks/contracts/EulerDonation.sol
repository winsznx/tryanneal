// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Fixture: Euler Finance March 2023 donation attack (~$197M).
// ERC4626-style vault where totalAssets() returns the raw token balance.
// Attacker mints 1 wei share, donates a large balance directly to the
// vault to inflate share price, then the next depositor rounds down to 0
// shares — their assets are stolen on rounding.

interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transferFrom(address, address, uint256) external returns (bool);
}

abstract contract ERC4626 {}

contract EulerDonation is ERC4626 {
    IERC20 public asset;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    constructor(IERC20 _asset) { asset = _asset; }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        // No virtual-shares offset, no dead-share floor.
        return totalSupply == 0 ? assets : assets * totalSupply / totalAssets();
    }

    function deposit(uint256 assets) external returns (uint256 shares) {
        shares = convertToShares(assets);
        asset.transferFrom(msg.sender, address(this), assets);
        balanceOf[msg.sender] += shares;
        totalSupply += shares;
    }
}
