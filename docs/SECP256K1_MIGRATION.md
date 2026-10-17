# Chisel secp256k1 signing

Noble 3.2.0 is the default production signer in the normal browser pages, standalone driver, CLI and Keeper. Identity signing and verification use the same backend boundary as transaction signing. The default dispatcher refuses to sign if Noble is unavailable. No production transaction is signed again with elliptic for comparison.

The static browser load order is:

```html
<script src="chisel.js"></script>
<script src="chisel.sign.js"></script>
<script src="vendor/noble-secp256k1-3.2.0.browser.js"></script>
<script src="chisel.secp256k1.js"></script>
<script src="chisel.secp256k1.noble.js"></script>
<script src="chisel.sign.backend.js"></script>
<script src="chisel.identity.js"></script>
<script src="chisel.safety.js"></script>
```

All scripts are local. A static checkout needs no package installation, CDN, import map or application build. Web Crypto must be available for hashing and asynchronous Noble signing.

`chisel.secp256k1.js` defines the backend boundary and strict Bitcoin DER/compact conversion. `chisel.secp256k1.noble.js` supplies `getPublicKey`, `signDigest` and `verifyDigest`. For already-hashed Chisel digests it uses `prehash: false`, `lowS: true`, `format: 'compact'` and `signAsync()`. Valid transaction and artifact signature fixtures remain unchanged. The public `CHISEL.signDigest()` function is now asynchronous.

The readable vendor source is `vendor/noble-secp256k1-3.2.0.js`; the classic-script bundle is `vendor/noble-secp256k1-3.2.0.browser.js`. Both are exact-version records in `vendor/checksums.json`, with an MIT license under `THIRD_PARTY_LICENSES/`. The browser bundle was generated from that source with esbuild 0.25.10 (`bundle`, `format: 'iife'`, `globalName: 'ChiselNoble'`, `target: 'es2020'`, no minification). The dependency-free application remains ordinary JS source.

The old elliptic code is retained for explicit legacy compatibility APIs and the offline public-fixture parity tests. Its advisory is not repaired by retaining it. Do not use `setSigningBackend('elliptic')` or `signRawTransactionWithElliptic()` with valuable keys. The normal page and the production dispatcher do not select that path.

Run the offline comparisons with:

```sh
npm ci --prefix tools/secp256k1Migration --ignore-scripts --no-audit --no-fund
npm test --prefix tools/secp256k1Migration
node --test tests/identity-security.test.mjs tests/transaction-security.test.mjs tests/keeper-signing.test.mjs
```

Tests compare compressed/uncompressed keys, deterministic low-S signatures, DER and full serialized transactions using public fixture keys. The 253-input case also verifies the first and final signatures against separately constructed preimages. A poisoned legacy signer test proves ordinary Noble signing does not invoke it.

`tools/secp256k1Migration/litecoin-test.html` now reports the ordinary application's installed Noble backend without reloading the dispatcher or generating legacy signatures. It needs no `node_modules` at runtime.

See [the W42 review response](SECURITY_REVIEW_2026_W42.md) for amount verification, fee policy, parser limits and remaining trust boundaries. This migration does not change WIF or address formats, transaction sighash types, M64 contracts or EVM wallet-extension signing.
