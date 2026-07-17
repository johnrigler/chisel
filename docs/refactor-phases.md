# Chisel Refactor Phases

This file defines the low-risk refactor order for the next Chisel passes. The project does not yet have a real automated test harness, so changes should remain small, reversible, and easy to inspect in a browser.

## Safety rule

Make one conceptual change per patch. Prefer documentation, labels, static HTML, and passive reader UI before touching signing, serialization, fee calculation, UTXO selection, or broadcast code.

## Phase 1: orientation, low behavior change

- Add `docs/origin.md` and `docs/origin-print.html`.
- Rename the old Origin page to Start and keep it as the colleague-facing bridge.
- Update README so a colleague can understand the white-paper-to-Chisel bridge before opening old experimental panels.
- Keep Decode available under Tools only, as legacy diagnostics.

## Phase 2: Portal as the main reader

- Move normal decode language into Portal.
- Keep the old decoder as a diagnostic tool under Tools. Completed in v2.7.5.
- Add one obvious demo path: load local transaction, inspect outputs, inspect MacDougall/OP_RETURN/amount semantics, verify raw JSON.

## Phase 3: static dataset contract

- Document `data/` and `data-bundled/` as readable static datasets.
- Ensure Portal can read static JSON without fileProxy when index files are present.
- Keep fileProxy as the local write/import helper, not as a runtime dependency.

## Phase 4: core and satellites

- Treat core as UTXO primitives: build, sign, serialize, decode, and explain.
- Treat Portal as reader/presenter.
- Treat fileProxy, bunOven, keeperBun, label tools, QR tools, and scanners as satellites.
- Do not let satellites define the canonical artifact model.

## Phase 5: public examples

- Add two or three small examples that avoid project folklore.
- Each example should include: source transaction, decoded rows, human interpretation, verification route, and optional print view.

## Still handle carefully

- WIF handling.
- Transaction signing internals.
- Fee selection.
- UTXO selection.
- Broadcast endpoints.
- Chain module internals.

The v2.7.5 Etch manual pipeline touches orchestration around these areas, but it does not alter the core signing/serialization functions.

Those areas need a small fixture-driven test harness before major edits.
