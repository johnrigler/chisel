# CM64 v3: native binary program record

Status: binary-only ledger wire protocol for the Dark Star M64/Chisel Polygon experiment. No JSON ledger envelope or legacy decoder is retained in the active workbench.

## Design principle

Chisel may write to transaction fields, outputs, contract calldata, or logs. On a binary-capable carrier, the record **must be composed of native bytes**, not JSON encoded to UTF-8 or Base64 text encoded to UTF-8. Chisel is not obligated to fit a conventional app/document structure.

M64 itself is a codec for a dictionary-token/literal byte stream. Its human-readable transport alphabet is

```text
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_
```

The 64 printable characters are for text transport. They **are not** the on-ledger representation. The byte stream uses `0x80..0xBF` for dictionary IDs 0..63, `0xC0` followed by a varuint for IDs 64+, and `0x00..0x7F` for literal ASCII bytes. This is not automatically a six-bit packed format; common dictionary references currently occupy one byte, and escape/literal rules have costs of their own.

## Active Polygon references

```text
chainId       137
M64Dictionary 0x522afe4f086da1df80531dea1e8793b05cace9cf
Chisel        0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3
```

The addresses above must be validated against the selected network. The M64Dictionary stores symbol IDs/terms, and Chisel emits a program record. Chisel does not need to store the JavaScript in contract storage.

## Wire layout

```text
byte field                                     representation
─────────────────────────────────────────────────────────────────
magic                                          43 4d 36 34 ("CM64")
record version                                 03
chain ID                                       unsigned varint
Chisel contract address                        20 raw bytes
dictionary contract address                    20 raw bytes
dictionary version                             unsigned varint
renderer-template transaction hash             32 raw bytes
renderer-template SHA-256 digest               32 raw bytes
canonical JavaScript SHA-256 digest            32 raw bytes
canonical source length                        unsigned varint
JavaScript language version                    length-prefixed short ASCII
entry function name                            length-prefixed short ASCII
input schema                                   unsigned varint
input values                                   schema-defined typed integers
compressed program stream                      remaining binary M64 bytes
```

Input schema `0` means no parameters. Schema `1` is a fixed ordering of the Dark Star integer fields, defined in `DARK_STAR_INPUT_KEYS`. Schema `2` is a canonical sorted set of up to 64 ASCII field names and signed integers. Signed integers use ZigZag varints. Unsupported input data is **rejected**, not automatically stringified. If these compact formats need revision, explicitly version the decoder.

The ledger program event uses `keccak256("chisel-m64-program-v3")` as its format tag in `logRecord(bytes32,bytes)`. The template event remains `chisel-m64-template-v1`; it is referenced by its transaction hash and digest in the program record.

## Rebuild

1. Retrieve the receipt and find the program event emitted by the selected Chisel address, tagged `chisel-m64-program-v3`.
2. Parse the binary header, with strict bounds, version, integer and field validation.
3. Resolve the dictionary address from the record on the same chain. Rebuild the M64 text view from the raw compressed bytes only if needed to run the existing dictionary hydrator.
4. Hydrate canonical JavaScript using that dictionary, verifying the canonical byte length and SHA-256 digest.
5. Retrieve the renderer template by transaction hash, verify its SHA-256, and assemble the standalone HTML. Do not execute that JavaScript merely because reconstruction succeeded.

The previously published JSON-envelope experiment is immutable ledger history, but this version of the workbench intentionally **does not decode it**. There is no JSON backward-compatibility code or runtime fallback.

## Screen report versus on-chain bytes

Only the fixed binary record, the EVM ABI wrapping it, and the selected contract call belong to the transaction. These are local diagnostic values only:

- baseline source bytes, canonical source bytes, raw token stream bytes;
- printed Base64url character count;
- record bytes and calldata bytes;
- cost comparisons, gas estimates, savings percentages;
- transaction JSON used as a human-readable **screen inspection** format.

Neither saving a transaction request to a local text field nor presenting diagnostic JSON means that JSON is published. `dark-star-z.html` must build the transaction bytes from `packLedgerProgram`, never from the display report. The signing wallet may still alter the execution route. Inspect the actual receipt and the outer `to` address after mining.

## Cost limitation

The Chisel `logRecord(bytes32,bytes)` ABI call serializes the data into calldata, then emits a copy in the `RecordLogged` event. That is one transaction, but two charged representations of the same bytes. The v3 envelope removes JSON and Base64 text from the record; it does **not** remove duplicated event/calldata cost. Direct calldata-only publishing is a separate optimization that needs its own end-to-end reconstruction and cost measurements.

## Invariants

- No implicit JSON/on-chain envelope.
- No wallet/delegation or proprietary index required to reconstruct.
- Do not write dictionary terms merely to compress once; reuse existing terms and preserve unknown terms as literals.
- Do not write savings percentages or diagnostic metadata into transaction data.
- Never claim a new transaction was published until its real receipt confirms success.
