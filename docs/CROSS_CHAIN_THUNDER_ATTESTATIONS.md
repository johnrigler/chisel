# Cross-chain Thunder Attestations: Trust and Distrust

Status: proposed Chisel protocol, 2026-11-06. These conventions are not consensus rules or a claim that an attestation is true. The parser, ledger writer, and attestation viewer are not yet fully implemented.

This document extends [Web3 Trust, Human Identity, and Executable Artifacts](WEB3_TRUST_AND_EXECUTABLE_ARTIFACTS.md). It is intended to work with the existing signed artifact envelope, MacDougall/UTXO thunder-address conventions, M64, and IPFS.

## 1. Principle

A claim is made by a **publisher/attestor** about an **identified subject** and carried by a **transaction**. These are distinct identities.

- A contract deployer makes the dictionary available. It is not automatically the party who endorses Dark Star Z.
- An EVM transaction's sender gives transaction provenance, not proof that the sender reviewed the code or is the original author.
- A UTXO transaction does not necessarily have one unambiguous "from" address; multiple input keys and change addresses may be involved. For strong authorship claims, use an explicit cryptographic signed envelope bound to the claim digest.
- A publisher may attest positively, warn against an artifact, correct an older assertion, or withdraw their endorsement. Every assertion remains attributable and independently evaluable.
- **Trust decisions belong to the reader**, including the reader's in-person relationships and other attestations. Publishing a warning does not make it globally authoritative.

## 2. Thunder address / word conventions

For EVM chains, reserve the following **Chisel application conventions** (not EVM protocol-defined special addresses):

| Meaning | 20-byte visible thunder address |
| --- | --- |
| BROADCAST / announce | \`0x1111111111111111111111111111111111111111\` |
| AVOID / warning / distrust | \`0x2222222222222222222222222222222222\` |

The zero address \`0x0000000000000000000000000000000000000000\` is already heavily used for null/burn semantics and is **not** the Chisel broadcast marker.

Do not automatically transfer POL, ETH or tokens to these addresses. If a writer chooses an address-directed EVM publication, the intent is a **zero-value data transaction** whose \`to\` is the marker, not a payment. A reader must never classify arbitrary token transfers to that address as attestations. On an EVM \`Packet\`-event carrier, a thunderword may instead appear as a declared \`bytes32\` namespace, for example all 1 hex digits across 32 bytes. A 20-byte address and a 32-byte event topic are different values and must be displayed as such.

For Litecoin, DigiByte and other UTXO chains, preserve the readable MacDougall/Unspendable language and the existing transaction structure. A recognizable thunder address can provide discovery context, while a plain ASCII \`OP_RETURN\` payload carries an unambiguous machine-readable claim. The same claim can be re-anchored on different chains without changing its subject digest.

## 3. Minimal ASCII wire idea for UTXO OP_RETURN

Proposed compact positive/negative locator:

\`\`\`text
CT1|+|H|<64 lowercase hex characters>
CT1|-|H|<64 lowercase hex characters>
\`\`\`

\`CT1\` identifies the Chisel Thunder Attestation v1 proposal. \`+\` means *endorsement/encouragement*; \`-\` means *warning/discouragement*. \`H\` means a raw SHA-256 digest of the **declared subject bytes**. Each line occupies 72 ASCII bytes, before any other output-level overhead; it therefore fits an 80-byte payload policy where that policy applies. Actual relay/consensus limits vary by UTXO chain and the selected wallet/service, and Chisel must check each chain's configured limit.

This short payload does **not** itself establish the person who issued it, indicate severity, or contain all evidence. If the identity binding or reason matters, point to a separately signed full envelope using another output, IPFS manifest, index, or later linked attestation.

A hash-only warning can say "I discourage use of software whose exact bytes have this digest" without publishing the software's address. It hides location, **not identity of commonly known content**: anyone who already has candidate bytes can hash them and compare. A hash is not a secrecy mechanism.

## 4. Larger portable claim

A suggested *semantic record*, before committing to an exact canonical serialization:

\`\`\`json
{
  "kind": "chisel-thunder-attestation",
  "version": 1,
  "claim": "warn",
  "subject": {
    "digestAlgorithm": "sha256",
    "digest": "<64 lowercase hex>",
    "digestScope": "m64-canonical-program"
  },
  "statement": "I discourage executing these bytes.",
  "issuer": "chisel:v1:<compressed-secp256k1-public-key>",
  "related": [],
  "evidence": [],
  "created": "<ISO8601 timestamp>"
}
\`\`\`

Positive claims may use \`claim: "endorse"\`; withdrawal/correction records must reference the earlier attestation itself. The assertion should bind at least: protocol version, claim meaning, subject digest, subject digest scope, and claimed issuer. Explicitly sign a stable canonical serialization using Chisel's established \`chisel-signed-v1\` domain-separated signing path, with its full type identifier (e.g. \`type: "thunder-attestation"\`). Do not copy an unsigned JSON document and label it "verified."

A subject can additionally carry a CID, EVM contract address, transaction hash, or network-qualified locator. The digest remains the byte-identity check. When a trust warning applies specifically to the M64 **program bytes**, distinguish that SHA-256 from the digest of the **M64 artifact JSON** or the CID of a UnixFS wrapper. All three can differ for the same program.

## 5. Cross-chain references

A reader normalizes a carrier observation to a provenance record, e.g.

\`\`\`json
{
  "carrier": "eip155:137",
  "txid": "0x...",
  "publisher": "0x...",
  "payloadFormat": "chisel-thunder-attestation-v1"
}
\`\`\`

Or \`carrier: "litecoin:mainnet"\`, \`txid\`, \`vout\` and \`opReturnBytes\`. The carrier record and the signed claim are separate objects. A claim can be repeated across Litecoin, DigiByte and Polygon; duplicate historical anchors should not count as independent human endorsements.

Attestations need no universal trust registry. A Chisel reader can aggregate statements about a selected digest by multiple independently chosen discovery routes, show each issuer, and apply local trust policy. Silence is not a vote.

## 6. Visual contract for the reader

The user should be able to recognize an attestation even without being able to decode hexadecimal:

- **BROADCAST / 1111:** display the full marker, its human label, chain, txid, author, and claimed subject. Do not rely only on color.
- **AVOID / 2222:** display a conspicuous warning sign and the full marker, followed by the **specific signer's warning**, subject digest, and a way to inspect evidence. Never silently re-label a contract or a publisher as "scam" just because one untrusted account made a negative assertion.
- **DISAGREEMENT:** display competing attestations together, in date order with identities, provenance, and withdrawn/corrected status. No globally authoritative majority count.
- **UNKNOWN:** distinguish "no attestation found" from "safe" and "unsafe."
- **LOCAL TRUST:** display how the reader knows the issuer, e.g. scanned sticker + separate signed identity attestation, without exposing private meeting details by default.

Trusted issuers can be granted scoped capabilities: graphics-only code in a no-network runtime differs from code allowed wallet access. A bad reputation claim should not revoke somebody else's signed identity or remove immutable ledger history.

## 7. Dark Star Z and IPFS

The first executable experiment should have this recovery path:

\`\`\`text
Chisel / standalone Dark Star Z page
    |
    +-- CID supplied --> gateway/IPFS fetch artifact JSON
    |                       |
    |                       +--> resolve M64 dictionary ref by chain and contract
    |                       +--> hydrate and verify canonical SHA-256
    |                       +--> inspect issuer / trust claims
    |                       +--> reader authorizes restricted execution
    |
    +-- no CID --------> run local deterministic source and controls
                            |
                            +--> optional build M64 v3 against a selected dictionary
                            +--> download artifact / render image
                            +--> optional explicit upload to public IPFS
\`\`\`

A Pinata JWT is a private capability, not part of the artifact. The initial standalone prototype accepts it *for the current page session only*, never puts it in a CID/URL/transaction, and never stores it in localStorage. A short-lived signed upload URL from a user-controlled broker is the preferred future path. A CID records content identity; it does not itself authenticate author or establish executable-code safety.

The standalone viewer is \`tools/m64Artifact/dark-star-z.html\`, suitable for linking or embedding in Chisel as an iframe. The transport-neutral \`M64\` interface, Solidity dictionary, and chain-aware resolvers remain separate modules.

## 8. To implement next

- Minimal verified attestation parser/serializer for the compact OP_RETURN form and signed envelope.
- EVM marker writer and indexed event reader, with zero-value review before send and no special interpretation of arbitrary payments.
- UTXO reader across supported chains for OP_RETURN plus thunder-address discovery.
- Publisher/subject views, user-controlled issuer trust decisions, warning/endorsement overlays, withdrawal records, and filterable claim timelines.
- Optional signed Pinata uploads through a user-selected local broker; later IPFS-native fetch and CID verification independent of a single gateway.

No new Solidity contract is required just to express these conventions.
