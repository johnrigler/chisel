# Data diagnostics, record sources, and FileProxy plans

## Available now

Open **☰ → Diagnostics → Run data checks**. The report checks the active
FileProxy's `/ping`, its configured/resolved data root, configured static
manifests and the index URLs Portal actually uses, and the alternate
`chisel-data` / `chisel_data` spelling when a manifest uses one of those paths.
The alternate spelling is optional; a 404 there is a warning. FileProxy health
and static data availability are reported separately. A working repository
snapshot does not conceal an unavailable FileProxy.

**Download debug JSON** runs fresh checks before exporting. The v3 export
includes the latest report and a bounded history of FileProxy and static JSON
request metadata (HTTP status, duration, failure category, endpoint origin/path).
URL credentials, query strings, fragments, transaction bodies, form values and
private key material are excluded. Home-directory usernames and long account
identifiers in paths are redacted. Clear debug history clears both histories.
Browser fetch failures cannot reliably distinguish CORS, mixed content, TLS,
and a disconnected network; those failures have no invented HTTP status.

Checks only read data. They do not reindex, write cache records, send or sign
transactions, change symlinks, or repair server configuration. Each request has
a six-second timeout. Normal browsing still uses the existing loading policy;
there is no new background polling loop. The storage portion of `/ping` needs
the updated FileProxy process. Older servers remain usable and show a warning
that resolved storage diagnostics are unavailable. Browser-only changes need a
reload; updating `tools/fileProxy/proxy.py` needs a FileProxy restart.

The canonical sibling datastore remains `chisel-data`; FileProxy selects the
first `CHISEL_DATA_ROOT` entry or the checkout's `data` path. A compatibility
alias does not replace correct service configuration. Diagnostics report when
the workspace `data` path and an explicit service root resolve differently.

The configuration loader also accepts a plain `chisel.portal.config.json`
without requiring FileProxy to wrap it in an `ok/config` response. This keeps
the static-reader configuration available when FileProxy is offline. The
main page's inline-script CSP hashes match the menu/activity bootstrap again.

## Next: visible record sources and explicit ledger refresh

Keep delivery source, freshness, and validation as separate metadata. A record
read from FileProxy or a repository is cached content even when its discovery
started with a live ledger search. Fetching successfully from a blockchain API
is a provider observation, not independent ledger proof.

Planned record labels:

| Actual data delivery | Visible label | Additional state |
| --- | --- | --- |
| Repository/bundled JSON | Repository snapshot | Snapshot generation date |
| FileProxy transaction cache | FileProxy cache | Server identity and retrieval time |
| Fresh chain API/node response | Ledger API | Provider and retrieval time |
| Imported/undetermined data | Imported / source unknown | No inferred verification |

Add source badges to each record and its expanded details. Preserve the actual
source of the displayed payload through merges: a cache hit, a saved copy of a
live response, or discovery metadata must not silently promote an old payload
to "verified." Do not use `discoverySource`, `staticSource`, or the presence of
`localPath` alone to infer payload verification. The existing explorer link is
a navigation action, not a completed verification check.

Add an explicit **Refresh from ledger** action that bypasses repository and
FileProxy caches. Check the requested network/coin and transaction ID before
accepting a response; compare canonical transaction content rather than
provider-specific JSON formatting. Where raw transactions are available,
compute and compare the transaction ID. EVM receipt and block proof support
needs a separate design. Record when and how a check was performed and retain
both versions if they conflict. On timeout or disagreement, retain the cached
record and show the result of the attempted check. Use stronger "verified"
wording only for the specific verification actually performed.

For speed, render cached records immediately, offer explicit per-record refresh,
and consider a bounded refresh of visible stale records later. Avoid refetching
the entire feed on every paint or delaying browsing for optional checks.

## Later: several FileProxy servers, including phone and computer

Replace the single URL with an explicit server registry: stable ID, display
name, base URL, read priority, enabled state, and whether it is a write target.
Support the public server and deliberately configured LAN/loopback endpoints.
Keep per-server health, storage identity, last success, latency and capabilities.
The diagnostics already read the currently selected URL and should eventually
show one check group per enabled server.

Try enabled read servers in a bounded order and stop after a suitable result;
record which server supplied the displayed data. A matching transaction ID is
not permission to label two conflicting payloads as equivalent. Keep writes
on an explicitly selected destination, with no silent fan-out or retry to a
different server after an ambiguous write result.

Before enabling this:

- Remove the current unconditional migration of explicit localhost and
  `127.0.0.1:7799` URLs to rigler.org. A deliberate local URL must stay local;
  any migration of an old saved default must be distinct from user input.
- Handle browser mixed-content and private-network access requirements. An
  HTTPS page may not be able to read an HTTP phone/LAN service. CORS alone does
  not resolve every browser restriction; document workable secure/local access.
- Keep loopback binding as the default. LAN sharing is an explicit deployment
  choice with origin restrictions and authenticated writes. A device's
  filesystem paths are not portable addresses for another FileProxy.
- Merge and deduplicate by chain/network plus transaction ID, while preserving
  source identity, freshness, conflicts, and validation history.

Record badges, ledger refresh, and the server registry are plans in this note;
this diagnostics update does not claim to implement them.
