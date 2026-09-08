# Chisel: Next Development Sequence

Status: active development roadmap, 2026-09-07.

This document is the durable order of operations for the next Chisel work. It is intentionally narrower than the general refactor map. The goal is to keep Chisel useful while turning M64 from an experimental compression/workbench feature into a stable recovery protocol.

## Current baseline

- Portal public reads should not require fileProxy. Static/bundled/public ledger sources are the public runtime path; fileProxy remains a local write/import/SQLite helper.
- M64 v2 already supports a 64-character transport alphabet, literal ASCII bytes, compact dictionary indexes 0..63, variable-length dictionary indexes above 63, a growing dictionary, external term/index lookup hooks, hydration, a browser workbench, and a Polygon calldata carrier.
- `tools/m64Artifact/m64.artifact.js` provides the executable M64 v3 external-dictionary schema boundary.
- `tools/m64Artifact/m64.javascript.js` provides an explicit conservative `js-canonical-v1` adapter. New v3 JavaScript publishing should use this boundary rather than calling the legacy mini-canonicalizer directly.
- `tools/m64Artifact/m64.dictionary.js` now defines a transport-neutral dictionary resolver interface plus an append-only in-memory reference provider.
- `tools/m64Artifact/m64.v3.js` now proves the v3 client loop end-to-end: canonicalize -> ensure dictionary terms -> M64 -> artifact -> resolve -> hydrate -> verify byte count/SHA-256.
- No production Polygon dictionary contract is deployed yet. A ledger contract should become one resolver provider, not the M64 protocol itself.
- Chisel has a small GitHub Actions regression floor, but it still does not have enough transaction fixtures to safely refactor signing, serialization, fee selection, UTXO selection, or broadcasting.

## Order of operations

### 1. Build a small regression floor

Status: first tranche implemented and running in GitHub Actions.

Completed first tranche:

- M64 byte transport encode/decode round trip.
- M64 stage/hydrate equality.
- dictionary references above index 63.
- external dictionary lookup/hydration.
- malformed/reserved M64 byte rejection.
- v2/v3 artifact validation boundaries.
- JavaScript adapter fixtures for ordinary division, template-literal rejection, regex-literal rejection, and the current Dark Star source.
- append-only in-memory dictionary resolver fixtures.
- end-to-end v3 publish/hydrate/integrity fixtures, including Dark Star.
- syntax checks for the M64 codec/artifact/JavaScript/dictionary/v3 helpers, Portal static-data helper, Thunderword adapter, and fileProxy entry points.

Next fixtures to add incrementally:

- WIF -> known address for every supported UTXO chain.
- known raw transaction -> deterministic decode.
- known transaction inputs -> deterministic signed raw transaction.
- MacDougall/unspendable address generation.
- one transaction/provider normalization fixture per supported chain.
- Portal static dataset normalization and merge behavior.

Safety rule: do not perform broad rewrites of signing, fee, UTXO selection, serialization, or broadcast code before representative fixtures exist.

### 2. Freeze M64 v3 as a protocol

Status: executable draft schema plus client hydration/integrity loop implemented; no live ledger dictionary provider yet.

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

The v3 validator checks package/version fields, JavaScript/runtime identifiers, dictionary identity/version/language agreement, structural M64 payload validity, canonical byte count, and SHA-256 field shape.

When an actual resolver is supplied, `hydrateArtifactV3()` additionally:

- requires the resolver descriptor to match the artifact dictionary reference;
- resolves dictionary IDs to terms;
- reconstructs canonical source;
- verifies `canonicalBytes`;
- recomputes and verifies SHA-256.

The remaining gap is a durable ledger-backed resolver provider and publication path. The legacy `validateArtifact()` v2 boundary stays intact so the current v2 UI does not accidentally accept a v3 artifact through the wrong hydration path.

Important distinction:

- dictionary identity says what shared vocabulary is being used;
- artifact `language` identifies the source family;
- dictionary `language` must agree with the artifact language;
- `languageVersion` and `canonicalizer` belong to the artifact, not to the dictionary contract;
- M64 transport remains independent of JavaScript, Polygon, and any one storage provider.

### 3. Separate the JavaScript adapter from M64 core

Status: first adapter boundary implemented; safe subset still intentionally incomplete.

`m64.javascript.js` exposes:

```text
inspectJavascriptV1(source)
canonicalizeJavascriptV1(source, identifierMap)
JS_CANONICAL_V1.id
```

`js-canonical-v1` is deliberately conservative. It accepts the current Dark Star staging source and ordinary division but rejects syntax that the old mini-canonicalizer can silently corrupt, including template literals and regular-expression literals/ambiguous slash positions. It also rejects unterminated strings/comments and unbalanced parentheses found by preflight.

Existing v2 workbench behavior remains unchanged. New v3 JavaScript publishing should use `canonicalizeJavascriptV1()`.

Continue the physical split incrementally:

```text
m64.core.js          byte transport and varuint dictionary references
m64.dictionary.js    dictionary resolution helpers
m64.javascript.js    JavaScript canonicalization/source adapter
m64.artifact.js      v2/v3 artifact validation and integrity fields
m64.v3.js            v3 publication/hydration orchestration
m64.js               compatibility facade, if needed
```

Preserve the `ChiselM64` compatibility API while moving internals. Do not widen `js-canonical-v1` casually. Any newly accepted JavaScript lexical form should have regression fixtures showing that canonicalization does not alter its semantics or source tokens unexpectedly.

### 4. Implement the shared ledger dictionary

Status: client resolver contract and in-memory reference provider implemented; live ledger provider next.

`m64.dictionary.js` defines the client-facing resolver methods:

```text
describe()
idForTerm(term)
termForId(id)
ensureTerm(term)
ensureTerms(terms[])
```

The provider underneath that resolver is expected to supply the conceptual ledger operations:

```text
language()
dictionaryVersion()
termCount()
lookupTerm(id)
lookupId(term)
addTerm(term)
addTerms(terms[])
```

Requirements remain:

- append-only stable numeric IDs;
- no renumbering existing terms;
- deterministic lookup behavior;
- batch lookup/add support so publishing does not require one transaction/call per lexical term;
- M64 logic stays client-side;
- artifacts reference dictionary identity/version rather than embedding the complete dictionary snapshot.

The in-memory provider is deliberately not special to the protocol. A Polygon contract, cached static JSON mirror, IPFS snapshot, or another ledger adapter should implement the same resolver-facing behavior.

Start with JavaScript as the first ledger dictionary namespace. Other languages can have independent dictionaries later without changing M64.

### 5. Measure compression and ledger cost

Status: next after a first real ledger dictionary provider or faithful local simulation.

Do not optimize from intuition. Produce repeatable measurements for representative artifacts.

At minimum measure:

```text
original source bytes
canonical source bytes
abstract dictionary-stream bytes
M64 characters / UTF-8 bytes
embedded dictionary bytes (v2)
external dictionary bytes charged to artifact (v3)
new dictionary terms added
reused dictionary terms
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

Define the first EVM/Polygon dictionary provider against the resolver interface, but keep the contract deliberately small and test it against a local/static mock before spending real gas. The provider should map a stable descriptor such as `eip155:137:<contract>` to `lookupId`, `lookupTerm`, `addTerm`, and batched `addTerms`. In the same pass, add a repeatable compression/cost report so the first real contract experiment has measurable targets.

## Related documents

- `docs/refactor-phases.md` - conservative general refactor sequence.
- `REFACTOR-MAP.md` - executable-source dependency/refactor inventory.
- `tools/m64Artifact/README.md` - implemented M64 mechanics.
- `tools/m64Artifact/LEDGER_IPFS_ARCHITECTURE.md` - ledger/dictionary/IPFS architecture notes.
- `tools/m64Artifact/SELF_REBUILD.md` - recursive recovery direction.
