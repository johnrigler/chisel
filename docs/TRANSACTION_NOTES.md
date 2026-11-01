# Transaction notes

Notes describe the meaning and context of a transaction separately from its
ledger bytes. The editor has two fields: a freeform Note and an optional JSON
Metadata object. Notes render as literal text with preserved line breaks;
metadata is data, never executable code.

**SAVE TO FILEPROXY** writes a shared file through the configured server.
**SAVE IN BROWSER** writes only localStorage. Existing browser notes are not
automatically uploaded. Legacy Category and Fix fields become labeled text
inside the Note, preserving their contents. Unsent edits stay in memory across
record rerenders. Invalid metadata and failed saves retain that draft.

FileProxy already supplies the required API; no new Python route is needed:

```text
GET /raw?path=data/annotations/litecoin/<txid>.json
POST /save
```

The save body is `{ "path": "data/annotations/litecoin/<txid>.json", "text":
"<serialized notes document>" }`. It writes a separate file and leaves the
transaction JSON unchanged. Tools and assistants with authorized FileProxy
access can read and write this same document:

```json
{
  "schema": "chisel-transaction-notes-v1",
  "coin": "litecoin",
  "txid": "<64 lowercase hexadecimal characters>",
  "note": "The work behind this transaction, analysis, links and follow-up.",
  "metadata": {
    "title": "A descriptive record title",
    "sources": ["https://example.org/reference"]
  },
  "updatedAt": 1793500000000
}
```

`updatedAt` is Unix time in milliseconds. The reader checks schema and record
identity. A changed shared timestamp detected before saving stops the write;
reload the shared note and merge your retained draft before retrying. This is
a client preflight check, not an atomic compare-and-swap on the generic `/save`
endpoint. External writers should read the current document before updating it.

For EVM views, both the document and path also retain `chainId` and `sourceId`:
`annotations/evm/<chainId>/<sourceId>/<txid>.json`. Other chains use
`annotations/<coin>/<txid>.json`. Notes are limited to 24,000 characters and
metadata to a 64 KiB JSON object. Additional metadata fields remain opaque and
are preserved, including decoder/profile names, related transactions and source
code. The record renderer recognizes `metadata.title`, `metadata.mediaCards`
and a single `metadata.media` card. For example:

```json
{
  "title": "Descriptive title",
  "media": {
    "url": "https://www.netflix.com/watch/example",
    "title": "Descriptive title",
    "description": "Shared description",
    "authorName": "Author or channel",
    "thumbnailUrl": "https://example.org/picture.jpg"
  }
}
```

Existing media URL/image checks still apply. These fields cannot alter the
TXID, currency, ledger bytes, financial calculations or live verification.
Saved notes are included in the `notes` field of `chisel-record-v1` downloads;
unsent drafts and browser identity state are excluded.

Readers load visible records in groups of four without blocking transaction
loading. FileProxy is tried first; ordinary HTTP sources and the bundled
snapshot are fallbacks. Under a published data root, the HTTP file is
`annotations/<coin>/<txid>.json`. A FileProxy write does not itself copy files
to another web directory: that directory must publish the annotations folder
to offer those writes without Python. The trapezoid specimen has an explicit
bundled snapshot, so its note also reads from the static Chisel build.

The browser cache preserves a newer local note when a mirror is older. An
empty, timestamped shared document clears a shared note without reviving an
older static snapshot. No browser note is silently promoted to shared storage.

Configuration defaults:

```json
{
  "autoLoadTransactionNotes": true,
  "annotationFilePrefix": "data/"
}
```

`annotationFilePrefix` is relative to FileProxy's workspace. A deployment with
an allowed external data root can use `"data-root:"` instead. Static HTTP
locations always use the root-relative `annotations/...` path.
