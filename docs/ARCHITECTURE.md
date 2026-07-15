# Chisel Architecture

Chisel should be understood as five layers.

## 1. Core UTXO driver

The core code builds VIN/VOUT objects, serializes raw transactions, signs them locally, decodes raw hex when possible, and submits signed hex to a broadcast provider or RPC node.

Primary files:

```text
chisel.js
chisel.sign.js
chisel.ravencoin.js
chisel.digibyte.js
chisel.litecoin.js
```

`dist/chisel-driver.js` is the intended public consolidation point.

## 2. Etch UI

Etch is the transaction workbench. It supports two paths:

```text
RUN ALL: build -> sign -> send
manual: prepare VIN/VOUT -> create raw -> sign raw -> send signed raw
```

The manual path is deliberately copy/paste friendly. It lets a user stop after `createrawtransaction`, edit VIN/VOUT JSON, sign later, or paste signed hex produced elsewhere.

## 3. Review UI

Review displays the raw transaction spine:

```text
account
UTXOs
VIN
VOUT
build payload
unsigned raw hex
decoded unsigned tx
signed raw hex
decoded signed tx
send payload
broadcast result
```

Review is not the public story. It is the engineering microscope.

## 4. Portal reader

Portal is the default reader. It loads static/bundled/local transaction records, merges live discoveries when configured, and renders Chisel-aware transaction semantics.

Portal should not require fileProxy for public read-only use.

## 5. Satellites

Tools such as fileProxy, bunOven, keeperBun, keyPrint, box labels, QR scanner, and the legacy decoder are satellites. They are useful, but they should not define the public interface.
