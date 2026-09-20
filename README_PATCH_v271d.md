# Chisel v2.7.1d — smart OP_RETURN input

The Etcher now has one OP_RETURN data field instead of separate ASCII and hex fields.

## Input behavior

- Even-length hexadecimal text is treated as hex.
- Base64 or Base64URL with a distinguishing character (`=`, `+`, `/`, `-`, or `_`) is decoded to bytes and then represented as hex.
- Other input is encoded as UTF-8 text.
- The live readout shows the chosen interpretation and payload byte count.
- The selector can force UTF-8, hex, or Base64.
- In automatic mode, the prefixes `text:`, `ascii:`, `utf8:`, `hex:`, `base64:`, `b64:`, `base64url:`, and `b64url:` force an interpretation and are not included in the payload.
- A leading `0x` forces hexadecimal input.

Some strings are valid in more than one encoding. For example, `deadbeef` can be text or hex, and an unpadded alphanumeric Base64 string can look like ordinary text. Automatic mode chooses hex first, then strongly identifiable Base64/Base64URL, then UTF-8. Use the selector or a prefix when the intended interpretation differs.

Legacy callers of `CHISEL.resolveOpReturnHex()` using `opReturnAscii`, `opReturnText`, or `opReturnHex` remain supported. New callers can use `opReturnData` with optional `opReturnEncoding`.
