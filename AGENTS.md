# Chisel engineering instructions for contributors and AI maintainers

Read `ARCHITECTURE.md`, `docs/NEXT_DEVELOPMENT.md`, and the relevant wire-format specification before altering a carrier, wallet path, or codec. These are project-specific constraints, **not conventional application defaults**.

## Ledger-native first: no automatic JSON wrapping

- A Chisel record is fundamentally a **ledger transaction and its native fields**. Treat transaction inputs, UTXO outputs, address encoding, OP_RETURN, EVM calldata, contract events, and transaction histories as potential carriers. The destination need not store contract state for transaction data to be durable.
- **Never silently wrap ledger-bound data in JSON. Do not serialize an object to JSON, convert that JSON to UTF-8/binary, then publish it unless the user explicitly asks for this representation.** This is a policy decision, not a harmless implementation detail.
- Preserve the smallest *specified* byte encoding appropriate to each field: 20-byte EVM addresses as 20 bytes, 32-byte digests/hashes as 32 bytes, numeric values as compact integers, dictionary references as compact indexes, and program streams as binary bytes. Avoid spelling these out as JSON keys, hex text, or Base64 text in a binary-capable carrier.
- Text, ASCII, Base64url, and JSON may be useful **intentional** representations for human-readable messages, portable interchange, export/import, debugging, or legacy decoding. They are not implicit ledger storage formats. The choice and its byte cost must be visible. Ask before introducing a new on-chain JSON envelope.
- The M64 transport alphabet has 64 characters; its existing abstract program stream is **binary already**. Base64url is a text transport over that stream, not the compression itself. On EVM, consider storing the decoded binary stream directly. Do not confuse hex RPC display with stored hexadecimal ASCII.
- Format revisions require a version marker and independent reader compatibility. Never reinterpret earlier published records under new rules. Recoverability and deterministic verification matter more than using a familiar serializer.

## Measure actual costs before making a new write

- Report original source bytes, canonical source bytes, abstract M64 binary bytes, Base64url bytes if shown, complete record bytes including every header, final EVM calldata bytes, ABI overhead, and transaction gas.
- Account for data duplicated between calldata and events. An EVM `logRecord` event is not a second transaction, but may carry another charged copy of the same data. Compare direct calldata-only, log/event, and delegated paths, using real receipts when available.
- Account for *amortized* shared dictionary and renderer setup separately from each marginal program record. Show negative compression if full-record bytes exceed the original. Do not optimize a character count while increasing total paid bytes.
- Treat chain-specific alternatives (UTXO address-based encoding, OP_RETURN, EVM transaction data, contract logs, etc.) as first-class options, not deviations to normalize away.

## Wallets, signing, trust, and publication

- Chisel builds transactions; wallets, when used, are replaceable signing and transport adapters. Bitcoin/Litecoin local signing is the reference architecture.
- A wallet's smart-account, EIP-7702, or delegation route is **not** an implicit Chisel requirement. Make the requested destination, actual top-level destination, receipt logs, and any intermediary transparent. Preflight checks alone cannot guarantee the routing outcome.
- Do not broadcast, deploy, append dictionary entries, grant delegations, or spend gas without a specific user-initiated approval in the actual wallet/action flow. Never mistake unsigned calldata for a mined transaction.
- Protocol readers should reconstruct ledger artifacts from ordinary public node/RPC data, independent of a particular wallet, browser extension, or proprietary index.

## Review checklist

Before committing a codec, publishing path, or UI change, answer:

1. Which **exact native ledger bytes** are being published, and in which transaction field(s)?
2. Is any JSON, Base64, hex-as-ASCII, ABI, or copied event payload introduced? Why and at what byte/gas cost?
3. Can an independent decoder recover the original canonical source and verify hashes without the publisher or wallet?
4. Are all earlier transaction versions still readable?
5. Does the implementation preserve direct signing/broadcast options and make routing visible?

The central failure to avoid: **reverting to standard JSON/application abstractions that erase the intended ledger-level compression or self-sovereignty.**
