# Chisel v2.4.3b patch

Path-cleanup pass after the 2.4.3a GUI shell. No transaction-pipeline rewrite.

## Changes

- Bumped app version to `2.4.3b`.
- Updated cache-busting script query strings in `index.html` from `2.4.3a` to `2.4.3b`.
- Fixed GUI links for tools that actually live under `tools/`:
  - `tools/boxLabels4.html`
  - `tools/decoder/index.html`
- Updated GitHub workflow file checks to match the current repository layout.
- Kept root `qrScan.html` as-is because the main WIF scanner integration points at that root file.

## Non-goals

- No chain support changes.
- No signing changes.
- No proxy/API changes.
- No tool rewrites.
