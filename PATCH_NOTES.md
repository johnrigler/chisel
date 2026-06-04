## v2.6.4 - QR scanner currency-specific WIF prefixes

- QR scanner now derives WIFs from 64-hex private-key fragments using the selected coin extension's `WIF_PREFIX`.
- Added `WIF_PREFIX` and `WIF_PREFIXES` metadata to Ravencoin, Digibyte, Litecoin, and Litecoin Testnet coin extensions.
- Fixes Litecoin scanner failure where raw hex fragments were converted into Bitcoin/Ravencoin/Digibyte-style WIF prefix 128 instead of Litecoin mainnet prefix 176.
- WIF mismatch errors now explain that a complete WIF QR may belong to a different selected coin/network.
- Rebuilt `/dist/chisel-driver.js` and metadata for v2.6.4.

## v2.6.3 - QR scanner currency registry

- qrScan.html now builds its currency dropdown from installed Chisel coin extensions instead of hard-coded Ravencoin/Digibyte options.
- Added Litecoin and Litecoin Testnet support to qrScan.html by loading chisel.litecoin.js.
- qrScan.html now honors ?currency=... / ?coin=... after the dynamic currency list is built.
- Updated index.html scanner copy to describe the registry-driven scanner.
- Left the scanner as a separate page for now. Full inline integration into index.html would drag camera lifecycle, html5-qrcode, and sticker-state code into the transaction shell. That should wait until the /dist driver boundary is stable.

## v2.6.2 - internal RIPEMD160 + sealed dist driver

- Added a small internal RIPEMD160 implementation to `chisel.sign.js`.
- Replaced the previous `CryptoJS.RIPEMD160` call with `CHISEL.ripemd160Bytes()` and `CHISEL.ripemd160Hex()`.
- Removed the CryptoJS CDN script tag from `index.html` and `qrScan.html`.
- Rebuilt `dist/chisel-driver.js` so the driver no longer has CryptoJS or elliptic runtime dependencies.
- Updated `dist/chisel-driver.manifest.json`, `dist/chisel-driver.sha256`, and `dist/README.md`.
- Verified RIPEMD160 against standard test vectors and confirmed `CHISEL.signRawTransaction` loads without `window.CryptoJS`.


## v2.6.1 - dist driver + coin transport metadata

- Added `dist/chisel-driver.js` as the first professional single-file browser driver for external projects.
- The dist driver includes core Chisel, embedded elliptic, unspendable helpers, signing, and the Ravencoin/Digibyte/Litecoin coin extensions.
- App/UI modules are intentionally excluded from dist.
- Added `dist/chisel-driver.manifest.json` and `dist/chisel-driver.sha256` for auditability.
- Added explicit coin extension transport metadata so external users can tell whether a coin uses proxy RPC, public providers, external explorer UTXO lookup, or legacy external broadcast behavior.
- Documented the old v1 Digibyte external `sendtx` broadcast route as legacy, not default.

# Chisel v2.4.3c patch

First Litecoin GUI bridge.

## Changes

- Bumped UI version and cache-busting query strings from `2.4.3b` to `2.4.3c`.
- Added `chisel.litecoin.js` to the main page load order.
- Replaced the broken experimental Litecoin coin file with a thin GUI coin bridge over the existing `CHISEL.litecoin` resource/provider layer.
- Installed two GUI currency choices:
  - `litecoin` / Litecoin mainnet
  - `litecoinTestnet` / Litecoin Testnet
- Let the existing broadcaster skip JSON-RPC client loading for provider-backed coins.
- Reused the existing GUI fields for Litecoin:
  - WIF
  - fee
  - OP_RETURN ASCII/HEX
  - extra recipients
  - provider list in the former RPC/API URL field
- Added local raw transaction construction for legacy Litecoin P2PKH outputs.
- Added local decode via `CHISEL.parseRawTransactionDetailed()` for Litecoin.
- Added provider broadcast through `CHISEL.litecoin.broadcastRawTransactionWithReport()`.
- Updated GitHub workflow checks for `chisel.litecoin.js`.

## Scope limits

- Litecoin GUI path is legacy P2PKH only.
- Bech32/P2SH inputs and outputs are not supported in this bridge.
- Ravencoin IPFS output field is rejected for Litecoin.
- Litecoin uses public providers, not the Ravencoin/Digibyte RPC proxy model.


## v2.6.0 - elliptic dependency consolidation

- Embedded elliptic 6.6.1 browser minified build directly into `chisel.js`.
- Removed the separate `vendor/elliptic-6-6-1.min.js` script dependency from `index.html` and `qrScan.html`.
- Preserved `vendor/elliptic-6-6-1.min.js` and `vendor/elliptic-6-6-1.js` as audit/source artifacts, not runtime dependencies for the main pages.
- Preserved the MIT license notice in `THIRD_PARTY_LICENSES/elliptic.txt` and added an embedded-source banner in `chisel.js`.
- Bumped the `chisel.js` cache token in `index.html` to `2.6.0`.
