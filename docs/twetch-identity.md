# Twetch identity adapter (experimental)

## Evidence and scope

The legacy [Twetch JS SDK](https://www.npmjs.com/package/@twetch/sdk) documents external signing addresses and registration through the legacy developer page. The [TonicPow bot](https://github.com/tonicpow/twetch-bot/blob/master/src/index.ts) uses the SDK's `twetch/post@0.0.1` action. The current [Twetch developer overview](https://github.com/twetch-inc) describes an identity made of a user ID and signer, but does not specify the HTTP write endpoint, canonical signing bytes, or signature representation. The linked new Rust SDK source was not available during investigation.

## Phase one

The browser-only adapter signs legacy Bitcoin Signed Message format using Chisel's existing vendored noble-secp256k1. It serializes the message with CompactSize prefix and message lengths, double-SHA256 hashes, and outputs a base64 65-byte recoverable signature. It checks the loaded WIF's address against the selected legacy mainnet P2PKH address and recovers the address to verify the result. This is an interoperable message proof, not a claim of compatibility with the current Twetch API.

The UI can generate a unique, locally scoped challenge or sign an exact user-supplied message. No key, message or proof is transmitted automatically; no network request, transaction, fee, or persistent credential storage occurs. Local proof is not Twetch account registration or authentication.

## Next

Obtain a documented current API challenge or signed-write example and verify its exact preimage, signature encoding, user ID mapping, funding model and CORS behavior. Add the transport independently of the signer. Do not send a private key or WIF, and do not guess write endpoints or declare a successful account verification based on a local signature. The legacy SDK's publication action is evidence of historical behavior only.
