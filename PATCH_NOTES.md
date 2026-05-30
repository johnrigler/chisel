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
