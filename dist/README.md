# Chisel Driver (`/dist`)

`chisel-driver.js` is the browser-facing driver for external projects such as Squalker.
It is deliberately separate from the Chisel app UI.

Current load order:

```html
<script src="dist/chisel-driver.js"></script>
```

There are no required external runtime scripts in v2.6.4. `elliptic` 6.6.1 is embedded in `chisel.js`, and RIPEMD160 is now implemented inside `chisel.sign.js`.

This exposes:

- `window.CHISEL`, the core Chisel object.
- `window.CHISEL_DRIVER`, a small driver metadata object.

Included source modules:

1. `chisel.js`, including embedded `elliptic` 6.6.1.
2. `chisel.unspendable.js`.
3. `chisel.sign.js`, including internal RIPEMD160.
4. `chisel.ravencoin.js`.
5. `chisel.digibyte.js`.
6. `chisel.litecoin.js`.

Excluded on purpose:

- `app.js`
- `index.html`
- `qrScan.html`
- `chisel.portal.js`
- `chisel.thunderwords.js`
- `tools/`

## Coin transport model

Chisel labels each installed coin extension with transport metadata. This is the line between the reusable driver and the app shell.

### Ravencoin

Ravencoin is currently `proxy-rpc` only. The browser driver talks to a trusted proxy, and the proxy talks to the user's node or configured backend.

### Digibyte

Digibyte is hybrid:

- UTXOs are derived from an external address transaction endpoint.
- create/decode/send use the configured proxy RPC path.

The v1 Digibyte code also had an external broadcast path through `https://digibyteblockexplorer.com/sendtx` by POSTing `hex=SIGNED_TX` and scraping an HTML message body. That path is documented as legacy metadata, not used as the default. It is too brittle for the professional driver.

### Litecoin

Litecoin uses public providers through the generic bitcoin-like resource in `chisel.js`, then the app coin extension bridges that resource into the same `CHISEL.installCoin()` shape used by the UI.

## Smoke test

Open a browser console after loading the driver:

```js
CHISEL_DRIVER.VERSION
CHISEL_DRIVER.getCoins()
CHISEL.ripemd160Hex("616263")
typeof window.CryptoJS
typeof CHISEL.signRawTransaction
```

Expected:

- `CHISEL_DRIVER.VERSION` is `2.6.4`.
- `CHISEL.ripemd160Hex("616263")` is `8eb208f7e05d987a9b044a8e98c6b087f15a0bfc`.
- `typeof window.CryptoJS` is `undefined`.
- `CHISEL.signRawTransaction` is a function.


## Related satellite tool

`tools/keyPrint/index.html` uses the same Chisel key/address helpers to create long PNG receipts for private/public key packets. It is not included inside `/dist` because it is an operational browser UI, not the external driver itself.
