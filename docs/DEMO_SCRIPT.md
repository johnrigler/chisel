# Chisel Demo Script

## 1. Start in Portal

Show that Chisel opens as a reader, not as a wallet asking for a private key.

Explain that a transaction can be read as ordered outputs, OP_RETURN data, amount-level codes, and readable unspendable address lines.

## 2. Show Start

Use Start for the conceptual bridge: vanilla JavaScript, local signing, the 2020 linguistic system, Portal, and the split between core and satellites.

## 3. Open Etch

Show the normal path first:

```text
WIF -> UTXOs -> VIN/VOUT -> raw tx -> signed tx -> broadcast
```

Do not send during a first demo unless the audience already understands the burn/index outputs.

## 4. Show the manual pipeline

Use the manual transaction pipeline to show the separable RPC-style steps:

```text
PREPARE VIN / VOUT FROM FORM
CREATE RAW FROM JSON
SIGN RAW
SEND SIGNED RAW
```

Point out that the JSON and hex boxes are intentionally copy/paste surfaces. A user can stop, edit, save, or move the step to another machine.

## 5. Open Review

Show the raw spine. This is where a technical reviewer can audit exactly what was built and sent.

## 6. Open Tools last

Explain that QR scanning, labels, fileProxy, bunOven, and the legacy decoder are support systems. They are not required to understand the core claim.
