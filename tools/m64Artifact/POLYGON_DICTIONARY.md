# M64 Polygon Dictionary and packet carrier

Status: dictionary resolver plus generic packet/log publication layer implemented; Hardhat 3 development/deployment workspace implemented; first real Polygon deployment still pending.

This contract is one durable ledger provider for the transport-neutral resolver in `m64.dictionary.js`. It also exposes a generic EVM event-log carrier, but neither M64 nor Chisel artifacts depend on Polygon.

See [`CARRIER_MODEL.md`](CARRIER_MODEL.md) for the broader rule: Chisel defines artifacts, locators, readers, and carrier adapters rather than one preferred publication destination. See [`HARDHAT.md`](HARDHAT.md) for the standard Solidity development, test, demo, and Ignition deployment workflow.

## Dictionary behavior

`contracts/M64Dictionary.sol` is intentionally permissionless and append-only.

There is no owner or administrator. There are no edit, delete, renumber, moderation, or packet-removal methods.

Anyone willing to pay Polygon gas may add a non-empty dictionary term. Existing terms keep their IDs forever. Adding a duplicate term simply reuses the existing ID, so another publisher cannot change what an old artifact means.

The dictionary surface is:

```text
language() -> "javascript"
dictionaryVersion() -> 1
termCount()
lookupTerm(id)
lookupId(term)
addTerm(term)
addTerms(terms[])
```

The missing-term sentinel for `lookupId` is `uint256.max`. Empty strings are not valid terms. `lookupTerm` returns an empty string for an out-of-range ID, which is unambiguous because empty terms cannot be inserted.

## Generic packet log

The same contract exposes a second, deliberately unrelated publication surface:

```solidity
event Packet(
    bytes32 indexed namespace,
    bytes32 indexed objectId,
    uint256 indexed part,
    address publisher,
    bytes data
);

publishPacket(namespace, objectId, part, data)
```

`namespace`, `objectId`, and `part` occupy the three user-indexed event topics. `publisher` and `data` remain in log data. The contract assigns no meaning to any of them and stores no packet bytes in contract state.

That means publishers may use the same event surface for M64, minified JavaScript, manifests, CIDs, binary chunks, thunderword-addressed streams, or formats that do not exist yet. Unknown namespaces are simply logs a reader may ignore.

`packet-polygon.html` is the browser tool for publishing and querying these events against a deployed contract.

## Thunderwords

Thunderwords are conventions rather than storage types. An `0x1111...`-style marker may be used as an indexed namespace, an object identifier, text inside a manifest, a MacDougall/UTXO convention, or another locator. Chisel should expose helpers without requiring a publisher to put the same marker in the same field on every carrier.

## Resolver identity

A deployed Polygon dictionary is represented in M64 v3 as:

```text
eip155:137:0x<contract-address>
```

Example descriptor:

```json
{
  "kind": "ledger-dictionary",
  "ref": "eip155:137:0x0000000000000000000000000000000000000001",
  "version": 1,
  "language": "javascript"
}
```

The descriptor is stored in the artifact. The contract address is therefore part of the meaning of the artifact; Chisel does not silently substitute another dictionary.

## Browser provider

`m64.dictionary.evm.js` adapts the dictionary portion of an EVM contract to the normal Chisel resolver interface:

```text
describe()
idForTerm(term)
termForId(id)
ensureTerm(term)
ensureTerms(terms[])
```

It also exposes:

```text
termCount()
inspectContract()
createEip1193Dictionary(...)
```

The browser adapter uses the vendored ethers v6 build only for ABI/RPC/signing mechanics. M64 v3 itself remains independent of ethers and Polygon.

`dictionary-polygon.html` operates the dictionary. `packet-polygon.html` operates the generic event/log carrier. `polygon.html` remains the simpler arbitrary-UTF-8 transaction-calldata carrier.

## Verified deployment artifact

The canonical development/deployment compiler path is now Hardhat 3.16.0 using Solidity 0.8.30. Solidity's appended CBOR metadata trailer is disabled so path-dependent compiler metadata cannot make the browser and Hardhat routes produce different creation bytes.

CI compiles `contracts/M64Dictionary.sol` twice with the same Solidity settings:

1. through Hardhat;
2. directly through the pinned `solc` 0.8.30 Standard JSON API.

CI requires exact equality of creation bytecode and runtime bytecode between those paths. It also requires the Hardhat creation bytecode to exactly match the committed browser deployment artifact:

```text
contracts/M64Dictionary.compiled.json
```

The current pre-deployment capture records:

```text
Hardhat: 3.16.0
Solidity: 0.8.30
CBOR metadata appended: false
creation bytecode bytes: 4002
creation SHA-256: f55001c8e085674028643483943f42363d913d172b328f7d10dc175d3419e051
runtime SHA-256: c8153c84675cdb642cf32f0cb472d8aabbacd90f984b519d74f3f477d483ab27
```

Compiler/source/workflow provenance is recorded explicitly in the captured JSON rather than being delegated to Solidity's CBOR trailer.

`deploy-dictionary-polygon.html` loads only that captured artifact, recomputes its decoded-byte SHA-256 before enabling deployment, and uses the captured ABI/bytecode with the vendored ethers `ContractFactory`.

The user should not need Remix for the normal path. Remix remains only an independent inspection/debugging option. Hardhat Ignition is the standard CLI/developer deployment path, while the browser page remains the injected-wallet path.

## First live experiment

Once a real Polygon address exists:

1. record the `eip155:137:<address>` descriptor in Chisel;
2. inspect `language`, version, and starting term count through the dictionary provider;
3. publish a small seed vocabulary;
4. publish a tiny packet under a chosen namespace/object ID and read it back from logs;
5. build a v3 artifact against the live resolver;
6. publish or reference that artifact through one or more carriers and hydrate it with byte-count/SHA-256 verification;
7. repeat with a more serious JavaScript dependency, with `elliptic` or a selected browser subset as the intended second test;
8. continue with Dark Star and selected Chisel modules;
9. measure new terms, reused terms, packet bytes/chunks, calldata/log gas, artifact bytes, and hydration equality.

The important experiment is marginal cost after vocabulary already exists. The dictionary is shared public infrastructure; the packet log is a permissionless publication tape; neither is meant to become a private Chisel database or a mandatory publishing path.
