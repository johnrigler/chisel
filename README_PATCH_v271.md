# v2.7.1 Dogecoin local import patch

Built from uploaded `chisel-v270.tar`.

Changes:

- Parsed 50 Dogecoin Bun jist output rows.
- Grouped them into 41 local transaction fixture file(s).
- Preserved the existing `data -> /home/john/daisy/2026/chisel-data` symlink.
- Added `data-bundled/transactions/dogecoin/`.
- Added `data-bundled/index/transactions.index.json`.
- Added `data-bundled/imports/dogecoin/bun-jist-dogecoin-20260623.jsonl`.
- Added `data-bundled/chords/dogecoin/bun-jist-dogecoin-20260623.chord`.
- Patched fileProxy to read `data-bundled/transactions` in addition to the traditional datastore.
- Added Portal DOGE filter.
- Added Dogecoin local Thunderword profile.
- Set Portal config to auto-load local transactions and skip default remote stream fetching.
- Added `POST /import-jist-feed` to fileProxy, with `merge` and `replace` modes.
- Added `tools/bunOven/import-jist-to-fileProxy.js`.
- Replaced broken root `README.md` content with a real Chisel README.

Literal rule: this patch preserves the feed as etched and does not repair hand-crafted typos.
