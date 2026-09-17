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
