# Hardhat compatibility path

Canonical M64 source: [Solidity/M64Dictionary.sol](../../../Solidity/M64Dictionary.sol).

`M64Dictionary.sol` in this directory is a Git symbolic link to that
source. It is used only by the optional Hardhat developer workspace so its
original logical Solidity source identifier stays compatible with the
existing, verified M64 bytecode.

The ABI, compiled deployment artifact, and documentation live at:

- [Solidity/compiled/M64Dictionary.json](../../../Solidity/compiled/M64Dictionary.json)
- [Solidity/compiled/M64Dictionary.abi.json](../../../Solidity/compiled/M64Dictionary.abi.json)
- [Solidity/M64Dictionary.md](../../../Solidity/M64Dictionary.md)

Browser tools load these shared files directly; no duplicated compiled
output is maintained inside `tools/m64Artifact/contracts/`.
