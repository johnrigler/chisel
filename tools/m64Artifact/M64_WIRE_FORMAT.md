# M64 v3 transport, Chisel ledger records, and hexadecimal EVM rendering

**Current proposal: CM64 binary record v3**, using the existing M64 dictionary codec. The version 2 JSON-header records below remain historical and readable. The v3 change is designed for a single compressed-program transaction, with no JSON in ledger bytes. No v3 transaction has been broadcast from this change.

## CM64 binary program record v3

The format is a byte serialization, not serialized JSON:

| Field | Encoding |
| --- | --- |
| Magic | Four raw bytes `43 4d 36 34` ("CM64") |
| Version | Single byte `03` |
| Chain ID | Unsigned LEB128-style varint |
| Chisel contract | 20 raw address bytes |
| Dictionary contract | 20 raw address bytes |
| Dictionary version | Unsigned varint |
| Renderer-template transaction hash | 32 raw bytes |
| Renderer-template SHA-256 | 32 raw bytes |
| Canonical program SHA-256 | 32 raw bytes |
| Canonical byte count | Unsigned varint |
| JavaScript language version | Length-prefixed short ASCII string |
| Canonical entry function | Length-prefixed short ASCII string |
| Input schema | Unsigned varint: 0 absent; 1 fixed-order Dark Star signed integers; 2 sorted numeric field-name/value pairs |
| Compressed program | Remaining raw decoded M64 token-stream bytes, **not Base64 text** |

All numeric parameter values use zigzag signed varints. The fixed Dark Star schema is deliberately defined by the named ordering in `DARK_STAR_INPUT_KEYS` in `m64.ledger.js`. Generic numeric maps use lexicographically ordered short ASCII keys and signed varints. Unknown schema numbers must fail, not fall back to JSON. The language/runtime/canonicalizer/codec currently supported by v3 are fixed by the version and decoder, rather than redundantly restated as strings. If these conventions change, introduce a new version.

The rendered M64 Base64url alphabet stays exactly `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`. The decoder reconstructs that display representation from the raw bytes; the ledger itself never pays to store the display characters. The underlying dictionary stream uses `0x80..0xBF` for indexes 0..63, `0xC0` plus a varuint for larger indexes, and ASCII bytes for literals. **That is one byte per dictionary index, not six-bit packing.** The 64-character transport does not automatically imply six-bit storage for a mixed literal/index stream. Any subsequent bit-packing optimization needs its own codec/version and measured byte/gas savings.

The `logRecord(bytes32,bytes)` call still wraps the program bytes in EVM ABI calldata and emits a Chisel event. That repeats payload bytes in calldata and the log. It is preserved for this compatibility iteration, **not** claimed to be the minimum-gas publication method. Compare with a direct calldata-only carrier separately. The `chisel-m64-program-v3` event format is distinct from `chisel-m64-program-v2`, and the reader accepts either while validating its envelope version.

**Off-chain diagnostics:** raw/canonical/program byte counts, percentage savings, projected gas, and the JSON shown in the unsigned-transaction inspector are UI-only. The signing request carries only the chain ID, destination, value, and EVM calldata. No compression-report values are included in CM64 v3. The reader can rebuild and verify the record using a node/RPC, Chisel's template log, and the referenced dictionary. The wallet is not needed for reconstruction.

## CM64 envelope v2 (historical, backward-readable)

Status: historical description of v2 below, with the current v3 binary candidate specified above. The earlier unmerged prototype used a different byte payload; do not confuse it with deployed v2 or candidate v3.

## Three layers, three different purposes

1. **M64 text** is the compressed program's transport representation. Its alphabet is exactly `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`. It is unpadded Base64url-style **text**, not a collection of 64-bit words, and not ordinary source code. M64 maps an abstract dictionary-reference/literal byte stream into those 64 text symbols. For this format, preserving those characters exactly is a protocol requirement.
2. **Chisel record** carries that M64 text and the metadata needed to decode it, including an explicit `eip155:<chainId>:<dictionaryAddress>` reference, canonicalizer/version, runtime/entry, byte count, SHA-256, and an immutable Chisel template transaction locator. The M64 characters remain unchanged inside the record. The dictionary contract stores terms/IDs only; it does not store the program.
3. **EVM hexadecimal** is how Ethereum/Polygon JSON-RPC, ABI `bytes`, transaction input, and event log data are displayed externally. The text `QUJD` is four UTF-8 bytes `51 55 4a 44`, typically displayed `0x51554a44`. Hex display is not a second M64 codec. It does not make the ledger store eight ASCII characters; the underlying data are four bytes. ABI encoding, transaction calldata, and receipt logs have their own overhead.

**About the 63-plus-escape proposal:** The implemented protocol is not a 63-character vocabulary plus one printed escape. It has 64 ordinary printable transport symbols, while the decoded abstract byte stream has its own reserved dictionary-index extension marker at `0xC0`. Making the last printable symbol into an escape would be an incompatible *new* codec and should use a new codec ID and independent compression benchmarks. Existing v3 records must not be reinterpreted.\n\nThe 64-character alphabet and the first 64 dictionary indexes are separate ideas. M64's abstract bytes use single-byte references for dictionary IDs 0–63 (`0x80..0xBF`), and `0xC0 + varuint` for IDs 64 and above. `0x00..0x7F` represents literal ASCII. The transport alphabet has exactly 64 characters regardless of vocabulary size.

## Active Polygon contract references

For the current Dark Star Z experiment, the deployed and populated dictionary has been reported as:

```text
chainId       137 (Polygon mainnet)
M64Dictionary 0x522afe4f086da1df80531dea1e8793b05cace9cf
dictionaryRef eip155:137:0x522afe4f086da1df80531dea1e8793b05cace9cf
Chisel        0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3
```

51 extracted Dark Star Z symbols were reported as published to the M64Dictionary. This is a historical baseline, not a hard-coded fixed dictionary size; on-chain inspection is needed to establish the current term count.

The HTML renderer-template transaction is a Chisel-only log. The M64 program transaction is another Chisel log whose `CM64` v2 envelope includes the dictionary reference, the exact compressed M64 characters, canonical integrity metadata, and the renderer transaction's hash and SHA-256. The program transaction builder must verify that the chosen M64Dictionary address matches the artifact's dictionary reference and that the dictionary can reconstruct the artifact. The two contracts are joined by the **program record's immutable references**, not by a cross-contract call.

## Dual-contract layout

- **M64Dictionary** (Polygon, or another resolver implementing the same lookup contract): immutable, append-only `id -> term`, `term -> id`; the dictionary identity is part of an artifact's meaning.
- **Chisel**: `logRecord(bytes32 format, bytes data)` publishes the compressed program as a `RecordLogged` event. Another log carries the standalone Dark Star HTML renderer template, including the landscape controls. Neither log writes persistent contract state.
- **Client**: retrieves the Chisel logs, verifies the declared dictionary contract identity, reconstructs the source, verifies its canonical SHA-256 and byte length, retrieves/verifies the HTML template, and assembles a standalone HTML page. No contract executes reconstructed JavaScript.
- **IPFS**: distribution of the reconstructed HTML/other artifacts. Reproducing the *same* CID requires a separately specified deterministic import/DAG/CAR profile, not just matching HTML bytes. The current page can save or upload its reconstructed HTML, but a universal byte-for-byte CID recovery proof still needs this profile and an independent retrieval test.

## Binary Chisel record envelope v2

The EVM `bytes data` field is a byte serialization of the following record. **The M64 content at the end remains the exact ASCII characters of `artifact.payload`, not the decoded dictionary byte stream.**

```text
offset  size   content
0       4      ASCII "CM64" (43 4d 36 34)
4       1      envelope version = 0x02
5       4      JSON header length, unsigned big-endian
9       N      UTF-8 JSON header
9+N     rest   ASCII M64/Base64url payload (unaltered)
```

The header contains:

```json
{
  "kind": "chisel-m64-ledger-program",
  "version": 2,
  "carrier": "eip155:137:0x<chisel-contract-address>",
  "payloadEncoding": "m64-base64url-ascii",
  "artifact": {
    "kind": "chisel-m64-artifact",
    "version": 3,
    "language": "javascript",
    "languageVersion": "es2026",
    "codec": "m64-dict-v1",
    "canonicalizer": "js-canonical-v1",
    "dictionary": {
      "kind": "ledger-dictionary",
      "ref": "eip155:137:0x<dictionary-contract-address>",
      "version": 1,
      "language": "javascript"
    },
    "runtime": "CHISEL-PURE1",
    "entry": "a",
    "canonicalBytes": 0,
    "sha256": "<canonical-source-sha256>"
  },
  "template": {
    "format": "chisel-m64-template-v1",
    "tx": "0x<chisel-template-transaction-hash>",
    "sha256": "<template-html-sha256>"
  }
}
```

The artifact in the header includes the same validated v3 metadata as the standalone JSON artifact, *except* the `payload` field. The `payload` is stored immediately after the header, with no Base64 decoding/re-encoding on the way to the contract. Input parameters may also be in the artifact metadata. The hexadecimal representation returned by JSON-RPC is the hex encoding of this complete envelope.

The `logRecord` event's `format` is `keccak256(utf8("chisel-m64-program-v2"))`. The template is logged under `keccak256(utf8("chisel-m64-template-v1"))`. The event also identifies the writer. The program record binds its declared `carrier` to the Chisel contract address and binds its template by transaction hash and SHA-256. Since receipt logs are immutable, the exact source bytes can be reconstructed from ledger history.

Earlier envelope v1 (decoded binary tail) was a development experiment and is **not the v2 format**; v2 uses its own event format and version byte so that a reader cannot silently mix the representations.

## Reconstruction and verification

1. Retrieve the Chisel program transaction receipt, and select the `RecordLogged` log emitted by the expected Chisel address and v2 format topic.
2. Hex-decode the event bytes (standard ABI/RPC operation), parse the envelope, and recover the **original M64 character sequence**.
3. Read the dictionary reference in `artifact.dictionary.ref`, select that exact contract and chain, and resolve dictionary IDs from the M64-decoded abstract stream.
4. Reconstruct canonical JavaScript locally. Verify `canonicalBytes` and SHA-256. Never silently substitute a dictionary at another address.
5. Fetch the referenced template event from Chisel, verify its SHA-256, then embed the canonical JavaScript and entry/input parameters into that self-contained HTML.
6. Save or upload the HTML. Verify its byte hash. When a deterministic import profile is chosen, rebuild its IPFS DAG/CAR and compare the computed CID with the published CID.
7. Only execute reconstructed code after explicit user action, inside a constrained runtime. Hash verification proves byte integrity, not that the publisher or code is trustworthy.

## Read-only dictionary inspection and marginal cost

The workbench accepts the deployed dictionary address and the Chisel publisher address independently. Its first action should always be a read-only inspection of the dictionary identity and permanent term IDs. Compression uses only terms already in that table; missing terms remain literal bytes in the reversible canonical stream. No need to pay Polygon gas to add new words unless the expected repeated reuse justifies it. An explicit separate wallet action appends missing terms, and then the same read-only encoding can be repeated.

The initial complete Chisel record size is projected before any transactions by populating the fixed-width template transaction and SHA-256 fields with placeholders. These are the same number of bytes as the eventual values. A live unsigned transaction preview compares ABI-encoded calldata and may request `eth_estimateGas` for the compressed record and plain-source baseline. The gas estimate depends on the current Polygon state/RPC and is not a signature or transaction submission.

A saving percentage below zero means the representation expands the source. A payload may be smaller than canonical source while the full manifest/event is larger. This matters for a one-off program, and may change when metadata and HTML-template costs are amortized across many programs.

## Compression reporting

Measure separately:

- original JavaScript UTF-8 bytes;
- canonical/minified JavaScript UTF-8 bytes;
- binary M64 abstract dictionary stream bytes (internal diagnostic only, **not published** in the v2 ledger program);
- **actual M64/Base64url text bytes** (published unchanged);
- total serialized Chisel envelope bytes, including metadata and M64 text;
- dictionary storage/gas, template log bytes/gas, ABI/event/gas overhead, and any IPFS packaging bytes (separate costs).

A defensible metric for an individual program record is `(1 - ledgerEnvelopeBytes / originalSourceBytes) * 100`. Negative savings mean expansion. This does not amortize the cost of dictionary creation or HTML template publication. Report those setup costs independently, along with marginal cost as other programs reuse the dictionary and template. The hex characters printed by explorers are not the storage-byte baseline.

The M64 text may be **larger** than the abstract binary dictionary stream, because Base64 represents each three bytes using four 64-alphabet characters. The entire record may also be larger than original source for small programs. This is why the UI needs both payload-only and full-record measurements, not a claim that M64 is always smaller.

## Implementation locations

- `m64.js`: dictionary references, abstract byte stream, 64-alphabet encode/decode.
- `m64.artifact.js`: M64 v3 artifact schema / alphabet.
- `m64.v3.js`: canonical JavaScript -> M64 text, and verified reverse mapping.
- `m64.ledger.js`: self-describing v2 ledger envelope / report.
- `dark-star-z.html`: publish both Chisel records, read them back against the named dictionary, and build a standalone page.
- `examples/darkstar-ledger-template.html`: the HTML and landscape controls included in the renderer template log.
