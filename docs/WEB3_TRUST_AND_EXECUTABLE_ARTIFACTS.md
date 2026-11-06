# Web3 Trust, Human Identity, and Executable Artifacts

Status: architectural note / proposed Chisel behavior, 2026-11-06. This is a trust model, not a claim that all UI or protocol machinery described here is implemented.

## Thesis

Web3 offers a distinct way to connect an encounter with a person, a cryptographic identity, an enduring public claim, and exact software bytes. This is not the assertion that a blockchain makes code safe or that a key proves a legal name. It is the ability for a reader to independently recover **who claimed what, about which bytes, when, and through which durable record**, and to choose whether to rely on that claim.

Chisel's objective is to make this chain of evidence understandable without appointing a site operator, contract owner, block explorer, or gateway as the sole authority.

A useful separation:

- **Content identity:** a CID or digest names exact bytes.
- **Publication evidence:** a transaction proves a particular account published or submitted data at a particular ledger position, under that chain's rules.
- **Authorship / endorsement:** an explicit signature binds a claimed identity to a particular artifact digest and statement. The publisher can be the author, but need not be.
- **Human trust:** a person decides whether to trust the identity behind the signature, possibly following direct meetings, recurring relationships, verified records, or attestations by other people.
- **Execution policy:** the local reader decides whether and with which capabilities to run recovered code.

None of these implies the next automatically.

## The QR/sticker encounter: identity is a relationship, not an address string

Chisel's physical QR workflow offers a practical way to establish a memorable encounter: hand over or show a physical sticker, scan it, inspect the record it identifies, and optionally exchange public-key information or attest to what happened. The physical ritual supplies social context that a naked address does not.

The record's 16-hex / 8-byte QR identifier is a **locator or index**, not authentication and not a private key. Color is a visual grouping/checksum aid, not a cryptographic proof. The KEY 4, ARTIFACT 1, and RECORD scanner modes must not be conflated. Merely possession or scanning of a copied sticker proves neither identity nor consent.

A stronger encounter can record each participant's public identity, the exact claim being made, its date, and optionally independent signatures by both parties. The attendee can then recognize that identity in subsequent publications. Private keys remain private. The encounter can be recorded locally or anchored publicly at the participant's discretion; meeting and location data should never be exposed automatically.

This is a proposed trust-building mechanism, not a mechanism for automatically certifying someone's real-world identity.

## Publisher is not deployer

For the M64 example:

1. Somebody deploys an `M64Dictionary` contract. That address identifies one append-only vocabulary and lookup table; the deployer's account does not thereby approve every artifact using it.
2. Somebody publishes a Dark Star Z M64 artifact, perhaps as EVM calldata, an event packet, or a signed manifest carried by IPFS. The transaction sender gives transaction-level provenance for the publication.
3. That sender (or another author/attestor) may explicitly sign a statement bound to the artifact's canonical digest/CID, dictionary reference, runtime specification, and a declared meaning such as "I published this program" or "I have reviewed this program."
4. The reader resolves the dictionary and program, verifies byte integrity, then chooses whether the signer's identity and specific claim justify executing it.

The account that submitted the publishing transaction is the starting point for publication provenance; it is not necessarily the author, reviewer, or end-user-facing identity. A separate signed statement makes the intended assertion unambiguous. A claim of safety should identify its scope and the artifact digest, not just a mutable name like "Dark Star Z."

## Dark Star Z: first executable trust case

Dark Star Z is an interactive graphics program, not merely an image. Chisel should recover its program from the M64 artifact, resolve term IDs through the referenced dictionary (initially Polygon, but not inherently EVM), verify the reconstructed bytes, and expose its input parameters as controls in the browser. Changing line count, colors, seed, dimensions, and slopes reruns the already-hydrated program; no new blockchain transaction or repeated hydration is required.

The artifact can be stored in IPFS, in ledger packet data, or at a user-chosen HTTP/static source. The same reader should operate from IPFS or rigler.org. The artifact carries the dictionary identity so numeric IDs are never interpreted against the wrong contract.

Execution should be a deliberate reader action governed by an explicit trust decision. A verified signature answers "which key made this precise claim?" It cannot establish that arbitrary JavaScript is harmless. Sandboxed execution with minimal capabilities remains useful even when the publisher is trusted, because trusted people can make mistakes or lose keys. An established relationship should make execution *possible by policy*, not bypass the integrity checks.

## Trust is contextual, plural, and revisable

Chisel should not create one globally authoritative "safe" badge.

A reader can maintain local trust decisions for keys and purposes, for example:

- recognize this identity because of an in-person encounter;
- accept this publisher's graphical experiments within a no-network, no-wallet runtime;
- require a second signed review before granting filesystem, network, or wallet interactions;
- decline an artifact or revoke future automatic execution if an identity is compromised.

Trust can be delegated, but endorsements should be explicit, signed, inspectable, and purpose-limited. A signed assertion is evidence that its signer made the assertion, not proof that the assertion is true. Reputation emerges from the reader's relationships and inspectable history rather than a central server's opaque score.

Historical ledger records are append-only. Corrections, withdrawals, and revocations must be **new signed records** referencing earlier assertions; they do not erase history. Readers should distinguish a claim's original publication time from its present trust status.

## Proposed Chisel components

1. **Identity / encounter viewer:** show the scanned QR locator, resolved public identity, attestations, and the reader's own notes. Never treat the QR locator itself as an authentication factor.
2. **Artifact envelope:** bind the M64 v3 descriptor, dictionary reference, canonical digest, runtime and publisher claim to a portable signed statement, using Chisel's established `chisel-signed-v1` signature conventions where appropriate. Do not assume an EVM transaction signature and a Chisel secp256k1 signed envelope are interchangeable without explicit key/address validation.
3. **Publication adapter:** identify chain ID, transaction hash, log index or calldata position, publisher address, IPFS CID, and content digest as applicable; separate what was observed on-chain from what was self-asserted.
4. **Trust policy:** locally store accepted identities, claim types, optional co-signers, execution scopes and revocations. The reader owns this policy; publication does not silently change it.
5. **M64 hydration and execution:** read transport bytes, resolve the correct external dictionary, verify canonical digest and byte length, then run in an isolated execution environment with declared permissions.
6. **Human-readable provenance view:** answer "Where did this code come from?", "Who published it?", "Who endorsed this exact version?", "How do I know that identity?", and "What will Chisel allow it to do?"

## What is new here

Conventional web distribution often asks users to trust a domain, package registry, or platform operator. Chisel's proposed model lets a human encounter establish a relationship to a key, lets public ledgers preserve attributed publication history, lets content addressing identify immutable program bytes, and lets a portable client reconstruct and execute the artifact under the reader's chosen trust policy. No one chain, gateway, contract deployer, or web domain needs to define trust for everyone else.

It is not trustlessness. It is **user-directed, portable, inspectable trust with durable evidence**.

## Existing repository foundations

- `tools/qrField/README.md`: physical labels, deterministic colors, 16-hex locator values.
- `docs/physical-records.md`: complete 8-byte record IDs, distinct scanner modes and private Daisy catalogs.
- `docs/SIGNED_ARTIFACTS.md`: portable secp256k1 signature envelope independent of storage carrier.
- `docs/community-web3-workshop.md`: proposed in-person QR and ledger record demonstration.
- `tools/m64Artifact/README.md` and `tools/m64Artifact/LEDGER_IPFS_ARCHITECTURE.md`: external dictionaries, client-side hydration, multiple carriers and reconstruction.
- `tools/m64Artifact/CARRIER_MODEL.md`: artifacts, locators and carriers remain separate.
- `docs/SECURITY_REVIEW_2026_W42.md`: the existing code-integrity and signing boundaries are meaningful and should remain in place.

## Non-goals and open questions

This note does not specify a universal identity authority, a single trust algorithm, or a token-based reputation score. Open design questions include the exact scope of a signed safety assertion, how an artifact identifies its original publisher if copied between carriers, how offline readers receive revocations, how a user migrates from a compromised key, and whether multiple in-person signatures should be required for particular execution capabilities. These should be worked through with Dark Star Z before treating artifact execution as a general feature.
