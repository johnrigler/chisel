# Chisel Driver (`/dist`)

`chisel-driver.js` is the browser-facing driver for external projects such as Squalker.
It is deliberately separate from the Chisel app UI.

Current load order:

```html
<script src="dist/chisel-driver.js"></script>
```

The 2.8.1 driver is self-contained, including pinned Noble 3.2.0, the signing boundary, strict parsing, identity and transaction safety. Elliptic remains embedded for explicit offline legacy comparisons; ordinary signing uses Noble. The UI-specific receipt loader is excluded.

Regenerate after editing source modules with `node tools/build-driver.mjs`; CI verifies it with `--check`. The manifest records every included module and its hash.

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

- `CHISEL_DRIVER.VERSION` is `2.8.1`.
- `CHISEL.ripemd160Hex("616263")` is `8eb208f7e05d987a9b044a8e98c6b087f15a0bfc`.
- `typeof window.CryptoJS` is `undefined`.
- `CHISEL.signRawTransaction` is a function.


## Related satellite tool

`tools/keyPrint/index.html` uses the same Chisel key/address helpers to create long PNG receipts for private/public key packets. It is not included inside `/dist` because it is an operational browser UI, not the external driver itself.
