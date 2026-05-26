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
