// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title M64SymbolDictionary
/// @notice One M64 format profile: 62 immutable primary definitions, two
///         six-bit escape opcodes, and an append-only typed reference table.
/// @dev A dictionary is NOT an ERC token. No ownership, balances, or transfer
///      methods. All binary definitions are native bytes, never JSON envelopes.
///      No external contract is invoked as part of decoding.
contract M64SymbolDictionary {
    uint8 public constant ASCII_ESCAPE = 62;
    uint8 public constant SECONDARY_ESCAPE = 63;
    uint8 public constant ENTRY_PACKED_M64 = 0;
    uint8 public constant ENTRY_RAW_BYTES = 1;
    // Protocol v2 retains six-bit opcodes; typed secondary entries require
    // v2-aware readers so a raw-byte entry cannot be mistaken for packed M64.
    uint32 public constant codecVersion = 2;
    uint32 public constant dictionaryVersion = 1;
    uint32 public constant MAX_DEFINITION_SYMBOLS = 4096;
    uint32 public constant MAX_RAW_ENTRY_BYTES = 4096;

    error WrongPrimaryCount(uint256 got);
    error EmptyMetadata();
    error EmptyPrimary(uint256 index);
    error LengthMismatch();
    error InvalidSymbolCount();
    error InvalidPadding();
    error TruncatedLiteral();
    error InvalidLiteral(uint256 value);
    error TruncatedIndex();
    error OversizedIndex();
    error ForwardSecondaryReference(uint256 index);
    error InvalidPrimaryIndex(uint256 index);
    error InvalidSecondaryIndex(uint256 index);
    error WrongEntryKind(uint256 index);
    error EmptyRawEntry();
    error OversizedRawEntry();
    error InvalidContractReference();

    // Familiar, externally queryable metadata without implementing ERC-20/721.
    string public name;
    string public symbol;
    string public language;
    string public mediaType;
    string public description;

    bytes32 public immutable primaryDigest;
    bytes32 public definitionDigest;
    // Snapshots let a reader pin exactly the dictionary prefix used at publish
    // time even if more entries are added in future.
    mapping(uint256 => bytes32) public digestAtCount;

    bytes[] private _primary;
    struct Entry {
        uint8 kind;
        uint32 symbolCount; // 0 for RAW_BYTES; positive for PACKED_M64
        bytes data;
    }
    Entry[] private _secondary;
    mapping(bytes32 => uint256) private _entryIdPlusOne;

    // Informational inter-contract links. They do NOT automatically alter the
    // M64 decoding table. A reader must explicitly select and verify a target.
    struct Reference {
        uint256 chainId;
        address target;
        bytes32 role;
        bytes32 expectedDigest;
    }
    Reference[] private _references;
    mapping(bytes32 => uint256) private _referenceIdPlusOne;

    event SecondaryAdded(
        uint256 indexed id,
        uint32 symbolCount,
        bytes32 indexed entryDigest,
        address indexed payer
    );
    event EntryAdded(
        uint256 indexed id,
        uint8 kind,
        bytes32 indexed entryDigest,
        address indexed payer
    );
    event ReferenceAdded(
        uint256 indexed id,
        uint256 indexed chainId,
        address indexed target,
        bytes32 role,
        bytes32 expectedDigest
    );

    constructor(
        string memory name_,
        string memory symbol_,
        string memory language_,
        string memory mediaType_,
        string memory description_,
        bytes[] memory primary_,
        bytes[] memory initialPacked_,
        uint32[] memory initialCounts_
    ) {
        if (
            bytes(name_).length == 0 || bytes(symbol_).length == 0 ||
            bytes(language_).length == 0 || bytes(mediaType_).length == 0 ||
            bytes(description_).length == 0
        ) revert EmptyMetadata();
        if (primary_.length != 62) revert WrongPrimaryCount(primary_.length);
        if (initialPacked_.length != initialCounts_.length) revert LengthMismatch();

        name = name_;
        symbol = symbol_;
        language = language_;
        mediaType = mediaType_;
        description = description_;
        for (uint256 i = 0; i < 62; i++) {
            if (primary_[i].length == 0) revert EmptyPrimary(i);
            _primary.push(primary_[i]);
        }
        primaryDigest = keccak256(abi.encode(primary_));
        definitionDigest = primaryDigest;
        digestAtCount[0] = primaryDigest;
        for (uint256 i = 0; i < initialPacked_.length; i++) {
            _appendPacked(initialPacked_[i], initialCounts_[i]);
        }
    }

    function descriptor() external view returns (
        string memory contentType,
        string memory purpose,
        uint32 codec,
        uint32 version,
        bytes32 initialDigest,
        bytes32 currentDigest
    ) {
        return (mediaType, description, codecVersion, dictionaryVersion,
                primaryDigest, definitionDigest);
    }

    function primaryCount() external pure returns (uint256) { return 62; }
    function secondaryCount() external view returns (uint256) { return _secondary.length; }
    function referenceCount() external view returns (uint256) { return _references.length; }

    function primary(uint256 id) external view returns (bytes memory) {
        if (id >= 62) revert InvalidPrimaryIndex(id);
        return _primary[id];
    }

    /// @notice Existing packed-M64 read surface; fails closed on typed raw entries.
    function secondary(uint256 id) external view returns (bytes memory packed, uint32 symbolCount) {
        if (id >= _secondary.length) revert InvalidSecondaryIndex(id);
        Entry storage e = _secondary[id];
        if (e.kind != ENTRY_PACKED_M64) revert WrongEntryKind(id);
        return (e.data, e.symbolCount);
    }

    /// @notice Typed view suitable for packed M64 and reusable raw-byte entries.
    function entry(uint256 id) external view returns (uint8 kind, bytes memory data, uint32 symbolCount) {
        if (id >= _secondary.length) revert InvalidSecondaryIndex(id);
        Entry storage e = _secondary[id];
        return (e.kind, e.data, e.symbolCount);
    }

    function referenceAt(uint256 id) external view returns (
        uint256 chainId, address target, bytes32 role, bytes32 expectedDigest
    ) {
        if (id >= _references.length) revert InvalidContractReference();
        Reference storage link = _references[id];
        return (link.chainId, link.target, link.role, link.expectedDigest);
    }

    /// @notice Permissionless, append-only. Exact duplicates return the old ID.
    function addSecondary(bytes calldata packed, uint32 count) external returns (uint256) {
        return _appendPacked(packed, count);
    }

    function addSecondaryBatch(bytes[] calldata packed, uint32[] calldata counts)
        external returns (uint256[] memory ids)
    {
        if (packed.length != counts.length) revert LengthMismatch();
        ids = new uint256[](packed.length);
        for (uint256 i = 0; i < packed.length; i++) ids[i] = _appendPacked(packed[i], counts[i]);
    }

    function addRaw(bytes calldata value) external returns (uint256) {
        return _appendRaw(value);
    }

    function addRawBatch(bytes[] calldata values) external returns (uint256[] memory ids) {
        ids = new uint256[](values.length);
        for (uint256 i = 0; i < values.length; i++) ids[i] = _appendRaw(values[i]);
    }

    /// @notice Informational reference only, NOT a trusted or executable import.
    /// @dev A reference may point across EVM chains. Readers must verify the
    ///      remote dictionary's digest and chain independently.
    function addReference(
        uint256 chainId, address target, bytes32 role, bytes32 expectedDigest
    ) external returns (uint256 id) {
        if (chainId == 0 || target == address(0) ||
            role == bytes32(0) || expectedDigest == bytes32(0)
        ) revert InvalidContractReference();
        bytes32 digest = keccak256(abi.encode(chainId, target, role, expectedDigest));
        uint256 existing = _referenceIdPlusOne[digest];
        if (existing != 0) return existing - 1;
        id = _references.length;
        _references.push(Reference(chainId, target, role, expectedDigest));
        _referenceIdPlusOne[digest] = id + 1;
        emit ReferenceAdded(id, chainId, target, role, expectedDigest);
    }

    function _appendPacked(bytes memory packed, uint32 count) private returns (uint256) {
        if (count == 0 || count > MAX_DEFINITION_SYMBOLS) revert InvalidSymbolCount();
        uint256 expected = (uint256(count) * 6 + 7) / 8;
        if (packed.length != expected) revert InvalidSymbolCount();
        uint256 unused = expected * 8 - uint256(count) * 6;
        if (unused != 0 && (uint8(packed[expected - 1]) & uint8((1 << unused) - 1)) != 0) {
            revert InvalidPadding();
        }
        _validatePacked(packed, count);
        return _append(ENTRY_PACKED_M64, packed, count);
    }

    function _appendRaw(bytes memory value) private returns (uint256) {
        if (value.length == 0) revert EmptyRawEntry();
        if (value.length > MAX_RAW_ENTRY_BYTES) revert OversizedRawEntry();
        return _append(ENTRY_RAW_BYTES, value, 0);
    }

    function _append(uint8 kind, bytes memory data, uint32 count) private returns (uint256 id) {
        bytes32 digest = keccak256(abi.encode(kind, count, data));
        uint256 existing = _entryIdPlusOne[digest];
        if (existing != 0) return existing - 1;

        id = _secondary.length;
        _secondary.push(Entry(kind, count, data));
        _entryIdPlusOne[digest] = id + 1;
        definitionDigest = keccak256(abi.encode(definitionDigest, digest));
        digestAtCount[id + 1] = definitionDigest;
        emit EntryAdded(id, kind, digest, msg.sender);
        if (kind == ENTRY_PACKED_M64) {
            emit SecondaryAdded(id, count, keccak256(abi.encode(count, data)), msg.sender);
        }
    }

    /// @dev Secondary references point to already stored entries, whether
    ///      packed or raw. This prohibits forward cycles by construction.
    function _validatePacked(bytes memory packed, uint32 count) private view {
        uint256 i = 0;
        while (i < count) {
            uint8 op = _symbol(packed, i);
            ++i;
            if (op < ASCII_ESCAPE) continue;
            if (op == ASCII_ESCAPE) {
                if (i + 1 >= count) revert TruncatedLiteral();
                uint256 value = (uint256(_symbol(packed, i)) << 6)
                    | uint256(_symbol(packed, i + 1));
                if (value > 255) revert InvalidLiteral(value);
                i += 2;
                continue;
            }
            uint256 index;
            uint256 digits;
            while (true) {
                if (i >= count) revert TruncatedIndex();
                if (digits == 7) revert OversizedIndex();
                uint8 digit = _symbol(packed, i);
                ++i;
                index |= uint256(digit & 31) << (5 * digits);
                ++digits;
                if ((digit & 32) == 0) break;
            }
            if (index >= _secondary.length) revert ForwardSecondaryReference(index);
        }
    }

    function _symbol(bytes memory packed, uint256 index) private pure returns (uint8) {
        uint256 bit = index * 6;
        uint256 at = bit >> 3;
        uint256 shift = bit & 7;
        uint256 window = uint256(uint8(packed[at])) << 8;
        if (at + 1 < packed.length) window |= uint8(packed[at + 1]);
        return uint8((window >> (10 - shift)) & 63);
    }
}
