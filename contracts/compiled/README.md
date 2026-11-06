# EVM deployment artifacts

This directory contains browser-loadable compiled Solidity artifacts.

- `Chisel.json`: generated from `contracts/Chisel.sol` with `python3 contracts/build-solidity.py Chisel.sol` (legacy `build-chisel.py` remains supported); pinned solc CI publishes updates. Chisel has a deployer-supplied Polygon 137 address, with verification separate.
- `M64Dictionary.json`: captured Hardhat 3.16.0 / solc 0.8.30 creation bytecode and full ABI for the separate `contracts/M64Dictionary.sol`; 4,002-byte creation-code SHA-256 `f55001c8e085674028643483943f42363d913d172b328f7d10dc175d3419e051`.
- `M64Dictionary.abi.json`: human-auditable interface including the `Packet` event.

M64's `sourcePath` and `compiledFromCommit` fields preserve **historical provenance** from the original `tools/m64Artifact/contracts/` location, while `canonicalSourcePath` gives the new source path. The bytecode is copied unchanged, not silently recompiled. CI checks Hardhat (using a generated, git-ignored source copy), standalone solc, captured creation code and runtime hashes.

Use [EVM Contract Factory](../../tools/evmFactory/index.html) to review and optionally deploy from static/IPFS hosting. **No M64 contract address is registered or assumed.** All deployments require explicit wallet approval and independent receipt/code checks. No private keys or secrets belong here.

To compile a new source in `contracts/`, run `python3 contracts/build-solidity.py <Name>.sol`; the default artifact path is `contracts/compiled/<Name>.json`. Use `--contract` when the contract declaration differs from the filename. `--check` validates without rewriting. The existing M64Dictionary.json is a provenance-preserving historical artifact, not a guarantee that rebuilding with different solc settings yields the same bytes.
