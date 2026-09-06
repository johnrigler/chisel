# McDougall Litecoin specimen v1

This note freezes the first working two-transaction Litecoin resurrection specimen used by Chisel.

## Root locator

The artifact is addressed by the compact Litecoin locator:

```text
3172924:19
```

Transaction positions are zero-based within the block transaction array.

## What is actually on Litecoin

The live root transaction does **not** contain the proposed leading `01` version byte. Its OP_RETURN begins directly with the four-byte predecessor locator:

```text
previous-height-u24be || previous-tx-index-u8 || tail-bytes
```

For this specimen the predecessor locator is:

```text
3172893:13
```

Its compact four-byte encoding is:

```text
30 6a 1d 0d
```

The observed root payload therefore begins with `0x30`, not `0x01`. The resolver treats this exact ledger artifact as the unversioned specimen format.

The proposed versioned form remains supported for later artifacts:

```text
01 || previous-height-u24be || previous-tx-index-u8 || tail-bytes
```

## Predecessor

The predecessor transaction is the transaction whose txid is:

```text
99d2afeed6dc496e4e0f13d1cd304db9cd6adb1d0f90b02dc1e7641cf7bc022b
```

It carries the first 80 raw McDougall abstract bytes in OP_RETURN. The root carries the backward locator and final 14 abstract bytes. Reassembly is:

```text
abstract = predecessorPayload || rootTail
```

For the trapezoid specimen this reconstructs a 94-byte abstract stream which hydrates to the canonical JavaScript:

```js
function a(b){const c=b.getContext("2d");const d=b.width;const e=b.height;c.beginPath();c.moveTo(d*.2,e*.8);c.lineTo(d*.8,e*.8);c.lineTo(d*.65,e*.2);c.lineTo(d*.35,e*.2);c.closePath();c.fill();}
```

## McDougall token profile

Bytes below `0x80` are literal ASCII. Token bytes begin at `0x80`:

```text
80 .getContext("2d")
81 .beginPath()
82 .closePath()
83 .lineTo(
84 .moveTo(
85 .fill()
86 function
87 const
88 return
89 canvas
8a width
8b height
8c ctx
8d (
8e )
8f {
90 }
91 ;
92 ,
93 =
94 .
95 *
96 +
```

## Resolver

Open:

```text
tools/mcdougallResolver/
```

The tool accepts a `blockHeight:txIndex` root locator. It resolves block height to block hash through Litecoinspace, resolves the zero-based transaction position to a txid, reads OP_RETURN, decodes either the live unversioned specimen or the proposed versioned v1 header, follows the backward pointer, concatenates the abstract bytes, hydrates JavaScript, and keeps execution behind a separate RUN button.

The default locator is the live specimen `3172924:19`.

## Deliberate limits

This is a specimen format, not yet the final general protocol. The current resolver assumes one backward hop, a 24-bit block height, an 8-bit transaction index, Litecoin mainnet/testnet lookup through Litecoinspace-compatible endpoints, and the fixed McDougall token profile above. It does not yet include recursive chains, cross-chain locators, embedded profile identifiers, content hashes, signatures, or a larger transaction-index encoding.
