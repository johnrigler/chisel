# Reading saved records over HTTP

Portal can read published files directly from an ordinary web server or an
HTTP IPFS gateway. Python and FileProxy are optional for reading those files.
FileProxy adds searchable indexes, caching, imports and writes when available.

In **File portal / storage**, set **Static data URL** to a data root, a currency
directory or a JSON index. For example:

```text
https://rigler.org/chisel-data/transactions/litecoin/
```

Portal leaves this field as entered. The separate **FileProxy URL (optional)**
field identifies the API; a static source is never converted into an API URL.
Changing the static source loads and merges its records into the current stream.
The bundled records and recent browser summaries still supply the first paint.

For a data root or currency directory, the reader tries
`index/transactions.index.json`, then `index/portal.index.json`. A currency
directory limits catalog rows to that currency. If the web server exposes an
HTML directory listing, recognized transaction JSON filenames are merged into
the catalog, including files missing from an older index. A listing can also
work without an index. Supported names are `<64-hex-txid>.json` and Chisel's
`<Base58-txid>-<first-12-hex>.json`. Only direct child files on the same origin
are accepted from a listing. For a root without a usable index, directory
discovery defaults to `transactions/litecoin/`; use a currency URL for another
chain. Servers without directory listings need a published index.

Catalog paths such as `data-root:transactions/litecoin/example.json` or
`data/transactions/litecoin/example.json` resolve under the static data root.
Transaction identity is checked against the requested TXID before JSON is used.
Relative manifest bases resolve against the manifest's URL, with its containing
directory as a fallback for older manifests. Known saved asset paths also try
the static HTTP roots, including images in closed and expanded records.

Static catalog loading starts independently of FileProxy. Its transaction
details load in groups of four, prioritizing the visible page and newer records.
FileProxy GETs have a two-second default deadline, including response-body
reading. Network failures and unavailable API responses defer API retries for
30 seconds while direct HTTP reads continue. API reads fall back to the static
catalog and transaction files; live ledger services can supply records that
have not been published there.

The relevant deployment settings in `chisel.portal.config.json` are:

```json
{
  "staticDataSources": ["https://rigler.org/chisel-data/"],
  "fileProxyUrl": "https://rigler.org/fileproxy",
  "fileProxyReadTimeoutMs": 2000,
  "autoLoadStaticDataset": true,
  "backgroundHydrateTransactions": true
}
```

The URL field uses the first configured static source. Without that field,
the loader supports all configured sources. Cross-origin servers must permit
browser reads with CORS; `rigler.org/chisel-data` currently supplies this header.
Static HTTP reading needs no cron job. Publishing updated files or indexes can
be automated separately. Browser reads cannot write back to a static directory;
imports and saving new data still need an authoring tool or writable service.
Saved JSON also cannot complete a submitted transaction's independent live
ledger verification.
