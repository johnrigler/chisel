# M64 Symbol Dictionary v2: typed entries and linked contracts

Status: implemented in [`contracts/M64SymbolDictionary.sol`](../../contracts/M64SymbolDictionary.sol), **not deployed**. This is a replacement for the still-undeployed v1 `M64SymbolDictionary` design. Do not confuse it with the older, separately deployed text-based `M64Dictionary.sol` on Polygon.

## Design goal

One **native six-bit** instruction alphabet plus an extensible contract-backed dictionary. Contract deployment gas is not the architectural priority; compressing the repeated artifact payload and ensuring exact, deterministic recovery are. No payload JSON envelope, text Base64 encoding, or other automatic transformation into ASCII is permitted.

The six-bit instruction alphabet remains unchanged:

- Values **0–61**: direct definitions from a 62-entry immutable primary byte-sequence table. They can represent ASCII text, binary fragments, or whole strings.
- Value **62**: literal-byte escape followed by **two six-bit values**, jointly representing one arbitrary input byte (0–255).
- Value **63**: dictionary-reference escape followed by a variable-length **base-32 continuation integer** selecting one entry from a unified append-only table.

Every six-bit symbol costs 6 bits in the packed program. The exact symbol count precedes the packed bytes as a minimal byte varuint to distinguish padding from real symbols. The on-ledger object also needs a chain/contract reference and a fixed dictionary snapshot identifier, supplied by native fields rather than a JSON wrapper.

## Types of stored dictionary entries

The **same escape 63** references both kinds of entries without consuming another instruction symbol or changing the index encoding:

| Kind | ABI entry fields | Decoder operation |
| --- | --- | --- |
| `0: PACKED_M64` | `data: bytes`, `symbolCount > 0` | Read packed six-bit symbols and recursively resolve previously registered entries |
| `1: RAW_BYTES` | `data: bytes`, `symbolCount = 0` | Emit the raw bytes verbatim, with no text decoding |

The `entry(id)` getter identifies kind, bytes, and six-bit symbol count. `secondary(id)` still reads a packed entry, but reverts for a raw-byte record so an old reader cannot silently misinterpret it. `addSecondary`/`addSecondaryBatch` register packed entries. `addRaw`/`addRawBatch` register arbitrary byte sequences. Exact duplicates of a given kind reuse the existing index. Raw entries need not contain printable ASCII, and nested packed definitions may refer to earlier raw entries.

Allowing future **new entry kinds** would require updating the codec version and readers explicitly. Unknown kinds are rejected; they are not decoded as text or guessed from field lengths.

## Metadata and relationship fields

`name()`, `symbol()`, `language()`, `mediaType()`, and `description()` are contract getters similar to the useful *descriptive* fields common in token contracts. **This dictionary does not claim to implement ERC-20 or ERC-721.** Its constructor fixes those five values so a dictionary can advertise JavaScript, JSON, HTML, Python, or an arbitrary binary profile.

`descriptor()` returns content type, purpose, codec version, dictionary version, immutable primary digest, and latest aggregate definition digest.

`addReference(chainId, target, role, expectedDigest)` creates an append-only typed link to another EVM contract, potentially on another EVM chain. `referenceAt(id)` and `referenceCount()` allow readers to discover these links. For example, `role` can be `parent`, `related`, `format`, or another 32-byte identifier. **A link is descriptive only:** it does not automatically import definitions, call an arbitrary contract, or modify the six-bit decoding table. Readers must verify the referenced chain, contract code, and pinned digest before using it independently. Since additions are permissionless, links are suggestions and cannot be treated as endorsed or trusted based solely on presence.

Primary assignments are immutable. The secondary table is append-only, and all packed references are limited to **earlier** entries. This precludes circular definitions. `digestAtCount(n)` pins a reproducible dictionary snapshot after exactly `n` secondary entries. An artifact should bind to the dictionary contract (and chain), codec version, and a suitable immutable snapshot digest/count so future append operations cannot change its interpretation.

## Constructor

```solidity
constructor(
    string name_,
    string symbol_,
    string language_,
    string mediaType_,
    string description_,
    bytes[] primary_,        // exactly 62 entries, non-empty
    bytes[] initialPacked_,  // any count, sequential references only
    uint32[] initialCounts_  // matching symbol counts
)
```

The Dark Star JavaScript seed is in `tools/m64Artifact/seeds/darkstar-native6-v1.js`. It provides the original 62 primary definitions and 24 secondary packed definitions; the profile now reports codec v2. A different MIME type can use its own differently deployed dictionary contract and initial table.

## What the encoder actually does

The vanilla JavaScript codec `tools/m64Artifact/m64.native6.js` accepts arbitrary `Uint8Array` input. It chooses literal bytes, primary definitions, or secondary dictionary entries based on six-bit symbol cost and then packs the selected symbols. The v2 codec reads both packed and raw secondary entries. No JavaScript parsing or JSON understanding is required. JavaScript canonicalization, when desired, is a separate, expressly selected preprocessing step.

A dictionary may be large or rich as long as it is immutable/versioned and verifiably reconstructs the exact source. For optimization, measure program payload size, total binary record size, decoding safety, and dictionary reuse. Contract deployment gas is not a reason to prevent useful protocol features.

## Boundaries

- A stored definition's `bytes` length is already supplied by the EVM ABI; a packed definition additionally needs `symbolCount` because of trailing bit padding.
- `MAX_DEFINITION_SYMBOLS=4096` and `MAX_RAW_ENTRY_BYTES=4096` bound individual entries. Off-chain decoders also bound total expanded output.
- Unsupported kinds, malformed six-bit padding, truncated variable indexes, and forward references must fail closed.
- References to another contract are *metadata*, not a third implicit escape or an instruction to execute code.
- No live wallet signing, on-chain deployment, or Polygon publication is part of this change.
