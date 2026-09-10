# Chisel secp256k1 migration

Status: the Noble migration boundary and guarded test harness are merged into `main`. The Noble path has been exercised successfully through the guarded Litecoin/browser flow. The remaining production cutover is packaging and wiring a pinned standalone browser copy of Noble into the ordinary Chisel page so the legacy elliptic runtime can be removed without breaking static or `file://` use.

Merged from:

```text
noble-secp256k1-migration
```

## Why this exists

Chisel historically vendors elliptic 6.6.1 directly into the browser signing path. That kept the browser runtime self-contained, but it also made the curve implementation a large and sticky dependency. The migration replaces only the secp256k1 primitive while preserving Chisel's transaction formats, WIF handling, address derivation, sighash construction, script construction, and browser-first distribution model.

The target remains vanilla JavaScript. No framework, Node runtime, Hardhat runtime, or wallet extension should be required for Chisel's UTXO signing path.

The target secp256k1 implementation is `@noble/secp256k1`.

## Boundary

`chisel.secp256k1.js` defines the implementation-neutral boundary and the Bitcoin-family DER codec.

The signer interface is:

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

`tools/secp256k1Migration/` is development and regression scaffolding. Its crypto package is an exact pin of:

```text
@noble/secp256k1 3.2.0
```

The harness compares Noble through the Chisel adapter against Chisel's existing vendored elliptic signer.

The fixed vectors cover:

- compressed public-key equality
- uncompressed public-key equality
- deterministic low-S compact-signature equality
- DER-signature equality
- Noble verification of elliptic signatures
- elliptic verification of Noble signatures
- exact full signed-transaction equality for a synthetic one-input Bitcoin-family transaction using the real `chisel.sign.js` serialization path

The generic boundary and DER tests also run without Noble or npm dependencies.

## Guarded live browser test

`chisel.sign.backend.js` is the migration selector layered on top of the existing `chisel.sign.js`.

When Noble is selected, Chisel:

1. derives the public key with Noble and compares it with the legacy signer;
2. signs the transaction with Noble;
3. verifies the Noble signature locally;
4. signs the same transaction again with the legacy elliptic path;
5. compares the complete serialized signed transaction byte-for-byte;
6. refuses to return the Noble transaction if any comparison fails.

The dedicated browser harness is:

```text
tools/secp256k1Migration/litecoin-test.html
```

It loads the ordinary `index.html` in a same-origin frame and injects the migration backend only for the test session.

Local setup from the repository root:

```bash
cd tools/secp256k1Migration
npm install
npm test
cd ../..
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/tools/secp256k1Migration/litecoin-test.html
```

The top strip should say:

```text
READY: Noble active, elliptic parity guard enabled.
```

In the framed Chisel console:

```js
CHISEL.getSigningBackendInfo()
```

should report Noble selected.

The `node_modules` copy of Noble is migration/test scaffolding. The ordinary Chisel browser distribution should not depend on npm, a CDN, or Node at runtime.

## Production cutover

The migration code is now in `main`, but the normal static browser page still needs a standalone pinned Noble artifact before elliptic can be removed safely.

The remaining sequence is intentionally small:

1. vendor or generate a pinned classic-script/IIFE browser build of `@noble/secp256k1` under `vendor/`;
2. load the Noble boundary and adapter from the ordinary Chisel page;
3. make Noble the default production backend;
4. rerun the existing transaction, browser, and chain regression floors without the parity guard;
5. remove the embedded/vendored elliptic runtime and its license record only after no ordinary path loads or calls it.

Do not delete elliptic before step 3. The merged branch still uses it as the legacy default and as a byte-for-byte parity oracle in the guarded migration harness.

## Browser distribution

The final Chisel runtime must remain self-contained and browser-first.

The preferred packaging is a pinned, generated classic-script/IIFE vendor build of `@noble/secp256k1`, committed under `vendor/`, so ordinary Chisel pages and `file://` use do not depend on npm, a CDN, import maps, Node, or a build step at runtime.

The npm package in `tools/secp256k1Migration/` is test/build scaffolding only. It is not the proposed Chisel runtime dependency mechanism.

## Determinism and hedged signatures

Noble 3 supports optional hedged signatures via extra entropy. Do not enable that during compatibility migration. The first objective is deterministic reproducibility against existing Chisel behavior.

After production cutover, hedged signing can be evaluated separately as a security policy decision. It should not be mixed into the compatibility change.

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
