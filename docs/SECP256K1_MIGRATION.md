# Chisel secp256k1 migration

Status: experimental branch work. Do not remove the existing elliptic signer until the complete transaction gates below pass.

Branch:

```text
noble-secp256k1-migration
```

## Why this exists

Chisel currently vendors elliptic 6.6.1 directly into `chisel.js`. That keeps the browser runtime self-contained, but the current elliptic release has an unresolved signing advisory. The migration goal is to replace only the secp256k1 primitive while preserving Chisel's transaction formats, WIF handling, address derivation, sighash construction, script construction, and browser-first distribution model.

The target remains vanilla JavaScript. No framework, Node runtime, Hardhat runtime, or wallet extension should be required for Chisel's UTXO signing path.

## Boundary

`chisel.secp256k1.js` defines the implementation-neutral boundary and the Bitcoin-family DER codec.

The intended signer interface is:

```text
getPublicKey(privateKey, compressed)
signDigest(digest32, privateKey32)
verifyDigest(digest32, signature, publicKey)
```

`chisel.secp256k1.noble.js` adapts `@noble/secp256k1` to that boundary.

For Chisel transaction digests the Noble adapter deliberately uses:

```text
prehash: false
lowS: true
format: compact
```

and `signAsync()`. The digest entering the signer is already the 32-byte transaction sighash and must not be SHA-256 hashed again by the curve library.

The dependency-free Noble async path is preferred because Chisel's signing flow is already asynchronous. This avoids adding `@noble/hashes` merely to enable Noble's synchronous signing API.

## DER boundary

`@noble/secp256k1` intentionally emits compact 64-byte `r || s` signatures rather than Bitcoin DER. Chisel owns the small DER conversion layer:

```text
Noble compact r || s
        |
Chisel compactToDer()
        |
DER signature
        |
append chain sighash byte
```

The DER codec has independent tests for positive sign-byte insertion, redundant-leading-zero removal, strict decode behavior, and exact 32-byte scalar reconstruction.

## Current parity floor

`tools/secp256k1Migration/` is a temporary development harness. Its only crypto package is an exact pin of:

```text
@noble/secp256k1 3.2.0
```

The harness compares Noble through the Chisel adapter against Chisel's exact vendored `vendor/elliptic-6-6-1.min.js`.

The current fixed vectors prove:

- compressed public-key equality
- uncompressed public-key equality
- deterministic low-S compact-signature equality
- DER-signature equality
- Noble verification of elliptic signatures
- elliptic verification of Noble signatures

The generic boundary and DER tests also run without Noble or npm dependencies.

## Migration gates

Do not replace production signing in one jump. Move through these gates in order.

### 1. Primitive parity

Current state: active and passing on the initial fixed vectors.

Expand the vector set before production cutover, including boundary-value private keys and varied 32-byte digests.

### 2. Common Chisel seam

Route the existing common public-key derivation and signing functions through the new boundary. Coin plugins should continue calling the same Chisel APIs they call today.

Keep the legacy elliptic backend available behind an explicit development switch while this gate is active.

### 3. Complete transaction parity

For each supported Bitcoin-family chain, freeze at least one complete known transaction fixture:

```text
private key / WIF
 -> public key
 -> address
 -> previous output script
 -> transaction sighash
 -> compact signature
 -> DER signature + sighash byte
 -> scriptSig
 -> serialized signed transaction
 -> txid
```

Initial chain floor:

```text
DigiByte
Litecoin
Dogecoin
Ravencoin
```

Where the transaction is deterministic, old and new signed transaction bytes should match exactly. At minimum, both implementations must produce independently valid signatures and identical transaction semantics.

### 4. Browser distribution

The final Chisel runtime must remain self-contained and browser-first.

The preferred packaging is a pinned, generated classic-script/IIFE vendor build of `@noble/secp256k1`, committed under `vendor/`, so ordinary Chisel pages and `file://` use do not depend on npm, a CDN, import maps, Node, or a build step at runtime.

The npm package in `tools/secp256k1Migration/` is test/build scaffolding only. It is not the proposed Chisel runtime dependency mechanism.

### 5. Remove elliptic

Only after the primitive, full-transaction, browser, and existing regression floors all pass:

- switch the default Chisel backend to Noble;
- remove the embedded elliptic bundle from `chisel.js`;
- stop loading or shipping the old vendor file except where retained as a historical test fixture;
- update third-party license records;
- rerun all chain fixtures and browser checks.

## Determinism and hedged signatures

Noble 3 supports optional hedged signatures via extra entropy. Do not enable that during parity migration. The first objective is deterministic reproducibility against existing Chisel behavior.

After the migration is complete, hedged signing can be evaluated separately as a security policy decision. It should not be mixed into the compatibility change.

## Non-goals

This migration does not change:

- M64
- Solidity or smart contracts
- ethers v6
- EVM wallet-extension signing
- transaction serialization
- chain fee policy
- WIF formats
- address formats

The point is to make secp256k1 a small replaceable primitive rather than letting the curve implementation leak into the rest of Chisel.
