# EVM workbench: Jethro write path

The standalone [evm.html](../evm.html) remains Chisel's EVM import/recovery
workbench. It now contains a **Jethro · Write Contract** panel. The Portal
remains a read-only presentation and verification surface; writing does not
depend on FileProxy, Etherscan, or the Portal's caches.

## Model

The registry in `chisel.evm.contracts.js` distinguishes:

- **Interface:** An ABI, which multiple implementations may expose.
- **Implementation:** Solidity source and/or creation/runtime bytecode, if
  independently recovered, with its ABI reference and provenance.
- **Deployment:** A specific chain ID and contract address using that
  implementation. An implementation may have multiple deployments.
- **Transaction:** A call to a deployment with exact ABI-encoded calldata.
  Future indexed artifacts can identify a specific transaction, log and
  ordinal within it.

The bundled Gomez and Jethro ABIs were present in the original EVM decoder.
They are not presented as independently verified on-chain source. In
particular, the implementation objects intentionally have `source: null`
and `runtimeBytecodeHash: null`. A successful `eth_getCode` lookup proves
there is bytecode at that address through the selected RPC; it does not prove
that the bundled interface matches the deployed implementation. Do not assume
a verified explorer ABI or Solidity source unless independently retrieved.

The existing EVM reader now derives Gomez/Jethro addresses and ABI fragments
from this registry rather than carrying a second, incompatible set.

## Writing Jethro

1. Open `evm.html` in a wallet-enabled browser.
2. In **Jethro · Write Contract**, select an injected EVM wallet
   (EIP-6963 discovery with `window.ethereum` fallback).
3. Connect; if necessary, explicitly switch the wallet to Polygon mainnet
   (chain ID 137), then reconnect.
4. Enter exact `artifact` and `body` strings for
   `mapArtifact(string,string)`.
5. Click **Review and simulate**. Chisel checks the wallet account/network,
   checks that the target contract has bytecode using `eth_getCode`,
   constructs calldata using the bundled ABI, simulates via `eth_call`,
   estimates gas, and displays sender, target, function signature,
   implementation/interface IDs, full arguments, encoded data, code hash and
   gas units. **No write occurs here.**
6. Review the address and calldata; click **Send via wallet**. Chisel
   rechecks the chain, account, code hash and simulation and then requests
   `eth_sendTransaction` using the exact reviewed bytes. The wallet performs
   its own confirmation. A refused signature or RPC error does not broadcast
   via Chisel.
7. A returned hash is **submitted, not confirmed**. Click **Check receipt**
   to distinguish pending, mined-and-successful, and reverted transactions.
   A revert may still incur gas. The explorer link is provided for
   independent inspection.

The transaction has zero native-token value (`0x0`) apart from gas.
Gas estimate is for review only; actual fees depend on wallet and network
conditions. No private key or mnemonic is accepted by this page. Payload and
API keys are not sent to FileProxy by this writer.

Edits to either payload field, a provider selection, wallet account, or chain
invalidate the reviewed calldata. A changed code hash also blocks sending.
Submissions cannot replay the same review through Chisel.

## Scope and limitations

- This first writer is restricted to the bundled Jethro contract at
  `0x0076416C84c7151CaEfA74C3e09d6eBF2f296BA0` on chain 137 and the
  `mapArtifact(string,string)` function.
- Etherscan authentication in the legacy read/import panel is separate from
  wallet authorization and is not used to sign.
- Real transaction fees are paid through the wallet. Chisel never attempts
  a live transaction in automated tests.
- The page still loads ethers 6.16.0 from a CDN, an existing offline/IPFS
  limitation for a future dependency-vendoring pass.
- Code-hash checks do not establish a proxy contract's implementation,
  which can change without changing the proxy bytecode. Proxy awareness,
  verified ABI/source fetching, reusable EVM method forms and Etherscan
  import pagination belong in later iterations.
- Existing EVM ingestion, local split-file writing and legacy Gomez
  image recovery are intentionally unchanged.

## Verification

```sh
node --test tests/evm-write.test.mjs
node --test tests/*.test.mjs
node --check chisel.evm.contracts.js
node --check chisel.evm.write.js
node --check chisel.evm.write.ui.js
node tests/check-inline-scripts.mjs evm.html
```

The tests use an injected wallet stub, not a live private key or transaction.
