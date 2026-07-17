# Chisel refactor map (v2.7.7)

This is an inspection-only map of executable source files. It intentionally excludes JSON datasets, Markdown/text documentation, images, hashes, and license text. `dist/` and vendored code are included because they execute, but are marked as generated/third-party and are not proposed as extraction targets.

## Legend

The dependency columns describe *direct* dependencies in the file (not what a loaded dependency may use).

| Mark | Meaning |
| --- | --- |
| `D` | DOM/browser UI (`document`, elements, canvas, events, print, media/camera) |
| `F` | Network (`fetch`, RPC, HTTP client/server endpoint) |
| `S` | Persistent storage: `B` browser storage, `P` filesystem/SQLite, `-` none |
| `E` | Direct elliptic/secp256k1 dependency |
| `G` | Mutable runtime global: browser `window`/`globalThis`, or Bun/Node process/runtime singleton |
| `A` | Chisel/application-specific state or protocol; `-` means a generic stand-alone tool/library |

“Classification” uses the requested categories. `compatibility/legacy` includes archived, generated, third-party, or obsolete alternate-entry code; it is not a quality judgement.

## Main browser application

| File | Classification | D | F | S | E | G | A | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `index.html` | application/UI | D | - | - | - | G | A | Main shell; script-load order defines the global integration contract. |
| `app.js` | application/UI | D | F | B | - | G | A | Etch/Review/Start controller; owns form state, manual-draft storage, QR handoff, and exposes many `window.*` actions consumed by v277 self-tests. |
| `chisel.portal.js` | application/UI | D | F | B | - | G | A | Portal reader, mutable `state`, rendering, static/local/live sources, annotations, and `window.CHISEL_PORTAL`. |
| `chisel.selftest.js` | application/UI | D | F | B | - | G | A | v277 test/demo runner; calls `app.js` globals and inspects `CHISEL_PORTAL.state`. |
| `fixtures/etch/etch-fixtures.js` | compatibility/legacy | - | - | - | - | G | A | Fixture data installed as `window.CHISEL_ETCH_FIXTURES`; required by the self-test fixture route. |
| `data-bundled/portal-starter.js` | provider/API adapter | - | F | - | - | G | A | Static data bootstrap and fallback fetch; publishes `CHISEL_PORTAL_STARTER_DATA`. |
| `chisel.portal.config.json` | n/a — data/config | - | - | - | - | - | A | Not executable source; listed to make the Portal configuration boundary explicit. |

## Core, signer, and chain adapters

| File | Classification | D | F | S | E | G | A | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `chisel.js` | Chisel core | - | - | - | E | G | A | Browser bundle containing elliptic plus CHISEL encoding/hash/transaction primitives; establishes `window.elliptic` and `window.CHISEL`. |
| `chisel.sign.js` | signer | - | - | - | E | G | A | Installs signing and key functions onto `window.CHISEL`; depends on the embedded elliptic global. |
| `chisel.unspendable.js` | Chisel core | - | - | - | - | G | A | Chisel unspendable-address generator/test helpers; uses Web Crypto if available and exports globals. |
| `chisel.ravencoin.js` | provider/API adapter | - | F | - | - | G | A | Ravencoin coin registration and provider/RPC operations through CHISEL. |
| `chisel.digibyte.js` | provider/API adapter | - | F | - | - | G | A | Digibyte registration plus direct explorer fetch. |
| `chisel.litecoin.js` | provider/API adapter | - | F | - | - | G | A | Litecoin/Testnet adapters over the `CHISEL.litecoin` resource, including broadcast. |
| `chisel.thunderwords.js` | provider/API adapter | - | F | - | - | G | A | Chain/index URL and address/transaction fetch adapter used by Portal. |
| `dist/chisel-driver.js` | compatibility/legacy | - | F | - | E | G | A | Generated public consolidation artifact; includes core/signer/chain code. Do not edit as a first extraction. |
| `vendor/elliptic-6-6-1.js` | compatibility/legacy | - | - | - | E | G | - | Auditable third-party elliptic source. |
| `vendor/elliptic-6-6-1.min.js` | compatibility/legacy | - | - | - | E | G | - | Third-party minified elliptic distribution, dynamically imported by keeperBun. |
| `vendor/ethers-6.6.0.umd.min.js` | compatibility/legacy | - | - | - | - | G | - | Third-party EVM library. |
| `vendor/html5-qrcode.min.js` | compatibility/legacy | D | - | - | - | G | - | Third-party camera/QR reader. |
| `vendor/qrcode.min.js` | compatibility/legacy | D | - | - | - | G | - | Third-party QR renderer. |

## Alternate and legacy browser entry points

| File | Classification | D | F | S | E | G | A | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `chisel.html` | compatibility/legacy | D | - | - | - | - | A | Older static Chisel page; no active script integration. |
| `qrScan.html` | application/UI | D | - | B | - | G | A | QR WIF scanner; loads Chisel globals, camera library, and sends scan payload to the main app. |
| `scan.html` | compatibility/legacy | D | - | - | E | G | A | Obsolete minimal scan entry; references missing `qrHexKeyReader.js` and repeats signer loading. |
| `evm.html` | application/UI | D | F | B | - | G | A | Independent EVM reader/export UI; uses a CDN ethers version rather than the checked-in vendor version. |
| `docs/origin-print.html` | application/UI | D | - | - | - | - | A | Printable, static project explanation; no executable application logic. |

## Service, importer, and operator tools

| File | Classification | D | F | S | E | G | A | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `blockchair-doge.js` | provider/API adapter | - | F | - | - | G | A | Bun Blockchair Dogecoin normalizer, fileProxy client, and broadcast adapter. |
| `hydrate-utxo-block-times.py` | provider/API adapter | - | F | P | - | G | A | Hydrates UTXO transaction timestamps in Chisel data trees. |
| `tools/chisel-api.sh` | provider/API adapter | - | F | - | - | G | A | Command-line RPC/API convenience wrapper. |
| `tools/bunOven/import-jist-to-fileProxy.js` | provider/API adapter | - | F | P | - | G | A | Bun feed reader and fileProxy import client. |
| `tools/dataCatalog/make_snapshot.py` | chain-neutral tool | - | - | P | - | G | A | Filesystem snapshot/catalog generator for the project dataset. |
| `tools/dgbProxy/dgbProxy.py` | provider/API adapter | - | F | P | - | G | A | Digibyte proxy service/configuration. |
| `tools/ravenProxy/ravenProxy.py` | provider/API adapter | - | F | P | - | G | A | Ravencoin proxy. |
| `tools/ravenProxy/ravenProxy2.py` | compatibility/legacy | - | F | P | - | G | A | Second/older Ravencoin proxy implementation. |
| `tools/fileProxy/proxy.py` | provider/API adapter | - | F | P | - | G | A | Local HTTP datastore, importer, raw file, index, and save API. |
| `tools/evmLegacyImages/import_legacy_gomez_images.py` | compatibility/legacy | - | F | P | - | G | A | One-off legacy EVM image importer. |

## keeperBun

| File | Classification | D | F | S | E | G | A | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tools/keeperBun/keeper-common.js` | chain-neutral tool | - | - | - | - | G | - | Generic Bun/Node parsing, hashing, challenge, and wire helpers. |
| `tools/keeperBun/keeper-crypto.js` | signer | - | - | - | E | G | A | Litecoin WIF/address/challenge signing; dynamically imports vendored elliptic. |
| `tools/keeperBun/keeperd.js` | provider/API adapter | - | F | P | - | G | A | Bun SQLite-backed local keeper HTTP service. |
| `tools/keeperBun/keeper-init.js` | provider/API adapter | - | F | - | - | G | A | Keeper initialization client. |
| `tools/keeperBun/login-litecoin.js` | signer | - | F | P | E | G | A | Reads payload and uses keeper crypto to authenticate with Litecoin WIF. |
| `tools/keeperBun/start-keeperd.example.sh` | compatibility/legacy | - | - | - | - | G | A | Example launch wrapper, not library code. |

## Stand-alone UI and legacy utility tools

| File | Classification | D | F | S | E | G | A | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tools/decoder/index.html` | compatibility/legacy | D | F | - | - | G | A | Legacy transaction decoder/RPC diagnostic UI. |
| `tools/boxLabels.html` | chain-neutral tool | D | - | B | - | G | A | Print/QR label tool; contains a Ravencoin transaction field but no Chisel runtime dependency. |
| `tools/keyPrint/index.html` | application/UI | D | - | B | - | G | A | Chisel-backed key/QR print UI; loads all main chain globals. |
| `tools/qrField/index.html` | chain-neutral tool | D | - | - | - | G | - | Stand-alone QR field generator. |
| `tools/camera/index.html` | chain-neutral tool | D | - | - | - | G | - | Stand-alone camera page. |
| `tools/recorder/index.html` | chain-neutral tool | D | - | - | - | G | - | Browser recorder utility. |
| `tools/base64/index0.html` | compatibility/legacy | D | - | - | - | G | - | Earlier base64 utility page. |
| `tools/base64/index1.html` | compatibility/legacy | D | - | - | - | G | - | Earlier base64 utility page. |
| `tools/base64/index_base64_mcdougal_opreturn.html` | compatibility/legacy | D | - | - | - | G | A | One-off MacDougall/OP_RETURN base64 page. |
| `tools/base64/table.html` | compatibility/legacy | D | - | - | - | G | - | Base64 reference/table page. |
| `tools/htmlWord/index0.html` | compatibility/legacy | D | - | - | - | G | - | Earlier HTML-word editor. |
| `tools/htmlWord/index1.html` | compatibility/legacy | D | - | - | - | G | - | Earlier HTML-word editor. |
| `tools/htmlWord/wordHtml.html` | compatibility/legacy | D | - | - | - | G | - | HTML-word utility variant. |
| `tools/htmlWord/wordHtml2.html` | compatibility/legacy | D | F | - | - | G | - | HTML-word utility variant with CDN JSZip. |
| `tools/unspendable/snippet.js` | compatibility/legacy | - | - | - | - | G | A | Ad-hoc console snippet expecting a global `unspendable` function. |
| `tools/unspendable/testLoop.js` | chain-neutral tool | - | - | - | - | G | A | Console runner for `CHISEL_UNSPENDABLE`; no DOM. |

## Bundled QR library copy

| File | Classification | D | F | S | E | G | A | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tools/qrField/lib/davidshimjs-qrcodejs-04f46c6/index.html` | compatibility/legacy | D | - | - | - | G | - | Third-party QR demo page. |
| `tools/qrField/lib/davidshimjs-qrcodejs-04f46c6/index-svg.html` | compatibility/legacy | D | - | - | - | G | - | Third-party SVG QR demo page. |
| `tools/qrField/lib/davidshimjs-qrcodejs-04f46c6/jquery.min.js` | compatibility/legacy | D | F | - | - | G | - | Third-party jQuery distribution (its AJAX capability is network-capable). |
| `tools/qrField/lib/davidshimjs-qrcodejs-04f46c6/qrcode.js` | compatibility/legacy | D | - | - | - | G | - | Third-party QR implementation. |
| `tools/qrField/lib/davidshimjs-qrcodejs-04f46c6/qrcode.min.js` | compatibility/legacy | D | - | - | - | G | - | Third-party minified QR implementation. |
| `tools/qrField/lib/davidshimjs-qrcodejs-04f46c6/qrReader.js` | compatibility/legacy | D | - | - | - | G | - | Third-party/browser QR reader implementation. |

## Smallest safe first extraction

Extract only Portal’s static-dataset transport/normalization boundary from `chisel.portal.js` into a new, non-DOM module (for example `chisel.portal.static-data.js`). Keep the existing `window.CHISEL_PORTAL` API and `state` object exactly where they are.

Move these functions and their URL helpers as a single unit: `isAbsoluteUrl`, `trimUrlSlash`, `dirnameUrl`, `joinDataPath`, `normalizePathList`, `fetchJsonNoStore`, `staticRowToPortalRow`, `normalizeStaticDatasetRows`, `loadStaticManifest`, `fetchStaticRawFromRow`, and the hash-fetch portion of `validateStaticDataset`. Supply the module with injected operations instead of globals:

```
Portal UI/state ──inject──> static-data boundary ──> fetch / Web Crypto
       │                         │
       └── keeps row merge, status, and CHISEL_PORTAL methods unchanged
```

The boundary should return rows/reports/raw payloads only. `chisel.portal.js` must retain `mergeStaticRows`, `state.staticRawByTxid` updates, `setStatus`, `setText`, and public wrappers (`loadEmbeddedStaticDataset`, `loadConfiguredStaticDatasets`, `validateStaticDataset`). That keeps behavior and globals stable while extracting the code that has no DOM need.

Why this is the smallest low-risk first step:

- It avoids `chisel.js`/`chisel.sign.js`, elliptic loading, serialization, WIF handling, UTXO selection, and broadcast paths.
- It does not change `app.js` globals that `chisel.selftest.js` invokes.
- It preserves the v277 checks: embedded starter boot, Portal state presence/rows, bundled index fetches, and `CHISEL_PORTAL.validateStaticDataset()`.
- It needs only one new script tag, placed before `chisel.portal.js`, plus thin delegation calls; no module loader or build-system introduction is required.

Before implementing that extraction, run the existing browser sequence over HTTP (`python3 -m http.server 8787`, then `index.html?mode=start` → **RUN ALL SELF TESTS**) and retain the same run afterward. The data-bundled link check is intentionally skipped under `file://`.
