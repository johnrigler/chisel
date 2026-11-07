// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title M64SymbolDictionary
/// @notice Immutable 62-symbol primary table and append-only packed six-bit
///         secondary definitions. Each deployment describes one data profile.
/// @dev No JSON, bytecode interpreter, user-account storage, or publication
///      carrier. No owner or administrator can change assigned symbol IDs.
///      Symbols 62 and 63 are codec escapes, not user-defined entries.
contract M64SymbolDictionary {
    uint8 public constant ASCII_ESCAPE = 62; // A raw byte follows as two 6-bit symbols.
    uint8 public constant SECONDARY_ESCAPE = 63; // A base-32 varuint index follows.
    uint32 public constant codecVersion = 1;
    uint32 public constant dictionaryVersion = 1;
    uint32 public constant MAX_DEFINITION_SYMBOLS = 4096;

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

    string public mediaType;
    string public description;
    bytes32 public immutable primaryDigest;
    // This hash changes only when a NEW secondary entry is appended.
    // Pin primaryDigest and any referenced entry's immutable ID if stability
    // across future appends matters; this aggregate digest is informational.
    bytes32 public definitionDigest;

    bytes[] private _primary;
    struct Secondary {
        bytes packed;
        uint32 symbolCount;
    }
    Secondary[] private _secondary;
    mapping(bytes32 => uint256) private _secondaryIdPlusOne;

    event SecondaryAdded(
        uint256 indexed id,
        uint32 symbolCount,
        bytes32 indexed entryDigest,
        address indexed payer
    );

    constructor(
        string memory mediaType_,
        string memory description_,
        bytes[] memory primary_,
        bytes[] memory initialPacked_,
        uint32[] memory initialCounts_
    ) {
        if (bytes(mediaType_).length == 0 || bytes(description_).length == 0) {
            revert EmptyMetadata();
        }
        if (primary_.length != 62) revert WrongPrimaryCount(primary_.length);
        if (initialPacked_.length != initialCounts_.length) revert LengthMismatch();

        mediaType = mediaType_;
        description = description_;
        for (uint256 i = 0; i < 62; i++) {
            if (primary_[i].length == 0) revert EmptyPrimary(i);
            _primary.push(primary_[i]);
        }
        primaryDigest = keccak256(abi.encode(primary_));
        definitionDigest = primaryDigest;
        for (uint256 i = 0; i < initialPacked_.length; i++) {
            _appendSecondary(initialPacked_[i], initialCounts_[i]);
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

    function primary(uint256 id) external view returns (bytes memory) {
        if (id >= 62) revert InvalidPrimaryIndex(id);
        return _primary[id];
    }

    /// @notice ABI provides packed.length; symbolCount disambiguates pad bits.
    function secondary(uint256 id) external view returns (bytes memory packed, uint32 symbolCount) {
        if (id >= _secondary.length) revert InvalidSecondaryIndex(id);
        Secondary storage entry = _secondary[id];
        return (entry.packed, entry.symbolCount);
    }

    /// @notice A duplicate definition returns its original ID without a state write.
    function addSecondary(bytes calldata packed, uint32 symbolCount) external returns (uint256) {
        return _appendSecondary(packed, symbolCount);
    }

    function addSecondaryBatch(
        bytes[] calldata packed,
        uint32[] calldata symbolCounts
    ) external returns (uint256[] memory ids) {
        if (packed.length != symbolCounts.length) revert LengthMismatch();
        ids = new uint256[](packed.length);
        for (uint256 i = 0; i < packed.length; i++) {
            ids[i] = _appendSecondary(packed[i], symbolCounts[i]);
        }
    }

    function _appendSecondary(bytes memory packed, uint32 count) private returns (uint256 id) {
        if (count == 0 || count > MAX_DEFINITION_SYMBOLS) revert InvalidSymbolCount();
        uint256 expected = (uint256(count) * 6 + 7) / 8;
        if (packed.length != expected) revert InvalidSymbolCount();
        uint256 unused = expected * 8 - uint256(count) * 6;
        if (unused != 0 && (uint8(packed[expected - 1]) & uint8((1 << unused) - 1)) != 0) {
            revert InvalidPadding();
        }
        _validatePacked(packed, count);

        bytes32 digest = keccak256(abi.encode(count, packed));
        uint256 existing = _secondaryIdPlusOne[digest];
        if (existing != 0) return existing - 1;

        id = _secondary.length;
        _secondary.push(Secondary({packed: packed, symbolCount: count}));
        _secondaryIdPlusOne[digest] = id + 1;
        definitionDigest = keccak256(abi.encode(definitionDigest, digest));
        emit SecondaryAdded(id, count, digest, msg.sender);
    }

    /// @dev Validate every escape. References MUST point to entries already
    ///      stored, making a directed cycle impossible by construction.
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
