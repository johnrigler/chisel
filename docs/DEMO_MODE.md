# Chisel Demo Mode

Demo Mode is the colleague-facing click path. It exists so a first review does not begin inside legacy Decode or a live broadcast workflow.

## Path

1. Start: explain what Chisel proves.
2. Portal: show bundled/static data as the default reader.
3. Etch: load a dry-run fixture.
4. Etch: create unsigned raw transaction hex from VIN/VOUT JSON.
5. Etch: sign locally with the fixture WIF.
6. Etch: export normal RPC command text.
7. Tools: show QR, label, legacy decoder, and satellite utilities.

## Safety boundary

The bundled Etch fixtures use dummy keys. Do not fund those addresses.

Demo Mode does not check the SEND SIGNED RAW confirmation box and does not attempt live broadcast.

## Why this matters

The demonstration maps Chisel back to ordinary Bitcoin-family transaction machinery:

```bash
createrawtransaction '[...]' '{...}'
signrawtransactionwithkey 'HEX' '["<WIF>"]'
sendrawtransaction 'SIGNED_HEX'
```

The point is not that Chisel invents a new wallet ritual. The point is that it exposes the normal transaction spine through a plain browser interface, while preserving copy/paste stop points for audit, hand-editing, node use, or fileProxy-based workflows.
