# Cross-platform identity, rabbit trails, and recoverable publication

Recorded 2026-11-16. Design direction only; no new runtime integration is claimed.

## Principle

Chisel is the ledger-facing reader, signer, verifier and publisher. Mogwai supplies ingestion and optional peer transports. FileProxy indexes and preserves bytes; independent readers must not require FileProxy or rigler.org. Rabbit trails are typed, navigable relationships between records, not an assumption that a link is a backup.

## Identity

Chisel's native crypto addresses/keys remain valid first-class identities. Support external DIDs (including Bluesky did:plc), AT URIs, CIDs, domains and other chain addresses as optional references. Never require DID adoption for Chisel-native signing. A DID string may be published in chain-native UTXO OP_RETURN or EVM transaction data where current policy/fees allow. Plain publication of an identifier is not proof of control. Verify signed cross-identity claims against relevant key material and the source protocol; distinguish DID resolution from historical key authorization. Thunderwords are human-readable subject/discovery indexes, not evidence that all publishers sending to them own the subject.

## Rabbit trail data model (proposal)

Each artifact should distinguish: source locator, immutable content identifier if available, raw preserved bytes and media inventory, exact hash scheme and digest, capture observation time, source-asserted creation time, independent chain inclusion time, signer/key/algorithm and verification outcome, typed relations (reply, quote, parent, cites, mirror, attests), and chain transaction references. Preserve the exact original bytes and keep a canonicalization/version manifest for derived or M64-rehydrated material. A hash alone cannot restore missing content. Do not implicitly JSON-wrap on-chain records.

For Bluesky, keep AT URI (logical record), CID (record version), DID (actor), original record bytes or separately labeled normalized export, media blob references, and parent/root/reply references. The public API representation is not automatically the original signed repository record. Chain attestations must describe precisely which bytes were hashed. Import a single post first; thread traversal is an optional follow-on operation. If previously indexed, navigate directly to its portal record instead of a new etch screen.

## M64 and carriers

Prefer M64 when a verified round trip and total on-ledger byte/gas cost justify it. Preserve codec version, dictionary reference and full recovery metadata. UTXO OP_RETURN, EVM transaction calldata/logs, IPFS, cached files, and future BSV remain independent carriers. BSV is research only until public read fixtures, signing tests and collaborators exist. Do not infer chain capacity from a different network's policy. Avoid spending/broadcasting without explicit approval.

## Signing and messaging

A Chisel-signed application message can travel over WebRTC, local transport, email or any other carrier. Sign canonical versioned bytes with domain separation, chain/key algorithm and replay protection (nonce/message ID, optional expiry). Do not confuse DTLS transport encryption with independently verifiable message signatures. Signed timestamps are sender claims; chain inclusion is separate evidence of time. Key rotation/revocation needs an explicit history and validation rule. Never export private keys through Mogwai or peer transport.

## Engineering acceptance tests

1. Import the same Bluesky post twice: deterministic dedup by AT URI and tracked CID version; navigate to existing portal artifact.
2. Preserve source text and binary media; verify hashes from local bytes after the source goes offline.
3. Traverse root/reply/quote links on demand without duplicating already indexed records or asserting complete-thread preservation.
4. Verify and reject deliberately altered signed messages, invalid identity associations and replayed messages.
5. Rehydrate M64 bytes from the named dictionary and check both source digest and exact record version.
6. Disconnect GitHub Pages, public RPC, original service, IPFS gateways and FileProxy independently; record what still resolves, reads and verifies.

Related: docs/BSV-SUPPORT-DIRECTION.md; docs/CROSS_CHAIN_THUNDER_ATTESTATIONS.md; Mogwai docs/BROWSER-AND-BLUESKY-SUGGESTIONS.md.
