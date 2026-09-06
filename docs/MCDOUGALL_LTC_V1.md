# McDougall Litecoin specimen v1

This note records the first working two-transaction Litecoin resurrection specimen used by Chisel.

## Canonical root locator

The clean canonical root is:

```text
3172942:28
```

Transaction positions are zero-based within the block transaction array.

The compact four-byte locator for this root is:

```text
30 6a 4e 1c
```

## Root payload

The canonical root uses the proposed versioned v1 form:

```text
01 || previous-height-u24be || previous-tx-index-u8 || tail-bytes
```

Its predecessor locator is:

```text
3172893:13
```

whose compact encoding is:

```text
30 6a 1d 0d
```

The intended canonical root payload is therefore:

```text
01 30 6a 1d 0d 92 65 95 94 32 8e 91 63 82 91 63 85 91 90
```

or, without spaces:

```text
01306a1d0d92659594328e9163829163859190
```

## Predecessor

The predecessor transaction is the transaction whose txid is:

```text
99d2afeed6dc496e4e0f13d1cd304db9cd6adb1d0f90b02dc1e7641cf7bc022b
```

It carries the first 80 raw McDougall abstract bytes in OP_RETURN. The canonical root carries the version byte, backward locator, and final 14 abstract bytes. Reassembly is:

```text
abstract = predecessorPayload || rootTail
```

For the trapezoid specimen this reconstructs a 94-byte abstract stream which hydrates to the canonical JavaScript:

```js
function a(b){const c=b.getContext("2d");const d=b.width;const e=b.height;c.beginPath();c.moveTo(d*.2,e*.8);c.lineTo(d*.8,e*.8);c.lineTo(d*.65,e*.2);c.lineTo(d*.35,e*.2);c.closePath();c.fill();}
```

## Earlier compatibility specimen

The earlier root at:

```text
3172924:19
```

stored the hexadecimal characters as ASCII text in OP_RETURN rather than storing the 19 payload bytes directly. Chisel keeps compatibility logic that detects an ASCII-hex OP_RETURN and unwraps it once before parsing the McDougall root. It remains a useful historical specimen but is not the canonical compact example.

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

The default locator is now `3172942:28`. The resolver resolves block height to block hash through Litecoinspace, gets the zero-based transaction at that position, reads OP_RETURN, follows the backward pointer to `3172893:13`, concatenates the abstract bytes, hydrates JavaScript, and keeps execution behind a separate RUN button.

The resolver also retains support for the earlier ASCII-hex transport form at `3172924:19`.

## Deliberate limits

This is still a specimen format, not the final general protocol. The current resolver assumes one backward hop, a 24-bit block height, an 8-bit transaction index, Litecoin mainnet/testnet lookup through Litecoinspace-compatible endpoints, and the fixed McDougall token profile above. It does not yet include recursive chains, cross-chain locators, embedded profile identifiers, content hashes, signatures, or a larger transaction-index encoding.
