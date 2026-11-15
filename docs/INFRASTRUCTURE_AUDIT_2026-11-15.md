# Chisel / Mogwai infrastructure review — 2026-11-15

This is a source and Git-history audit, **not** a live penetration test or proof of the running rigler.org FileProxy configuration. Do not infer that GitHub source and the live service match until the server checkout and service process are checked. Keep all Chisel code changes on `main`; do not merge a stale branch wholesale just because its PR remains open.

## Confirmed integrations on Chisel main

- PR #51 (Noble default browser signer): closed without merging. The newer production Noble 3.2.0 integration was already on `main`; the older PR would restore obsolete parity-signing behavior.
- PR #84 (crawler-readable social preview pages): the publisher, test, and documentation were copied byte-for-byte onto `main`, then the diverged PR was closed. This is a **manual static HTML generator**, not an automatically deployed FileProxy service or a claim that X previews already work.
- PR #83 (Viewing now YouTube thumbnails): the renderer was copied onto current `main`; CSS and the script cache revision were patched into the current `index.html`. The diverged PR was closed. Browser display still requires manual confirmation.

## Open Chisel PRs requiring reconciliation, not blind merge

- #50: recipient-address QR scanner. The proposed standalone `addressScan.html` is absent from `main`, while the current Send page has a `SCAN QR` control. Confirm the active control's recipient validation and return path before integrating the older page/bridge.
- #56: read-only FileProxy/data-root diagnostics. `chisel.data-diagnostics.js` is absent from `main`; the older branch also edits legacy FileProxy code and current Portal files. Port the diagnostic behavior and tests against current code instead of replacing newer runtime files.
- #64: Solidity/M64 directory consolidation. This wide rename touches EVM factory, M64 source/build outputs, paths, CI and docs. Rebase functionality against the current deployed contracts and file layout before changing source paths; do not merge the old 41-file branch wholesale.

Historical release branches are snapshots. An ahead/behind count does not establish functional absence, nor is deleting a branch a substitute for integration.

## FileProxy is not GitHub-style repository authorization

GitHub protects repository write/publish permissions. FileProxy is a local/operator-controlled filesystem service, accessed directly, through a LAN, or through a web reverse proxy. Its relevant questions are **which network peer can reach each route**, **what root is registered**, **whether that route reads or writes**, and **what public artifacts are intentionally published**.

The current Mogwai `fileProxy/fileproxy/server.py` inherits a Chisel compatibility handler and exposes additional `/v1` routes. The `FILEPROXY_WRITE_TOKEN` policy applies to the new `/v1` POST path, **not** automatically to the inherited legacy Chisel endpoints. The `/v1/file` and folder reads serve registered filesystem roots to reachable callers. The server's own architecture notes warn that inherited legacy endpoints include unauthenticated writes and broad CORS. A reverse proxy that exposes a loopback-bound listener is still remote exposure at the HTTP layer; loopback binding by itself is insufficient if an Apache/Nginx proxy forwards public requests.

This does **not** mean every internal FileProxy action needs a GitHub-account login or a universal token. Separate local operator operations, remote reader operations, controlled writes, and intentionally public static artifacts. Local ownership and explicit root selection remain first-class. Never treat a CORS header or a hash as authorization. A SHA-256 verifies bytes, not identity or source truth. Chisel remains responsible for ledger/signature interpretation; FileProxy remains byte transport and indexing, not a wallet signer.

## Highest-priority checks

1. Inspect the **actual** rigler.org reverse proxy mapping and FileProxy process arguments. Determine whether unauthenticated legacy write routes such as `/save-tx`, `/save`, `/reindex`, and `/delete` are remotely reachable and which filesystem directories they affect. Inspect config before probing mutations on production. Constrain exposed paths/routes by the intended public/private boundary.
2. Review all registered roots on each FileProxy instance. `/v1/file` and `/v1/fs/` should only serve content intentionally readable by that instance's clients. Do not register an entire private Daisy archive for a publicly reachable read interface unless that exposure is explicitly intended.
3. Preserve Mogwai's evolved compatibility handler. Its `fileProxy/tools/fileProxy/proxy.py` and Chisel's `tools/fileProxy/proxy.py` have different Git blob hashes; Mogwai has extra `/interactions`, `/account-index`, and `/youtube-metadata` routes. The current Mogwai README, AGENTS and architecture notes were corrected to describe this divergence. Do not copy the older Chisel handler over the running Mogwai one.
4. Align Portal ingestion with the indexed URL catalog and `/interactions` contract. A Mogwai share shim is optional; Chisel itself should resolve a recognized existing video to Portal. A static Chisel page should still render stored/indexed records when FileProxy is unavailable.
5. Test the post-integration browser behavior after GitHub Pages catches up, including the Viewing now thumbnail on narrow screens and a social-preview URL **after** the corresponding HTML has actually been published. The authoring commits are not proof of deployment or runtime success.
6. Reconcile the dated roadmap. `docs/NEXT_DEVELOPMENT.md` was last updated October 6 and still calls some Polygon dictionary deployments future work; later contracts and on-chain work require a fresh verified state, not assumptions based on the old status line.

## Mogwai branches still under review

- PR #8, Litecoin signed identity namespaces, is explicitly experimental and calls for wallet interoperability and security hardening before public exposure. Do not merge it into a publicly reachable service as a routine branch cleanup.
- `docs/fileproxy-large-media-cas-20261110` and `feature/static-artifact-publication-v1-20261109` have unmerged work; reconcile streaming/copy integrity and static publication separately from HTTP access-control changes.
- The YouTube URL catalog branch is behind `main` with zero ahead commits; its functionality is already in the current history, unlike the above experimental branches.

## Verification limit

The GitHub connector confirmed source files and commit updates. No connected Chromebook tab was available for hands-on UI testing, and a public request to `https://rigler.org/fileproxy/ping` could not be completed from the available external fetch. The latest direct commits did not expose CI conclusions via the queried status interfaces. Do not claim tests passed or a FileProxy restart happened on that evidence.
