# Chisel bundled/static data

This directory is runtime data for the browser Portal. It is safe to publish on GitHub Pages, IPFS, or rigler.org.

The browser uses `portal-starter.js` for immediate first-page rendering, then may fetch `manifest.json` and `index/portal.index.json` to validate or refresh the static dataset. Local tools such as bun, deno, and fileProxy build or update this data, but they are not runtime dependencies.

## v276 reproducibility note

The release now includes generated static transaction stubs for every path referenced by `index/transactions.index.json`. These are not full live-node transaction captures; they are hydration-safe bundled records generated from the index and bundled import JSONL so colleague demos do not hit missing relative paths.
