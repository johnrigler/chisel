## v2.7.4

- Portal now preloads a bundled/static dataset before any fileProxy or live ledger work.
- Added `data-bundled/manifest.json`, `data-bundled/index/portal.index.json`, and `data-bundled/portal-starter.js` so the first Portal page renders immediately from static records.
- Added explicit static refresh, dataset validation, live ledger search, and clear-stream controls.
- Changed Portal loaders to merge into the stream by default; Gomez/Jethro/static/live rows no longer intentionally erase each other.
- Moved fileProxy/EVM-local controls under authoring options. fileProxy, bun, deno, and local import scripts are build/import/publish tools, not public runtime dependencies.
- Portal row keys are source-aware (`sourceId:txid`) and rows show bundled/static/preloaded/summary/hydrated badges.
- Config defaults now prefer static-first public loading and optional live ledger search; local fileProxy autoload is off.

# Patch notes

## v2.7.3

Low-risk documentation and Origin mode expansion.

- Expanded `docs/origin.md` to open with why Chisel is built as vanilla browser JavaScript.
- Added the Keir Finlow-Bates signing-context note and explained how `elliptic` made browser-side secp256k1 signing practical.
- Added QR stickers / label tools to the origin story as part of the mundane-transaction adoption layer.
- Updated `docs/origin-print.html` with a new first section and refreshed page layout.
- Updated the Origin panel copy and version string to 2.7.3.
- No signing, WIF, fee, UTXO selection, serialization, or broadcast behavior changed.

## v2.7.2

Low-risk orientation pass. No signing, fee, UTXO selection, serialization, or broadcast behavior was intentionally changed.

- Added `docs/origin.md` as the white-paper-to-Chisel bridge.
- Added `docs/origin-print.html` for printable review copies.
- Added `docs/refactor-phases.md` to define the safe cleanup order.
- Added an Origin mode to the main app shell.
- Demoted Decode language to legacy diagnostic wording while keeping the decoder link available.
- Corrected visible UI spelling to MacDougall where new reader-facing text was touched.
- Updated app shell version string to 2.7.2.


## v2.6.9l

- Fixed expanded Portal rendering for EVM catalog image rows.
- EVM image assets now render in the expanded area before media cards and before hydration/raw JSON is required.
- Prevented duplicate EVM image blocks after a row hydrates.
- Kept expanded rows pinned in the current rendered list so hydration/sorting cannot make the opened row appear to vanish.
- Bumped Portal cache string to `2.6.9l`.

# v269d patch notes

This patch stops the portal from inflating the visible transaction list during background hydration.

## Changes

- Disabled automatic local fileProxy transaction loading on page open. The local cache can contain every saved rabbit trail and should not be merged into the public root stream by default.
- Disabled automatic sender/rabbit-trail fetching by default. Rabbit trail targets are still discovered and displayed as metadata, but their transactions are not auto-added to the paged stream.
- Added a portal load generation guard so stale background hydration from an older load cannot append rows after a new load starts.
- Reset portal rows when loading a new root stream, custom address stream, or manual local fileProxy stream.
- Kept page size at 20. Page count now reflects the active stream, not old local cache or recursive discoveries.

## Config keys

```json
{
  "autoLoadLocalTransactions": false,
  "pollLocalTransactionsMs": 0,
  "rabbitTrailSenders": false,
  "autoFetchRabbitTrails": false
}
```

Set `autoFetchRabbitTrails` to `true` only for debugging crawler behavior. It should stay `false` for a normal public portal.

## v2.6.3 - QR scanner currency registry

- qrScan.html now builds its currency dropdown from installed Chisel coin extensions instead of hard-coded Ravencoin/Digibyte options.
- Added Litecoin and Litecoin Testnet support to qrScan.html by loading chisel.litecoin.js.
- qrScan.html now honors ?currency=... / ?coin=... after the dynamic currency list is built.
- Updated index.html scanner copy to describe the registry-driven scanner.
- Left the scanner as a separate page for now. Full inline integration into index.html would drag camera lifecycle, html5-qrcode, and sticker-state code into the transaction shell. That should wait until the /dist driver boundary is stable.

## v2.6.2 - internal RIPEMD160 + sealed dist driver

- Added a small internal RIPEMD160 implementation to `chisel.sign.js`.
- Replaced the previous `CryptoJS.RIPEMD160` call with `CHISEL.ripemd160Bytes()` and `CHISEL.ripemd160Hex()`.
- Removed the CryptoJS CDN script tag from `index.html` and `qrScan.html`.
- Rebuilt `dist/chisel-driver.js` so the driver no longer has CryptoJS or elliptic runtime dependencies.
- Updated `dist/chisel-driver.manifest.json`, `dist/chisel-driver.sha256`, and `dist/README.md`.
- Verified RIPEMD160 against standard test vectors and confirmed `CHISEL.signRawTransaction` loads without `window.CryptoJS`.


## v2.6.1 - dist driver + coin transport metadata

- Added `dist/chisel-driver.js` as the first professional single-file browser driver for external projects.
- The dist driver includes core Chisel, embedded elliptic, unspendable helpers, signing, and the Ravencoin/Digibyte/Litecoin coin extensions.
- App/UI modules are intentionally excluded from dist.
- Added `dist/chisel-driver.manifest.json` and `dist/chisel-driver.sha256` for auditability.
- Added explicit coin extension transport metadata so external users can tell whether a coin uses proxy RPC, public providers, external explorer UTXO lookup, or legacy external broadcast behavior.
- Documented the old v1 Digibyte external `sendtx` broadcast route as legacy, not default.

# Chisel v2.4.3c patch

First Litecoin GUI bridge.

## Changes

- Bumped UI version and cache-busting query strings from `2.4.3b` to `2.4.3c`.
- Added `chisel.litecoin.js` to the main page load order.
- Replaced the broken experimental Litecoin coin file with a thin GUI coin bridge over the existing `CHISEL.litecoin` resource/provider layer.
- Installed two GUI currency choices:
  - `litecoin` / Litecoin mainnet
  - `litecoinTestnet` / Litecoin Testnet
- Let the existing broadcaster skip JSON-RPC client loading for provider-backed coins.
- Reused the existing GUI fields for Litecoin:
  - WIF
  - fee
  - OP_RETURN ASCII/HEX
  - extra recipients
  - provider list in the former RPC/API URL field
- Added local raw transaction construction for legacy Litecoin P2PKH outputs.
- Added local decode via `CHISEL.parseRawTransactionDetailed()` for Litecoin.
- Added provider broadcast through `CHISEL.litecoin.broadcastRawTransactionWithReport()`.
- Updated GitHub workflow checks for `chisel.litecoin.js`.

## Scope limits

- Litecoin GUI path is legacy P2PKH only.
- Bech32/P2SH inputs and outputs are not supported in this bridge.
- Ravencoin IPFS output field is rejected for Litecoin.
- Litecoin uses public providers, not the Ravencoin/Digibyte RPC proxy model.


## v2.6.0 - elliptic dependency consolidation

- Embedded elliptic 6.6.1 browser minified build directly into `chisel.js`.
- Removed the separate `vendor/elliptic-6-6-1.min.js` script dependency from `index.html` and `qrScan.html`.
- Preserved `vendor/elliptic-6-6-1.min.js` and `vendor/elliptic-6-6-1.js` as audit/source artifacts, not runtime dependencies for the main pages.
- Preserved the MIT license notice in `THIRD_PARTY_LICENSES/elliptic.txt` and added an embedded-source banner in `chisel.js`.
- Bumped the `chisel.js` cache token in `index.html` to `2.6.0`.

## v2.6.4

- Added `tools/keyPrint/index.html`, a long-PNG key instaprint tool for paper-wallet workflows.
- The tool derives WIF/private-hex input into Chisel coin address/public-key packets.
- The tool can render private WIF, private hex, address, compressed public key, and a public manifest as QR/text sections in one long PNG.
- Added optional local device storage under `localStorage.chisel.keyPrint.records.v1` for repeat instaprinting.
- Added the key instaprint tool to the main Tools page.

## 2.6.6 local explorer / fileProxy decode-portal patch

- Reworked `tools/fileProxy/proxy.py` into a ledger-object filesystem bridge.
- Added txid fixture lookup through `/txids` and `/tx`.
- Added IPFS fixture lookup through `/ipfs`.
- Added local image/base57 asset lookup through `/find-assets` and raw serving through `/raw`.
- Portal now has a `Local fileProxy ledger store` panel.
- Portal can list txid fixtures, render selected local transactions, and show local image assets tied to a txid or reconstructed CID.
- Portal still supports live Thunderword indexes and Babel/rabbit-trail stream loading.
- Decode was rebuilt as a small local block-explorer page instead of a Ravencoin-only fixture viewer.
- Decode now tries fileProxy first, then relative `../../txids/<txid>`, then live Ravencoin RPC.
- Decode classifies standard/change outputs separately from Chisel label outputs and renders base57 image rows automatically.

Test path:

```bash
cd v265
python3 tools/fileProxy/proxy.py
# open index.html?mode=portal
# open tools/decoder/index.html
```

## v269b portal timestamp + stream visibility patch

- Portal summaries now accept `time`, `blocktime`, `blockTime`, `block_time`, and `status.block_time`. This fixes Ravencoin verbose-RPC transactions rendering as `unknown` date even when the tx JSON contains a normal Unix timestamp.
- Thunderword address transaction normalization now carries `time` / `blocktime` from explorer/RPC results into stream rows when available.
- fileProxy transaction indexes now summarize Ravencoin-style `time` / `blocktime`, so cached local rows sort and display correctly after reindexing.
- The “Load all default streams” report now renders the root index report in the visible Sources section, so Litecoin/Ravencoin/Digibyte attempts are visible even if a stream returns zero rows or an endpoint fails.
- Bumped browser cache query strings for `chisel.thunderwords.js` and `chisel.portal.js`.


## v269c portal paging + inline record patch

- Portal stream now renders a fixed page of 20 transactions at a time, newest first.
- Added `page1 ... pageN` controls above the transaction stream.
- Removed the normal user-facing dependency on the separate “current transaction” viewport. The old viewport remains hidden as a compatibility sink for legacy direct-tx controls.
- Added inline `+` / `-` expansion per transaction row.
- Expanded rows resolve transaction JSON local-first, then render decoded links, drill-down targets, decoded MacDougal lines, semantic records, and raw JSON in-place.
- `LOAD ALL DEFAULT STREAMS` now fetches root index txid lists first, sorts the merged stream, renders page1, then hydrates transaction details and rabbit trails in the background.
- Portal auto-loads default streams when opened directly as `index.html?mode=portal` and `autoLoadConversationStreams` is enabled.
- Added portal config keys: `autoLoadConversationStreams`, `backgroundHydrateTransactions`, and `portalPageSize`.

## v2.6.9e

- Render Base57 image chords directly inside expanded portal rows.
- For image transactions, keep the image first and place decoded links, semantic records, decoded lines, and raw JSON behind a collapsed inline drawer labelled `show other record data`.
- Added `inlineImageScale` to `chisel.portal.config.json` so the same renderer can be reused for BSV or other future image-carrying chains without changing the row UX.
- Browser-only patch. No fileProxy restart required.


## v269f EVM split-feed persistence

- `evm2.html` can now parse an Etherscan v2 `account.txlist` JSON response from the Raw Response textarea.
- Added `Use Jethro`, `Parse raw textarea`, and `Save split tx files to data/` controls.
- Added contract/stream naming so Gomez, Jethro, and later contracts do not collapse into one flat EVM bucket.
- Split EVM transaction files are written through fileProxy under:

```text
data/transactions/evm/<chainid>/<contract-name>-0x<address-prefix>/<base58hash>-<hash-prefix>.json
```

- Added fileProxy endpoints:

```text
/save-evm-tx
/save-evm-batch
```

- fileProxy now automatically allows a symlinked `data/` directory target as an allowed data root. This supports the persistent Chisel data store at `/home/john/daisy/2026/chisel-data` without requiring `CHISEL_DATA_ROOT` every time.
- The local transaction indexer now summarizes EVM transaction wrappers: `timeStamp`, `blockNumber`, method id, function name, contract name, contract address, and Polygonscan/Etherscan explorer URL.
- Portal timestamp/summary extraction now recognizes EVM wrapper fields, but EVM feed ingestion into the main portal remains conservative. These files can be indexed locally now; a fuller EVM portal view can come later.

## v269g EVM Gomez/Jethro incremental split pull

- `evm2.html` now has saved Gomez and Jethro profiles.
- Added `Check Gomez`, `Check Jethro`, and `Check selected + save new` buttons.
- When a saved profile is selected, the page asks fileProxy for the latest saved local split block and fills `startBlock` with the next block.
- Incremental checks fetch from `latestBlock + 1` and automatically call split-save when new rows appear.
- Added lightweight Jethro decoding for `mapArtifact(string artifact,string body)` alongside Gomez `tell(...)` decoding.
- Added fileProxy `GET /evm-stream-status` to summarize a contract stream directory without forcing the browser to scrape the whole local transaction index.
- This patch changes `tools/fileProxy/proxy.py`; restart fileProxy before using the new EVM stream status endpoint.

## v269h legacy Gomez EVM image catalog patch

- Added a legacy Gomez image importer for the old `easyBase/server/137_block_pos` files created by `evm_img_decode.php`.
- Added the C2/C3 mojibake repair decoder used by the old PHP script, while keeping normal image detection for cleaner future EVM payloads.
- Added persistent EVM image asset catalog output under `data/assets/evm/<chain>/<contract>/images/`.
- Added `_image-manifest.json` and one metadata JSON file per recovered image.
- Added fileProxy endpoints:
  - `GET /evm-image-catalog`
  - `POST /import-legacy-evm-images`
- Added `tools/evmLegacyImages/import_legacy_gomez_images.py` as a command-line wrapper for the importer.
- Updated `evm2.html` with a Legacy Gomez image recovery panel.
- EVM split save now recognizes inline decoded image payloads and writes normal image assets when possible.
- EVM transaction summaries now expose image asset fields for later portal integration.


## v269i portal EVM catalog bridge + snapshot tool

- Added a local EVM catalog bridge for Portal.
- Added Gomez and Jethro EVM checkboxes plus a `LOAD EVM LOCAL` button in the main transaction stream panel.
- Added `GET /evm-local-catalog` to fileProxy. It joins split EVM transaction wrappers with the EVM image manifest so Gomez image assets can appear as normal Portal rows.
- Added `data-root:` support to fileProxy `/raw`, so persistent assets under `CHISEL_DATA_ROOT` can be served without copying them back into each release directory.
- Added EVM image thumbnails in the Portal stream and larger EVM images in the expanded row.
- Increased expanded Base57 image rendering through `inlineImageExpandedScale`; thumbnail scale is now separate as `inlineImageThumbScale`.
- Added `tools/dataCatalog/make_snapshot.py` to create compact metadata-only data snapshots for debugging catalog behavior.
- Bumped Portal cache strings to `2.6.9i`.

Restart note: this patch changes `tools/fileProxy/proxy.py`, so restart fileProxy.

## v269j portal source filters + safer EVM record display

- Added Portal source filters for DGB, RVN, LTC, BTC, Gomez EVM, Jethro EVM, and Other.
- Added `only Gomez`, `only Jethro`, and `show all` focus buttons. Filtering changes visibility only; it does not delete loaded rows or re-run a pull.
- Added a stream search box for words/title/hash/decoded EVM data. This makes Gomez word-address lookups such as `apocalypse` visible once the Gomez local catalog is loaded.
- FileProxy now cleans HTML-ish Gomez/Jethro text for Portal titles instead of showing raw `<a href=...>` material in the feed.
- EVM summaries now expose `cleanText`, `evmWords`, `evmReceivers`, `evmAmounts`, and `recordKind` for safer display and search.
- Expanded EVM rows now show a decoded record block with text, record links, receiver-address words, and receiver address/amount rows. The raw transaction JSON remains behind the existing drawer.
- Bumped Portal cache strings to `2.6.9j`.

Restart note: this patch changes `tools/fileProxy/proxy.py`, so restart fileProxy.

## v269k Gomez media-card rendering

- Adds safe Gomez/EVM media-card extraction in fileProxy catalog summaries.
- Parses old `tell()` HTML blocks without evaluating them: `href`, `src`, YouTube embeds, `youtu.be`, Spotify embeds, archive.org/audio links, and plain URL text become clickable media records.
- Converts YouTube embed/watch/live/short URLs into canonical watch links and deterministic thumbnail URLs (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`).
- Adds Portal media-card rendering for EVM rows: thumbnails in the row when available, larger cards in expanded rows, plain text/links only, no HTML evaluation.
- Adds local post-production override support at `data/overrides/evm-media-overrides.json`; see `tools/dataCatalog/evm-media-overrides.example.json`.
- Snapshot helper now includes the `overrides/` directory in metadata/full snapshots.

## v2.6.9m - Gomez media hydration keeps cards

- Rebuilds Gomez/Jethro media cards client-side from hydrated raw EVM wrappers.
- Prevents hydration from replacing a rich fileProxy catalog summary with an older stored wrapper summary that lacks mediaCards.
- Extracts YouTube URLs from malformed old Gomez snippets such as `<a href=<iframe ... src="https://www.youtube.com/embed/...">`.
- Keeps the row thumbnail source and expanded media-card source aligned for YouTube/Spotify/link records.
- Browser-only patch; fileProxy restart is not required.

## v2.7.0 portal review patch

- Moved `portalPageControls` below `portalTransactionList`, so page navigation lives at the bottom of the viewport instead of above it.
- Removed the previous behavior that appended expanded rows from other pages into the current page slice. Expanded Gomez/Jethro records now disappear normally when the page changes.
- Page changes now collapse inline rows, clear the selected inline row, and reset the transaction-list scroll position to the top of the new page.
- Added a local-only Portal annotation editor on each expanded row with `Category`, `Note`, and `Fix / cleanup` fields.
- Annotations are saved in browser `localStorage` under `chisel.portal.annotations.v1`; no ledger writes, no fileProxy dependency, and no transaction JSON mutation.
- Annotated rows show `cat:<category>`, `note`, and/or `fix` in the existing stream flag column.

FileProxy restart is not required for this browser-only patch.
