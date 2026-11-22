# BSV public-history discovery

Chisel reads other people's existing BSV transactions without needing a BSV
balance. Mogwai's [Python scanner](https://github.com/johnrigler/mogwai/blob/main/docs/BSV-HISTORY-SCANNER.md)
runs on rigler.org, checkpoints a backward block scan in SQLite, and exports a
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
previews. B://, BCAT, 1Sat file reconstruction and payload execution are outside
this discovery step. Size is a search heuristic, and imported provider JSON is
not independent proof of ledger inclusion. No signing or spending is added.
