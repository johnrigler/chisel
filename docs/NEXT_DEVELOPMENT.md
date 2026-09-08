# Chisel: Next Development Sequence

Status: active development roadmap, 2026-09-07.

This document is the durable order of operations for the next Chisel work. It is intentionally narrower than the general refactor map. The goal is to keep Chisel useful while turning M64 from an experimental compression/workbench feature into a stable recovery protocol.

## Current baseline

- Portal public reads should not require fileProxy. Static/bundled/public ledger sources are the public runtime path; fileProxy remains a local write/import/SQLite helper.
- M64 v2 already supports a 64-character transport alphabet, literal ASCII bytes, compact dictionary indexes 0..63, variable-length dictionary indexes above 63, a growing dictionary, external term/index lookup hooks, hydration, a browser workbench, and a Polygon calldata carrier.
- A first executable M64 v3 external-dictionary schema validator now lives beside the v2 codec in `tools/m64Artifact/m64.artifact.js`. It does not yet make the v2 hydrator consume v3 artifacts or deploy a live dictionary contract.
- Chisel now has a small GitHub Actions regression floor, but it still does not have enough transaction fixtures to safely refactor signing, serialization, fee selection, UTXO selection, or broadcasting.

## Order of operations

### 1. Build a small regression floor

Status: first tranche implemented and running in GitHub Actions.

Completed first tranche:

- M64 byte transport encode/decode round trip.
- M64 stage/hydrate equality.
- dictionary references above index 63.
- external dictionary lookup/hydration.
- malformed/reserved M64 byte rejection.
- current artifact-version validation boundary.
- syntax checks for the M64 codec/artifact helper, Portal static-data helper, Thunderword adapter, and fileProxy entry points.

Next fixtures to add incrementally:

- WIF -> known address for every supported UTXO chain.
- known raw transaction -> deterministic decode.
- known transaction inputs -> deterministic signed raw transaction.
- MacDougall/unspendable address generation.
- one transaction/provider normalization fixture per supported chain.
- Portal static dataset normalization and merge behavior.

Safety rule: do not perform broad rewrites of signing, fee, UTXO selection, serialization, or broadcast code before representative fixtures exist.

### 2. Freeze M64 v3 as a protocol

Status: executable draft schema started; not yet frozen as a live publishing/hydration protocol.

The next M64 problem is protocol stability, not cleverer compression.

M64 itself should remain language-neutral. A JavaScript source adapter may produce canonical bytes, but the transport and dictionary layers should not know JavaScript syntax.

The current executable v3 draft requires this field shape:

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

The v3 validator checks package/version fields, JavaScript/runtime identifiers, dictionary identity/version/language agreement, structural M64 payload validity, canonical byte count, and SHA-256 field shape. It does **not** yet prove that the referenced dictionary exists, that the payload hydrates against that dictionary, or that the supplied hash matches reconstructed canonical source. Those belong to the resolver/hydrator path.

Important distinction:

- dictionary identity says what shared vocabulary is being used;
- artifact `language` identifies the source family;
- dictionary `language` must agree with the artifact language;
- `languageVersion` and `canonicalizer` belong to the artifact, not to the dictionary contract;
- M64 transport remains independent of JavaScript, Polygon, and any one storage provider.

Keep the legacy `validateArtifact()` v2 boundary intact until the current workbench/hydrator has an explicit v3 resolver. v3 is validated separately through `validateArtifactV3()` so old UI code cannot accidentally accept an artifact it cannot hydrate.

### 3. Separate the JavaScript adapter from M64 core

The current `tools/m64Artifact/m64.js` contains both generic transport/dictionary behavior and a deliberately small JavaScript canonicalizer.

Before claiming arbitrary JavaScript source support, make this boundary explicit. A likely physical split is:

```text
m64.core.js          byte transport and varuint dictionary references
m64.dictionary.js    dictionary resolution helpers
m64.javascript.js    JavaScript canonicalization/source adapter
m64.artifact.js      v2/v3 artifact validation and integrity fields
m64.js               compatibility facade, if needed
```

`m64.artifact.js` now exists as the first extraction. Continue incrementally and preserve the `ChiselM64` compatibility API while moving internals.

The JavaScript adapter must either correctly handle modern JavaScript lexical forms (including template literals and regular-expression literals) or explicitly reject syntax it cannot safely canonicalize. Silent source corruption is unacceptable.

### 4. Implement the shared ledger dictionary

The dictionary contract should be intentionally simple. The ledger is durable vocabulary storage, not the M64 execution engine.

Conceptual operations:

```text
language()
dictionaryVersion()
termCount()
lookupTerm(id)
lookupId(term)
addTerm(term)
addTerms(terms[])
```

Requirements:

- append-only stable numeric IDs;
- no renumbering existing terms;
- deterministic lookup behavior;
- batch lookup/add support so publishing does not require one transaction/call per lexical term;
- M64 logic stays client-side;
- artifacts reference dictionary identity/version rather than embedding the complete dictionary snapshot.

Start with JavaScript as the first dictionary namespace. Other languages can have independent dictionaries later without changing M64.

### 5. Measure compression and ledger cost

Do not optimize from intuition. Produce repeatable measurements for representative artifacts.

At minimum measure:

```text
original source bytes
canonical source bytes
abstract dictionary-stream bytes
M64 characters / UTF-8 bytes
embedded dictionary bytes (v2)
external dictionary bytes charged to artifact (v3)
ledger calldata bytes
estimated/actual publish cost
hydration equality/hash
```

Corpus:

- a small ordinary JavaScript function;
- Dark Star raster renderer;
- MIDI generator;
- image/pattern generator;
- selected Chisel modules;
- eventually the smallest recoverable Chisel subset.

The important metric is not simply whether M64 beats gzip. Measure the marginal cost of describing a new program after its vocabulary already exists on the ledger.

### 6. Perform the recursive Chisel rebuild experiment

Do not encode the whole repository first.

Milestone sequence:

1. identify the smallest useful subset that can locate one ledger artifact and hydrate M64;
2. encode/reference that subset through the ledger dictionary model;
3. reconstruct it without loading the original source files;
4. use the reconstructed subset to retrieve a second, larger artifact;
5. repeat toward the intended Chisel tool tree;
6. reconstruct a canonical directory/tree;
7. compare a recorded tree hash and, later, deterministic IPFS/CAR root CID.

Success changes M64 from a compact artifact format into part of Chisel's recovery substrate.

## Technical debt policy

There is ordinary technical debt in Chisel: browser-global integration, large UI controllers, legacy pages, provider duplication, compatibility entry points, and satellite tools. Do not make cleanup an end in itself.

Refactor when one of these conditions is true:

- the debt blocks a roadmap milestone;
- a regression fixture makes the extraction safe;
- duplicated code has already caused a concrete failure;
- a public/runtime dependency can be removed;
- a compatibility boundary can be preserved while internals are simplified.

Otherwise prefer shipping the protocol milestone over aesthetic restructuring.

## Immediate next patch

Extract or wrap the JavaScript canonicalizer behind an explicit adapter boundary and add fixtures for syntax that the current mini-lexer must not silently corrupt, especially template literals and regular-expression literals. In parallel, define the resolver interface that turns a v3 `dictionary.ref` plus dictionary IDs into terms. Do not deploy a production dictionary contract until those client boundaries are testable.

## Related documents

- `docs/refactor-phases.md` - conservative general refactor sequence.
- `REFACTOR-MAP.md` - executable-source dependency/refactor inventory.
- `tools/m64Artifact/README.md` - implemented M64 mechanics.
- `tools/m64Artifact/LEDGER_IPFS_ARCHITECTURE.md` - ledger/dictionary/IPFS architecture notes.
- `tools/m64Artifact/SELF_REBUILD.md` - recursive recovery direction.
