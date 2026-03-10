// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BatchTransfer - EIP-7702 Compatible
 * @dev Batch transfer implementation designed for EIP-7702 delegatecall pattern
 * @notice When used with EIP-7702, the EOA temporarily becomes this contract and executes transfers directly
 * @notice NO approvals needed - the EOA IS the sender, so it transfers its own tokens
 */
contract BatchTransfer {
    // Events
    event BatchETHTransfer(address indexed sender, uint256 totalAmount, uint256 recipientCount);
    event BatchERC20Transfer(
        address indexed sender, address indexed token, uint256 totalAmount, uint256 recipientCount
    );
    event TransferFailed(address indexed recipient, uint256 amount);

    // Custom errors (more gas efficient than require strings)
    error InvalidArrayLength();
    error InsufficientBalance();
    error ArrayLengthMismatch();
    error TransferFailedError();
    error ZeroAddress();

    /**
     * @dev Batch transfer ETH to multiple recipients
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to send (in wei). If length is 1, same amount sent to all recipients
     * @notice With EIP-7702: EOA's ETH is transferred directly (no msg.value needed in delegatecall)
     * @notice Gas optimized: Pass single-element amounts array to send equal amounts to all
     */
    function batchTransferETH(address payable[] calldata recipients, uint256[] calldata amounts) external payable {
        uint256 recipientCount = recipients.length;
        uint256 amountCount = amounts.length;

        if (recipientCount == 0) revert InvalidArrayLength();
        if (amountCount == 0) revert InvalidArrayLength();

        // Check if equal distribution (single amount) or custom amounts
        bool isEqualDistribution = amountCount == 1;

        if (!isEqualDistribution && amountCount != recipientCount) {
            revert ArrayLengthMismatch();
        }

        uint256 totalAmount;
        uint256 amountPerRecipient = isEqualDistribution ? amounts[0] : 0;

        // Calculate total required
        if (isEqualDistribution) {
            unchecked {
                totalAmount = amountPerRecipient * recipientCount;
            }
        } else {
            for (uint256 i = 0; i < recipientCount;) {
                unchecked {
                    totalAmount += amounts[i];
                    ++i;
                }
            }
        }

        // In EIP-7702, address(this) IS the EOA, so check its balance
        if (address(this).balance < totalAmount) revert InsufficientBalance();

        // Perform transfers
        for (uint256 i = 0; i < recipientCount;) {
            address payable recipient = recipients[i];
            if (recipient == address(0)) revert ZeroAddress();

            uint256 amount = isEqualDistribution ? amountPerRecipient : amounts[i];

            // Direct transfer from this address (the EOA via delegatecall)
            (bool success,) = recipient.call{value: amount}("");
            if (!success) {
                emit TransferFailed(recipient, amount);
                revert TransferFailedError();
            }

            unchecked {
                ++i;
            }
        }

        emit BatchETHTransfer(address(this), totalAmount, recipientCount);
    }

    /**
     * @dev Batch transfer ERC-20 tokens to multiple recipients
     * @param token ERC-20 token contract address
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to send. If length is 1, same amount sent to all recipients
     * @notice With EIP-7702: EOA's tokens are transferred directly via transfer() - NO APPROVAL NEEDED
     * @notice Gas optimized: Pass single-element amounts array to send equal amounts to all
     */
    function batchTransferERC20(address token, address[] calldata recipients, uint256[] calldata amounts) external {
        uint256 recipientCount = recipients.length;
        uint256 amountCount = amounts.length;

        if (recipientCount == 0) revert InvalidArrayLength();
        if (amountCount == 0) revert InvalidArrayLength();
        if (token == address(0)) revert ZeroAddress();

        // Check if equal distribution (single amount) or custom amounts
        bool isEqualDistribution = amountCount == 1;

        if (!isEqualDistribution && amountCount != recipientCount) {
            revert ArrayLengthMismatch();
        }

        IERC20 tokenContract = IERC20(token);
        uint256 totalAmount;
        uint256 amountPerRecipient = isEqualDistribution ? amounts[0] : 0;

        // Calculate total
        if (isEqualDistribution) {
            unchecked {
                totalAmount = amountPerRecipient * recipientCount;
            }
        }

        // In EIP-7702, address(this) IS the EOA, check its balance
        if (tokenContract.balanceOf(address(this)) < totalAmount && isEqualDistribution) {
            revert InsufficientBalance();
        }

        // Perform transfers - using transfer() not transferFrom()
        // Since we ARE the token holder via delegatecall, we can transfer directly
        for (uint256 i = 0; i < recipientCount;) {
            address recipient = recipients[i];
            if (recipient == address(0)) revert ZeroAddress();

            uint256 amount = isEqualDistribution ? amountPerRecipient : amounts[i];

            if (!isEqualDistribution) {
                unchecked {
                    totalAmount += amount;
                }
            }

            // Direct transfer from this address (the EOA via delegatecall)
            bool success = tokenContract.transfer(recipient, amount);
            if (!success) {
                emit TransferFailed(recipient, amount);
                revert TransferFailedError();
            }

            unchecked {
                ++i;
            }
        }

        emit BatchERC20Transfer(address(this), token, totalAmount, recipientCount);
    }

    /**
     * @dev Get balance of this address (useful for checking before transfers)
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Get ERC20 token balance of this address
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Fallback to receive ETH
    receive() external payable {}
}
