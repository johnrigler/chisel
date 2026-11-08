# Chisel Solidity contracts: local build and browser deployment

This directory contains the Solidity source of Chisel's EVM contracts.
**Solidity compilation happens locally** using native `solc` (Standard JSON)
and Python 3. The EVM Contract Factory does **not** compile source and no
Node.js, npm, or Hardhat runtime is required.

## Current Polygon SVG icon deployment

The SVG dictionary constructor has already been deployed on Polygon mainnet (chain 137) at `0xd78e182813cd4e964aa382d6a81f9efbb10648bd`. Read-only checks report 62 primary fragments and zero initial secondary entries. To render icons or review transactions that append the 64 compressed SVG definitions, use [the SVG icon viewer](../tools/m64Artifact/svg-icons-polygon.html). **Do not redeploy simply to add icons.** The build instructions below remain useful for other profiles and compiler/source verification.

## Files

| File | Role |
| --- | --- |
| `Chisel.sol` | General on-chain publisher, `logRecord(bytes32,bytes)` and related methods |
| `M64SymbolDictionary.sol` | Native-six-bit M64 v2 dictionary; shared Solidity implementation for separately deployed JS, SVG, etc. profiles |
| `M64Dictionary.sol` | Older v3 text-based dictionary: **different codec** |
| `JethroV2.sol` | Jethro contract |
| `build-solidity.py` | Canonical Standard JSON compiler; emits ABI, creation/runtime bytecode, and hashes |
| `build-chisel.py` | Backwards-compatible Python entry point |
| `build.sh` | Small shell wrapper around `build-solidity.py` |
| `compiled/` | Browser-loadable artifacts, one JSON per compiled contract |
| `CHISEL.md` | Details of the Chisel publisher and signing flow |

To inspect all `*.sol` source files from anywhere in your local clone:

```sh
cd ~/chisel
git pull --ff-only
bash contracts/build.sh --list
```

## Prerequisites

Verify `python3 --version` and `solc --version`. For
`M64SymbolDictionary.sol`, use a native `solc` version supporting
`pragma solidity ^0.8.24` (i.e. 0.8.24–0.8.x, not 0.9.x).
The Solidity compiler and Python must both be on your PATH, or supply
`SOLC=/path/to/solc`. The build is offline once the compiler is installed.

```sh
python3 --version
solc --version
```

## Compile the native M64 dictionary for the SVG icon profile

From the repository root:

```sh
bash contracts/build.sh M64SymbolDictionary.sol
```

With the default arguments, `bash contracts/build.sh` does the same.
Equivalently, run the underlying Python command directly:

```sh
python3 contracts/build-solidity.py M64SymbolDictionary.sol
```

The output is:

```text
contracts/compiled/M64SymbolDictionary.json
```

That file contains ABI, creation bytecode, compiled runtime bytecode,
compiler/settings and SHA-256 digests. You may check an existing build using
`bash contracts/build.sh M64SymbolDictionary.sol --check`.

To compile another source, pass its filename, for example
`bash contracts/build.sh Chisel.sol`. The wrapper compiles **one source
only** so it will not overwrite the historical M64Dictionary artifact.

## Next: EVM Contract Factory

1. Open [EVM Contract Factory](../tools/evmFactory/index.html).
2. Use **Compiler output / artifact JSON** to import
   `contracts/compiled/M64SymbolDictionary.json`.
3. Select Polygon chain **137**, then supply the constructor arguments
   in ABI order for the **SVG** profile:
   `name_`, `symbol_`, `language_`, `mediaType_`,
   `description_`, `primary_`, `initialPacked_`,
   `initialCounts_`.
4. Review the creation bytecode, constructor values, SHA-256 and gas estimate.
   Deployment is a separate, explicitly approved wallet transaction.
5. After mining, inspect `codecVersion`, `dictionaryVersion`,
   `primaryCount`, `secondaryCount`, `digestAtCount`, and actual
   dictionary definitions. Record the new Polygon address.

**Do not click "Load bundled M64 Dictionary" for the native SVG profile.**
That button loads the older `M64Dictionary.sol` artifact. Likewise,
**do not use the "Fill M64 Symbol Dictionary with Dark Star seed" button**
for SVG; it supplies JavaScript vocabulary, not icon vocabulary.

**Compilation does not populate the SVG dictionary.** The constructor
seed must be generated/reviewed independently, then supplied to the Factory.
The SVG profile has now been deployed separately from this build script; compilation alone does not prove or reproduce that deployment. The Factory offers separate SVG and Dark Star seeds; do not mix profiles.

## Operational limits and provenance

The browser Factory rejects unlinked bytecode and creation transactions
over the EIP-3860 49,152-byte initcode limit. A large SVG seed may inflate
constructor calldata or deployment gas; measure that separately. Individual
raw dictionary entries are limited to 4,096 bytes by
`M64SymbolDictionary.sol`.

The compiled artifact is source/code provenance, **not proof of deployed
behavior**. Source/profile verification and the mined receipt remain separate.
Different `solc` versions can produce different bytecode; use
`--check` to detect accidental rebuild drift. Do not commit a rebuilt
historical artifact merely because the compiler produced a different hash.
