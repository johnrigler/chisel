// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title JethroV2
/// @notice A permissionless, address-scoped artifact dictionary.
/// @dev Draft for a NEW deployment. This does not modify legacy Jethro on Polygon.
///      An entry is keyed by (msg.sender, keccak256(bytes(artifact))).
///      Rewriting a key replaces only that writer's current value.
///      ArtifactMapped logs preserve the complete append-only write history.
contract JethroV2 {
    address public immutable creator;

    struct Entry {
        string body;
        uint64 revision; // Zero means this writer/key has never been written.
    }

    mapping(address => mapping(bytes32 => Entry)) private entries;

    event ArtifactMapped(
        address indexed writer,
        bytes32 indexed artifactKeyHash,
        uint64 revision,
        string artifact,
        string body
    );

    constructor() {
        // With a factory deployment, creator is the factory, not the factory's caller.
        creator = msg.sender;
    }

    /// @notice Write or update an artifact in the CALLER'S namespace.
    /// @dev Keeps the legacy mapArtifact(string,string) call signature for
    ///      a possible future Chisel deployment adapter. No owner-only gate.
    function mapArtifact(string calldata artifact, string calldata body) external {
        bytes32 artifactKeyHash = keccak256(bytes(artifact));
        Entry storage entry = entries[msg.sender][artifactKeyHash];
        entry.body = body;
        entry.revision += 1;

        emit ArtifactMapped(
            msg.sender,
            artifactKeyHash,
            entry.revision,
            artifact,
            body
        );
    }

    /// @notice Read a writer's current value by the original artifact string.
    /// @return body The latest value, including an intentionally empty value.
    /// @return revision 0 if no value was ever written by this writer for this key.
    function getArtifact(
        address writer,
        string calldata artifact
    ) external view returns (string memory body, uint64 revision) {
        Entry storage entry = entries[writer][keccak256(bytes(artifact))];
        return (entry.body, entry.revision);
    }
}
