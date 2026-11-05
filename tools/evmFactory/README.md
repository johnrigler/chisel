# Browser-native EVM Contract Factory (no Hardhat required)

Open [index.html](./index.html) from the Chisel static site or pinned IPFS
directory. This workbench is a standalone vanilla-JavaScript artifact loader,
wallet preflight and contract deployment interface. There is no package.json,
bundler, Hardhat, ethers or CDN dependency in the browser path.

## Boundaries

- **Compile separately** with native Solidity `solc --standard-json`, an
  equivalent `solc-js` compiler, or another tool that exports a compiled ABI +
  bytecode. The browser page does **not** compile source code.
- **Import** a Solidity Standard JSON compiler output or a single JSON artifact
  with `abi` and `bytecode`. Multiple contracts appear as a selection.
  Unlinked bytecode, invalid hex, missing ABI, initcode over 49,152 bytes, and
  any constructor with arguments are deliberately rejected.
- **Review** creation bytes, SHA-256, target EVM chain ID, wallet account and
  estimated gas. A SHA-256 digest proves the inspected bytes were not altered
  inside this workflow; it does *not* verify Solidity source or semantics.
- **Deploy** only after a separate explicit action, followed by the wallet's
  own approval. Chisel sends `eth_sendTransaction` with `from`, `data`,
  `value: 0x0`, and **no** `to` address. Wallet/chain/gas are checked again.
- **Check receipt** explicitly. Submitted is not mined; successful receipt
  and nonempty `eth_getCode` are separately reported. A byte-for-byte
  compiled-runtime comparison is displayed when supplied. Immutables or
  libraries may make raw runtime equality unsuitable for some contracts.
- No file upload service, private-key input, API token, persistent storage,
  FileProxy, or Etherscan account key is required. The uploaded JSON is
  processed in memory. Only the wallet's provider sends transactions.

### Build one Chisel artifact for multiple EVM chains

Run this from the repository root with Python 3 and a native `solc` supporting
`^0.8.24`:

```sh
python3 contracts/build-chisel.py
git add contracts/compiled/Chisel.json
git commit -m "Compile Chisel deployment artifact"
```

The script compiles `contracts/Chisel.sol:Chisel` using Solidity Standard JSON
and writes exactly one reusable file:

`contracts/compiled/Chisel.json`

On a successful trusted `main` build, GitHub Actions also compiles the same\nartifact with the pinned `solc` 0.8.30 dependency and commits the generated\nJSON to `main` (when changed). Pull again if CI has just updated the artifact.\n\nIt contains the ABI, creation bytecode, compiled runtime, Solidity compiler
version, explicit optimizer and EVM target, and SHA-256 digests of the source
and creation bytecode. Compilation is not performed by the browser. The
`solc --bin --abi` console headings are not included in this JSON.

To verify that the committed artifact matches the current source and local
compiler settings:

```sh
python3 contracts/build-chisel.py --check
```

`solc` defaults to the executable on `PATH`; set `SOLC=/path/to/solc` to
choose another compiler. Commit only after inspecting the compiler version and
diff. Building with a different `solc` release may change bytecode even if
the Solidity source does not change. The build currently targets `evmVersion:
paris` to avoid requiring Shanghai's PUSH0 instruction; this does not
guarantee compatibility with every EVM chain.

Then open [the Contract Factory](./index.html), click **Load Chisel from
repository**, select an EVM chain ID and an injected browser-extension wallet,
connect, click **Switch wallet to expected chain** if needed, review bytecode and gas, and explicitly click **Deploy reviewed
contract**. The browser builds a contract-creation transaction with no `to`
address, signs through the wallet, and checks the receipt when requested.

**Important:** One compiled ABI/creation bytecode can be reused for deployments
on many compatible EVM networks. Each deployment has its own transaction,
chain ID, nonce, sender, gas, contract address, and native token. The
`creator` immutable is initialized per deployment, so compiled runtime bytes
may differ from deployed runtime even when the same creation bytecode was used.
Record verified addresses separately by chain; none are bundled or guessed.
No local private key or RPC secret is stored.

You can still import any other manually compiled Standard JSON output or
single-contract artifact using the file picker, or load the existing bundled
M64 Dictionary.

### Existing M64 dictionary

Click **Load bundled M64 Dictionary** to review the previously compiled
artifact at `../m64Artifact/contracts/M64Dictionary.compiled.json`. Its
existing browser deployment page remains available. This factory doesn't
compile or regenerate M64, and selecting it does not deploy anything.

The existing `tools/m64Artifact/` Hardhat 3 project remains an **optional**
developer test/CI convenience. It is not required for compiling with `solc`,
reviewing the JSON artifact, or browser-wallet deployment. The no-Hardhat
runtime choice documented in `tools/M64_ARTIFACT_WORKBENCH.md` is unchanged.

### Limitations and verification

- Constructor arguments, linking libraries, complex deployment scripts,
  automatic verification, EVM-chain-specific fee estimates, and Solidity
  editor/compiler UX are **not implemented**. Use compiled linked bytecode with
  a zero-argument constructor.
- Only EIP-1193 injected wallets are supported. EIP-6963 discovery is used
  for multiple injected wallets, with `window.ethereum` fallback.
- The chain ID is explicit. Click **Switch wallet to expected chain** to
  request an EIP-3326 network change in the selected injected wallet. Approve
  in the wallet. The factory does **not** silently switch or add a chain.
  Unknown chains must be added manually. Switching invalidates deployment review.
- The standard library RPC supports only preflight gas estimation here.
  Deployment is a consequential transaction and can incur gas even if mined
  with failure.
- `eth_getCode` and a receipt from one RPC do not constitute independent
  audit or multi-provider verification. Confirm the contract before Chisel
  uses it for publishing data.
- Run unit tests using Node's built-in test runner *only if available*:
  `node --test tests/evm-factory.test.mjs`. Node is **not** a runtime
  dependency of Chisel or the factory page.
