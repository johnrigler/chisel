# Chisel fileProxy

`fileProxy` is the local filesystem bridge used by Decode and Portal. It keeps browser code simple while avoiding direct filesystem assumptions.

Run from the repository root or from this directory:

```bash
python3 tools/fileProxy/proxy.py
```

Defaults:

- URL: `http://127.0.0.1:7799`
- Root: the Chisel repository root detected from `tools/fileProxy/proxy.py`

Optional overrides:

```bash
CHISEL_FILE_ROOT="$PWD" CHISEL_FILE_PORT=7799 python3 tools/fileProxy/proxy.py
```

Ledger-store conventions:

- `txids/<txid>`
- `txids/<coin>/<txid>.json`
- `data/transactions/<coin>/<txid>.json`
- `ipfs/<cid>` or `data/ipfs/<cid>`
- local images in `images/`, `data/images/`, `base57/`, `data/base57/`, `ipfs/`, or `data/ipfs/`

Endpoints:

- `GET /ping`
- `GET /txids?coin=litecoin`
- `GET /tx?coin=litecoin&txid=<64hex>`
- `GET /ipfs?cid=<cid>`
- `GET /find-assets?txid=<64hex>` or `GET /find-assets?cid=<cid>`
- `GET /raw?path=<relative path>`
- `GET /list?path=<relative path>`
- `GET /load?path=<relative path>`
- `POST /save`
- `POST /save-tx`
- `POST /mkdir`
- `POST /delete`

Decode uses `/tx` and `/txids`. Portal uses `/txids`, `/tx`, and `/find-assets`. The older `/load` and `/save` endpoints remain available.
