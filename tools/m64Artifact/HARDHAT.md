# Chisel M64 with Hardhat 3

This directory is also a standalone Hardhat 3 project. The canonical Solidity remains:

```text
contracts/M64Dictionary.sol
```

There is no copied Hardhat-only contract. The browser tools, captured deployment artifact, standalone compiler check, and Hardhat all work from the same Solidity source.

## Why Hardhat is here

Chisel remains browser-first. Hardhat is the conventional Solidity workshop around the contract:

- compile and inspect Solidity using familiar EVM tooling;
- run repeatable local contract tests;
- demonstrate dictionary and Packet behavior without spending gas;
- deploy with Hardhat Ignition;
- later add verification, gas reporting, fuzzing, or other standard tooling without changing the Chisel browser protocol.

Hardhat does not become an M64 runtime dependency.

## Requirements

Use Node.js 22.13 or later.

From this directory:

```bash
npm install
npm test
```

Once `package-lock.json` is present, prefer:

```bash
npm ci
```

Useful commands:

```bash
npm run compile
npm run compile:standalone
npm test
npm run test:all
npm run demo
npm run deploy:local
```

`npm run demo` deploys to Hardhat's local simulated EVM, adds a few dictionary terms, publishes a Packet event, queries it back, and prints the result. It is intended to be presentation-friendly and spends no real funds.

## Reproducible deployment bytes

The deployment build uses Solidity 0.8.30 with the compiler CBOR metadata trailer disabled:

```text
metadata.appendCBOR = false
```

This avoids source-path/compiler-metadata differences producing different creation bytes for otherwise identical executable code. Provenance is retained explicitly in `contracts/M64Dictionary.compiled.json` instead.

CI compiles the same source two ways:

1. through Hardhat 3;
2. directly through the pinned `solc` 0.8.30 Standard JSON interface.

CI requires exact equality of both creation bytecode and runtime bytecode. It then requires the Hardhat creation bytecode to equal the bytecode captured in `contracts/M64Dictionary.compiled.json`.

The current pre-deployment capture is 4,002 creation bytes with decoded-byte SHA-256:

```text
f55001c8e085674028643483943f42363d913d172b328f7d10dc175d3419e051
```

The browser deployment page independently recomputes that hash before enabling its deployment button. The Hardhat and browser routes therefore deploy the same contract bytes rather than merely equivalent Solidity source.

## Hardhat Ignition

The deployment module is:

```text
ignition/modules/M64Dictionary.ts
```

Local deployment:

```bash
npx hardhat ignition deploy ignition/modules/M64Dictionary.ts
```

Polygon deployment:

```bash
npx hardhat ignition deploy ignition/modules/M64Dictionary.ts --network polygon
```

The Polygon network configuration reads these Hardhat configuration variables:

```text
POLYGON_RPC_URL
POLYGON_PRIVATE_KEY
```

Prefer Hardhat's keystore rather than putting a private key in shell history or source control:

```bash
npx hardhat keystore set POLYGON_RPC_URL
npx hardhat keystore set POLYGON_PRIVATE_KEY
```

Never commit a private key, `.env` secret, keystore plaintext, or funded test key to this repository.

The browser deployment page remains useful when the desired signer is an injected browser wallet. Hardhat Ignition is the CLI/developer deployment route. Both use the same captured Solidity contract semantics and the CI gate requires the browser artifact to equal the Hardhat creation bytes.

## What the tests demonstrate

`test/M64Dictionary.ts` covers the contract properties that matter to Chisel:

```text
empty dictionary metadata
stable append-only term IDs
duplicate-term reuse
permissionless writes
empty-term rejection
Packet event publication
three indexed Packet routing fields
opaque Packet byte recovery
absence of owner/admin mutation methods
```

The Packet test deliberately uses an M64-like namespace and arbitrary bytes, but the contract itself assigns no meaning to those values.

## OpenZeppelin and tokenization

OpenZeppelin is not required by `M64Dictionary.sol`. The contract has no owner, role system, ERC-20, ERC-721, or ERC-1155 behavior, so importing OpenZeppelin merely to make the project look conventional would add dependency surface without adding capability.

OpenZeppelin can be added later as a separate contract when there is a concrete economic object to represent. Plausible examples include:

- sponsorship or patronage receipts tied to an artifact/object ID;
- limited or numbered editions of a published artifact;
- prepaid service or publishing credits;
- access/service entitlements around hosted infrastructure;
- a payment wrapper that accepts an existing ERC-20 for a separately provided service.

An ERC-721 or ERC-1155 receipt/edition contract keyed to a Chisel `objectId` is a cleaner fit than forcing an ERC-20 token into the carrier itself. A publisher could also accept an existing ERC-20 without inventing a new currency.

Those mechanisms should sit beside the permissionless dictionary/Packet carrier. The core carrier should not require a Chisel token, and an optional monetization contract should not change the meaning of existing dictionary IDs or Packet history.

A token is therefore a possible adapter, not the business model and not a protocol prerequisite.

## Deployment identity

The first real Polygon deployment should still be treated as a protocol artifact. Record at minimum:

```text
contract address
chain ID
deployment transaction
block number
compiler version
creation bytecode hash
Hardhat/Ignition deployment record
starting term count
```

After that deployment, the next live experiment remains: seed a small vocabulary, publish a tiny M64 artifact, hydrate and verify it, then move to a real JavaScript dependency such as `elliptic`.
