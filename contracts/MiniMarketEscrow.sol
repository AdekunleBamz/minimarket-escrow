// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MiniMarketEscrow
/// @notice Escrow for MiniPay and web buyers with explicit TVL and total volume metrics.
contract MiniMarketEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum EscrowStatus {
        None,
        Funded,
        Released,
        Refunded,
        Disputed,
        ResolvedToSeller,
        ResolvedToBuyer
    }

    struct Escrow {
        address buyer;
        address seller;
        address arbiter;
        address token;
        uint256 amount;
        bytes32 dealHash;
        uint64 createdAt;
        EscrowStatus status;
    }

    uint256 public totalEscrows;
    uint256 public totalClosedEscrows;
    uint256 public tvlNative;
    uint256 public totalVolumeNative;

    mapping(address token => uint256 amount) public tvlByToken;
    mapping(address token => uint256 amount) public totalVolumeByToken;
    mapping(uint256 escrowId => Escrow escrow) public escrows;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 amount,
        address arbiter,
        bytes32 dealHash
    );
    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
    event EscrowSettled(
        uint256 indexed escrowId,
        EscrowStatus indexed status,
        address indexed recipient,
        address token,
        uint256 amount
    );

    constructor(address initialOwner_) Ownable(initialOwner_) {
        require(initialOwner_ != address(0), "OWNER_ZERO");
    }

    function createNativeEscrow(
        address seller,
        address arbiter,
        bytes32 dealHash
    ) external payable nonReentrant returns (uint256 escrowId) {
        require(msg.value > 0, "AMOUNT_ZERO");
        require(seller != address(0), "SELLER_ZERO");

        escrowId = _createEscrow(
            msg.sender,
            seller,
            arbiter == address(0) ? owner() : arbiter,
            address(0),
            msg.value,
            dealHash
        );

        tvlNative += msg.value;
    }

    function createTokenEscrow(
        address seller,
        address arbiter,
        address token,
        uint256 amount,
        bytes32 dealHash
    ) external nonReentrant returns (uint256 escrowId) {
        require(amount > 0, "AMOUNT_ZERO");
        require(seller != address(0), "SELLER_ZERO");
        require(token != address(0), "TOKEN_ZERO");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        escrowId = _createEscrow(
            msg.sender,
            seller,
            arbiter == address(0) ? owner() : arbiter,
            token,
            amount,
            dealHash
        );

        tvlByToken[token] += amount;
    }

    function release(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _escrowFunded(escrowId);
        require(msg.sender == escrow.buyer, "ONLY_BUYER");

        _settleToSeller(escrowId, EscrowStatus.Released);
    }

    function refund(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _escrowFunded(escrowId);
        require(msg.sender == escrow.seller || msg.sender == escrow.arbiter || msg.sender == owner(), "NOT_AUTHORIZED");

        _settleToBuyer(escrowId, EscrowStatus.Refunded);
    }

    function openDispute(uint256 escrowId) external {
        Escrow storage escrow = _escrowFunded(escrowId);
        require(msg.sender == escrow.buyer || msg.sender == escrow.seller, "ONLY_PARTIES");

        escrow.status = EscrowStatus.Disputed;
        emit EscrowDisputed(escrowId, msg.sender);
    }

    function resolveDispute(uint256 escrowId, bool releaseToSeller) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Disputed, "NOT_DISPUTED");
        require(msg.sender == escrow.arbiter || msg.sender == owner(), "ONLY_ARBITER");

        if (releaseToSeller) {
            _settleToSeller(escrowId, EscrowStatus.ResolvedToSeller);
        } else {
            _settleToBuyer(escrowId, EscrowStatus.ResolvedToBuyer);
        }
    }

    function marketSnapshot(address token)
        external
        view
        returns (
            uint256 escrowCount,
            uint256 closedCount,
            uint256 nativeTvl,
            uint256 nativeVolume,
            uint256 tokenTvl,
            uint256 tokenVolume
        )
    {
        escrowCount = totalEscrows;
        closedCount = totalClosedEscrows;
        nativeTvl = tvlNative;
        nativeVolume = totalVolumeNative;
        tokenTvl = tvlByToken[token];
        tokenVolume = totalVolumeByToken[token];
    }

    function _createEscrow(
        address buyer,
        address seller,
        address arbiter,
        address token,
        uint256 amount,
        bytes32 dealHash
    ) internal returns (uint256 escrowId) {
        require(arbiter != address(0), "ARBITER_ZERO");

        escrowId = ++totalEscrows;
        escrows[escrowId] = Escrow({
            buyer: buyer,
            seller: seller,
            arbiter: arbiter,
            token: token,
            amount: amount,
            dealHash: dealHash,
            createdAt: uint64(block.timestamp),
            status: EscrowStatus.Funded
        });

        emit EscrowCreated(escrowId, buyer, seller, token, amount, arbiter, dealHash);
    }

    function _settleToSeller(uint256 escrowId, EscrowStatus status) internal {
        Escrow storage escrow = escrows[escrowId];
        _decreaseTvl(escrow.token, escrow.amount);
        _increaseVolume(escrow.token, escrow.amount);
        totalClosedEscrows += 1;
        escrow.status = status;
        _transferValue(escrow.token, payable(escrow.seller), escrow.amount);

        emit EscrowSettled(escrowId, status, escrow.seller, escrow.token, escrow.amount);
    }

    function _settleToBuyer(uint256 escrowId, EscrowStatus status) internal {
        Escrow storage escrow = escrows[escrowId];
        _decreaseTvl(escrow.token, escrow.amount);
        _increaseVolume(escrow.token, escrow.amount);
        totalClosedEscrows += 1;
        escrow.status = status;
        _transferValue(escrow.token, payable(escrow.buyer), escrow.amount);

        emit EscrowSettled(escrowId, status, escrow.buyer, escrow.token, escrow.amount);
    }

    function _decreaseTvl(address token, uint256 amount) internal {
        if (token == address(0)) {
            tvlNative -= amount;
        } else {
            tvlByToken[token] -= amount;
        }
    }

    function _increaseVolume(address token, uint256 amount) internal {
        if (token == address(0)) {
            totalVolumeNative += amount;
        } else {
            totalVolumeByToken[token] += amount;
        }
    }

    function _transferValue(address token, address payable recipient, uint256 amount) internal {
        if (token == address(0)) {
            (bool sent, ) = recipient.call{value: amount}("");
            require(sent, "NATIVE_TRANSFER_FAILED");
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
    }

    function _escrowFunded(uint256 escrowId) internal view returns (Escrow storage escrow) {
        escrow = escrows[escrowId];
        require(escrow.buyer != address(0), "ESCROW_MISSING");
        require(escrow.status == EscrowStatus.Funded, "ESCROW_NOT_FUNDED");
    }
}
