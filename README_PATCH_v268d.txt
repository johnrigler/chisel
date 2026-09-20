Chisel v2.6.8d portal/local-index patch

Scope
- Portal now uses the full browser width in portal mode.
- The base57/image renderer is demoted. It hides when a selected transaction has no S* image lines, and its controls are closed by default.
- Local transaction loading now prefers fileProxy /tx-index instead of opening every transaction JSON in the browser on every local scan.
- fileProxy can build a cached summary index at data/index/transactions.index.json. Rebuild it with /reindex or /tx-index?force=1.
- Rabbit trails and address explorer links now infer the explorer profile from the target address instead of inheriting the parent stream's coin.
- Saved discovered link packets dedupe urls, IPFS CIDs, and non-image address targets.

Why
The previous portal could make cross-chain trails look like the wrong coin. A DGB root transaction that pointed at an RVN/LTC/DGB target would still render many child links through the DGB profile because the parent stream entry was passed forward. This patch chooses the profile from the target address root first.

Local index behavior
- GET http://127.0.0.1:7799/tx-index
  Returns cached transaction summaries when present, otherwise builds the index.
- GET http://127.0.0.1:7799/tx-index?force=1
  Rebuilds the summary index.
- GET http://127.0.0.1:7799/reindex
  Same as force rebuild.

Testing
1. Start tools/fileProxy/proxy.py.
2. Open index.html?mode=portal.
3. Confirm local rows appear quickly with streamLabel "local index".
4. Select a transaction with S* image lines; base57 controls should become available.
5. Select a non-image transaction; base57 display should stay hidden.
6. Load all default streams and inspect rabbit trails. D/R/L/0x address trails should use their own coin profile when possible.

Notes
This is still not a true worker thread. It is a quasi-background index: the Python fileProxy scans once, stores summaries, and lets the browser lazily load full JSON only when a row is selected.
