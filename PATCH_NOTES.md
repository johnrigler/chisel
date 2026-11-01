# 2.8.28 — interaction history and dated comments

- Add a shared **Viewing now** history with public record titles/synopses, newest-first activity, older pages and record reopening. Log page arrivals, selections, media opens and reconstructed-function activity without logging key fields, keystrokes or browser-only notes.
- Add separate append-only dated comments to expanded records and record pages. A loaded identity signs comments with its canonical Litecoin identity; readers verify signatures before labeling authors. Export each original JSON document with its signature proof at the bottom.
- Queue interactions locally when FileProxy is unavailable or needs updating. Preserve pending IDs/signatures across reloads, scope queues to their selected API, expose pause/export/clear controls, and preserve active comment drafts during background updates.
- Add the corresponding append/read/download API in Mogwai FileProxy. Pull Mogwai and restart each configured FileProxy process to enable shared history. See `docs/INTERACTION_HISTORY.md`.

# 2.8.27 — incremental Portal rendering

- Keep visible transaction rows mounted by chain/TXID identity. Update changed headers and detail sections, reconcile chronological order, and anchor a scrolled list as new records arrive.
- Retain note editors, unsent drafts, caret/focus, payload controls, open drawers and unchanged images during background reads. Keep the same reconstructed-function iframe and canvas when its source is unchanged; dispose it when the function changes or the row leaves the page.
- Apply the same section updates to individual record pages, including while a note is being edited. Reuse pagination controls during background refreshes. Keep source selection, the read queue, transaction creation and signing behavior unchanged.

# 2.8.26 — shared Portal read queue

- Coordinate transaction hydration, visible date/amount reads, shared notes and artifact continuation reads through one vanilla JavaScript queue. Prioritize opened/expanded records, then the visible page, then newer history. Share pending transaction reads across date lookup, expansion and background loading.
- Bound reads to six active jobs, reserving one slot for an opened record and limiting ordinary note reads to two. Reprioritize pending work as the visible page changes. Keep the existing source fallback order, timeouts, cache writes and provider retry policies.
- Cancel obsolete queued work on reset and ignore its late results. Keep unfinished active reads counted until they settle. Prevent old date/notes cleanup from changing the next load's bookkeeping.

# 2.8.25 — runnable reconstructed functions in notes

- Show a readable JavaScript function and RUN FUNCTION control inside transaction Notes. Draw canvas output beside the source and preserve completed drawings during background record rerenders.
- Reconstruct the trapezoid from the first OP_RETURN chunk and its continuation, checking transaction identity and the predecessor locator. Support both binary and ASCII-hex roots; retain the shared note's saved source when the files are unavailable.
- Execute only on request in an opaque sandbox frame and a three-second canvas worker. Keep execution outside the Portal's storage/session and retain the main page CSP. No FileProxy/Python changes are required.

# 2.8.24 — shared transaction notes and metadata

- Replace Category / Note / Fix with a freeform Note and optional JSON Metadata. Preserve legacy category/follow-up text in the migrated blob. Show saved notes alongside record details; retain unsent drafts during background rendering.
- Save notes explicitly to FileProxy or the browser. Use separate chain/TXID JSON files through the existing `/raw` and `/save` endpoints; preserve raw transaction files. Shared reads fall back to published HTTP/bundled notes and the browser cache. Newer local edits survive older mirrors.
- Load notes for visible records in groups of four and on record pages. Shared metadata can supply a title and media descriptions/pictures, and record JSON exports include saved notes. Detect changed shared timestamps before writing and retain drafts when saving fails.
- Add the reconstructed trapezoid explanation, continuation locators and original JavaScript as a shared note for `99d2afee…f7bc022b`, with a static bundled copy.

# 2.8.23 — record pages, share links and binary OP_RETURN

- Open an individual record from its timestamp or OPEN RECORD action. Back restores the existing list, page, filters, expansion and scroll; record-page rendering leaves the hidden list DOM intact. Browser Back/Forward supports the same navigation.
- Share a Chisel URL containing currency/TXID and an optional public JSON source. A fresh visit can read that source directly without Python or an index. SOURCE JSON and DOWNLOAD JSON expose the underlying transaction and lossless payloads for inspection outside Chisel.
- Decode OP_RETURN as text only when it is valid, printable ASCII/UTF-8. Binary payloads show their byte count and exact HEX/Base64 representations; truncated scripts are reported explicitly. The screenshot transaction `99d2afee…f7bc022b` contains 80 binary bytes.
- Extract payload handling and record navigation into vanilla browser modules. Shared pending reads prevent record navigation from duplicating background transaction requests.

# 2.8.22 — direct static HTTP data with optional FileProxy

- Add a separate Static data URL field that preserves the entered website/currency directory. Read catalogs, directory listings and transaction JSON directly from the web server or an HTTP IPFS gateway without Python.
- Prefer the full transaction index, merge files missing from older indexes, translate `data-root:` paths under the HTTP root and resolve manifests relative to their own URL. Check fetched transaction identity and use known static asset paths for pictures in closed and expanded records.
- Load the HTTP catalog independently of FileProxy and hydrate visible/recent records first, four at a time. Bound FileProxy GETs to two seconds by default and defer repeated requests after service failures; API catalog and raw reads fall back to published HTTP files.

# 2.8.21 — Portal status messages in the top activity panel

- Show the actual Portal status message in the top activity panel, including search results, loading progress and errors. Remove the duplicate caption/status lines below the address lookup.
- Keep status/caption sources available to diagnostics and existing observers. The activity badge can become idle without erasing the latest message.

# 2.8.20 — identify failed resources accurately

- Failed pictures and media are logged as resource warnings rather than fatal "unknown script" errors. The debug export retains the resource tag and sanitized URL so the failing image or asset can be identified.
- Actual script and stylesheet load failures remain errors with the failed filename. Runtime JavaScript errors retain their message, source and stack; missing browser details are reported explicitly rather than called a script-load failure.

# 2.8.19 — extract the Portal record store

- Move record identity, deduplication, summary merging and recent display snapshots into `chisel.portal.store.js`. The module uses injected normalization/storage callbacks and has no DOM, network or timers.
- Preserve the Portal API/state, row objects, cache key/limits, visible text/media, pending-to-seen behavior and first-page loading priority from 2.8.18. Rendering and request scheduling remain in the Portal.
- Add fixtures captured from 16 pre-refactor record transitions and direct store tests for merging, persistence, reset behavior and browser script order.

# 2.8.18 — OP_RETURN text in closed records

- Portal rows always show decoded OP_RETURN text, including BlockCypher output scripts and older rows with generic summaries. Cached summary text remains visible before raw transaction data loads.
- Full payload text wraps on desktop and phones without title truncation or a two-line limit. Media titles, metadata and thumbnails remain visible alongside it.
- The latest 60 display summaries survive resets and reloads. Sparse index results retain decoded text, media and amounts; saved account rows restore before configuration/network loading.
- The entire visible Litecoin page loads missing details in groups of four and paints each completed record. Background FileProxy hydration prioritizes the visible page, then newer records, ahead of older history.
- Visible ledger reads display before FileProxy saving/indexing completes. Index rebuilds are batched after saves, and stale in-flight reads cannot repopulate a reset stream.

# 2.8.17 — actual errors and FileProxy endpoint diagnostics

- Debug exports retain sanitized activity/error messages, JavaScript stacks, promise rejection reasons and failed ledger reads. FileProxy requests record the actual host, port and route, HTTP status and duration without request bodies, URL credentials, query values or key material.
- Exports include Portal status, pending ledger-check errors and configured/entered/effective FileProxy endpoints. Explicit `7799` and `47799` URLs remain distinct; neither is silently replaced with the public reverse proxy.

# 2.8.16 — one record from submission through ledger discovery

- Submitted and fetched copies merge by chain/TXID into one expandable record. Later receipt updates retain the fetched transaction, timestamp, amount and index instead of replacing them with the submitted copy.
- Pending and observed records use the same layout and date format. Navy text turns black after the independent live ledger check succeeds; separate awaiting/seen labels and status panels are removed. Automatic retries and accessible status text remain.
- Reviewed media and complete linked metadata stay attached to the merged record. Cached discovery alone cannot complete the ledger check.

# 2.8.14 — visible media in closed and expanded records

- Closed Portal rows show the media title, author/provider, description and small picture using the same metadata and artwork selection as the expanded card. Saved page metadata and older Netflix annotations both work.
- Opening a media record puts the large picture first, above transaction details, publication status and optional drawers. The media is rendered once; ledger tables and raw JSON remain below it.
- Explicit image fields accept safe HTTP(S) image URLs without requiring a filename extension, including IPFS gateways. Netflix watch/title pages remain navigation links rather than image sources.

# 2.8.13 — show sent records immediately in Portal

- Successful broadcasts switch to Portal and reveal the new expandable record at the top before the first ledger read. The record comes from the sent transaction bytes and retains matching reviewed media.
- Navy **Awaiting ledger read** becomes black **Seen by ledger** only when a live node/provider returns the exact sent raw transaction with matching computed TXID. A mempool observation is separate from block confirmation; cached data and broadcast replies cannot complete the check.
- Failed reads retry and offer CHECK LEDGER NOW. Repeated discovery merges by chain/TXID, stream refreshes retain local receipts, and rejected broadcasts add no row.
- Up to 20 public receipts survive reload in bounded tab session storage. Restored statuses require a new live check; signing keys, account objects and transport credentials are excluded.

# 2.8.12 — complete record preview before Send

- Send accepts an optional, bounded `chisel-shared-record-v1` presentation record alongside shared OP_RETURN text. The exact text must match; imported fields cannot change keys, currency, recipients or fees.
- The expanded preview above SEND reuses Portal's stream and media renderers for the picture, title, channel and complete metadata. Ledger bytes, current outputs, requested fee and IPFS field remain inspectable, with unknown transaction fields left null.
- Text edits invalidate shared metadata, form changes refresh the preview, and a draft expands independently from real Portal rows. Fetched cards no longer duplicate URL-derived cards for the same media link.
- Linked pictures/metadata stay off-chain. Normal transaction review still precedes signing and broadcast.

# 2.8.11 — sticker links

- Printed stickers, scanner echoes and public artifact QR codes contain `https://johnrigler.github.io/chisel/#sticker=<16-hex-ID>`. The existing eight random bytes and color rule are retained.
- A normal camera opens a choice: use the single sticker's public artifact page, or continue a four-sticker key scan. In-app scans extract the ID from the URL; older raw-hex stickers still work.
- Public use is remembered locally and excluded from later key scans in that browser. This is a local guard, not a global registry or cryptographic revocation. Other devices, hosts and cleared site data do not share the exclusion. Never publish a key fragment; use a separate private key to sign at a public page.

# 2.8.9 — shared URL to OP_RETURN

- Open `?mode=send#opreturn=<URL-encoded-text>` to fill OP_RETURN ASCII through the existing draft loader and show Send. The query parameter `opreturn` is also accepted for URL openers.
- The Mogwai installable share receiver recognizes YouTube links and supplies the short video URL. It is maintained in `johnrigler/mogwai/app/`.
- Shared text is bounded to 4,096 UTF-8 bytes; each selected chain's existing payload checks still apply. The handoff preserves currency and recipients and requires ordinary transaction review.

# 2.8.1 — W42 technical review

- Verified previous outputs, bounded fees and a review before normal/manual signing; removed provider-driven fee rebuilding.
- Strict CompactSize and decimal amount parsing, bounded input selection, HTTP(S) link rendering and plain-JSON/low-S signed artifacts.
- Local Noble is the production default for transactions, identity and Keeper; offline fixture parity remains.
- Added vendor/driver integrity checks, main-page CSP and broader pinned CI.
- Full details: [W42 review response](docs/SECURITY_REVIEW_2026_W42.md).

## v2.7.4

- Portal now preloads a bundled/static dataset before any fileProxy or live ledger work.
- Added `data-bundled/manifest.json`, `data-bundled/index/portal.index.json`, and `data-bundled/portal-starter.js` so the first Portal page renders immediately from static records.
- Added explicit static refresh, dataset validation, live ledger search, and clear-stream controls.
- Changed Portal loaders to merge into the stream by default; Gomez/Jethro/static/live rows no longer intentionally erase each other.
- Moved fileProxy/EVM-local controls under authoring options. fileProxy, bun, deno, and local import scripts are build/import/publish tools, not public runtime dependencies.
- Portal row keys are source-aware (`sourceId:txid`) and rows show bundled/static/preloaded/summary/hydrated badges.
- Config defaults now prefer static-first public loading and optional live ledger search; local fileProxy autoload is off.

# Patch notes

## v2.7.18 - mobile scanner and public-address handoff

- The QR scanner now requests the rear/environment camera on every normal start and falls back to the best rear-labeled device only when the browser cannot honor the facing-mode constraint.
- Fixed the initial camera-selection bug that calculated a preferred rear camera and then replaced it with camera index `0`.
- Scanner handoff now carries the derived public address with the WIF and returns to Etch mode explicitly.
- The derived public address is visible beside the WIF controls instead of being hidden in the collapsed advanced section.
- Added `SEARCH ADDRESS AS THUNDERWORD`, which switches to Portal and reloads the derived public address as the active chain-specific thunderword stream.
- Added `SHOW ADDRESS QR`, which opens a large phone-scannable QR containing only the public address, with the address printed underneath for verification.

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
- Preserved `vendor/elliptic-6-6-1.min.js` as audit/source artifacts, not runtime dependencies for the main pages.
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
