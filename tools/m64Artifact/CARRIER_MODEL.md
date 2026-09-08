# Chisel carrier model

Chisel should disappear into the background.

The library does not define one correct publication destination. It defines artifacts, locators, codecs, readers, and signing/reconstruction tools that can move across whatever carrier a publisher chooses.

## One artifact, many carriers

A publisher may place or reference the same artifact through any combination of:

- MacDougall / UTXO encodings;
- EVM contract state;
- EVM transaction calldata;
- EVM event logs;
- IPFS / CID references;
- Ravencoin-style metadata fields;
- ordinary HTTP/static files;
- future ledger- or application-specific adapters.

These are peer carriers. Chisel should not silently privilege one as canonical merely because one implementation happened first.

The common model is:

```text
artifact
  -> canonical bytes
  -> optional shared dictionary references
  -> M64 or another declared transport
  -> locator / carrier adapter
  -> verification / hydration
```

## Thunderwords are conventions, not storage types

A thunderword is a recognizable namespace, marker, entry point, or locator convention. It is not itself required to be the payload container.

For example, an `0x1111...`-style value may be used as:

- an EVM indexed namespace topic;
- an object or stream identifier;
- text inside an IPFS manifest;
- a MacDougall/UTXO convention;
- a cross-ledger reference;
- or simply a human-visible marker understood by one community.

Chisel should expose helpers for these conventions without assuming every publisher uses them in the same field or on the same ledger.

## Generic EVM packet carrier

`M64Dictionary.sol` now includes a log-only publication surface:

```solidity
event Packet(
    bytes32 indexed namespace,
    bytes32 indexed objectId,
    uint256 indexed part,
    address publisher,
    bytes data
);
```

and:

```solidity
publishPacket(namespace, objectId, part, data)
```

The three routing values are indexed EVM log topics. `data` is opaque bytes. The contract does not store packet bytes in state and does not assign meaning to any field.

This permits a publisher to place M64, minified JavaScript, a manifest, a CID, binary data, or an unknown future format into the event history without changing the contract.

The browser tool `packet-polygon.html` can publish and query these packets against a deployed dictionary contract.

## Bootstrap readers

A future bootstrap reader should be deliberately small ASCII/minified JavaScript whose responsibility is only:

```text
recognize locator
  -> read carrier
  -> resolve dictionary if needed
  -> decode transport
  -> verify integrity
  -> return artifact
```

That reader can itself be replicated across many carriers. The important property is not where the bootstrap lives; it is that enough copies and enough carrier adapters exist to reconstruct the next layer without a privileged server.

## Elliptic as the second serious reconstruction test

After the tiny live Polygon/M64 proof, a useful next artifact is the browser JavaScript `elliptic` dependency or a deliberately selected subset of it.

That test is more meaningful than another toy payload because it exercises a real cryptographic dependency and creates a path toward recursive recovery:

```text
tiny bootstrap
  -> locate M64 artifact
  -> resolve shared dictionary
  -> rebuild elliptic / EC primitives
  -> gain signing capability
  -> rebuild more Chisel
```

The test should measure byte identity, usable runtime behavior, new versus reused dictionary vocabulary, packet/chunk counts, and marginal ledger cost.

## Design rule

Carrier adapters may know their ledger. Artifacts should not.

EVM code should know EVM logs and calldata. A Ravencoin adapter may know Ravencoin metadata. A MacDougall adapter may know UTXO/address conventions. M64 remains a transport and reconstruction protocol above those choices.
