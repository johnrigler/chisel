# Chisel native eCash etching

The [Zorkmid Chisel view](https://johnrigler.github.io/lantern/world.html#view=etch)
uses `chisel.ecash.js` to write a note or IPFS URI on eCash mainnet. The module is
independent of Chisel's legacy Bitcoin-style transaction signer. Import it on
demand; its browser SDK includes the WASM locally and makes no request on import.

`prepareEtch({privateKeyHex, compressed, address, note, snapshot})` builds and signs
locally, returning reviewed transaction bytes and amounts. `snapshot` is the
official Chronik `address(address).utxos()` result. The output contains a zero-value
`OP_RETURN` with UTF-8 `ZORKMID1 ` followed by the note, and P2PKH change back to the
signing address. Notes are limited to 180 UTF-8 bytes. No token is minted.

`broadcastEtch(client, review)` is a separate action. It checks the reviewed outputs,
fee, and current UTXOs, then broadcasts the same bytes with Chronik token safety
checks enabled. There is no automatic broadcast or retry. If the broadcast
response is lost, check the transaction ID before explicitly retrying those bytes.

The fixed fee rate is 1,000 sat/kB. One XEC is 100 satoshis. At most 12 non-token,
non-coinbase inputs are selected, with a 5,000 sat fee ceiling and at least 546 sat
of returned change. Coinbase inputs are conservatively excluded even if mature.
Token UTXOs never fund a note. Both compressed and uncompressed WIF-derived P2PKH
addresses are supported. The caller must keep the secret only in local memory.

The IPFS URI is an immutable note, not an authenticated latest-release resolver.
Pin the content separately. This does not update an existing token's genesis URL.

## SDK provenance and rebuild

Bitcoin ABC `ecash-lib@4.14.4` (MIT) and `chronik-client@4.3.3` (MIT) are bundled in
`vendor/ecash-sdk-4.14.4.js`. `tools/ecash-sdk/package-lock.json` pins transitive
packages. To rebuild, run `npm ci && npm run build` in `tools/ecash-sdk` using Node.
The Chronik TypeScript entry is intentional: this release's published compiled
entry refers to a missing `dist/src/ChronikClient` file. The source entry is from
the same pinned official package. Esbuild preserves dependency legal comments;
Bitcoin ABC's MIT notice is also in `vendor/BITCOIN-ABC-LICENSE.txt`.

Zorkmid vendors the identical module and SDK for static/IPFS hosting. There is no
runtime CDN. Run `node --test tests/ecash-etch.test.mjs` for fixture-only checks:
transaction serialization, ForkID Schnorr verification, fee/change, token
exclusion, stale funds, and ambiguous-broadcast behavior. Tests never broadcast.
