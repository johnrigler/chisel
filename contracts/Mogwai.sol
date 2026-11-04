// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Mogwai
/// @notice Writer-scoped dictionary, optional log and native-currency distribution.
/// @dev No owner-gated writes. Each writer controls only their own dictionary keys.
///      Chisel performs policy checks and encoding off-chain. The unchecked payment
///      path is best-effort, but still cannot spend more than the call's msg.value.
contract Mogwai {
    address public immutable creator;
    uint256 public constant PAYMENT_CALL_GAS = 50000;

    struct Entry {
        string body;
        uint64 revision; // Zero means the entry does not exist.
    }

    struct Payment {
        address payable recipient;
        uint256 amount;
    }

    // Dictionary entries are keyed by the actual EVM caller, not a claimed author.
    mapping(address => mapping(bytes32 => Entry)) private entries;
    // Only used when a best-effort refund to a contract caller fails.
    mapping(address => uint256) public pendingRefunds;

    event ArtifactMapped(
        address indexed writer,
        bytes32 indexed artifactKeyHash,
        uint64 revision,
        string artifact,
        string body
    );
    event RecordLogged(address indexed writer, bytes32 indexed format, bytes data);

    /// @dev status: 0 = insufficient msg.value budget (not called);
    ///              1 = external call failed; 2 = call succeeded.
    ///      A successful zero-value CALL may not appear as an internal transfer
    ///      on a block explorer. This event reports the EVM call result.
    event TransferResult(
        address indexed writer,
        address indexed recipient,
        uint256 indexed index,
        uint256 amount,
        uint8 status
    );
    event RefundCredited(address indexed writer, uint256 amount);
    event RefundWithdrawn(address indexed writer, uint256 amount);

    error InvalidPayment();
    error TransferFailed(uint256 index);
    error RefundFailed();

    constructor() {
        creator = msg.sender;
    }

    /// @notice Write only to the caller's (writer, artifact) namespace.
    function mapArtifact(string calldata artifact, string calldata body) external {
        _mapArtifact(artifact, body);
    }

    function _mapArtifact(string calldata artifact, string calldata body) private {
        bytes32 key = keccak256(bytes(artifact));
        Entry storage entry = entries[msg.sender][key];
        entry.body = body;
        entry.revision += 1;
        emit ArtifactMapped(msg.sender, key, entry.revision, artifact, body);
    }

    function getArtifact(address writer, string calldata artifact)
        external
        view
        returns (string memory body, uint64 revision)
    {
        Entry storage entry = entries[writer][keccak256(bytes(artifact))];
        return (entry.body, entry.revision);
    }

    /// @notice Publish arbitrary bytes in receipt logs without storage writes.
    function logRecord(bytes32 format, bytes calldata data) external {
        emit RecordLogged(msg.sender, format, data);
    }

    /// @notice Best-effort native-token distribution. All recipients are processed
    ///         independently. Failures do not revert other successful payments.
    /// @dev Chisel can validate addresses and amounts before sending, but this
    ///      path intentionally permits zero amounts and zero addresses.
    function distribute(Payment[] calldata payments) external payable {
        _distribute(payments);
    }

    /// @notice Optional strict path: validates values and reverts ALL operations
    ///         if a payment fails; the caller supplies exactly the total sent.
    function distributeChecked(Payment[] calldata payments) external payable {
        uint256 total;
        for (uint256 i; i < payments.length; ++i) {
            Payment calldata payment = payments[i];
            if (payment.recipient == address(0) || payment.amount == 0) {
                revert InvalidPayment();
            }
            total += payment.amount;
        }
        if (total != msg.value) revert InvalidPayment();

        for (uint256 i; i < payments.length; ++i) {
            Payment calldata payment = payments[i];
            (bool success, ) = payment.recipient.call{value: payment.amount}("");
            if (!success) revert TransferFailed(i);
            emit TransferResult(msg.sender, payment.recipient, i, payment.amount, 2);
        }
    }

    /// @notice One transaction may write a dictionary entry, distribute funds,
    ///         emit a log, or do any combination of these operations.
    /// @dev Empty artifact skips dictionary; empty payments skips distribution;
    ///      empty logData skips log. The format can be zero for an untyped log.
    ///      Payment failures are best-effort, not atomic with the other actions.
    function execute(
        string calldata artifact,
        string calldata body,
        Payment[] calldata payments,
        bytes32 logFormat,
        bytes calldata logData
    ) external payable {
        if (bytes(artifact).length != 0) _mapArtifact(artifact, body);
        if (logData.length != 0) emit RecordLogged(msg.sender, logFormat, logData);
        _distribute(payments);
    }

    function _distribute(Payment[] calldata payments) private {
        uint256 unspent = msg.value;
        for (uint256 i; i < payments.length; ++i) {
            Payment calldata payment = payments[i];
            if (payment.amount > unspent) {
                emit TransferResult(msg.sender, payment.recipient, i, payment.amount, 0);
                continue;
            }
            // A gas cap prevents one reverting/gas-burning recipient from
            // exhausting the entire transaction in ordinary circumstances.
            // Transaction-wide out-of-gas can still revert every operation.
            (bool success, ) = payment.recipient.call{
                value: payment.amount,
                gas: PAYMENT_CALL_GAS
            }("");
            if (success) unspent -= payment.amount;
            emit TransferResult(msg.sender, payment.recipient, i, payment.amount, success ? 2 : 1);
        }
        if (unspent != 0) {
            (bool returned, ) = payable(msg.sender).call{
                value: unspent,
                gas: PAYMENT_CALL_GAS
            }("");
            if (!returned) {
                pendingRefunds[msg.sender] += unspent;
                emit RefundCredited(msg.sender, unspent);
            }
        }
    }

    /// @notice Recover funds when a contract caller rejected the automatic refund.
    /// @dev Checks-effects-interactions: failed withdrawal restores the credit.
    function withdrawRefund() external {
        uint256 amount = pendingRefunds[msg.sender];
        if (amount == 0) return;
        pendingRefunds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert RefundFailed();
        emit RefundWithdrawn(msg.sender, amount);
    }
}
