# M64 Artifact Workbench

The generic M64/Crusher/Hydrator work is in:

```text
tools/m64Artifact/
```

Open `tools/m64Artifact/index.html` for the staging workbench.

It supports:

- controlled JavaScript canonicalization and identifier crushing
- 64-entry token profiles
- M64 transport encoding and exact hydration
- self-contained `chisel-m64-artifact` JSON packages
- `CHISEL-PURE1` execution using `entry(input)`
- isolated browser testing in a sandboxed iframe
- a non-image text example
- the Dark Star deterministic raster example and known SHA-256 test vector
- a standalone hydrator
- a Polygon EIP-1193 calldata carrier for MetaMask, Backpack, and other injected wallets

The Polygon carrier waits for a receipt and reports the mined block and transaction position. It stores exact UTF-8 artifact text in transaction calldata and does not require a smart contract.

See `tools/m64Artifact/README.md` for the current artifact model and cross-ledger direction.
