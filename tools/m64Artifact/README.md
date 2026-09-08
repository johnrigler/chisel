# Chisel M64 Artifact Workbench

M64 is a compact transport for an abstract byte stream. It is not an image format and it is not inherently JavaScript-specific.

The current pipeline is:

```text
source/data
   |
canonical form
   |
dictionary collection / lookup
   |
dictionary-index byte stream
   |
M64 transport
   |
dictionary hydration
   |
runtime
```

## Active direction

The durable development order is in [`../../docs/NEXT_DEVELOPMENT.md`](../../docs/NEXT_DEVELOPMENT.md).

The immediate objective is **not** to invent another compression scheme. It is to stabilize M64 as a protocol:

1. keep a small executable regression floor;
2. freeze an M64 v3 external-dictionary artifact schema;
3. separate the JavaScript source adapter from the language-neutral M64 transport/dictionary core;
4. implement a simple append-only shared ledger dictionary;
5. measure marginal artifact cost after vocabulary already exists on-ledger;
6. use the result for the staged recursive Chisel rebuild experiment.

The first regression floor is now active, and an executable v3 schema validator has been started in `m64.artifact.js`. The JavaScript language/version and canonicalizer assumptions belong to artifact metadata. The dictionary can declare its language, but JavaScript language-version details should not be baked into the dictionary contract itself.

M64 transport should remain usable for JavaScript, Python, MIDI/binary generators, or other deterministic payload families.

## Design notes

The broader ledger/dictionary/IPFS direction is recorded in:

- [`LEDGER_IPFS_ARCHITECTURE.md`](LEDGER_IPFS_ARCHITECTURE.md) - EVM as durable data/reference substrate, plural append-only dictionaries, contract/transaction references, cross-ledger graphs, deterministic IPFS/CAR reconstruction, and recovery from zero hosted IPFS copies.

That document intentionally separates implemented M64 mechanics from architectural ideas that are not yet a frozen live protocol.

## M64 v2 dictionary encoding

The original staging format had a hard ceiling of 64 profile tokens. That ceiling is removed.

Dictionary references now have two forms:

```text
0x80..0xBF       dictionary indexes 0..63
0xC0 <varuint>   dictionary indexes 64 and above
0x00..0x7F       literal canonical ASCII
```

The first 64 terms therefore retain the cheapest possible one-byte references. Larger dictionaries use a compact variable-length integer only when the index exceeds 63.

A dictionary can now grow monotonically without changing the M64 transport. Thousands or millions of terms are possible in principle. The practical limit is the dictionary implementation, not M64.

## Automatic collection

The workbench starts with a small seed dictionary and scans canonical source for lexical terms. Newly encountered terms are appended to the dictionary and immediately become reusable references.

That means terms such as:

```text
function
return
Uint8Array
width
height
drawLine
```

need not be emitted repeatedly into the abstract stream once they have dictionary indexes.

The current collector is intentionally simple. It collects identifier/word-like terms of two or more characters. Manual dictionary entries can still represent punctuation, operators, method fragments, common phrases, or other repeated byte sequences.

## External dictionary lookup

The core codec no longer assumes that the dictionary must be an embedded array. `m64.js` exposes chain-neutral lookup hooks:

```text
collectDictionaryTerms(source, knownTerms)
resolveTerms(terms, termToIndexLookup)
tokenizeResolved(source, termToIndexMap)
dictionaryIndexes(bytes)
hydrateLookup(payload, alphabet, indexToTermLookup)
```

This is the intended bridge to a shared ledger dictionary.

For a JavaScript dictionary contract, the flow can be:

```text
canonical source
   |
collect terms
   |
contract lookup(term) -> numeric id
   |
add missing term to contract
   |
contract returns stable numeric id
   |
M64 stores only ids + unavoidable literals
```

Hydration performs the inverse operation:

```text
M64 payload
   |
extract dictionary ids
   |
contract/cache lookup(id) -> term
   |
reconstruct canonical source
```

M64 itself does not care whether those lookups come from an EVM contract, a locally cached mirror, IPFS, DigiByte/Litecoin metadata, or another registry.

## Current v2 artifact package

The workbench currently exports a self-contained version 2 artifact with an embedded dictionary snapshot so the artifact can still be tested without any network dependency:

```json
{
  "kind": "chisel-m64-artifact",
  "version": 2,
  "type": "javascript",
  "runtime": "CHISEL-PURE1",
  "entry": "a",
  "profile": {
    "kind": "m64-profile",
    "version": 2,
    "alphabet": "...64 characters...",
    "tokens": ["function", "return", "..."]
  },
  "input": {},
  "payload": "...M64..."
}
```

That embedded snapshot is staging scaffolding, not the desired final ledger format.

The legacy `validateArtifact()` path intentionally remains v2-only so the existing workbench and `hydrate.html` cannot accidentally accept a v3 artifact that they do not yet know how to resolve.

## Executable M64 v3 draft

`m64.artifact.js` adds a separate `validateArtifactV3()` boundary. The current executable draft is:

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
  "payload": "...M64...",
  "canonicalBytes": 0,
  "sha256": "<64 lowercase hex characters>"
}
```

For `m64-dict-v1`, the transport alphabet is fixed rather than repeated in every artifact:

```text
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

The current validator checks:

- package kind/version;
- JavaScript language and declared language version;
- codec and canonicalizer IDs;
- dictionary kind/reference/version/language;
- dictionary language agreement with the artifact language;
- `CHISEL-PURE1` runtime and JavaScript entry identifier;
- structural M64 payload validity, including reserved/truncated dictionary-reference bytes;
- canonical byte-count shape;
- lowercase SHA-256 field shape.

It intentionally does **not** yet verify that the dictionary reference exists, hydrate the payload against that dictionary, or recompute the canonical SHA-256. Those checks belong to the resolver/hydrator path, which is the next protocol layer.

This should still be treated as an executable draft until the JavaScript adapter and external dictionary resolver use it end-to-end.

## JavaScript adapter boundary

The current `m64.js` contains a deliberately small JavaScript canonicalizer alongside the generic transport/dictionary logic. That is staging code, not a claim that arbitrary modern JavaScript can already be canonicalized safely.

`m64.artifact.js` is the first physical extraction from the monolithic staging file. Continue moving concerns behind stable compatibility APIs rather than rewriting the workbench all at once.

Before v3 is called stable, JavaScript-specific canonicalization should sit behind an explicit adapter boundary and must either correctly handle lexical forms such as template literals and regular-expression literals or reject unsupported syntax. Silent source corruption is not an acceptable fallback.

## CHISEL-PURE1

A hydrated JavaScript artifact defines a plain entry function and the host invokes:

```js
entry(input)
```

The result should be structured-cloneable data such as a string, number, object, array, `ArrayBuffer`, or typed array.

This is deliberately not image-specific. A PURE1 artifact can implement raster generation, MIDI generation, text transformation, encoding/decoding, transaction serialization, parsers, or other deterministic protocol logic.

## Regression tests

The protocol-floor tests live in `../../tests/m64.test.mjs` and run in GitHub Actions:

```bash
node --test tests/m64.test.mjs
```

They cover byte transport round trips, stage/hydrate equality, dictionary IDs above 63, external dictionary hydration, malformed/reserved encoding rejection, the v2 workbench validation boundary, and the v3 external-dictionary schema validator.

## Files

- `m64.js` - current compatibility facade plus canonicalization, growing dictionary codec, external lookup hooks, and M64 transport
- `m64.artifact.js` - M64 v3 artifact/dictionary-reference validation boundary
- `index.html` - source -> dictionary -> M64 -> hydrate -> sandboxed test workbench
- `hydrate.html` - standalone v2 artifact hydrator/tester
- `polygon.html` - browser EIP-1193 carrier for writing artifact text into Polygon transaction calldata
- `LEDGER_IPFS_ARCHITECTURE.md` - design notes for ledger references, shared dictionaries, cross-ledger objects, and deterministic IPFS recovery
- `SELF_REBUILD.md` - staged recursive Chisel recovery direction
- `examples/` - Dark Star renderer staging material and earlier examples

## Polygon carrier

`polygon.html` remains intentionally separate from the compression layer. It carries arbitrary UTF-8 artifact text in transaction calldata. M64 and the dictionary model therefore remain independent of Polygon and can later be referenced from multiple ledgers.
