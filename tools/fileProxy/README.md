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

## Public HTTPS on `rigler.org`

The current rigler.org deployment uses Apache2 for HTTPS. The preferred setup is
to keep `fileProxy` on loopback HTTP and let Apache terminate TLS and reverse
proxy the requests.

Run `fileProxy` like this:

```bash
export CHISEL_FILE_HOST=127.0.0.1
export CHISEL_FILE_PORT=7799
export CHISEL_FILE_TLS=0

python3 tools/fileProxy/proxy.py
```

Test the Python service locally first:

```bash
curl -v http://127.0.0.1:7799/ping
curl -v http://127.0.0.1:7799/config
```

Enable the Apache proxy modules once:

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
```

Inside the existing `<VirtualHost *:443>` for `rigler.org`, add:

```apache
ProxyPreserveHost On

ProxyPass        /chisel-file/ http://127.0.0.1:7799/
ProxyPassReverse /chisel-file/ http://127.0.0.1:7799/
```

Keep the trailing slashes paired exactly as shown. This makes
`/chisel-file/ping` map to `/ping` on the Python service.

Validate and reload Apache:

```bash
sudo apachectl configtest
sudo systemctl reload apache2
```

Then test the public path:

```bash
curl -v https://rigler.org/chisel-file/ping
```

The deployed Portal should use:

```json
"fileProxyUrl": "https://rigler.org/chisel-file"
```

This is preferred over exposing Python TLS directly on public port `7799`.
Apache already owns the site's certificate lifecycle and HTTPS listener, while
`fileProxy` remains private on `127.0.0.1`.

### Direct Python TLS fallback

Direct TLS is still supported when needed. Use the full Let's Encrypt chain,
not `cert.pem`:

```bash
CHISEL_FILE_HOST=0.0.0.0 \
CHISEL_FILE_PORT=7799 \
CHISEL_FILE_TLS=1 \
CHISEL_FILE_CERT=/etc/letsencrypt/live/rigler.org/fullchain.pem \
CHISEL_FILE_KEY=/etc/letsencrypt/live/rigler.org/privkey.pem \
python3 tools/fileProxy/proxy.py
```

`CHISEL_FILE_CERT` must point to `fullchain.pem`, and
`CHISEL_FILE_KEY` must point to the matching `privkey.pem`. Using
`cert.pem` can allow Python to start while remote clients still fail
certificate validation because the intermediate chain is missing.

TLS protects transport only. It does not authenticate callers. `fileProxy`
has write/delete endpoints, so do not expose those publicly without access
control.

## Temporary single-file text editor

The editor is disabled by default.  It is separate from the legacy `/load` and
`/save` endpoints and exposes only one server-selected file.  For the Dark
Star technical paper, keep the ordinary Chisel root unchanged and provide the
Dark Star checkout as a separate editor root:

```bash
export CHISEL_TEXT_EDITOR=1
export CHISEL_EDITOR_TOKEN='replace-with-a-long-random-token'
export CHISEL_EDITOR_ROOT=/var/www/html/darkStar
export CHISEL_EDITOR_FILE=technical-paper.html
export CHISEL_EDITOR_PUBLIC_URL=https://johnrigler.github.io/darkStar/technical-paper.html

python3 tools/fileProxy/proxy.py
```

Open `https://rigler.org:7799/text-editor`, enter the temporary token, and
load the paper.  The page presents headings, paragraphs, list items, captions,
and table cells as screen-width wrapping textareas.  Saving requires the token,
refuses to overwrite a file that changed after it was loaded, writes
atomically, and preserves the previous version as
`.technical-paper.html.bak`.

When editing is finished, stop the service and restart it without
`CHISEL_TEXT_EDITOR`, or set that variable to `0`.  The editor page and its
load/save endpoints then return 404.

The token protects only `/editor/load` and `/editor/save`.  It does not add
authentication to the older general-purpose write/delete endpoints; the
existing warning about exposing those endpoints publicly still applies.

Ledger-store conventions:

- `txids/<txid>`
- `txids/<coin>/<txid>.json`
- `data/transactions/<coin>/<txid>.json`
- `ipfs/<cid>` or `data/ipfs/<cid>`
- local images in `images/`, `data/images/`, `base57/`, `data/base57/`, `ipfs/`, or `data/ipfs/`

Endpoints:

- `GET /ping`
 - `GET /main-streams`
- `GET /txids?coin=litecoin`
- `GET /tx?coin=litecoin&txid=<64hex>`
- `GET /reindex` (refresh the JSON catalog and unified SQLite witness once)
- `GET /ipfs?cid=<cid>`
- `GET /find-assets?txid=<64hex>` or `GET /find-assets?cid=<cid>`
- `GET /raw?path=<relative path>`
- `GET /list?path=<relative path>`
- `GET /load?path=<relative path>`
- `POST /save`
 - `POST /main-stream`
- `POST /save-tx` (`refreshIndex: false` permits a batch followed by one `/reindex`)
- `POST /mkdir`
- `POST /delete`

Decode uses `/tx` and `/txids`. Portal uses `/txids`, `/tx`, and `/find-assets`.
When Portal finds an uncached transaction while fileProxy is running, it saves
the canonical JSON first. A current-page date batch saves every cache miss with
`refreshIndex: false`, then calls `/reindex` once. That rebuild corrects
`data/index/chisel.sqlite3` and its portable Portal index without repeating the
ledger lookup on later visits. The older `/load` and `/save` endpoints remain
available.

Portal v2.7.12 also writes public main-thunderword manifests to
`data/streams/<coin>/`. They record the selected public address, how it was
promoted (manual address, URL, rabbit trail, or WIF-derived public account), and
the returned txids. The WIF is never sent to fileProxy. A single delayed
`/reindex` turns those manifests plus saved transaction JSON into the SQLite
tables `main_thunderwords`, `main_thunderword_transactions`, and
`transactions`.
