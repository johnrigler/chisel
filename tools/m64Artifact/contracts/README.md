# M64 Dictionary Contracts

The first contract is `M64Dictionary.sol`, a permissionless append-only JavaScript vocabulary for M64 v3.

There is deliberately no owner/admin path and no way to edit, delete, or renumber terms. Anyone can pay gas to append a term. Duplicate additions reuse the existing ID.

See [`../POLYGON_DICTIONARY.md`](../POLYGON_DICTIONARY.md) for the resolver identity, browser provider, deployment verification, and first live experiment.

Files:

- `M64Dictionary.sol` - canonical Solidity source.
- `M64Dictionary.abi.json` - small hand-auditable interface description.
- `M64Dictionary.compiled.json` - exact CI-produced ABI and creation bytecode captured after a successful pinned `solc@0.8.30` compile, including source/CI/bytecode integrity metadata.

GitHub Actions recompiles the Solidity source and requires the fresh compiler bytecode to match `M64Dictionary.compiled.json` exactly. `deploy-dictionary-polygon.html` then verifies the captured decoded-byte SHA-256 in the browser before enabling the wallet deployment button.

The normal deployment path therefore does not require Remix or browser-side Solidity compilation. The user's wallet signs the Polygon deployment of the already tested bytecode.
