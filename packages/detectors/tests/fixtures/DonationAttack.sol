// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 { function balanceOf(address) external view returns (uint256); function transferFrom(address, address, uint256) external returns (bool); }

/// @dev ERC4626-shaped vault without virtual-shares or dead-share floor — Euler donation pattern.
abstract contract ERC4626 {}

contract DonationAttack is ERC4626 {
    IERC20 public asset;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return totalSupply == 0 ? assets : assets * totalSupply / totalAssets();
    }

    function deposit(uint256 assets) external returns (uint256 shares) {
        shares = convertToShares(assets);
        asset.transferFrom(msg.sender, address(this), assets);
        balanceOf[msg.sender] += shares;
        totalSupply += shares;
    }
}
