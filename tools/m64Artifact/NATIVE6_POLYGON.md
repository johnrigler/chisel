# Native six-bit M64 on Polygon: verify, publish, reconstruct

Status: Browser integration implemented. Full independent on-chain verification awaits a live Polygon provider read. The user's successful deployment receipt does not by itself establish source equivalence.

## Contracts

- Polygon PoS chain ID 137
- M64 Symbol Dictionary: `0xe6e9df9f49b1ab4417129454991466adc9923f8c`
- Chisel event publisher: `0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3`
- Browser tool: [native6-polygon.html](./native6-polygon.html)
- Earlier M64 v3 dictionary `0x522afe4f086da1df80531dea1e8793b05cace9cf` uses a different codec. No implicit migration.

## Verify the deployed contract values

The browser reads runtime code, chain ID, codec version 2, dictionary version 1, 62 primary count, language, MIME, snapshot digests, and 24 seeded secondary entries. It retrieves EVERY one of 62 primary definitions and 24 secondary entries, comparing the actual bytes, kind and symbol count to the fixed `seeds/darkstar-native6-v1.js` values. It verifies `digestAtCount(0)==primaryDigest` and pins `digestAtCount(24)` to keep the referenced dictionary prefix immutable. On-chain values that differ from the seed fail closed before publishing. Other later entries can be appended without changing this snapshot.

These checks use a selected wallet's Polygon RPC. They establish functional dictionary consistency, but are not a source audit or independent multi-provider verification.

## Compact M6P2 record

The source is UTF-8 bytes unless the user explicitly canonicalizes the unedited Dark Star example. The M64 native six-bit encoder uses primary symbols 0-61, literal escape 62, and secondary escape 63, packed as six-bit symbols.

| Field | Encoding |
| --- | --- |
| Magic and record version | `4d 36 50 32 01` |
| Dictionary address | 20 raw bytes |
| Dictionary snapshot entry count | canonical byte-varint |
| Immutable snapshot digest | 32 bytes |
| Original source byte length | canonical byte-varint |
| Original source SHA-256 | 32 bytes |
| Packed M64 program | six-bit native byte stream with symbol-count prefix |

The minimal header is 91 bytes before the compressed wire. NO JSON, printable Base64 wrapping, savings statistics, or screen diagnostics are serialized into the record.

Publish through existing Chisel `logRecord(bytes32,bytes)` using the format tag `keccak256('chisel-m64-native6-v2')`. The workbench locally encodes and decodes, estimates gas, then requests a separate review and explicit wallet signing. The dictionary contract is read only.

## Rebuild from a Polygon transaction

Fetch transaction and successful receipt. Find exactly one `RecordLogged` emitted by the registered Chisel contract with the native M64 tag. A wallet's smart-account route may change outer `tx.to`; the actual log emitter is authoritative. Parse and check the record's dictionary address and pinned snapshot, decode with verified on-chain definitions, then check original byte count and SHA-256. Display and save the resulting bytes without executing JavaScript.

The reconstructed file can be content-addressed in IPFS. Reproducing a specific whole-HTML CID requires explicitly fixed renderer, packaging and UnixFS/chunking parameters. The previous M64 v3 template/JSON workflow remains independent.

## Safety

- Only user-approved wallet writes. No implicit network switch, private-key access, or automatic code execution.
- No trust placed in metadata or hash getters alone; 62+24 actual entry values are checked against the pinned seed.
- A genuine event proves Chisel emitted bytes, not that the source code is safe.
- This document records the integration, NOT an independent claim that the user's on-chain dictionary has already passed all checks.