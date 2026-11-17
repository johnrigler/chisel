# Chisel send UX and ledger hydration direction (2026-11-17)

Status: design decisions recorded on 2026-11-17. The initial share-driver and YouTube UI are now implemented; the long-term ledger/IPFS hydration design remains future work.

## Working model

- **Chisel** is the browser-native base runtime and eventual base class. The current `Are You Sure` review/confirmation belongs in Chisel's **shared send workflow**, not in a YouTube-specific parent class.
- The send workflow owns preparation, transaction inspection, explicit final confirmation, local signing, broadcast, and success/failure reporting. Preserve existing ledger bytes, UTXO audits, network selection, fee semantics, and the manual pipeline.
- **YouTube** is the first specialized Chisel driver or future subclass. It handles recognizing a shared YouTube URL and constructing a media-aware preview and user intent, then invokes the same Chisel send workflow. Other drivers can follow the same pattern.
- A YouTube send screen should fit the preview and primary actions on a phone display. The bottom-left action is a **red Cancel**; the bottom-right is a prominent **green Go**. Show the selected identity/WIF readiness without exposing or leaking the WIF to preview drivers. **Go is not final authorization**: retain the existing transaction-review confirmation before signing.
- Existing-video deduplication stays ahead of building/signing/broadcasting, and existing Portal behavior should remain intact.
- In Android's Mogwai share shim, a successful handoff should show a short **about four-second** automatic-close countdown, with a control to keep the shim open. Return the user to their source application (often YouTube). **On failure, do not auto-close**; leave diagnostics and recovery available.

## Long-term destination

- GitHub is the current development/distribution stage. **IPFS** is the intended durable static distribution location, with **Polygon** as a verifiable publication/provenance source.
- An initial known transaction ID, including readable **unspendable address** semantics, should be sufficient to begin reconstructing or discovering Chisel. The bootstrap resolves ledger references and hydrates executable components, ultimately even reconstructing the application manually from ledger evidence if necessary.
- Reusable components, including Chisel's send logic and the YouTube driver, should eventually be represented by **M64** on Polygon. Definitions reference exact versions and dependencies (for example, immutable transaction hashes). This is **future work**, not a prerequisite for the UX improvements.
- The trust model is **self-sovereign**: verifiable identity, source bytes, hashes, dependencies, and ledger provenance make trust decisions inspectable and user-controlled; no centralized approval service is the root of authority. Confirmation and private-key boundaries are still explicit so that a user-authorized driver does not silently bypass transaction approval.
- Preserve browser-native vanilla JavaScript, static/IPFS portability, carrier-native transaction bytes, historic readability, and local signing.

## Implementation sequence

1. Add a small reusable boundary around the existing `app.js` standard send pipeline; keep safety review and broadcast behavior byte-for-byte equivalent. **Do not refactor the cryptographic core.**
2. Extract presentation/intent selection for the YouTube case, keeping generic send unchanged.
3. Add mobile preview with Cancel/Go, readiness checks, existing-video handling, and the existing confirmation modal.
4. Update Mogwai Android share success/failure dismissal separately in the Mogwai project.
5. Add fixtures for current flows, then evolve Chisel runtime classes, M64 packaging, on-chain dependency references, and IPFS hydration.

No transaction is to be broadcast, contract deployed, or dictionary modified as part of this software work.

## Implemented November 17, 2026

- Chisel 2.8.47: `chisel.share-driver.js` defines a small vanilla-JS base `ChiselShareDriver` and `YouTubeDriver` subclass. The shared `sendToChisel()` builds draft handoff URLs from public content and optional preview metadata, without involving signing keys.
- `chisel.youtube.ui.js` displays a Mogwai-inspired, phone-friendly YouTube panel with red Cancel, green Go, selected public address and a Transaction settings control. Go invokes the existing Chisel Send button; the verified fee/input/output review and explicit approval remain in `app.js`. Cancel discards the shared OP_RETURN draft without signing.
- Mogwai 0.4.25 can use the small script from Chisel GitHub Pages and falls back to its existing local handoff if offline or not yet loaded. The full signing bundle is not loaded by Mogwai.
- Source-level syntax was checked, but this release has not undergone a live on-chain send test. Existing video deduplication and Portal routing still execute in Chisel before any send.
