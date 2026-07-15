# What Chisel Proves

Chisel is a browser-first UTXO artifact workbench.

The important claim is not that Chisel has a perfect wallet UI. The claim is that a plain static web page can locally build and sign meaningful UTXO transactions, then use public block explorers, local full nodes, static JSON, and local authoring tools as interchangeable ledger resources.

## Core proof points

1. The browser can sign UTXO transactions locally using `elliptic` / secp256k1 primitives. The WIF does not need to be sent to an API server.
2. Ordered outputs can carry readable structure. A transaction can combine spendable outputs, intentionally unspendable address-lines, OP_RETURN text, and optional amount codes.
3. Public explorers and locally hosted nodes can be treated as generic read resources. They are not the application; they are replaceable sources.
4. The local/static Chisel dataset can become a chain-native graph/index. Portal reads that graph as a transaction stream.
5. fileProxy, bunOven, keeperBun, scanners, labels, and QR tools are satellites. They help author, import, print, and ritualize artifacts, but they should not be required for a public read-only viewer.

## Fast colleague explanation

Open Portal first. It is the reader.

Open Etch second. It is the transaction lab.

Open Review third. It is the raw microscope.

Open Tools only after the core path is clear.
