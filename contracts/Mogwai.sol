// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Mogwai
/// @notice Minimal permissionless, writer-address-scoped artifact dictionary.
/// @dev The creator's namespace is canonical by convention, not privileged.
///      Each wallet can update only its own (writer, artifact) entries.
///      Transaction input and ArtifactMapped events retain the write history.
contract Mogwai {
    address public immutable creator;

    struct Entry {
        string body;
        uint64 revision; // Zero means no entry has been written.
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
        creator = msg.sender;
    }

    /// @notice Write to the caller's namespace. Never modifies another writer's entry.
    function mapArtifact(string calldata artifact, string calldata body) external {
        bytes32 key = keccak256(bytes(artifact));
        Entry storage entry = entries[msg.sender][key];
        entry.body = body;
        entry.revision += 1;

        emit ArtifactMapped(msg.sender, key, entry.revision, artifact, body);
    }

    /// @notice Read a writer's current artifact value and revision.
    function getArtifact(address writer, string calldata artifact)
        external
        view
        returns (string memory body, uint64 revision)
    {
        Entry storage entry = entries[writer][keccak256(bytes(artifact))];
        return (entry.body, entry.revision);
    }
}
