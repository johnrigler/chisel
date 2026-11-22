# BSV public-history discovery

Chisel reads other people's existing BSV transactions without needing a BSV
balance. Mogwai's [Python scanner](https://github.com/johnrigler/mogwai/blob/main/docs/BSV-HISTORY-SCANNER.md)
can run on rigler.org, checkpoints a backward block scan in SQLite, and exports a
separate static dataset at `https://rigler.org/chisel-data/bsv/manifest.json`.

The portal loads this in addition to the general dataset. The **BSV** filter
selects its records. Each candidate shows transaction size and pushed OP_RETURN
data size, including a lower-bound marker when the provider truncated the
output. Expand **BSV scan coverage** for exact visited blocks, transaction
counts, partial/completed status, ranked blocks, timestamps, errors and notes.
Refresh the portal to fetch the next published snapshot.

The bundled `data-bsv/` snapshot contains real public-provider observations from
blocks 575041–575045: 66 checked transactions and 12 selected candidates. It is
a historical starting sample, not a claim that the entire chain was scanned.
The selection thresholds are at least 1,024 transaction bytes OR 128 pushed
data bytes, excluding coinbase candidates. Large ordinary payment transactions
can qualify by size; selection alone does not identify a file or protocol.

Runtime remains vanilla JavaScript and static/IPFS-compatible. Add exported
manifest URLs to `staticDiscoveryManifestPaths` in `chisel.portal.config.json`,
or replace the bundled `data-bsv/` with another scanner export. A local/bundled
copy remains available without rigler.org. Multiple feeds merge by BSV + TXID,
keeping BTC and BSV records separate even where hashes coincide.

The reader accepts native `OP_RETURN` and `OP_FALSE OP_RETURN` scripts while
retaining original script bytes. Provider-truncated scripts are labelled as
previews. B:// image reading is available in the record explorer below. BCAT,
1Sat reconstruction and payload execution are outside this discovery step. Size is a search heuristic, and imported provider JSON is
not independent proof of ledger inclusion. No signing or spending is added.

## Record exploration (2.8.71)

Drill into any transaction for a persistent chain-scoped search panel. Search
loaded records by text, TXID, filename or MIME type; choose **Images only** or
**Text / articles**, and pivot to **This block**. Results open other record pages
without changing chains. These controls and file buttons persist through
background refreshes. Search covers loaded catalogs, not all chain history.

BSV B:// files are identified from individual data pushes using the
[original B protocol layout](https://github.com/unwriter/B). Saved summaries
include file type, output, byte count and completeness. JPEG/PNG/GIF/WebP
signatures identify images when later MIME fields are truncated. Text links
to images do not qualify as embedded image files. **Load image** explicitly
reads a complete output from WhatsOnChain if needed, matches the saved prefix,
and displays it as an image Blob. BCAT/1Sat reconstruction is not implemented.

The panel reads Mogwai/FileProxy health and the remote BSV scan feed separately.
A working daemon can serve cached transactions without running the history
scanner. Feed status includes checked count and last export, or a fetch error.

## Pagination (2.8.72)

Transaction counts are separate from page counts. The bundled 12-record BSV
sample fits on one page at the default 20 transactions per page. Single-page
results show no Previous/Next controls. Larger catalogs paginate normally;
background static, EVM and ledger catalog merges preserve the selected page.
Changing a source filter or search still starts at page one.

## Two-cursor daemon and Alice anchor (2.8.73)

Mogwai now includes a separate continuous BSV discovery daemon and a user-systemd
unit. Its `recent` cursor walks backward from the confirmed tip, while `early`
walks forward from the Alice block (566492). They share deduplicated checked
blocks and transactions. After their ranges meet, `early` follows new confirmed
blocks. Coverage shows each job's direction, phase, next height, errors and the
runner's saved heartbeat. These are exported observations, not a live process
probe. Setup is documented in [Mogwai's scanner guide](https://github.com/johnrigler/mogwai/blob/main/docs/BSV-HISTORY-SCANNER.md).

A separate `data-bsv-anchors/` feed adds the transaction referenced by unwriter's
original Alice in BitcoinLand app: `b742886801560f57b4dc824ce3a1719613d8b2d38530909fe988c1ca04cc82af`.
It was mined on January 23, 2019 in block 566492. The serialized transaction
hash was checked, and its native output contains 17100 pushed bytes of
looking-glass text. Original provider JSON, serialized hex and provenance are
retained. This individual lookup adds one record without changing the bundled
history sample's 66-transaction / five-block scan coverage. Treat Alice as the
best located match for the user's rabbit-hole reference, not as proof of the
first BSV file or a block-size activation transaction.
