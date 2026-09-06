# Chisel M64 Artifact Workbench

This directory turns the McDougall/M64 experiments into a generic Chisel tool.

The important separation is:

```text
source/data
   |
canonical form
   |
token abstraction
   |
M64 transport
   |
hydration
   |
runtime
```

M64 is not an image format. It is a transport encoding for an abstract byte stream. The current workbench uses it primarily for compact JavaScript artifacts, but the transport layer does not require JavaScript.

## Files

- `index.html` - generic source -> canonical JS -> abstract tokens -> M64 -> hydrate -> sandboxed test workbench
- `polygon.html` - pure browser EIP-1193 carrier for writing arbitrary UTF-8 artifact text into Polygon transaction calldata and reading it back
- `examples/darkstar-raster.html` - compact standalone host for the deterministic Dark Star raster/pattern core
- `examples/darkstar-core.js` - extracted image-producing core
- `examples/darkstar-core.canonical.js` - known-good canonical/minified core
- `examples/darkstar.m64.txt` - known-good M64 staging payload
- `examples/darkstar.profile.json` - token profile used for the staging payload
- `examples/darkstar.artifact.json` - self-contained artifact package
- `examples/darkstar.test.json` - byte counts and known RGB SHA-256

## Artifact model

The first package format is intentionally small and descriptive:

```json
{
  "kind": "chisel-m64-artifact",
  "version": 1,
  "type": "javascript",
  "runtime": "CHISEL-PURE1",
  "entry": "a",
  "profile": {
    "kind": "m64-profile",
    "version": 1,
    "alphabet": "...64 characters...",
    "tokens": ["function", "return", "..."]
  },
  "input": {},
  "payload": "...M64..."
}
```

The profile is embedded for now so an artifact can hydrate without an external registry. Later versions can replace an embedded profile with a content hash or ledger reference once profiles become stable and reusable.

## CHISEL-PURE1

`CHISEL-PURE1` is the first execution convention.

A hydrated artifact defines a plain JavaScript entry function and the host invokes:

```js
entry(input)
```

The result should be structured-cloneable data such as a string, number, object, array, `ArrayBuffer`, or typed array.

This is deliberately not an image-specific interface. A PURE1 artifact can implement:

- a raster generator
- text transformation
- address encoding/decoding
- transaction serialization
- parsers
- procedural data generation
- MIDI or other binary file generation
- compact protocol logic

The workbench recognizes one convenience case: if an artifact returns a `Uint8Array` whose size is `input.width * input.height * 3`, it previews those bytes as RGB24. That preview rule is a workbench adapter, not part of M64 itself.

## Runtime isolation

The workbench runs hydrated artifacts in a sandboxed iframe with a restrictive CSP and no same-origin privilege. This reduces accidental access to the parent page, local storage, injected wallets, and network endpoints.

This is not a proof-grade sandbox. Untrusted JavaScript can still consume CPU or memory. The workbench destroys the execution frame after a timeout, but the artifact should still be treated as code.

Future runtimes can explicitly define additional capabilities, for example canvas, audio, network, or wallet access. Those should be separate runtime profiles rather than silently exposing browser globals to every artifact.

## Dark Star staging result

The first larger test extracts the deterministic renderer from Dark Star Raster v1.

Known staging numbers:

```text
readable raster core:    1108 bytes
canonical JS:             920 bytes
abstract token stream:    833 bytes
M64 transport:           1111 characters
generated RGB raster: 3,780,000 bytes
```

Known RGB SHA-256:

```text
f8ae0fb9eb89714ab56dcf583ee1481bce22f16f22e0493ca66a9a34047b5d62
```

The stored M64 hydrates exactly to the canonical JavaScript, and both the canonical and hydrated forms reproduce the same RGB byte stream.

The current token profile is inherited from the earlier trapezoid experiment and is not optimized for this renderer. That is useful: it proves the transport before profile tuning. A later profile can be optimized independently without changing the runtime model.

## Polygon carrier

`polygon.html` does not deploy a contract. It uses an injected EIP-1193 wallet and sends a zero-value self-transaction whose `data` field is the UTF-8 bytes of the artifact text.

That page is intentionally separate from the workbench:

1. build/test an artifact
2. export artifact JSON
3. paste the JSON into the Polygon carrier
4. send it
5. record the transaction hash
6. retrieve the transaction later and recover the exact text
7. import the recovered artifact into the workbench/hydrator

The carrier recognizes EIP-6963 providers where available and also falls back to common injected providers such as MetaMask or Backpack.

## Cross-ledger direction

The artifact package and the carrier are separate. A future manifest can point at chunks on different ledgers without changing M64 itself. Candidate compact reference families include:

```text
L:<litecoin locator or tx reference>
P:<polygon transaction hash>
C:<polygon contract address>
D:<digibyte reference>
I:<ipfs cid>
```

That is not implemented as a finalized protocol here. The current tool is the staging layer: create, compact, hydrate, test, package, and carry artifacts without binding the artifact model to one chain.
