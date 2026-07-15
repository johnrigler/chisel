# Chisel v2.7.5 Patch Notes

## Interface refactor

- Portal is now the default mode.
- `Origin` is now `Start`.
- `Broadcast` is now `Etch`.
- `Legacy Decode` is removed from the top navigation.
- The legacy decoder remains available under Tools.
- `?mode=broadcast` is accepted as a compatibility alias for Etch.
- `?mode=origin` is accepted as a compatibility alias for Start.
- `?mode=decode` redirects to Tools.

## Etch manual transaction pipeline

Etch now has a copy/paste-friendly manual pipeline:

```text
PREPARE VIN / VOUT FROM FORM
VIN FROM UTXO JSON
CREATE RAW FROM JSON
SIGN RAW
SEND SIGNED RAW
LOAD FROM REVIEW
```

The new text boxes expose:

```text
UTXO JSON
VIN JSON
VOUT JSON
unsigned raw transaction hex
signed raw transaction hex
scratch JSON / notes
```

This allows the user to stop between `createrawtransaction`, `signrawtransaction`, and `sendrawtransaction`, edit JSON manually, save payloads externally, or paste signed hex produced elsewhere. Sending signed raw hex does not require the WIF.

## Docs

Added:

```text
docs/WHAT_CHISEL_PROVES.md
docs/ARCHITECTURE.md
docs/DEMO_SCRIPT.md
```

Updated README to reflect the actual `data-bundled/` contents and to stop claiming that transaction fixture JSON files are included when they are not.

## Validation

JavaScript syntax checks passed for:

```text
app.js
chisel.portal.js
chisel.ravencoin.js
chisel.digibyte.js
chisel.litecoin.js
chisel.sign.js
chisel.unspendable.js
```
