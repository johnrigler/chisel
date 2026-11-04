# EVM workbench: Gomez and Jethro write paths

The standalone [evm.html](../evm.html) remains Chisel's EVM import/recovery
workbench. It contains separate **Gomez · Write Contract** and **Jethro · Write Contract** panels, sharing the same wallet-discovery, review, and submission code. The Portal
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

## Writing Gomez

The **Gomez · Write Contract** panel targets `0x5a2220d56f56db9C9F5B0cb83ff35b42746503a2`
on Polygon mainnet (chain ID 137). Its bundled interface contains:

```solidity
function tell(
  string message,
  address receiver1, uint256 amount1,
  address receiver2, uint256 amount2,
  address receiver3, uint256 amount3,
  address receiver4, uint256 amount4
);
```

1. Select a wallet, connect it, and use **Switch to Polygon** if needed.
2. Enter the message and four receiver/amount pairs. All four pairs start
   with the zero address and zero amount. Use explicit 20-byte EVM addresses
   for receiver fields and unsigned decimal integers for the amounts.
3. Amounts are **raw uint256 values**, not assumed to be POL or token units.
   Their meaning depends on the actual deployed Solidity. Chisel does not
   infer or perform four independent transfers from the ABI.
4. Click **Review and simulate** to inspect the exact encoded `tell`
   calldata, chain, address, sender, arguments and gas estimate.
5. Once the simulation succeeds, click **Send via wallet** and approve it
   independently through your wallet. **Check receipt** distinguishes pending,
   successful execution, and a mined revert.

The editor rejects malformed addresses, negative/non-integer values,
overflows past uint256, overly large messages, and nonzero amounts paired
with an all-zero receiver address. This last condition is a conservative
interface guard rather than a Solidity ABI rule; adjust it only with
contract-specific evidence.

The actual deployed Gomez permissions are not yet independently verified
here. If the sender is not the required contract owner, the RPC preflight
may return an `Only the contract owner can run this` revert. Chisel reports
that error rather than bypassing authorization or submitting a known
reverting transaction.

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

## Proposed Jethro v2: permissionless address-scoped dictionary (next implementation)

**Status: design plus [draft Solidity](../Solidity/JethroV2.sol), NOT deployed or connected to the Chisel writer.** The deployed legacy Jethro at
`0x0076416C84c7151CaEfA74C3e09d6eBF2f296BA0` has a bundled
`mapArtifact(string,string)` ABI, but its verified source/upgradeability is
not established here. Editing local Solidity does **not** change that
deployed contract. A newly deployed instance, verified ABI/source, and
an explicit Chisel deployment registration are required before use.

Jethro's central behavior is dictionary lookup, distinct from Gomez's
`tell(...)` message path. The next Jethro implementation should act like
a database with a composite unique key **(EVM writer address, artifact key)**:

- **Permissionless write:** Every caller may submit `mapArtifact(artifact, body)`.
  The contract uses `msg.sender` to select the namespace, not a caller-supplied
  address or a user-declared identity. No global owner-only write gate.
- **Isolated lookup:** `getArtifact(writer, artifact)` returns the latest body
  and a revision number. Two different wallets can use the same artifact key
  without overwriting each other. A writer may update only its own current
  value. `revision == 0` distinguishes an absent entry from an empty body.
- **Canonical creator view:** `creator` records the deploying account.
  Chisel can show `getArtifact(creator, artifact)` as the creator's canonical
  entry while presenting other writers' namespaces as contributions.
  This is a **UI convention**, not a claim that contributor entries are untrusted
  or that the creator may alter them. If a factory deploys the contract,
  the factory itself becomes `creator`; a factory-aware variant would need
  an explicitly authenticated constructor value.
- **Address identity:** Use the EVM address directly as the first mapping key.
  Solidity hashes the artifact string to `bytes32` internally for the second
  mapping key. Hashing the writer address separately is unnecessary; the chain
  authenticates the caller as `msg.sender`. A contract wallet writes under
  its contract address, not the externally owned signer behind it.
- **Write history:** Each update emits
  `ArtifactMapped(writer, artifactKeyHash, revision, artifact, body)`.
  Lookup provides the current value, while ordered transaction receipts/logs
  preserve all successful writes. The event includes the body to permit
  historical reconstruction without relying on mutable storage or a
  particular address-history API.
- **Compatibility boundary:** The draft retains the existing
  `mapArtifact(string,string)` selector, but legacy and v2 deployments are
  separate implementations. Do not silently redirect the current Chisel
  workbench to v2; register a new deployment/interface and verify chain ID,
  bytecode, permissions, source, reads, and events first.

The [draft Solidity](../Solidity/JethroV2.sol) implements these semantics
without modifying the separate `M64Dictionary` contract. Event history is
append-only, **not** the current mapping value, which is deliberately
replaceable by its own writer. Storage and duplicate event data cost gas.

**Before deploying:** Compile and test with at least two wallets writing the
same artifact key, attempts to overwrite the creator's namespace, multiple
revisions by one writer, empty bodies, absence detection, event-based history,
and factory/contract-wallet authorship. The draft has not been compiled,
audited, or deployed as part of this design update.

## Scope and limitations

- Writes are explicitly allowlisted to Gomez `tell(...)` and Jethro
  `mapArtifact(string,string)` at their respective bundled Polygon chain-137
  deployments. Arbitrary ABI methods are not exposed as write operations.
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
node --test tests/evm-write.test.mjs tests/evm-write-ui.test.mjs
node --test tests/*.test.mjs
node --check chisel.evm.contracts.js
node --check chisel.evm.write.js
node --check chisel.evm.write.ui.js
node tests/check-inline-scripts.mjs evm.html
```

The tests use an injected wallet stub, not a live private key or transaction.

## Chisel Solidity publisher and M64 dictionary (not yet deployed)

The [Chisel Solidity contract](../Solidity/Chisel.sol) combines the
permissionless, address-scoped Jethro-style mapping with optional native-token
distribution and event logging. `execute(artifact,body,payments,logFormat,logData)`
runs any combination. The `distribute` path is best-effort with individual
transfer-result events; `distributeChecked` is a separate atomic option.

The [M64Dictionary Solidity contract](../Solidity/M64Dictionary.sol) is a
distinct permissionless **append-only numeric vocabulary** and log-only packet
carrier. Its term IDs cannot be rewritten. M64 compression and hydration remain
in browser JavaScript under [the M64 workbench](../tools/m64Artifact/index.html).

Both Solidity sources, their ABI and deployment bytecode are cataloged under
[Solidity/](../Solidity/index.html). The compiled Chisel artifact is
[Chisel.json](../Solidity/compiled/Chisel.json), and the separate M64 deployment
artifact is [M64Dictionary.json](../Solidity/compiled/M64Dictionary.json).
The browser factory offers both bundles for wallet-reviewed deployment to a
compatible EVM chain.

Existing Polygon Gomez and Jethro deployments and their allowlisted Chisel
write tools are **not** replaced or silently redirected. Neither new contract
is registered as an actual deployed address here.

`chisel.evm.chisel.js` provides the Chisel client ABI and preparation
helpers. Browser and EVM tests are in `tests/chisel-contract-browser.test.mjs`,
`tests/chisel-build-artifact.test.mjs`, and
`tools/m64Artifact/test/Chisel.ts`. No on-chain deployment is implied by
the committed compiler artifacts.

## Browser-native compiled-contract factory (2026-11-03)

[Open the EVM Contract Factory](../tools/evmFactory/index.html) to deploy a
**new** zero-constructor-argument contract using a compiled Solidity JSON
artifact and an injected EIP-1193 wallet. The page is vanilla JavaScript and
can be served directly from static hosting or IPFS. Hardhat, npm, ethers, and
a backend are not runtime requirements. It supports Solidity Standard JSON
output from direct `solc` / `solc-js` compilation and previously compiled
single-contract artifacts. Compilation itself happens outside this page.

The workflow is **import → inspect exact creation bytecode + SHA-256 →
select expected chain + wallet → estimate gas and review → explicitly deploy
→ inspect receipt and runtime code**. Chain ID, account, and gas are rechecked
before wallet submission. No existing Gomez or Jethro deployment is replaced,
and no new deployment is registered in Chisel automatically.

For compiler input examples, unsupported constructor/linking cases, runtime
comparison caveats, and testing, see
[factory README](../tools/evmFactory/README.md). Hardhat remains an optional
M64 development/test workspace, not a requirement for this deployment path.
The new Chisel source remains undeployed until a separately verified live
deployment is completed.
