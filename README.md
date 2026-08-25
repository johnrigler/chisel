# Chisel

Chisel is a browser-first toolkit for reading and preserving small blockchain artifacts.

A transaction output can be more than a payment. An address can carry readable structure. An amount can carry a small code. An OP_RETURN can carry text. A transaction can become a public note, breadcrumb, receipt, ritual, or searchable index.

Chisel keeps public ledger material separate from local interpretation. The transaction remains public. Local notes, categories, fixes, feed imports, and indexes live in the local Chisel datastore.

## Orientation for colleagues

Start with the origin bridge before touring the code:

- `docs/origin.md` explains the vanilla-JS / elliptic signing decision, then maps the 2020 white paper into the current Chisel implementation.
- `docs/origin-print.html` is the printable HTML version for meetings and page-layout checks.
- `docs/refactor-phases.md` defines the low-risk sequence for cleaning up the project without touching signing or broadcast paths too early.

The short version: Chisel reads and writes ledger-native artifacts. A UTXO transaction can carry meaning through ordered outputs, readable unspendable addresses, optional OP_RETURN payloads, and amount-level codes. Portal should be the main reader. fileProxy, bunOven, keeperBun, label tools, QR tools, and other helpers are satellites.

Portal is now static-first: `data-bundled/portal-starter.js` preloads the known public records immediately, `data-bundled/manifest.json` and `data-bundled/index/portal.index.json` describe the same dataset for validation/refresh, and live ledger searches merge newer records without clearing the stream. `bun`, `deno`, `fileProxy`, local nodes, and import scripts remain authoring/publishing tools. They should not be required for a public visitor opening the GitHub/IPFS/rigler.org build.

## v2.7.15c Base57 image capture

The V1 image workflow is available from Etch’s `BASE57 IMAGE` button and from `tools/imageEncoder/`.

- The selected image stays in the browser; Chisel does not upload it.
- The source is resized onto an adjustable raster, then Top/Bottom/Left/Right margins select a movable 26-column box of up to 100 rows using the existing `b57.json` 57-color palette.
- A V1 parameter line accepts `Top,Bottom,Left,Right` directly. For `42,134,150,48` on a square source, it recreates the 224×224 raster and 26×48 Lou Reed capture.
- V1-compatible resize smoothing is the default. Preview scale is display-only and defaults to 5.
- Every ordered row becomes a checksum-valid Digibyte address whose layout is `S*` + 26 palette glyphs + 6 checksum glyphs.
- The first form is V1-compatible `SN`. Alternate decoder-safe `S*` prefixes and checksum variants keep identical pixel rows unique without changing their Portal rendering.
- `WRITE TO CHISEL ETCH` replaces the current recipient list with the ordered 0.0000546 DGB image outputs for review and signing.

The browser self-test includes the V1 Mogwai fixture address `SNMMMBQXiiiiiisrrrriiXQBBMMM12AD3f` and verifies the encoder → Etch → Portal row contract.


## v2.7.1 Dogecoin local import

This build imports the uploaded Bun jist Dogecoin feed into Chisel's local Portal path.

Parsed feed:

- 50 Dogecoin output row(s)
- 41 transaction fixture file(s)

The uploaded tree has `data` as a symlink to `/home/john/daisy/2026/chisel-data`. I preserved that symlink. The bundled Dogecoin seed is under `data-bundled/`, and fileProxy now reads both `data/transactions` and `data-bundled/transactions`.

To merge the same feed into the traditional datastore behind the `data` symlink, run:

```bash
python3 tools/fileProxy/proxy.py
bun tools/bunOven/import-jist-to-fileProxy.js data-bundled/imports/dogecoin/bun-jist-dogecoin-20260623.jsonl
```

To replace the Dogecoin store first:

```bash
bun tools/bunOven/import-jist-to-fileProxy.js data-bundled/imports/dogecoin/bun-jist-dogecoin-20260623.jsonl --replace
```

## Local datastore

The normal fileProxy datastore shape is:

```text
data/
  transactions/<coin>/*.json
  index/transactions.index.json
  imports/<coin>/*.jsonl
  chords/<coin>/*.chord
```

This patch also includes a read-only bundled seed:

```text
data-bundled/
  transactions/dogecoin/*.json
  index/transactions.index.json
  imports/dogecoin/bun-jist-dogecoin-20260623.jsonl
  chords/dogecoin/bun-jist-dogecoin-20260623.chord
```

## Portal

Start fileProxy:

```bash
python3 tools/fileProxy/proxy.py
```

Open `index.html` in Portal mode. The included config sets:

```json
{
  "autoLoadLocalTransactions": true,
  "autoLoadConversationStreams": false,
  "portalFilterDogecoin": true
}
```

That avoids remote Thunderword fetching on page load and shows the local/bundled Dogecoin import first.

## bunOven and fileProxy

`bunOven` should consume fileProxy. The new endpoint is:

```text
POST /import-jist-feed
```

Accepted body:

```json
{
  "coin": "dogecoin",
  "mode": "merge",
  "text": "{...jsonl...}"
}
```

`mode` can be `merge` or `replace`. Merge is the safe default. Replace is useful when a bad scan polluted the local Dogecoin folder.

## Chords

Chisel keeps a chord rendering of output rows:

```bash
dogecoin() {
  : 9sGoTTAxLiGHTxGoTTAxLiGHTzzz7g5ZcF 0.00039692;
  : DCxxxxFiNNEGANSxWAKEzzzzzzzzyYeZHb 1.00037497;
}
```

The chord is a local view, not a replacement for the transaction fixture JSON.

## Literal handling

The Dogecoin data is literal output data from the uploaded Bun jist feed. It is not reconstructed from printed Joyce and typos are not repaired.
