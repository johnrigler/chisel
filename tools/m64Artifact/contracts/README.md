# M64 Dictionary Contracts

The first contract is `M64Dictionary.sol`, a permissionless append-only JavaScript vocabulary for M64 v3.

There is deliberately no owner/admin path and no way to edit, delete, or renumber terms. Anyone can pay gas to append a term. Duplicate additions reuse the existing ID.

See [`../POLYGON_DICTIONARY.md`](../POLYGON_DICTIONARY.md) for the resolver identity, browser provider, CI compile gate, deployment sequence, and first live experiment.

`M64Dictionary.abi.json` is the hand-auditable interface description. GitHub Actions also compiles the Solidity source with pinned `solc@0.8.30` and uploads ABI/bytecode as the `m64-dictionary-solc` workflow artifact. The compiled bytecode should be captured into Chisel before the normal wallet deployment UI is enabled.
