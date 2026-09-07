# Recursive Chisel Rebuild

Status: architectural direction, not a finished recovery protocol.

M64 should not only be a tool inside Chisel. Chisel itself should eventually be representable as recoverable M64/ledger artifacts.

This creates a recursive bootstrap property:

```text
minimal surviving resolver
        |
        v
ledger discovery / beacon / identity
        |
        v
M64 dictionaries + artifact graph
        |
        v
reconstruct minimal Chisel tools
        |
        v
reconstruct full Chisel tree
        |
        v
verify canonical files / IPFS CID
        |
        v
republish Chisel to IPFS or another host
```

The important inversion is:

```text
Today:
Chisel -> creates M64 artifacts

Desired recovery model:
M64 artifacts -> recreate Chisel
```

Chisel therefore migrates from being only the authoring environment into being one of the recoverable objects inside the environment it creates.

## Bootstrap layers

The recovery path should not require the full Chisel application at the beginning. It should be layered so that each stage is capable of reconstructing the next.

A possible sequence is:

```text
Layer 0: human-readable ledger beacon
Layer 1: tiny resolver / format description
Layer 2: M64 codec + dictionary resolver
Layer 3: basic ledger readers
Layer 4: core Chisel transaction/data tools
Layer 5: complete Chisel tool tree
Layer 6: canonical deterministic IPFS/CAR representation
```

The earliest layer should remain deliberately primitive. A person should be able to locate and inspect it with ordinary ledger tooling or a block explorer even when Chisel, GitHub, domains, gateways, and current IPFS pins are unavailable.

## What must survive outside Chisel

A genuine self-rebuild cannot depend circularly on the full program it is trying to recover.

At minimum, the recovery specification must define enough information to implement or reproduce:

- ledger locator conventions
- bootstrap/beacon discovery conventions
- M64 transport decoding
- dictionary lookup rules
- artifact/reference traversal rules
- canonical file reconstruction rules
- integrity checks
- deterministic IPFS/CAR construction rules, if IPFS recovery is required

The smallest resolver may itself be plain source copied from a ledger record, independently reimplemented from the specification, or eventually represented in an even smaller fixed bootstrap encoding.

## Chisel as an artifact graph

The full Chisel repository does not need to be one giant artifact.

It can be reconstructed as a graph of reusable pieces:

```text
Chisel root manifest
   |
   +-- M64 codec
   +-- dictionary resolver
   +-- Polygon reader
   +-- Litecoin reader
   +-- DigiByte reader
   +-- transaction tools
   +-- UI pages
   +-- shared libraries
   +-- styles/assets
```

Common vocabulary and common code can be shared through dictionaries and referenced artifacts rather than repeated in every file.

The graph may span Polygon transactions, Polygon contracts, Litecoin/DigiByte artifacts, and IPFS checkpoints. The client performs the traversal; no EVM hydration is required.

## Verification target

A successful recovery should not merely produce code that looks similar to Chisel. It should reconstruct a canonical target that can be checked cryptographically.

For example:

```text
ledger graph
   -> reconstruct canonical Chisel directory
   -> build deterministic CAR/IPFS DAG
   -> calculate root CID
   -> compare with historical expected CID
```

If the calculated CID matches, the recovered Chisel tree is the historically checkpointed tree.

A conventional cryptographic hash of the canonical repository tree may also be recorded as an independent checkpoint.

## Near-zero infrastructure recovery

The strongest design goal is a cold-start scenario in which all ordinary infrastructure has disappeared:

```text
GitHub repository: gone
rigler.org: gone
IPFS pins: zero
local development copies: gone
commercial explorers: potentially gone
```

But the recovering party retains some combination of:

```text
key/seed or known public identity
ledger access
bootstrap convention/specification
```

From those roots it should be possible to discover the historical object graph, reconstruct enough tooling to resolve M64, recover Chisel, verify it, and republish it.

The system is therefore not merely self-hosting. The intended property is closer to self-reconstruction from durable public traces.

## Practical milestone

Do not attempt to encode the entire current Chisel repository first.

A useful staged experiment is:

1. identify the smallest useful Chisel subset capable of reading one Polygon artifact and hydrating M64;
2. represent that subset using the ledger/dictionary model;
3. reconstruct it without loading the original source files;
4. use the reconstructed subset to retrieve a second, larger Chisel artifact;
5. repeat until the full intended tool tree can be regenerated;
6. compare the resulting canonical tree/CID against an expected checkpoint.

If this succeeds, M64 stops being merely a compression format used by Chisel. It becomes part of a recovery substrate from which Chisel itself can be regenerated.
