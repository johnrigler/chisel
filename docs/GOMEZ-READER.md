# Gomez calldata reader

Portal 2.8.74 decodes existing transaction input in the browser instead of
depending on a FileProxy packet's optional `decoded` object. Generic catalog
titles such as `GOMEZ transaction` do not override recovered content. Visible
EVM rows load their original JSON in batches of four; older summaries can
appear immediately, then improve when their input is read.

`chisel.evm.decode.js` reads the existing interfaces in
`chisel.evm.contracts.js`, with no wallet library or network dependency:

- Gomez `tell(string,address,uint256,address,uint256,address,uint256,address,uint256)`:
  selector `0x3740071f`, nine 32-byte head words. Word zero points to the
  message length and bytes; four address/amount pairs occupy the other words.
- Jethro `mapArtifact(string,string)`: selector `0x16fb242a`, two dynamic string
  offsets. Their values remain the artifact label and body.

Offsets are measured from the ABI arguments after the selector. The reader
checks word bounds, dynamic offsets, string lengths, and address padding.
Amounts remain decimal uint256 strings without floating-point conversion.
Address word decoding recognizes printable bytes with zero padding.

ASCII/UTF-8 and HTML messages supply readable titles, text, receiver words and
links. Image tags supply image URLs, including extensionless URLs. Historical
Gomez images encoded byte values as Unicode characters followed by UTF-8;
the reader reverses that transformation only when the result has a recognized
PNG, JPEG, GIF or WebP signature. Raster bytes display directly without a
server-side image extraction step. Original input and saved packets are not
rewritten. Original message text is inspectable in the expanded record.

HTML is interpreted for text, links and image sources; transaction scripts and
event attributes are not executed. Unknown selectors remain undecoded rather
than being guessed to follow the Gomez ABI. Earlier predecoded packets and
saved image assets remain readable. No ledger write format or signing path changes.

The regression fixtures `gomez-tell-ascii.json`, `gomez-tell-html.json`, and
`gomez-tell-legacy-image.json` are public transaction observations retrieved
from rigler.org's FileProxy `/raw?path=...` API. They retain their original
transaction inputs, generic summaries and incomplete decoded metadata:

| Fixture | Polygon transaction |
| --- | --- |
| ASCII `test` | `0x8cb9e81316cf34aeaee0e0f55fb54da0411fcb083bb32b4088f81d0397e1a575` |
| HTML / Hufflepuff | `0xb71e85db9e8c061e822b60c2ec5f27843b2c3f46a71188517a8cb6d1a894eead` |
| Legacy PNG | `0xf53592a10d74f814dd30f28db2421625ddac3acd75413879b8d11d481d871b2d` |

The recovered PNG is 300 × 164 pixels, 36,853 bytes, SHA-256
`a99fb82b104883d5379585fc35ef2481fe849b330cd9267052688b4fd00c12a6`.
These are decoding fixtures, not independent proofs of ledger inclusion.

Run `node --test tests/evm-decode.test.mjs tests/record-preview.test.mjs tests/portal-store.test.mjs tests/version-release.test.mjs`.
