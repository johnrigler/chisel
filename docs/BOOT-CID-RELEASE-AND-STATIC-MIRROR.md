# Chisel boot CID release and distribution model

Status: design contract, 2026-11-18. No canonical boot CID has been
published or attested under this specification. Do not print or endorse
an experimental CID as a trusted boot release.

## Roles are intentionally independent

- **Pinata** is the intended PRIMARY IPFS pin and public distribution
  provider. The publish operation must verify the CID returned by Pinata.
  A Pinata account or API is NOT needed to read a previously published
  rigler.org static export.
- **rigler.org static CID mirror** stores ordinary files and directory
  trees, addressable by their ORIGINAL IPFS root CID through normal
  HTTP/HTTPS. Apache/nginx serves these files even when FileProxy and
  the local IPFS daemon are stopped. A mirror must be independently
  reachable and must not rewrite files merely to make them display.
- **Kubo on rigler.org and/or the developer's laptop** can create,
  inspect, import, pin, and recover the same IPLD DAG, and may help with
  boot and disaster recovery. Running an IPFS node is OPTIONAL and
  operationally separate from serving the static CID mirror.
- **FileProxy** can export/import/reconcile the index and bytes, but
  is not required on the static read path.
- **Polygon 137 and existing Chisel records** can publish versioned,
  publisher-authenticated boot root attestations; the chain is not
  required merely to serve already verified static assets.

The static mirror is NOT a live IPFS gateway. Use its own public
namespace (for example `/boot/<root-cid>/index.html`) to avoid falsely
claiming a Kubo gateway is responding. Never put Kubo's administrative
RPC port on the public internet.

## Two exports, one immutable root

For each boot release, keep BOTH:

1. A complete IPLD CAR archive with the exact root CID and all blocks,
   suitable for importing into any compatible node without rebuilding
   the DAG from ordinary files.
2. A readable export of the UnixFS directory or file tree, stored under
   a directory named for that exact root CID and served as static HTTP.
   Ordinary HTTP can serve `/boot/<cid>/index.html` and all the
   release's relative files even if the daemon is offline.

The extracted HTTP tree is a **convenience representation**, not
necessarily an independently reproducible IPFS DAG. Directory CIDs
include link structure, codecs, chunking and metadata choices. Filenames
or the SHA-256 of a single file do not establish the original root CID.
Verify the CAR block graph, the decoded file bytes, and the expected
root separately. Keep paths immutable: no server-side substitution of
new bytes under an old CID.

Store release metadata (block count when known, root CID, CAR digest,
file paths, MIME types, file SHA-256 checks, export verification status)
alongside the archive. These metadata files must not introduce a
circular reference in the IPFS DAG.

## Canonical boot release lifecycle

1. Select the exact boot source tree, entrypoint and independently
   supplied publisher identity. Review it for private keys, credentials,
   transient paths and server-specific URLs.
2. Freeze an explicit UnixFS import profile (CID version, raw leaves,
   chunker, DAG layout, mode/mtime preservation and directory
   structure). Implicit defaults are not sufficient for a physically
   published, long-lived boot CID.
3. Create the root DAG once. Export a complete CAR and record its
   SHA-256, exact root CID and canonical import settings. Re-import
   it into a separate node and verify all required blocks/files.
4. Upload THAT CAR to Pinata via its supported public-network CAR upload
   path, `car=true`. Abort release if the returned CID disagrees with
   the expected root. Do not simply re-upload the extracted folder
   and assume it will generate the same CID.
5. Pin/import the SAME CAR on Kubo at rigler.org and/or laptop when
   available. Verify the root CID, independently of Pinata.
6. Export the same decoded file tree to an immutable directory in the
   rigler.org static web root, next to the archived CAR. Test the HTTP
   URLs after explicitly stopping Kubo and FileProxy.
7. Publish a signed, versioned release attestation that names the
   EXACT root CID, boot version, selected entrypoint and (when used)
   manifest digest. For a Polygon record, verify chain ID 137,
   confirmed transaction, destination contract, actual transaction
   sender and the configured authorized publisher. A semantic address
   in a Jethro index alone is NOT publisher authentication.
8. Test recovery from Pinata-only, static-rigler-only, local-CAR-only
   and independent-Kubo-node paths. Only after all required checks
   pass should a boot CID be designated stable for printing.

Every update produces a NEW immutable CID. Retain old releases so
printed QRs remain meaningful. Any mutable `latest` pointer is a
separate verified discovery mechanism, never an overwrite of an
existing CID. A CID proves content identity under its codec/hash; it
does NOT by itself prove who authored, approved or published it.

## Boot provenance without circular metadata

The boot directory may contain a human-readable manifest and
recoverable source files. Its root CID is computed over this frozen
tree. Put the attestation naming that root CID OUTSIDE the tree,
for example in an independently verifiable Polygon/Jethro transaction
or detached signed release descriptor. Do not put the root CID inside
a file that is hashed into its own root.

A physical boot label may show:
- root CID and release version;
- independently checkable publisher identity/signature reference;
- at least one static URL, one IPFS gateway URL, and an optional
  on-ledger attestation transaction reference.

The URL is a retrieval hint, not a trust root. Verification must be
possible with the CID, the CAR/DAG, and the authorized publisher
attestation. Pinata pin status and rigler.org availability are
distribution checks, not authorship checks.

## Concrete acceptance criteria before physical boot publishing

- Pinata stores the same root CID created locally, and can serve it.
- rigler.org serves the full boot site statically with IPFS daemon AND
  FileProxy off.
- Complete CAR can hydrate a second, independent Kubo node to that
  same root CID and expose the same required file paths.
- A verifier can reject an unapproved publisher, wrong Polygon chain,
  wrong CID, modified release file, truncated CAR, and missing block.
- The release remains usable after the original laptop is disconnected.
- No implicit environment-variable setup or credentials appear in
  boot command examples; pass explicit CLI arguments or a private
  configuration file path when needed.

## First implementation: CID static publisher in Mogwai

The operator-side `fileproxy.cid_mirror` module and offline tests are
now on Mogwai `main` under `fileProxy/fileproxy/cid_mirror.py` and
`fileProxy/tests/test_cid_mirror.py`. Its instructions live at
`fileProxy/docs/CID-STATIC-MIRROR.md`.

It uses local Kubo once to export a CID's CAR and decoded files into an
immutable HTTP root. The offline verifier checks CARv1 root CID, the
SHA-256 multihashes of present blocks, and each exported file digest.
There is **no** live rigler.org publication proof, Pinata CAR upload,
complete UnixFS DAG/decoded-byte validation or authorized-publisher
attestation yet. Treat those as separate release gates before printing
physical boot CIDs.

## Existing code and future work

Mogwai already has `fileproxy.static_publish` for immutable SHA-256
static files; this is a related but DIFFERENT format. It is not a
CID/UnixFS validator, a directory snapshotter, or a CAR exporter.
Implement a separate CID-mirror publisher and verifier rather than
renaming SHA-256 files to CIDs and implying they are interchangeable.

This is the intended foundation for eventual physically published
boot CIDs, but the implementation and deployment have not yet been
validated.
