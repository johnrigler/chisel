# Chisel signed artifacts v1

Chisel treats key acquisition and artifact signing as separate layers.

A private key may come from a BIP-39 mnemonic, the QR/sticker system, a directly imported key, or a future external signer. Once Chisel has a secp256k1 private key, the signing format is identical.

## Identity

The machine identity is the compressed secp256k1 public key:

```
chisel:v1:<66 hex characters>
```

UI should normally use `CHISEL.shortIdentity()` rather than displaying the full identifier.

## Envelope

```json
{
  "format": "chisel-signed-v1",
  "type": "lantern-save",
  "identity": "chisel:v1:<compressed-public-key>",
  "payload": {},
  "proof": {
    "algorithm": "secp256k1-sha256",
    "digest": "<sha256>",
    "signature": "<64-byte compact signature as hex>"
  }
}
```

The signature input is domain-separated:

```
CHISEL-SIGNED-V1
<type>
<canonical-json-payload>
```

Object keys are recursively sorted before hashing. Arrays retain order.

## Browser API

```js
const identity = CHISEL.identityFromPrivateKey(privateKeyHex);
const label = CHISEL.shortIdentity(identity);

const envelope = await CHISEL.signArtifact({
  privateKeyHex,
  type: "lantern-save",
  payload: saveObject
});

const valid = await CHISEL.verifyArtifact(envelope);
```

The signed envelope contains no mnemonic and no private key.

Storage is deliberately outside this format. FileProxy, IPFS, a local JSON file, email, or a blockchain can carry the same envelope without changing its authorship proof.
