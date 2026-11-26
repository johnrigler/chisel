# Twetch identity adapter (experimental)

## Evidence and scope

The legacy [Twetch JS SDK](https://www.npmjs.com/package/@twetch/sdk) documents external signing addresses and registration through the legacy developer page. The [TonicPow bot](https://github.com/tonicpow/twetch-bot/blob/master/src/index.ts) uses the SDK's `twetch/post@0.0.1` action. The current [Twetch developer overview](https://github.com/twetch-inc) describes an identity made of a user ID and signer, but does not specify the HTTP write endpoint, canonical signing bytes, or signature representation. The linked new Rust SDK source was not available during investigation.

## Phase one

The browser-only adapter signs legacy Bitcoin Signed Message format using Chisel's existing vendored noble-secp256k1. It serializes the message with CompactSize prefix and message lengths, double-SHA256 hashes, and outputs a base64 65-byte recoverable signature. It checks the loaded WIF's address against the selected legacy mainnet P2PKH address and recovers the address to verify the result. This is an interoperable message proof, not a claim of compatibility with the current Twetch API.

The UI can generate a unique, locally scoped challenge or sign an exact user-supplied message. No key, message or proof is transmitted automatically; no network request, transaction, fee, or persistent credential storage occurs. Local proof is not Twetch account registration or authentication.

## Deferred direction (November 26, 2026)

This is a research backlog item, not the current implementation priority. The legacy Rust/WASM crate [`twetch-sdk` 0.0.1](https://docs.rs/crate/twetch-sdk/0.0.1/source/) is a possible reference implementation. Download the source and attempt a local `cargo build` on rigler.org if useful; compilation and compatibility with the current service have not been established. The SDK is not the complete Twetch backend, and a public source release of that backend has not been located. The newer Rust SDK described by Twetch is not currently accessible from its public link.

Study the legacy implementation for request structures, message hashing, recoverable signatures, publication actions, and fee/funding requirements. Prefer reproducing verified protocol behavior in Chisel's existing browser-native JavaScript signer, rather than introducing Rust as a runtime dependency. Keep the signing identity distinct from a BSV funding wallet and from a Twetch account ID. A zero-balance key can authenticate; publication still needs fees supplied by a wallet or sponsor.

A future experiment is to construct a Twetch-compatible transaction directly in Chisel, index it independently through the rigler.org BSV infrastructure, and test whether Twetch recognizes it. Investigate whether additional Chisel Thunderword outputs can coexist with the required Twetch payload. Do not assume Twetch will accept or index such transactions until tested.

## Next (when resumed)

Obtain a documented current API challenge or signed-write example and verify its exact preimage, signature encoding, user ID mapping, funding model and CORS behavior. Add the transport independently of the signer. Do not send a private key or WIF, and do not guess write endpoints or declare a successful account verification based on a local signature. The legacy SDK's publication action is evidence of historical behavior only.
