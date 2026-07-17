# Chisel v2.7.7 patch notes

## Main change

Added browser-side Self Test and Guided Demo Mode.

## Added

- `chisel.selftest.js`
- Start page: Guided Demo Mode panel
- Start page: Browser Self-Test panel
- Tools page links back to Self Test and Demo notes
- `docs/DEMO_MODE.md`

## Self-test coverage

The browser self-test can check:

- Etch fixture load
- VIN/VOUT parsing
- unsigned raw hex generation
- local signed hex generation
- RPC command export
- manual draft save/restore without WIF persistence
- SEND SIGNED RAW lock gate
- Portal boot with bundled/static rows
- data-bundled indexed transaction path fetches when served over HTTP

The data-bundled path check is skipped under `file://` because browser fetch behavior is not reliable there. Serve the directory over HTTP for that test:

```bash
python3 -m http.server 8787
```

Then open:

```text
http://127.0.0.1:8787/index.html?mode=start
```

## Not changed

- No live broadcast test was added.
- No new chain support was added.
- `chisel.portal.js` was not split yet.
- Legacy Decode remains under Tools.
