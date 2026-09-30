# Chisel fileProxy

`fileProxy` is the filesystem/cache bridge used by Chisel Portal. It lets the
browser treat locally or server-hosted transaction data as a reusable store
instead of repeatedly asking block explorers for the same raw transaction.

The important distinction is:

- the blockchain/explorer is the authoritative source;
- fileProxy is a cache, catalog, and persistence layer;
- JSON files under the Chisel data root are the durable source for rebuilding
  derived indexes;
- SQLite is optional derived state, not the primary record.

## Current deployment

On rigler.org the preferred arrangement is:

```text
browser
  |
  | HTTPS
  v
https://rigler.org/fileproxy/...
  |
  | Apache reverse proxy
  v
http://127.0.0.1:7799/...
  |
  v
tools/fileProxy/proxy.py
```

The Python service should remain bound to loopback:

```bash
export CHISEL_FILE_HOST=127.0.0.1
export CHISEL_FILE_PORT=7799
export CHISEL_FILE_TLS=0

python3 tools/fileProxy/proxy.py
```

Local test:

```bash
curl http://127.0.0.1:7799/ping
```

Public test through Apache:

```bash
curl https://rigler.org/fileproxy/ping
```

The Portal configuration should use:

```json
"fileProxyUrl": "https://rigler.org/fileproxy"
```

The Chisel client migrates the old `:7799`, localhost, and
`127.0.0.1:7799` values to the reverse-proxied URL.

Apache configuration:

```apache
ProxyPreserveHost On

ProxyPass        /fileproxy/ http://127.0.0.1:7799/
ProxyPassReverse /fileproxy/ http://127.0.0.1:7799/
```

Keep the trailing slashes paired. Then:

```bash
sudo apachectl configtest
sudo systemctl reload apache2
```

## What Portal does automatically

The current `chisel.portal.config.json` enables the caching path:

```text
autoSaveFetchedTransactions = true
cacheFetchedTransactionsWithFileProxy = true
localFirstTransactions = true
autoLoadLocalTransactions = true
autoHydrateLocalTransactions = true
backgroundHydrateTransactions = true
saveDiscoveredLinks = true
persistMainThunderwords = true
liveLedgerRefresh = true
```

For a UTXO transaction the intended flow is:

```text
first encounter:
Portal -> static/local cache -> miss -> explorer/API -> save raw JSON -> display

later encounter:
Portal -> static/local cache -> hit -> display
```

`loadTransactionLocalFirst()` checks static data and fileProxy before using a
live explorer. A live transaction that is fetched successfully is offered to
`/save-tx` when automatic caching is enabled.

Canonical transaction JSON is stored under:

```text
data/transactions/<coin>/
```

The exact filename may be a Base58-derived slug rather than the literal txid.
Use the API rather than assuming a filename:

```bash
curl 'https://rigler.org/fileproxy/tx?coin=litecoin&txid=<64hex>'
```

When Portal decodes links, IPFS references, or related addresses from a
transaction and `saveDiscoveredLinks` is enabled, it can also write:

```text
data/links/<coin>/<txid>-links.json
```

Those files record relationships discovered by Chisel. fileProxy is not a
general Web crawler. A remote URL, image service ID, or media ID is not
automatically promoted into a new Chisel record merely because it is reachable
from a saved link. Special handlers such as TikTok thumbnails and local/IPFS
asset discovery are explicit exceptions.

This matters for cases such as a ledger record that points to an image whose
remote service uses a different identifier: Chisel can remember the decoded
link, but it does not currently recursively ingest arbitrary linked resources.

## Main ThunderWords / address streams

Portal can persist a public address stream with:

```text
POST /main-stream
```

The manifest is stored under:

```text
data/streams/<coin>/
```

It records the public address, source, label, and discovered transaction IDs.
WIF/private-key material is rejected by the fileProxy main-stream writer.

The JSON manifest is intentionally the durable record. Any SQLite representation
should be considered rebuildable derived state.

## JSON index

fileProxy always has a JSON catalog path independent of SQLite:

```text
data/index/transactions.index.json
```

`GET /tx-index` reads or rebuilds that catalog. `GET /reindex` first rebuilds
the JSON catalog and then attempts the optional unified SQLite rebuild.

This gives Chisel a useful index even when SQLite support is unavailable.

## SQLite: current reality

There are two different SQLite ideas that have existed around Chisel and they
should not be conflated.

### Legacy per-currency / Jist databases

Older tooling and datasets may contain per-currency SQLite/Jist databases.
The current `tools/fileProxy/proxy.py` does **not** directly open or query
arbitrary per-currency SQLite databases.

The current supported legacy-import path is `POST /import-jist-feed`. It
converts Jist-style rows into canonical JSON transaction packets under
`data/transactions/<coin>/`, writes an import copy and chord representation,
and refreshes the JSON transaction index.

In other words, current fileProxy prefers:

```text
legacy/Jist source -> canonical JSON -> Chisel indexes
```

rather than making the browser depend directly on a collection of old SQLite
schemas.

### Optional unified SQLite index

`proxy.py` contains a hook for a unified indexer at:

```text
tools/chisel_index/indexer.py
```

`GET /ping` reports:

```json
"unifiedSqliteIndex": true|false
```

If that module exists, `GET /reindex` calls:

```python
indexer.rebuild_index(active_data_root(), include_legacy_jist=False)
```

The returned status may include the database path and table counts.

As of 2026-09-29, `tools/chisel_index/indexer.py` is **not present in the
current GitHub repository**, and the observed rigler.org `/ping` response
reported:

```json
"unifiedSqliteIndex": false
```

Therefore the filesystem cache and JSON index are working, but the unified
SQLite layer should currently be treated as unavailable unless the server has
an uncommitted/local copy of that indexer module.

Older documentation said that `/reindex` necessarily rebuilt
`data/index/chisel.sqlite3` and tables such as `transactions`,
`main_thunderwords`, and `main_thunderword_transactions`. That is only true
when the optional indexer module is installed. Do not assume those tables exist
from fileProxy alone.

## External data roots

fileProxy can work with a datastore outside the Git checkout:

```bash
export CHISEL_DATA_ROOT=/path/to/chisel-data
```

The first configured data root becomes the active data root. A `data` symlink
inside the repository is also recognized. This is useful for keeping generated
transaction caches out of Git.

`CHISEL_DATA_ROOT` expands the filesystem locations fileProxy may access. It
does not by itself add SQLite-query capability.

Legacy source locations can separately be allowed through:

```bash
export CHISEL_LEGACY_ROOTS=/path/containing/legacy/data
```

## How to tell whether fileProxy is helping

Basic health:

```bash
curl https://rigler.org/fileproxy/ping
```

A healthy response should contain:

```json
{
  "ok": true,
  "service": "chisel-fileproxy"
}
```

Count cached transaction files:

```bash
find /var/www/html/chisel/data/transactions -type f | wc -l
```

See files written recently:

```bash
find /var/www/html/chisel/data/transactions -type f -mmin -10 -print
```

List Litecoin records known to fileProxy:

```bash
curl 'https://rigler.org/fileproxy/txids?coin=litecoin'
```

When the unified database is healthy, this response should include:

```json
"catalogSource": "sqlite"
```

If SQLite is unavailable, fileProxy falls back to the filesystem and reports
`"catalogSource": "filesystem"`.

Retrieve a specific cached transaction without touching an explorer:

```bash
curl 'https://rigler.org/fileproxy/tx?coin=litecoin&txid=<64hex>'
```

Inspect the JSON catalog:

```bash
curl 'https://rigler.org/fileproxy/tx-index?coin=litecoin'
```

Force derived-index refresh and inspect SQLite status:

```bash
curl 'https://rigler.org/fileproxy/reindex'
```

If the response shows:

```json
"sqlite": {
  "available": false
}
```

then JSON indexing is still useful, but the unified SQLite indexer is absent.
A healthy deployment should instead report `"available": true`,
`"ok": true`, and nonzero transaction counts.

Check newly discovered link records:

```bash
find /var/www/html/chisel/data/links -type f -mmin -30 -print
```

A practical efficiency test is to load the same transaction twice while
watching browser network requests or server logs. The first load may require an
external explorer request; the second should be satisfied by fileProxy/static
data when the first result was cached successfully.

fileProxy currently does not maintain explicit hit/miss counters, so a numeric
cache-hit percentage cannot yet be obtained directly from `/ping`.

## Batching and efficiency

Portal avoids rebuilding indexes after every transaction in a batch.
`/save-tx` accepts `refreshIndex: false`, allowing several canonical JSON
writes followed by one `/reindex`.

This is important because the expensive work is discovery/fetching and catalog
rebuilding, not reading a small cached JSON file.

The current design therefore has three efficiency layers:

1. static/bundled data avoids any server request;
2. fileProxy cached JSON avoids repeat explorer/API transaction fetches;
3. derived JSON/SQLite indexes avoid repeatedly scanning every saved file.

At present all three layers are active when `tools/chisel_index/indexer.py`
is installed and `index/chisel.sqlite3` has been built. `/txids` now prefers
the SQLite catalog and reports `"catalogSource": "sqlite"` when it is serving
from the unified index. Cached transaction lookup also consults SQLite before
falling back to filename guesses and recursive filesystem scanning.

## Ledger-store conventions

Common paths include:

```text
txids/<txid>
txids/<coin>/<txid>.json
data/transactions/<coin>/
data/links/<coin>/
data/streams/<coin>/
ipfs/<cid>
data/ipfs/<cid>
images/
data/images/
base57/
data/base57/
```

## Main endpoints

Read-oriented:

```text
GET /ping
GET /config
GET /main-streams
GET /txids?coin=litecoin
GET /tx-index?coin=litecoin
GET /tx?coin=litecoin&txid=<64hex>
GET /reindex
GET /ipfs?cid=<cid>
GET /find-assets?txid=<64hex>
GET /find-assets?cid=<cid>
GET /raw?path=<relative path>
GET /list?path=<relative path>
GET /load?path=<relative path>
GET /tiktok-thumbnail?url=<url>
```

Write-oriented:

```text
POST /save
POST /save-tx
POST /main-stream
POST /save-links
POST /import-jist-feed
POST /save-evm-tx
POST /save-evm-batch
POST /mkdir
POST /delete
```

## Security boundary

Apache TLS protects transport, not authorization.

The public reverse proxy currently makes the selected fileProxy route reachable
from remote browsers. fileProxy includes write and delete operations and its
normal CORS response permits cross-origin access. Do not treat
`https://rigler.org/fileproxy` as a harmless read-only cache unless Apache or
fileProxy is configured to restrict mutating endpoints.

A safer long-term split would expose public read/cache endpoints separately
from authenticated administrative write/delete/editor operations.

## Temporary single-file text editor

The editor is disabled by default. It exposes only one server-selected file and
uses a separate token for its load/save operations.

Example:

```bash
export CHISEL_TEXT_EDITOR=1
export CHISEL_EDITOR_TOKEN='replace-with-a-long-random-token'
export CHISEL_EDITOR_ROOT=/var/www/html/darkStar
export CHISEL_EDITOR_FILE=technical-paper.html
export CHISEL_EDITOR_PUBLIC_URL=https://johnrigler.github.io/darkStar/technical-paper.html
```

With the reverse proxy, use:

```text
https://rigler.org/fileproxy/text-editor
```

The editor token protects only the editor endpoints. It does not authenticate
the older general-purpose fileProxy write/delete API.
