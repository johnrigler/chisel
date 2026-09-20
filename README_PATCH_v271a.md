# Chisel v271a local-label patch

This patch tightens Portal/fileProxy labeling for local transaction fixtures.

The problem in v271 was not the Dogecoin import itself. The imported Dogecoin JSON carried the right chain. The weak point was Portal context inference: when a Dogecoin MacDougall address begins with `D`, the UI could infer the Digibyte thunderword profile from the first character. Also, fileProxy could reuse a stale local index, so corrected imports could still appear under old labels.

Changes:

- Local fileProxy `/tx-index` rebuild is forced when Portal loads local transactions.
- Row identity now uses the row's explicit `coin`/`ticker` before any inferred index profile.
- `sourceIdForRow()` uses canonical coin order: DOGE/DGB/RVN/LTC/BTC first, EVM only when explicitly EVM or contract-shaped.
- Address explorer inference no longer lets first-character root matching override a known contextual chain. A Dogecoin row stays Dogecoin even if its address starts with `D`.
- fileProxy summary rows now include top-level `coin` and `ticker`, plus `summary.coin` and `summary.ticker`.
- fileProxy no longer sends UTXO JSON into the EVM summarizer unless the path or packet says EVM/polygon/matic, or the coin is otherwise unknown and the shape is clearly EVM.
- Bundled Dogecoin seed index is regenerated as `data-bundled/index/transactions.index.json`.

After installing, restart fileProxy and reload Portal with cache disabled or a hard refresh.

```bash
python3 tools/fileProxy/proxy.py
```

Then use Portal's local transaction load. The DOGE rows should display as DOGE and stay in the Dogecoin filter. Digibyte rows should remain DGB. Gomez/Jethro should remain EVM only when loaded from their EVM catalog.
