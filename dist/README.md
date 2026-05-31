# Chisel Driver (`/dist`)

`chisel-driver.js` is the browser-facing driver for external projects such as Squalker.
It is deliberately separate from the Chisel app UI.

Current load order:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js"></script>
<script src="dist/chisel-driver.js"></script>
```

`elliptic` is no longer an external dependency. `CryptoJS` is still external in this patch because `chisel.sign.js` uses it for RIPEMD160. The next clean tech-debt cut should either vendor CryptoJS into `/vendor` + `/dist`, or replace the RIPEMD160 call with a small internal implementation.

This exposes:

- `window.CHISEL`, the core Chisel object.
- `window.CHISEL_DRIVER`, a small driver metadata object.

Included source modules:

1. `chisel.js`, including embedded `elliptic` 6.6.1.
2. `chisel.unspendable.js`.
3. `chisel.sign.js`.
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

Chisel now labels each installed coin extension with transport metadata. This is the line between the reusable driver and the app shell.

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
CHISEL.getCoin("digibyte").TRANSPORT_MODES
CHISEL.getCoin("ravencoin").TRANSPORT_MODES
CHISEL.getCoin("litecoin").TRANSPORT_MODES
```

For a no-network signing sanity check, verify that `window.elliptic.version` is `6.6.1`, `window.CryptoJS` exists, and `CHISEL.signRawTransaction` is a function.
