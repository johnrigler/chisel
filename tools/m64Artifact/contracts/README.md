# M64 Solidity location
The canonical contract source, ABI, and compiled bytecode have moved out of this optional tool workspace:
- [Source](../../../contracts/M64Dictionary.sol)
- [Auditable ABI](../../../contracts/compiled/M64Dictionary.abi.json)
- [Compiled bytecode/ABI](../../../contracts/compiled/M64Dictionary.json)

M64's codec, resolver, browser deployment tools, and Hardhat tests remain under `tools/m64Artifact/`. The compiled artifact retains original compiler/build provenance and the same creation bytecode. No M64 chain deployment is asserted.
