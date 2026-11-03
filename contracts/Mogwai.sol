// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Mogwai
/// @notice Permissionless EVM artifact dictionary, log carrier, batch router, peer
///         transport and deterministic factory. Fresh deployments only.
/// @dev All authorship-sensitive dictionary keys come from msg.sender.
///      A peer's claimed original writer is NOT authenticated by this receiver.
///      Thunderword events are searchable logs, not address transfers.
contract Mogwai {
    uint8 public constant OP_ARTIFACT = 1;
    uint8 public constant OP_LOG = 2;
    uint8 public constant OP_THUNDERWORD = 3;
    uint8 public constant OP_PEER = 4;
    uint256 public constant MAX_PAYLOAD_BYTES = 24576;
    uint256 public constant MAX_ARTIFACT_KEY_BYTES = 1024;
    uint256 public constant MAX_BATCH_OPERATIONS = 32;
    bytes32 public constant PROTOCOL_ID = keccak256("CHISEL_MOGWAI_V1");

    struct Entry {
        string body;
        uint64 revision; // Zero means absent.
    }

    struct Operation {
        uint8 kind;
        bytes data; // ABI tuple determined by kind; see execute().
    }

    mapping(address => mapping(bytes32 => Entry)) private _dictionary;
    mapping(address => uint64) public writerSequence;
    mapping(address => uint64) public thunderwordCount;

    /// @dev Set in constructor for standalone instances and initialize() for clones.
    address public creator;
    bool private _initialized;

    /// @dev Immutable points to ORIGINAL full-code deployment, also under delegatecall.
    ///      This avoids creating clones of clones when children call deployChild().
    address public immutable implementation;

    event ArtifactMapped(
        address indexed writer,
        bytes32 indexed artifactKeyHash,
        uint64 revision,
        string artifact,
        string body
    );
    event RecordLogged(
        address indexed writer,
        bytes32 indexed format,
        uint64 sequence,
        bytes data
    );
    event ThunderwordPublished(
        address indexed writer,
        address indexed thunderword,
        bytes32 indexed format,
        uint64 sequence,
        bytes data
    );
    event PeerMessageSent(
        address indexed writer,
        address indexed peer,
        bytes32 indexed format,
        bytes32 dataHash
    );
    /// @dev peer == actual msg.sender; claimedWriter is untrusted peer-supplied data.
    event PeerMessageReceived(
        address indexed peer,
        address indexed claimedWriter,
        bytes32 indexed format,
        bytes data
    );
    event ChildDeployed(
        address indexed creator,
        address indexed child,
        bytes32 indexed derivedSalt,
        bytes32 userSalt
    );

    error NotInitialized();
    error AlreadyInitialized();
    error InvalidCreator();
    error InvalidArtifact();
    error PayloadTooLarge();
    error InvalidBatch();
    error UnknownOperation(uint8 kind);
    error InvalidThunderword();
    error InvalidPeer();
    error DeploymentFailed();

    modifier active() {
        if (!_initialized) revert NotInitialized();
        _;
    }

    constructor() {
        creator = msg.sender;
        implementation = address(this);
        _initialized = true;
    }

    /// @notice Called atomically by deployChild on a newly created EIP-1167 clone.
    /// @dev Standalone contracts cannot be reinitialized. Directly deployed
    ///      uninitialized third-party clones should not be treated as trusted roots.
    function initialize(address designatedCreator) external {
        if (_initialized) revert AlreadyInitialized();
        if (designatedCreator == address(0)) revert InvalidCreator();
        creator = designatedCreator;
        _initialized = true;
    }

    function mogwaiProtocol() external pure returns (bytes32) {
        return PROTOCOL_ID;
    }

    /// @notice Legacy Jethro selector, now permissionless and address-scoped.
    function mapArtifact(string calldata artifact, string calldata body) external active {
        _mapArtifact(msg.sender, artifact, body);
    }

    function getArtifact(address writer, string calldata artifact)
        external view returns (string memory body, uint64 revision)
    {
        Entry storage entry = _dictionary[writer][keccak256(bytes(artifact))];
        return (entry.body, entry.revision);
    }

    function _mapArtifact(address writer, string memory artifact, string memory body) private {
        uint256 keySize = bytes(artifact).length;
        if (keySize == 0 || keySize > MAX_ARTIFACT_KEY_BYTES) revert InvalidArtifact();
        if (bytes(body).length > MAX_PAYLOAD_BYTES) revert PayloadTooLarge();

        bytes32 keyHash = keccak256(bytes(artifact));
        Entry storage entry = _dictionary[writer][keyHash];
        entry.body = body;
        entry.revision += 1;
        emit ArtifactMapped(writer, keyHash, entry.revision, artifact, body);
    }

    function logRecord(bytes32 format, bytes calldata data) external active {
        _logRecord(msg.sender, format, data);
    }

    function _logRecord(address writer, bytes32 format, bytes memory data) private {
        if (data.length > MAX_PAYLOAD_BYTES) revert PayloadTooLarge();
        uint64 seq = ++writerSequence[writer];
        emit RecordLogged(writer, format, seq, data);
    }

    /// @notice Publish under any exact 20-byte semantic address, indexed in logs.
    /// @dev No ether/token transfer occurs; address history APIs will not discover
    ///      these by recipient. Query ThunderwordPublished topics or an indexer.
    function publishThunderword(address subject, bytes32 format, bytes calldata data)
        external active
    {
        _publishThunderword(msg.sender, subject, format, data);
    }

    function publishThunderwordText(string calldata text, bytes32 format, bytes calldata data)
        external active
    {
        _publishThunderword(msg.sender, _thunderwordAddress(text), format, data);
    }

    function _publishThunderword(
        address writer, address subject, bytes32 format, bytes memory data
    ) private {
        if (subject == address(0)) revert InvalidThunderword();
        if (data.length > MAX_PAYLOAD_BYTES) revert PayloadTooLarge();
        uint64 seq = ++writerSequence[writer];
        ++thunderwordCount[subject];
        emit ThunderwordPublished(writer, subject, format, seq, data);
    }

    /// @notice v1 text convention: 1-20 printable ASCII bytes, padded on the
    ///         right with 0x00 to exactly 20 bytes; case-sensitive, no Base58.
    /// @dev This is a semantic coordinate, NOT a provably unspendable address.
    function thunderwordAddress(string calldata text) external pure returns (address) {
        return _thunderwordAddress(text);
    }

    function _thunderwordAddress(string memory text) private pure returns (address) {
        bytes memory raw = bytes(text);
        if (raw.length == 0 || raw.length > 20) revert InvalidThunderword();
        uint160 packed;
        for (uint256 i; i < raw.length; ++i) {
            uint8 c = uint8(raw[i]);
            if (c < 0x20 || c > 0x7e) revert InvalidThunderword();
            packed = (packed << 8) | uint160(c);
        }
        return address(packed << (8 * (20 - raw.length)));
    }

    function decodeThunderword(address subject) external pure returns (string memory) {
        uint160 raw = uint160(subject);
        bytes memory characters = new bytes(20);
        uint256 len;
        bool padded;
        for (uint256 i; i < 20; ++i) {
            uint8 c = uint8(raw >> (8 * (19 - i)));
            if (c == 0) {
                padded = true;
            } else {
                if (padded || c < 0x20 || c > 0x7e) revert InvalidThunderword();
                characters[len++] = bytes1(c);
            }
        }
        if (len == 0) revert InvalidThunderword();
        assembly { mstore(characters, len) }
        return string(characters);
    }

    /// @notice Cross-contract message. The receiving peer can authenticate this
    ///         Mogwai instance, but it cannot independently authenticate writer.
    function sendToPeer(address peer, bytes32 format, bytes calldata data) external active {
        _sendToPeer(msg.sender, peer, format, data);
    }

    function _sendToPeer(address writer, address peer, bytes32 format, bytes memory data) private {
        if (peer == address(0) || peer.code.length == 0) revert InvalidPeer();
        if (data.length > MAX_PAYLOAD_BYTES) revert PayloadTooLarge();
        IMogwaiPeer(peer).receiveFromPeer(writer, format, data);
        emit PeerMessageSent(writer, peer, format, keccak256(data));
    }

    /// @notice Records authenticated calling contract and separately its claimed
    ///         origin writer. A malicious peer can forge claimedWriter.
    function receiveFromPeer(address claimedWriter, bytes32 format, bytes calldata data)
        external active
    {
        if (msg.sender.code.length == 0) revert InvalidPeer();
        if (data.length > MAX_PAYLOAD_BYTES) revert PayloadTooLarge();
        emit PeerMessageReceived(msg.sender, claimedWriter, format, data);
    }

    /// @notice Atomic, ordered batch; no arbitrary delegatecall or value transfer.
    /// @dev OP_ARTIFACT: abi.encode(string artifact,string body)
    ///      OP_LOG: abi.encode(bytes32 format,bytes data)
    ///      OP_THUNDERWORD: abi.encode(address subject,bytes32 format,bytes data)
    ///      OP_PEER: abi.encode(address peer,bytes32 format,bytes data)
    function execute(Operation[] calldata operations) external active {
        if (operations.length == 0 || operations.length > MAX_BATCH_OPERATIONS) {
            revert InvalidBatch();
        }
        for (uint256 i; i < operations.length; ++i) {
            uint8 kind = operations[i].kind;
            bytes memory encoded = operations[i].data;
            if (kind == OP_ARTIFACT) {
                (string memory artifact, string memory body) =
                    abi.decode(encoded, (string, string));
                _mapArtifact(msg.sender, artifact, body);
            } else if (kind == OP_LOG) {
                (bytes32 format, bytes memory data) = abi.decode(encoded, (bytes32, bytes));
                _logRecord(msg.sender, format, data);
            } else if (kind == OP_THUNDERWORD) {
                (address subject, bytes32 format, bytes memory data) =
                    abi.decode(encoded, (address, bytes32, bytes));
                _publishThunderword(msg.sender, subject, format, data);
            } else if (kind == OP_PEER) {
                (address peer, bytes32 format, bytes memory data) =
                    abi.decode(encoded, (address, bytes32, bytes));
                _sendToPeer(msg.sender, peer, format, data);
            } else {
                revert UnknownOperation(kind);
            }
        }
    }

    /// @dev EIP-1167 initialization code (55 bytes) pointing to immutable root.
    function _cloneCreationCode() private view returns (bytes memory) {
        return abi.encodePacked(
            hex"3d602d80600a3d3981f3",
            hex"363d3d373d3d3d363d73",
            bytes20(implementation),
            hex"5af43d82803e903d91602b57fd5bf3"
        );
    }

    /// @notice Namespace user salt by wallet, preventing cross-user collisions.
    function _salt(address author, bytes32 userSalt) private pure returns (bytes32) {
        return keccak256(abi.encode(author, userSalt));
    }

    function predictChildAddress(address author, bytes32 userSalt)
        external view returns (address)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                _salt(author, userSalt),
                keccak256(_cloneCreationCode())
            )
        );
        return address(uint160(uint256(digest)));
    }

    /// @notice Create a new Mogwai instance with the caller as creator.
    /// @dev Cloning + initialization are atomic. Children can themselves
    ///      deploy children, always using the original full-code implementation.
    function deployChild(bytes32 userSalt) external active returns (address child) {
        bytes32 derivedSalt = _salt(msg.sender, userSalt);
        bytes memory code = _cloneCreationCode();
        assembly {
            child := create2(0, add(code, 0x20), mload(code), derivedSalt)
        }
        if (child == address(0)) revert DeploymentFailed();
        Mogwai(child).initialize(msg.sender);
        emit ChildDeployed(msg.sender, child, derivedSalt, userSalt);
    }
}

interface IMogwaiPeer {
    function receiveFromPeer(
        address claimedWriter, bytes32 format, bytes calldata data
    ) external;
}
