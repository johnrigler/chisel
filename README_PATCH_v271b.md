# Chisel v271b: UTXO dates and RVN labels

This patch fixes two Portal/fileProxy problems found after importing the Dogecoin Bun jist feed.

## Fixes

- Dogecoin imported rows no longer sort by fileProxy load time when the feed lacks an exact `block_time` field.
- fileProxy now preserves exact block timestamps when source rows include `block_time`, `blockTime`, `blocktime`, `confirmed_at`, `confirmedAt`, `timestamp`, or `time`.
- If a UTXO feed only has `block_height`, fileProxy and Portal use a height-based historical fallback for sorting instead of the file modified time.
- The fallback is marked as `summary.blockTimeEstimated: true` inside fixture/index JSON.
- `created_at` is intentionally ignored as a block timestamp because the Bun jist feed uses it as scan/import metadata, not the transaction's chain time.
- RVN/Raven path and ticker aliases now normalize to `ravencoin` / `RVN`.
- Portal rejects EVM decoding for UTXO-shaped JSON with `vin`/`vout`, unless the row is explicitly marked EVM.
- RVN rows should now expand as UTXO transactions instead of briefly opening as EVM and collapsing/erroring.

## Exact timestamps

The height fallback is only for historical placement. For exact block header timestamps, run a local coin daemon and hydrate the fixtures:

```bash
python3 tools/bunOven/hydrate-utxo-block-times.py \
  --coin dogecoin \
  --rpc http://rpcuser:rpcpass@127.0.0.1:22555
```

For RVN, use your Ravencoin Core RPC URL and `--coin ravencoin`.

After hydrating, restart fileProxy and reload Portal:

```bash
python3 tools/fileProxy/proxy.py
# Portal hard refresh
```

Portal already requests `/tx-index?force=1` for local loads, so it should rebuild labels and historical ordering after the patch.
