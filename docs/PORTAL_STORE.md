# Portal record store

Extracted in v2.8.19 from the working v2.8.18 Portal. This pass moves record
ownership without changing the row schema, cache format, loading order or UI.

## Boundary

`chisel.portal.store.js` owns transaction identity, row insertion/deduplication,
summary merging and bounded recent display snapshots. It has no DOM, network,
timer or direct browser-storage calls.

`chisel.portal.js` supplies timestamp extraction, media URL normalization and
storage callbacks. It continues to own rendering, filtering, sorting, expansion,
request scheduling, reset generations and the 200 ms snapshot timer. The caller
passes already prioritized rows to `snapshotRecent`; the store does not decide
which page is visible.

The store shares only the `portalRows` and `portalRowKeys` data fields of the
existing `CHISEL_PORTAL.state` object. Both remain ordinary writable fields, and
the identity map and row array continue to reference the same row objects.
`reset()` replaces those two collections; the Portal controls all other reset
state and retains publication rows using its existing path.

## Record fields

| Field | Meaning |
| --- | --- |
| `raw` | Transaction returned by a provider or reconstructed from submitted bytes. |
| `summary` | Decoded/display data, including text, media, dates and amounts. |
| `publication` | Receipt tracked by `chisel.portal.publication.js`; its live byte check controls pending/seen state. |
| `discoverySource`, index/path fields | Where the row was discovered or can be loaded. |

Local annotations remain in the Portal's separate annotation map. Incoming sparse
summaries retain previously decoded content. Publication updates retain a fetched
raw transaction and live timestamps rather than restoring the submitted copy.
The store does not perform or complete ledger verification.

## Identity compatibility

UTXO keys use normalized coin plus lowercase TXID; changing the discovering index
does not create another row. Mainnet and testnet remain separate. EVM keys retain
the existing source-view identity, including Gomez/Jethro separation. This pass
does not migrate EVM identities or combine source views.

## Persistence compatibility

Recent snapshots still use `chisel.portal.recentDisplay.v1`, retain at most 60
summaries and omit individual summaries larger than 32,768 characters. The same
public-field allowlist excludes raw transactions, receipt verification state and
account/key fields. Reading malformed/unavailable storage falls back to memory;
a failed write leaves the previous stored snapshot intact. No cache migration is
required.

`createStore` receives `records`, `extractBlockTime`, `normalizeMediaUrl` and
optional `readStorage`, `writeStorage`, `onStorageError` callbacks. Its data
operations are `upsert`, `mergeSummary`, `snapshotRecent`, and `reset`.

## Verification

`tests/fixtures/portal-store-v2818.json` captures 16 transitions from commit
`a2553aaa77ad67aba235badcdc1b993b9110accb` before extraction. Store tests compare
each transition with that captured result, exercise persistence/reset behavior
without a DOM, and check the browser script order. Existing Portal history,
preview, publication and diagnostics suites cover the integrated boundary.

The loading queue and incremental row renderer remain separate future passes.
