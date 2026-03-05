// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MaxToken
 * @dev Professional BEP-20 Token for Max Miner W2E Platform.
 * Features:
 * - Managed minting by platform owner (backend).
 * - Public burnable for deflationary mechanics.
 * - Optimized for Binance Smart Chain (BSC).
 */
contract MaxToken is ERC20, ERC20Burnable, Ownable {
    constructor() ERC20("Max Token", "MAX") Ownable(msg.sender) {
        // Initial supply is zero; tokens are minted on-demand via platform withdrawals.
    }

    /**
     * @dev Function to mint tokens, accessible only by the platform owner.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
