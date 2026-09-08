# Chisel: Next Development Sequence

Status: active development roadmap, updated 2026-09-08.

This is the durable order of operations for the next Chisel work. The goal is to keep Chisel useful while turning M64 from an experimental compression feature into a stable recovery substrate without turning any one ledger or carrier into a required platform.

## Current baseline

- Portal public reads are intended to survive without fileProxy. Static/bundled/public ledger sources are the public runtime path; fileProxy remains a local write/import/SQLite helper.
- A small GitHub Actions regression floor is active. Do not broadly refactor signing, serialization, fee selection, UTXO selection, or broadcast until representative transaction fixtures exist.
- M64 v2 remains supported for the existing workbench/hydrator.
- M64 v3 now has an executable schema, external dictionary references, canonical byte count and SHA-256 integrity metadata.
- `js-canonical-v1` is an explicit conservative JavaScript adapter. It rejects syntax the old mini-canonicalizer cannot safely handle instead of silently changing it.
- `m64.dictionary.js` defines a transport-neutral resolver and append-only in-memory reference provider.
- `m64.v3.js` proves JavaScript -> canonical source -> dictionary IDs -> M64 -> v3 artifact -> hydrate -> byte/hash verification, including Dark Star.
- The first Polygon/EVM resolver provider and permissionless append-only Solidity dictionary are implemented. The same contract now also exposes a generic indexed Packet event/log carrier with opaque bytes. No real Polygon deployment has occurred yet.
- Chisel's carrier rule is now explicit: MacDougall/UTXO encodings, EVM state/logs/calldata, IPFS, Ravencoin-style metadata, HTTP/static files, and future adapters are peer publication surfaces. Artifacts should not depend on the carrier that happened to publish them.

## 1. Regression floor

Status: first tranche implemented and running in GitHub Actions.

Covered now:

- M64 byte encode/decode round trip;
- stage/hydrate equality;
- dictionary indexes above 63;
- external dictionary resolution;
- malformed/reserved encoding rejection;
- v2/v3 artifact validation;
- JavaScript adapter safety, including Dark Star;
- append-only in-memory dictionary behavior;
- end-to-end v3 publish/hydrate/integrity;
- EVM resolver behavior and duplicate-term reuse;
- Solidity dictionary and generic Packet carrier surface checks;
- pinned Solidity compilation;
- captured deployment-bytecode equality against fresh compiler output;
- browser inline-script syntax checks, including the packet console;
- fileProxy Python syntax checks.

Still add incrementally:

- WIF -> known address for each supported UTXO chain;
- known raw transaction -> deterministic decode;
- known inputs -> deterministic signed raw transaction;
- MacDougall/unspendable generation;
- one provider-normalization fixture per supported chain;
- Portal static dataset normalization/merge fixtures.

Safety rule: do not perform broad transaction-core rewrites before those fixtures exist.

## 2. M64 v3 protocol

Status: client protocol loop implemented; first real shared dictionary deployment pending.

Current artifact shape:

```json
{
  "kind": "chisel-m64-artifact",
  "version": 3,
  "language": "javascript",
  "languageVersion": "es2026",
  "codec": "m64-dict-v1",
  "canonicalizer": "js-canonical-v1",
  "dictionary": {
    "kind": "ledger-dictionary",
    "ref": "eip155:137:0x...",
    "version": 1,
    "language": "javascript"
  },
  "runtime": "CHISEL-PURE1",
  "entry": "a",
  "payload": "<M64>",
  "canonicalBytes": 0,
  "sha256": "<64 lowercase hex characters>"
}
```

`m64-dict-v1` fixes the transport alphabet to:

```text
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

Protocol boundaries to preserve:

- dictionary identity says which shared vocabulary an artifact uses;
- artifact `languageVersion` and `canonicalizer` belong to the artifact, not the dictionary contract;
- M64 transport remains independent of JavaScript, Polygon, ethers, IPFS, MacDougall, Ravencoin, or any one provider;
- legacy v2 validation/hydration stays separate until explicitly migrated.

## 3. JavaScript adapter

Status: explicit safe-subset boundary implemented.

`m64.javascript.js` exposes:

```text
inspectJavascriptV1(source)
canonicalizeJavascriptV1(source, identifierMap)
JS_CANONICAL_V1.id
```

`js-canonical-v1` accepts the current Dark Star source and ordinary division. It rejects template literals, regex literals/ambiguous slash positions, unterminated strings/comments, and unbalanced parentheses discovered by preflight.

Do not widen this adapter casually. Every newly accepted lexical form needs regression fixtures showing that canonicalization does not silently alter it.

Future physical extraction may continue toward:

```text
m64.core.js          byte transport and varuint references
m64.dictionary.js    resolver semantics
m64.javascript.js    JavaScript source adapter
m64.artifact.js      artifact validation/integrity fields
m64.v3.js            v3 publish/hydrate orchestration
m64.js               compatibility facade
```

Preserve `ChiselM64` compatibility while moving internals.

## 4. Shared ledger dictionary and generic packet log

Status: client resolver, in-memory provider, Polygon/EVM provider, Solidity contract, CI compile, captured bytecode, deployment UI, and generic Packet log surface implemented. First on-chain deployment is the next external action.

Resolver API:

```text
describe()
idForTerm(term)
termForId(id)
ensureTerm(term)
ensureTerms(terms[])
```

Polygon dictionary API:

```text
language()
dictionaryVersion()
termCount()
lookupTerm(id)
lookupId(term)
addTerm(term)
addTerms(terms[])
```

Generic event carrier:

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

Contract invariants:

- permissionless writes;
- append-only stable dictionary IDs;
- no owner/admin path;
- no edit, delete, or renumber operation;
- duplicate dictionary terms reuse the existing ID;
- empty dictionary terms rejected;
- batch dictionary insertion supported;
- Packet payload bytes live only in EVM log history, not contract storage;
- namespace/objectId/part are generic searchable routing fields;
- the contract assigns no meaning to M64, thunderwords, CIDs, JavaScript, or other packet conventions;
- M64 logic remains client-side.

Polygon dictionary identity is:

```text
eip155:137:0x<contract-address>
```

Operational files:

- `tools/m64Artifact/contracts/M64Dictionary.sol`
- `tools/m64Artifact/contracts/M64Dictionary.compiled.json`
- `tools/m64Artifact/m64.dictionary.evm.js`
- `tools/m64Artifact/deploy-dictionary-polygon.html`
- `tools/m64Artifact/dictionary-polygon.html`
- `tools/m64Artifact/packet-polygon.html`
- `tools/m64Artifact/POLYGON_DICTIONARY.md`
- `tools/m64Artifact/CARRIER_MODEL.md`

The normal deployment path must use the captured CI-tested bytecode. Do not switch to an ad-hoc Remix/browser compilation as the canonical path.

## 5. Carrier-neutral publication and bootstrap reader

Status: architecture recorded; generic EVM log carrier implemented; bootstrap reader remains a next-stage tool.

Thunderwords are conventions, not storage types. A recognizable `0x1111...`-style marker may be used as an EVM namespace topic, an object/stream identifier, text in an IPFS manifest, a MacDougall convention, or another locator. Chisel may provide convenience helpers, but it should not require one placement.

A future bootstrap reader should be deliberately small ASCII/minified JavaScript whose job is only:

```text
recognize locator
  -> read carrier
  -> resolve dictionary if needed
  -> decode M64
  -> verify integrity
  -> return artifact
```

That bootstrap can itself be replicated across many carriers. The useful property is recoverability without a privileged hosted service, not loyalty to a particular ledger.

## 6. Immediate live experiment

After this pre-deployment carrier patch is merged, the next user action is one wallet-signed Polygon deployment from `deploy-dictionary-polygon.html`.

After deployment:

1. record the returned `eip155:137:<address>` descriptor;
2. verify `language() == "javascript"`, dictionary version 1, and initial term count 0;
3. add a small seed vocabulary through the dictionary console;
4. publish a tiny Packet under a chosen namespace/object ID and read it back through `packet-polygon.html`;
5. build a small v3 JavaScript artifact against the live resolver;
6. hydrate it from the live contract and verify `canonicalBytes` and SHA-256;
7. publish/reference that artifact through one or more carriers;
8. use `elliptic` or a selected browser subset as the second serious reconstruction test;
9. continue with Dark Star and selected Chisel modules;
10. retain deployment tx, block, contract address, gas used, packet gas, and seed-write gas as measurement data.

No production vocabulary needs curation. If strangers add terms later, Chisel may simply reuse those IDs. They cannot change the meaning of existing IDs. Unknown packet namespaces can simply be ignored by readers that do not understand them.

## 7. Measure compression and ledger cost

Status: immediately after the first live dictionary/packet carrier is deployed.

Produce repeatable reports containing:

```text
original source bytes
canonical source bytes
abstract dictionary-stream bytes
M64 characters / UTF-8 bytes
v2 embedded dictionary bytes
v3 artifact bytes
new dictionary terms added
reused dictionary terms
packet/chunk count
packet payload bytes
ledger calldata/log bytes
dictionary gas used
packet/artifact publish gas/cost
hydration equality/hash
```

Corpus:

- small ordinary JavaScript function;
- `elliptic` browser build or selected reconstructable subset;
- Dark Star raster renderer;
- MIDI generator;
- image/pattern generator;
- selected Chisel modules;
- eventually the smallest recoverable Chisel subset.

The important metric is the marginal cost of a new program after most vocabulary already exists on-ledger, not merely whether M64 beats gzip.

## 8. Recursive Chisel rebuild

Do not encode the whole repository first.

Milestones:

1. identify the smallest subset that can locate one ledger/carrier artifact and hydrate M64;
2. represent that subset through the dictionary/carrier model;
3. reconstruct it without loading the original source files;
4. use the reconstructed subset to retrieve a second, larger artifact;
5. reconstruct elliptic/EC primitives or another real dependency and prove useful runtime behavior;
6. repeat toward the intended Chisel tool tree;
7. reconstruct a canonical directory/tree;
8. compare a recorded tree hash and later a deterministic IPFS/CAR root CID.

Success changes M64 from compact storage into part of Chisel's recovery substrate.

## Technical debt policy

Ordinary Chisel debt still includes browser-global integration, large UI controllers, legacy pages, provider duplication, compatibility entry points, and satellite tools. Do not make cleanup an end in itself.

Refactor when:

- debt blocks a roadmap milestone;
- a regression fixture makes the extraction safe;
- duplication caused a concrete failure;
- a public runtime dependency can be removed; or
- a compatibility boundary can be preserved while internals simplify.

Otherwise prefer the protocol milestone over aesthetic restructuring.

## Immediate next code after first deployment

Build the repeatable compression/gas report and a live-v3 publish/hydrate page using the deployed dictionary descriptor. Then add the tiny carrier-aware bootstrap reader and exercise a real dependency such as elliptic before attempting a much larger recursive Chisel rebuild.

## Related documents

- `tools/m64Artifact/CARRIER_MODEL.md` - carrier-neutral publication, thunderwords, bootstrap reader, and elliptic reconstruction direction.
- `tools/m64Artifact/POLYGON_DICTIONARY.md` - EVM dictionary and generic packet/log implementation.
- `tools/m64Artifact/LEDGER_IPFS_ARCHITECTURE.md` - ledger/dictionary/IPFS architecture notes.
- `tools/m64Artifact/SELF_REBUILD.md` - staged recursive recovery direction.
- `docs/refactor-phases.md` - conservative general refactor sequence.
- `REFACTOR-MAP.md` - executable-source dependency/refactor inventory.
