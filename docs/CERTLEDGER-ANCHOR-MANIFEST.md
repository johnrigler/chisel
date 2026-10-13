# CertLedger/Daisy evidence anchoring (2026-10-12)

Chisel is an **optional local signing, transaction and proof tool**.
It does not decide whether Oracle, a court, a commentator or a publisher
is correct, and it does not poll permits or private company correspondence.

The current concrete matter lives in
`johnrigler/daisy_2026/421/01-project-jupiter.record.json`; Chisel
must not duplicate the matter record as a second source of truth.

## Proposed minimal receipt contract (design, not implemented)

A reviewed manifest should explicitly name:
- stable `subjectId`, frozen `manifestVersion` and a deterministic
  **canonical serialization method** (not unspecified JSON formatting);
- each included artifact's original URL/source ID, full SHA-256, byte count
  and source capture identity;
- `manifestSha256` computed from **final canonical bytes**;
- `asOf`, review status and explicit note that the digest is not a
  judicial finding;
- separately, after a real chain write, `chain`, `network`, `txid`,
  the encoding or OP_RETURN location, block hash/height where verified,
  and observed confirmations.

Example intended shape:

```json
{
  "subjectId": "project-jupiter-nm-2026",
  "manifestVersion": "draft-v1",
  "canonicalization": "to-be-specified",
  "manifestSha256": null,
  "artifacts": [],
  "chainReceipt": null
}
```

This is a draft schema, **not a live transaction**. Do not hash the
placeholder, put unverified values on-chain, or assume that a shortened
Shoctal identifier or Git SHA is the full source digest.

## Workflow

Daisy stores original dated matters -> FileProxy retains and hashes
exact source bytes -> CertLedger reviews attribution and distinctions ->
SB Shell composes a human-readable issue -> at a chosen milestone,
freeze and hash an exact reviewed manifest -> manually sign/broadcast
via Chisel -> record receipt separately and verify the resulting chain
inclusion. Preserve the old manifest and add a new one for corrections.

Anchor meaningful **batches** or editorial milestones; never transmit
every incidental HTTP page change. Ledger finality and timestamps are
blockchain-specific; a block inclusion is evidence of presence no later
than that inclusion, not a proof of real-world document issue time or truth.

No Chisel signing, send, portal or wallet paths are modified by this note.
