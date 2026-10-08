# CertLedger as a Chisel public view

Date: 2026-10-07

## Boundary

The private `certLedger` repository is a working repository. It may contain case material, scans, drafts, personal information, research notes, and packet construction artifacts.

The public CertLedger experience should therefore not depend on that repository being public.

Chisel should provide the public reader.

## QR URL model

A physical CertLedger label should point to a Chisel-compatible URL carrying enough information to identify the public namespace and focus a record:

```text
certledger.html
  ?address=<CERTLEDGER_THUNDERWORD_OR_ADDRESS>
  &record=<RECORD_ID>
  &tx=<OPTIONAL_TXID>
  &sha256=<OPTIONAL_DOCUMENT_DIGEST>
  &ipfs=<OPTIONAL_CURRENT_IPFS_CID_OR_PATH>
```

The important distinction is:

```text
CertLedger = legal/evidence workflow and namespace
Chisel     = public reader / writer / resolver
```

A mirror can host the same static Chisel view at GitHub Pages, IPFS, rigler.org, Nerd Coffee, or elsewhere.

## Reader behavior

The CertLedger Chisel view should:

1. load the complete public Litecoin stream for the CertLedger Thunderword/address;
2. highlight the requested record supplied by the QR URL;
3. show the canonical PDF digest and transaction reference;
4. explain the narrow legal significance of the cryptographic record;
5. expose the underlying transaction and artifact where public;
6. discover alternate mirrors;
7. prefer a newer verified IPFS publication when the ledger announces one;
8. continue to work if any individual web host disappears.

The web location is therefore a convenience layer, not the identity of the record.

## Mirror-location records

A future CertLedger convention should allow the public ledger stream itself to announce publication locations.

Conceptually:

```text
type: location
namespace: CertLedger
transport: ipfs
value: <CID>
supersedes: <older location record>
```

Other transports can use the same concept:

```text
transport: https
value: https://example.org/path/
```

A Chisel reader can inspect the newest location records, test likely mirrors, and offer the user a working alternate copy.

This creates a useful recursion:

```text
QR points to one Chisel reader
        ↓
reader reads CertLedger ledger
        ↓
ledger describes other current readers/artifact locations
        ↓
user can move to IPFS or another mirror
```

No DNS name is permanently privileged.

## Public/private split

Public:
- CertLedger Thunderword/address
- document hashes intended for publication
- transaction IDs
- selected canonical PDFs
- public chronology
- mirror/IPFS location records
- verification instructions

Private:
- drafts
- identity information
- private scans
- strategy notes
- unpublished evidence
- packet construction

## Legal-facing presentation

The mailed document should not explain this architecture in detail.

The physical packet only needs to say that the square CertLedger label provides a public verification reference for the exact document and that scanning the QR code opens the record.

The Chisel CertLedger view does the teaching after the scan.

The desired first impression is not “blockchain tutorial.” It is:

```text
I am holding a paper document.
My phone is showing me the public record for this exact document.
The fingerprint, transaction, chronology, and alternate copies are independently inspectable.
```

That is the bridge between certified-mail procedure and public-ledger provenance.
