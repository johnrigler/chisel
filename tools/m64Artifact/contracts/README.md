# M64 Dictionary Contracts

The first contract is `M64Dictionary.sol`, a permissionless append-only JavaScript vocabulary for M64 v3 plus a generic log-only packet carrier.

There is deliberately no owner/admin path and no way to edit, delete, or renumber terms. Anyone can pay gas to append a term. Duplicate additions reuse the existing ID.

The contract also exposes `publishPacket(namespace, objectId, part, data)`, which emits a `Packet` event with three caller-selected indexed routing fields and opaque bytes. Packet payloads are not written to contract storage and the contract assigns no meaning to thunderwords, M64, CIDs, JavaScript, or any other packet convention.

See [`../POLYGON_DICTIONARY.md`](../POLYGON_DICTIONARY.md) for the resolver identity, packet/log surface, browser tools, deployment verification, and first live experiment. See [`../CARRIER_MODEL.md`](../CARRIER_MODEL.md) for the carrier-neutral Chisel model.

Files:

- `M64Dictionary.sol` - canonical Solidity source.
- `M64Dictionary.abi.json` - small hand-auditable interface description.
- `M64Dictionary.compiled.json` - exact CI-produced ABI and creation bytecode captured after a successful pinned `solc@0.8.30` compile, including source/CI/bytecode integrity metadata.

GitHub Actions recompiles the Solidity source and requires the fresh compiler bytecode to match `M64Dictionary.compiled.json` exactly. `deploy-dictionary-polygon.html` then verifies the captured decoded-byte SHA-256 in the browser before enabling the wallet deployment button.

The normal deployment path therefore does not require Remix or browser-side Solidity compilation. The user's wallet signs the Polygon deployment of the already tested bytecode.
