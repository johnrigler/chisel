# Chisel v2.4.3a patch

GUI shell pass. No transaction-pipeline rewrite.

## Changes

- Bumped app version to `2.4.3a`.
- Added mode navigation to `index.html`: Broadcast, Review, Decode, Tools.
- Broadcast mode keeps the existing build/sign/send form.
- Review mode holds the raw engineering pipeline outputs.
- Decode mode links to `decode.html`.
- Tools mode links to `qrScan.html`, `boxLabels4.html`, and `decode.html`.
- Added `setGuiMode(mode)` and URL query support: `?mode=broadcast`, `?mode=review`, `?mode=decode`, `?mode=tools`.

## Non-goals

- No new chain support.
- No transaction signing changes.
- No new RPC method assumptions.
- No changes to QR scanner logic.
