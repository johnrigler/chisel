// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title M64Dictionary
/// @notice Permissionless, append-only vocabulary for Chisel M64 artifacts.
/// @dev There is deliberately no owner, administrator, edit, or delete path.
contract M64Dictionary {
    uint256 private constant NOT_FOUND = type(uint256).max;

    string[] private terms;
    mapping(bytes32 => uint256) private idPlusOneByHash;

    event TermAdded(uint256 indexed id, string term, address indexed payer);

    error EmptyTerm();

    function language() external pure returns (string memory) {
        return "javascript";
    }

    function dictionaryVersion() external pure returns (uint256) {
        return 1;
    }

    function termCount() external view returns (uint256) {
        return terms.length;
    }

    function lookupTerm(uint256 id) external view returns (string memory) {
        if (id >= terms.length) return "";
        return terms[id];
    }

    function lookupId(string calldata term) external view returns (uint256) {
        uint256 n = idPlusOneByHash[keccak256(bytes(term))];
        return n == 0 ? NOT_FOUND : n - 1;
    }

    function addTerm(string calldata term) external returns (uint256 id) {
        return _addTerm(term);
    }

    function addTerms(string[] calldata batch) external returns (uint256[] memory ids) {
        ids = new uint256[](batch.length);
        for (uint256 i = 0; i < batch.length; i++) {
            ids[i] = _addTerm(batch[i]);
        }
    }

    function _addTerm(string memory term) internal returns (uint256 id) {
        if (bytes(term).length == 0) revert EmptyTerm();

        bytes32 key = keccak256(bytes(term));
        uint256 n = idPlusOneByHash[key];
        if (n != 0) return n - 1;

        id = terms.length;
        terms.push(term);
        idPlusOneByHash[key] = id + 1;
        emit TermAdded(id, term, msg.sender);
    }
}
