# Chisel send UX and ledger hydration direction (2026-11-17)

Status: decisions from the 2026-11-17 Android Mogwai → Chisel design discussion. This is a design note, **not** a claim that the features below are implemented.

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
