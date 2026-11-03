# Browser-native EVM Contract Factory (no Hardhat required)

Open [index.html](./index.html) from the Chisel static site or pinned IPFS
directory. This workbench is a standalone vanilla-JavaScript artifact loader,
wallet preflight and contract deployment interface. There is no package.json,
bundler, Hardhat, ethers or CDN dependency in the browser path.

## Boundaries

- **Compile separately** with native Solidity \`solc --standard-json\`, an
  equivalent \`solc-js\` compiler, or another tool that exports a compiled ABI +
  bytecode. The browser page does **not** compile source code.
- **Import** a Solidity Standard JSON compiler output or a single JSON artifact
  with \`abi\` and \`bytecode\`. Multiple contracts appear as a selection.
  Unlinked bytecode, invalid hex, missing ABI, initcode over 49,152 bytes, and
  any constructor with arguments are deliberately rejected.
- **Review** creation bytes, SHA-256, target EVM chain ID, wallet account and
  estimated gas. A SHA-256 digest proves the inspected bytes were not altered
  inside this workflow; it does *not* verify Solidity source or semantics.
- **Deploy** only after a separate explicit action, followed by the wallet's
  own approval. Chisel sends \`eth_sendTransaction\` with \`from\`, \`data\`,
  \`value: 0x0\`, and **no** \`to\` address. Wallet/chain/gas are checked again.
- **Check receipt** explicitly. Submitted is not mined; successful receipt
  and nonempty \`eth_getCode\` are separately reported. A byte-for-byte
  compiled-runtime comparison is displayed when supplied. Immutables or
  libraries may make raw runtime equality unsuitable for some contracts.
- No file upload service, private-key input, API token, persistent storage,
  FileProxy, or Etherscan account key is required. The uploaded JSON is
  processed in memory. Only the wallet's provider sends transactions.

### Compile \`contracts/Mogwai.sol\` without npm

From the Chisel repo root, install a **native** \`solc\` compiler separately
that supports this source's Solidity pragma (\`^0.8.24\`). Then:

\`\`\`sh
python3 - <<'PY' > /tmp/chisel-mogwai-input.json
import json, pathlib, sys
source = pathlib.Path("contracts/Mogwai.sol").read_text()
json.dump({
  "language": "Solidity",
  "sources": {"contracts/Mogwai.sol": {"content": source}},
  "settings": {
    "metadata": {"appendCBOR": False},
    "outputSelection": {"*": {"*": [
      "abi", "evm.bytecode.object", "evm.deployedBytecode.object"
    ]}}
  }
}, sys.stdout)
PY

solc --standard-json < /tmp/chisel-mogwai-input.json > /tmp/chisel-mogwai-output.json
\`\`\`

Import \`/tmp/chisel-mogwai-output.json\` into the factory page. Confirm the
compiler version, selected contract, selected chain, initialization-code hash,
gas estimate and wallet before approving deployment. The page deliberately
does not pre-register an address. Verify the deployed source/ABI/runtime and
receipt before adding an explicit deployment to
\`chisel.evm.contracts.js\`.

If you use standalone \`solc-js\` instead, the Standard JSON input/output
contract is the same, but the \`solcjs\` CLI is *not* a drop-in substitute for
every native \`solc\` flag. Keep compiler version and settings pinned for
reproducibility.

### Existing M64 dictionary

Click **Load bundled M64 Dictionary** to review the previously compiled
artifact at \`../m64Artifact/contracts/M64Dictionary.compiled.json\`. Its
existing browser deployment page remains available. This factory doesn't
compile or regenerate M64, and selecting it does not deploy anything.

The existing \`tools/m64Artifact/\` Hardhat 3 project remains an **optional**
developer test/CI convenience. It is not required for compiling with \`solc\`,
reviewing the JSON artifact, or browser-wallet deployment. The no-Hardhat
runtime choice documented in \`tools/M64_ARTIFACT_WORKBENCH.md\` is unchanged.

### Limitations and verification

- Constructor arguments, linking libraries, complex deployment scripts,
  automatic verification, EVM-chain-specific fee estimates, and Solidity
  editor/compiler UX are **not implemented**. Use compiled linked bytecode with
  a zero-argument constructor.
- Only EIP-1193 injected wallets are supported. EIP-6963 discovery is used
  for multiple injected wallets, with \`window.ethereum\` fallback.
- The chain ID is explicit. The wallet's selected chain must match; the
  factory does **not** silently switch or add a chain.
- The standard library RPC supports only preflight gas estimation here.
  Deployment is a consequential transaction and can incur gas even if mined
  with failure.
- \`eth_getCode\` and a receipt from one RPC do not constitute independent
  audit or multi-provider verification. Confirm the contract before Chisel
  uses it for publishing data.
- Run unit tests using Node's built-in test runner *only if available*:
  \`node --test tests/evm-factory.test.mjs\`. Node is **not** a runtime
  dependency of Chisel or the factory page.
