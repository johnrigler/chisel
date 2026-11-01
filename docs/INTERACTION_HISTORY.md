# Interaction history and comments

Chisel records four kinds of deliberate interaction through the configured
FileProxy API: `visit`, `select`, `engage`, and `comment`. Page arrival and mode
changes are visits. Expanding or opening a record selects it. Opening linked
media and requesting/completing a reconstructed drawing are engagements.
Opening an external video establishes that the link was opened; Chisel does
not claim that playback started, finished, or lasted a particular duration.
Other record renderers can dispatch `chisel:record-engagement` with a loaded
row's `key` and a short `action`, for example `draw_svg`.

**Viewing now** shows newest activity first, including a public record title,
synopsis and dated action. Its record button opens the same record controller
as the transaction list, so an older item can be revisited. Scroll and
**OLDER ACTIVITY** retrieve earlier pages. Each expanded record and record page
also has a separate **Comments** section with **OLDER COMMENTS** pagination.
The existing editable Notes field is not the comment store.

## API and storage

The implementation is in `johnrigler/mogwai/fileProxy/tools/fileProxy/` and is
inherited by the consolidated `fp.py serve` process. The old standalone copy
under `johnrigler/chisel/tools/fileProxy/` does not implement this API.

- `POST /interactions` appends one document. A replay with the same ID and
  content returns the original receipt; changed content with that ID is 409.
- `GET /interactions?limit=20&before=SEQ` reads older entries. `after=SEQ`
  reads newer entries; `subject=KEY` and `kind=comment` scope a comment feed.
- `GET /interactions/event?id=ID` downloads the exact stored JSON document.
- `/ping` advertises `capabilities.appendOnlyInteractions: true`.

The server keeps `chisel-interactions.sqlite3` in its active data root. It
stores complete JSON documents, receipt time, a monotonically increasing
sequence, record identity and a 32-byte SHA-256 BLOB. SQLite triggers reject
updates/deletes; the generic public `/save` and `/delete` routes cannot replace
the database or its sidecars. Existing transaction and annotation files are
not modified. The filesystem owner still controls their own database; this is
an append-only application API, not a consensus ledger or independent timestamp
authority.

History is shared with readers of that FileProxy. Events contain a fresh
per-tab random session ID, not a fingerprint or an authentication claim. The
journal does not add IP addresses, user agents, referrers, key inputs, typed
form data, raw transaction objects or browser-only notes. Public source links
are credential-free and record data URLs exclude query strings/fragments.
Existing HTTP/diagnostic logs are separate from these interaction documents.

The UI polls while visible every 15 seconds. Keyset cursors preserve older
pages when new visitors arrive and catch up multiple pages without advancing
past a gap. Server sequence determines order even if a visitor's clock is
wrong. Comments display their authored date; the API's received date remains
available separately.

## Signed comments

Anonymous visitors can append unsigned comments. When a private identity is
loaded, the browser signs a `chisel-comment-v1` artifact using the existing
Noble secp256k1 backend and `chisel-signed-v1` envelope. Its identity is the
compressed public key and its author address is the corresponding Litecoin
mainnet P2PKH address. This is the key's canonical Litecoin identity even when
another currency is selected in the transaction workbench.

The signed payload binds the exact comment, authored time, random event ID,
record/currency/source/chain and public display snapshot. The domain is:

```
CHISEL-SIGNED-V1
chisel-comment-v1
<recursively sorted canonical JSON payload>
```

The comment capability only signs this fixed artifact type. Keys remain inside
the application closure and never enter event documents, storage, exports or
API requests. Changing identity during signing rejects the attempt. A signing
failure retains the draft and cannot downgrade an authenticated comment to an
unsigned one.

The API checks shape and canonical payload digest, and preserves the proof. It
does not claim to verify secp256k1 on the server. Readers verify the signature,
low-S form, payload digest and Litecoin address binding with the production
browser verifier before displaying **signature verified** and that address.
Invalid proofs are visibly unverified. An address proves key control, not a
person's legal identity or an independently certified date.

Each comment's **JSON** button exports its original envelope with `proof` last,
so the signature is at the bottom of the file. The same file is available from
the API download route. Later comments append new documents; they do not edit
earlier comments or the underlying ledger record.

## Local fallback and controls

`chisel.interactions.v1` in localStorage holds at most 500 cached entries and
500 unsent documents. The API retains the complete journal. An unavailable or
older API leaves documents pending, with no invented server sequence or
confirmation. A missing browser store is labeled **History in this tab**.
An outbox at capacity reports the limit instead of silently dropping comments.
Retries reuse the original IDs, authored dates and signatures. Pending entries
are bound to the API endpoint selected when captured and are not silently sent
to a different endpoint.

**Log page visits, selections and engagements** pauses automatic logging;
explicit comments remain available. **EXPORT LOADED HISTORY** exports loaded
pages, cached records and pending documents. **CLEAR LOCAL / UNSENT HISTORY**
clears the local cache/outbox, preserving the logging preference and shared
entries. Ordinary polling may reload shared history after the local clear.
Unsubmitted comment fields are not interaction history or automatic uploads.

## Deployment

Update Mogwai on each machine serving the configured FileProxy and restart its
existing process with the same port, data-root and TLS options. Verify its
`/ping` capability. This repository's GitHub Pages deployment does not restart
the private FileProxy process on rigler.org or the user's devices. Until that
process is updated, Chisel's local history and pending comments still work.

Tests exercise real HTTP append/read/download operations, immutable storage,
duplicate retries, busy pagination, offline/reload behavior, source changes,
unsigned and signed comments, Unicode, tampering, invalid proofs, draft/focus
retention and exact JSON exports. Fixtures use a publicly known synthetic key.
