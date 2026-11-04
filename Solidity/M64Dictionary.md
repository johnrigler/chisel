# M64 Dictionary Contracts

The first contract is `M64Dictionary.sol`, a permissionless append-only JavaScript vocabulary for M64 v3 plus a generic log-only packet carrier.

There is deliberately no owner/admin path and no way to edit, delete, or renumber terms. Anyone can pay gas to append a term. Duplicate additions reuse the existing ID.

The contract also exposes `publishPacket(namespace, objectId, part, data)`, which emits a `Packet` event with three caller-selected indexed routing fields and opaque bytes. Packet payloads are not written to contract storage and the contract assigns no meaning to thunderwords, M64, CIDs, JavaScript, or any other packet convention.

See [`../POLYGON_DICTIONARY.md`](../POLYGON_DICTIONARY.md) for the resolver identity, packet/log surface, browser tools, deployment verification, and first live experiment. See [`../CARRIER_MODEL.md`](../CARRIER_MODEL.md) for the carrier-neutral Chisel model and [`../HARDHAT.md`](../HARDHAT.md) for Hardhat development and deployment.

Files:

- `M64Dictionary.sol` - canonical Solidity source.
- `M64Dictionary.abi.json` - small hand-auditable interface description.
- `M64Dictionary.compiled.json` - exact metadata-free Hardhat/solc creation bytecode captured for browser deployment, including source/compiler/workflow/hash provenance.

The deployment compiler is Hardhat 3.16.0 with Solidity 0.8.30 and `metadata.appendCBOR=false`. CI independently compiles the same source with the pinned `solc` Standard JSON interface and requires exact creation/runtime bytecode equality. CI then requires the captured browser creation bytecode to equal the Hardhat creation bytecode exactly.

Current creation bytecode is 4,002 bytes with decoded SHA-256:

```text
f55001c8e085674028643483943f42363d913d172b328f7d10dc175d3419e051
```

`deploy-dictionary-polygon.html` verifies that captured decoded-byte SHA-256 in the browser before enabling its wallet deployment button. Hardhat Ignition provides the standard CLI deployment route. Neither route requires a different Solidity source or a separately maintained contract copy.
