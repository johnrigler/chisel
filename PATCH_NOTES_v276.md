# Chisel v2.7.6 Patch Notes

## Etch fixtures and RPC export

This build adds deterministic dry-run fixtures for the manual Etch pipeline:

```text
fixtures/etch/etch-fixtures.js
fixtures/etch/litecoin-v276-opreturn.json
fixtures/etch/litecoin-testnet-v276-opreturn.json
```

The browser loads `etch-fixtures.js`. The JSON files are included for shell tests and external tooling. The fixture WIFs are public dummy keys derived from private key 1 and must not be funded.

The Etch panel now includes:

```text
Etch fixture selector
LOAD FIXTURE
SAVE DRAFT
RESTORE DRAFT
CLEAR BOXES
EXPORT RPC COMMANDS
RPC command export textarea
broadcast confirmation checkbox
```

The RPC export emits the three normal Bitcoin-family command boundaries:

```bash
createrawtransaction 'VIN_JSON' 'VOUT_JSON'
signrawtransactionwithkey 'UNSIGNED_HEX' '["<WIF>"]'
sendrawtransaction 'SIGNED_HEX'
```

The WIF is intentionally redacted from command export and intentionally excluded from manual draft save/restore.

## Manual pipeline validation

The manual pipeline now performs stronger checks before moving between steps:

```text
VIN must be a non-empty array with 64-character txids and numeric vouts.
VOUT must be a non-empty object with positive output amounts.
data outputs must be even-length hex.
hex boxes must contain even-length hex.
SEND SIGNED RAW is blocked until the explicit broadcast checkbox is checked.
```

## Bundled-data reproducibility

`data-bundled/index/transactions.index.json` previously referenced `data-bundled/transactions/dogecoin/*.json` files that were not included in the release archive. v2.7.6 generates hydration-safe static stubs for every referenced path.

These stubs are not full node transaction captures. They are generated from the bundled index plus available Dogecoin import JSONL rows so colleague demos do not hit missing relative paths.

## Validation

The following checks passed:

```bash
node --check app.js
node --check chisel.portal.js
node --check fixtures/etch/etch-fixtures.js
```

Fixture raw/signed transaction generation was checked in Node against the bundled Litecoin coin driver.
