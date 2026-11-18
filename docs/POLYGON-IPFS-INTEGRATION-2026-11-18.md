# Polygon workbench integration and practical IPFS recovery

Status: incremental plan, 2026-11-18. M64 Python dictionary and FileProxy
contract publication are on hold. This document is a design sequence, not a
claim that an IPFS node is running or that the workflow is deployed.

## Current implementation

Chisel's Send network selector includes Polygon 137 and redirects the Send
view to the embedded `evm.html` workbench. That workbench remains a distinct
iframe with its own state and forms. Its Gomez, Jethro and Chisel writers
require a separate wallet review and approval, including MetaMask and
Backpack detection. The EVM reader uses Polygon RPC and/or Etherscan V2.

As of Chisel 2.8.56, `evm.html` loads the repository's vendored ethers UMD
rather than a CDN. This removes a dependency on external JavaScript hosting;
it does not make Polygon RPC data available offline. Do not describe the
iframe as a fully merged single-page implementation.

## EVM cleanup order

1. Extract the common Polygon read/transaction decode routines from the
   standalone workbench into side-effect-free vanilla JS modules. Retain
   historical Gomez and Jethro calldata decoders and known-transaction tests.
2. Reuse Chisel's one network selector, account/address display, activity
   status, record preview, and explicit review/approve transaction flow.
3. Remove duplicated UI and iframe only after feature parity is tested;
   do not risk changing transaction encoding or wallet routing during layout
   consolidation. Keep every EVM send on chain 137 with visible destination,
   selected wallet, gas estimate, tx input and mined receipt verification.
4. Give Polygon records the same Portal navigation and shareable transaction
   URLs used by UTXO records. Keep raw calldata and normalized presentation
   separate so an independent reader can verify source bytes.

## IPFS roles

- **Ledger** is the durable source of transaction identity, publication,
  expected digests and reconstruction instructions when supplied.
- **IPFS/Kubo** stores and distributes content-addressed objects and DAGs.
  It is *not* the sole record of publication, a guaranteed persistence
  service, or a substitute for verification.
- **FileProxy** optionally imports, verifies, caches, pins and republishes
  artifacts locally. Public read paths should continue to work when it stops.
- **Static mirrors** can serve previously verified bytes without running
  FileProxy, a gateway daemon or a wallet.

## Realistic incremental IPFS sequence

1. **Read-only first.** Accept a CID, let users select an explicitly shown
   gateway endpoint (local Kubo gateway, configured static mirror or public
   gateway), attempt reads with bounded size/time, report which source returned
   the bytes and show failures. The browser must not assume that Kubo is
   installed on rigler.org or any client device.
2. **Verify independently.** Where the ledger provides a trusted expected
   SHA-256, compare the exact hydrated file bytes to it. A UnixFS CID is not
   necessarily the SHA-256 of the returned file bytes. For full CID proof,
   validate the IPLD block/DAG layout or import/export a reproducible CAR.
   Never mark gateway availability itself as cryptographic verification.
3. **Local publishing.** Configure a Kubo API address explicitly in the
   operator-facing FileProxy or CLI, using an explicit config path or flag,
   not ambient environment variables. A browser must not expose a public
   unauthenticated `/api/v0/add` or pin endpoint. Record exact returned CIDs.
4. **Hydration and repinning.** If a CID is unavailable, reconstruct bytes
   from verified chain publications when that source exists, verify the
   expected digest/CID with the correct UnixFS/DAG parameters, then re-add
   and pin via an operator-authorized local node. Report if a matching CID
   cannot be reproduced instead of silently publishing a different one.
5. **Replication.** Pin on at least one independent node, export CAR backups,
   and test restoration on a different machine. The presence of a CID in a
   transaction alone is not evidence that any peer still holds the content.

Do not force IPFS, FileProxy or remote credentials into the basic Portal
read path. No on-chain JSON wrapping, silent Base64 conversion, automatic
wallet transactions or implicit storage migration.

## Acceptance tests

- Open the Chisel static app with third-party CDNs blocked; the Polygon
  workbench loads, although ledger history requires RPC or existing cache.
- Verify an imported known Polygon transaction against its original calldata.
- Read a known file CID through local and independent gateways, checking an
  independent file digest when available.
- Stop FileProxy and local Kubo; the Portal still shows static/cached public
  records and reports unavailable remote objects rather than hanging.
- Restore the pinned artifact from a CAR on an independent machine and verify
  its CID and reconstructed bytes.
