# M64 ledger hydration notes — 2026-09-16

This note captures the Chisel-side technical requirement implied by the current Dark Star design.

## Goal

Allow a content-addressed artifact to be reconstructed from public-ledger data even if the artifact is no longer currently available from IPFS peers or a gateway.

The intended flow is:

```text
ledger records
    ↓
M64 hydrator
    ↓
reconstruct exact artifact bytes / DAG
    ↓
verify expected CID
    ↓
republish or pin to IPFS
    ↓
consumer opens by CID / QR
```

Polygon is one candidate source ledger, but the protocol should not depend on Polygon-specific semantics if it can be avoided. Chisel should be able to treat the ledger as a durable sequence/index of reconstruction records.

## Proposed record shape

A small single-file artifact could use a canonical record such as:

```text
M64H1
CID <expected CID>
TYPE text/html
ENC utf8
BODY <M64 payload>
```

A multipart artifact could use:

```text
M64H1
CID bafy...
PARTS 17
PART 0 <payload>
PART 1 <payload>
...
```

Fields still to define precisely:

- protocol/version marker;
- artifact identifier;
- expected CID;
- MIME/content type;
- character encoding;
- byte length;
- chunk count;
- chunk ordering/index;
- optional checksum per chunk;
- ledger transaction references;
- reconstruction mode: canonical file vs. explicit IPFS DAG/CAR;
- dependency references where an artifact is composed from previously stored objects.

## Determinism

CID verification only works if hydration reproduces the exact object expected by the original publisher.

Potential sources of CID drift include:

- newline normalization;
- UTF-8 vs. another encoding;
- filename differences;
- directory metadata;
- UnixFS chunking settings;
- DAG layout;
- object ordering;
- embedded timestamps or generated metadata.

For trivial files, Chisel can define a canonical byte representation.

For complex objects, reconstructing an explicitly specified CAR file may be safer because the content-addressed graph itself is preserved rather than asking a later IPFS client to independently rebuild it.

## Hydrator behavior

The hydrator should be deterministic and auditable:

1. locate all records belonging to an artifact;
2. reject duplicate/conflicting part numbers unless an explicit revision rule exists;
3. order chunks deterministically;
4. decode M64;
5. reconstruct the exact bytes or CAR/DAG;
6. calculate the CID independently;
7. compare it with the expected CID;
8. only after verification, publish/pin the object;
9. report the ledger records used for reconstruction.

A useful interface would expose both the expected CID and the actual reconstructed CID so failure cannot be hidden by the UI.

## Dark Star use case

Dark Star QR codes can point to content-addressed narrative fragments. If the object disappears from current IPFS availability, Chisel can rehydrate it from ledger records.

This makes the QR durable at the content-address layer rather than merely durable as a conventional gateway URL.

The same mechanism can support both:

- documentary references in relatively literal sections of Dark Star;
- unstable/interactive narrative artifacts such as the Mark dinosaur/marble sequence.

The technical system preserves bytes, not meaning. Later readers may faithfully reconstruct the artifact while interpreting its symbols differently. That distinction is a feature of the Dark Star narrative and should not be hidden by the Chisel implementation.


## EVM calldata publication and optional execution (2026-10-11 design discussion)

**Status: design note, not implemented.** This extends the same ledger-hydration concept, without making Solidity or EVM execution a dependency for Chisel's ordinary publishing or reading.

### Motivation

Chisel's original EVM publication path can put a substantial data payload in a transaction's `input` field, often in a transaction to an externally owned address (EOA), so no application contract executes. The publisher mainly pays transaction intrinsic gas for the encoded bytes plus normal network fees, instead of the much larger expense of repeated contract storage writes. The exact fee depends on byte composition (zero/nonzero), execution if any, and the chain's fee model; **this is not free, and calldata pricing is chain-dependent**. The off-chain vanilla-JavaScript reader retrieves the transaction from RPC or a block explorer (e.g. Polygonscan), decodes M64, and interprets or executes the *application-level meaning* outside the EVM. The original records and Chisel's address/transaction-based index remain **on-chain**; RPC/explorers are access methods, not authoritative databases.

Important terminology: this is **off-chain interpretation**, *not* Ethereum consensus execution. A browser running code found in a ledger record is not an EVM contract and cannot atomically affect on-chain state merely by interpreting it.

### Three separate layers

1. **Publication:** Put versioned M64 bytes, possibly with artifact IDs, dictionary IDs, length, checksum/content digest, and linkage/index information, in EVM transaction input. No contract storage or Solidity is needed for the plain inscription path.
2. **Hydration:** Discover the Chisel transactions using the on-chain index, fetch and validate raw transaction input, resolve a versioned symbol table, reconstruct canonical bytes, verify digest/CID, then optionally render, republish to IPFS, or process locally. Preserve old encodings and make missing parts/unknown dictionaries explicit errors.
3. **Optional on-chain bridge:** When an EVM contract must make a monetary decision, use separately designed registry mappings, committed hashes, or cryptographically verified proofs. Never assume an EVM contract can look up an arbitrary past transaction hash or read old calldata natively. Off-chain assertions submitted as registry updates require an explicit writer/trust model unless independently verified.

### Contract-code storage is a distinct optional experiment

A separate data-contract design may place immutable payload bytes in **runtime bytecode** so other contracts can read them via `EXTCODECOPY` or a getter. This is not equivalent to calldata in an old deployment transaction: historical initialization calldata isn't automatically readable by other contracts. Dynamic `CREATE`/`CREATE2` uses **creation code**, not an `eval` opcode. `CALL` invokes already deployed code; `DELEGATECALL` runs another contract's code in the caller's state context and is especially dangerous with untrusted modules. Avoid conflating source-code rendering, M64 hydration, native EVM bytecode execution, and local JS execution.

### Research questions before implementation

- Compare complete costs per byte for plain transaction input, event data, contract bytecode data, persistent storage, and compressed M64 + any on-chain decompression; account for deployment, retrieval, chain gas schedules and L2 data fees. Do not assume M64 compression automatically saves EVM gas.
- Specify canonical M64 format and immutable/versioned dictionary or symbol-table lookup so old records remain decodable.
- Demonstrate browser-only fetch + verified hydration with a known transaction fixture before building any Solidity registry.
- If smart-contract-readable records become a requirement, compare a minimal, auditable registry of commitments and pointers against runtime-bytecode data contracts; add authorization and provenance tests.
- Never execute hydrated source or bytecode from an untrusted record automatically; explicit validation, user opt-in, bounded resources and sandboxing are required.

**Architectural principle:** Publish cheaply, discover by Chisel's on-chain index, hydrate and interpret off-chain, and invoke Solidity only when consensus-enforced execution is required.
