# EVM workbench: Gomez and Jethro write paths

The standalone [evm.html](../evm.html) remains Chisel's EVM import/recovery
workbench, now including the Mogwai/Chisel deployment profile on Polygon 137. It contains separate **Gomez · Write Contract** and **Jethro · Write Contract** panels, sharing the same wallet-discovery, review, and submission code. The Portal
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

**Status: design plus [draft Solidity](../contracts/JethroV2.sol), NOT deployed or connected to the Chisel writer.** The deployed legacy Jethro at
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

The [draft Solidity](../contracts/JethroV2.sol) implements these semantics
without modifying the separate `M64Dictionary` contract. Event history is
append-only, **not** the current mapping value, which is deliberately
replaceable by its own writer. Storage and duplicate event data cost gas.

**Before deploying:** Compile and test with at least two wallets writing the
same artifact key, attempts to overwrite the creator's namespace, multiple
revisions by one writer, empty bodies, absence detection, event-based history,
and factory/contract-wallet authorship. The draft has not been compiled,
audited, or deployed as part of this design update.

## Chisel · Write Contract (Polygon 137, 2026-11-05)

The deployed-address profile for Mogwai / Chisel is
[`0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3`](https://polygonscan.com/address/0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3).
This is the deployer-supplied address. Independent deployed-code/source comparison
has **not** been completed here; the browser checks the presence and stable hash
of deployed bytecode at review time, but that is not an ABI audit.

[`evm.html`](../evm.html) now has **Chisel · Write Contract**, alongside Gomez
and Jethro. It reuses the same injected-wallet discovery, Polygon chain-ID
preflight, `eth_getCode` hashing, `eth_call` simulation, gas estimate, explicit
Send via wallet approval, and subsequent receipt status check. The static page
runs from regular hosting or IPFS; no application server signs transactions.
No new Solidity contract is deployed by the write panel.

**Allowlisted write methods and inputs:**

- `mapArtifact(artifact,body)`: writer-scoped dictionary entry. A nonempty
  key is required; empty body is permitted. UTF-8 input is capped at 64 KiB.
- `logRecord(format,data)`: `bytes32` format and nonempty even-length hex
  bytes. Emits an event only; does not store a dictionary entry.
- `execute(artifact,body,payments,format,data)`: optional combined write,
  log and native payments, requiring at least one operation.
- `distributeChecked(payments)`: atomic native payments. A failed recipient
  causes all payments to revert.
- `distribute(payments)`: best-effort native payments, including per-recipient
  result events and possible refunds on failure.
- `withdrawRefund()`: claims a pending refund for the connected caller.

Payment input uses one comma-separated `recipient,amountWei` pair per line.
Amounts are exact nonnegative decimal integers in **wei**, not floating-point
POL amounts. This interface deliberately requires nonzero recipients and
positive amounts, max 32 payments, and calculates the transaction's native
value as exactly the sum of payments. The contract itself accepts more
best-effort edge cases than the writer UI exposes. `distribute` and `execute`
can succeed while individual payments fail; check `TransferResult` logs and
refunds, not only the outer transaction status.

Every input change or method switch invalidates reviewed calldata.
An account or chain change requires reconnection and review. Simulation
and gas estimation do **not** send. Only clicking Send initiates a wallet
transaction request; the wallet then separately asks the user to approve.
The Etherscan API key is never used for signing.

## Scope and limitations

- Writes are explicitly allowlisted to Gomez `tell(...)`, Jethro
  `mapArtifact(string,string)`, and the six Chisel write methods above at their
  registered Polygon chain-137 deployments. Arbitrary ABI methods are not exposed.
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
node --test tests/evm-write.test.mjs tests/evm-write-ui.test.mjs tests/evm-chisel-write.test.mjs
node --test tests/*.test.mjs
node --check chisel.evm.contracts.js
node --check chisel.evm.write.js
node --check chisel.evm.write.ui.js
node tests/check-inline-scripts.mjs evm.html
```

The tests use an injected wallet stub, not a live private key or transaction.

## Mogwai v1 EVM kernel and factory (historical 2026-11-03 draft)

**Status, 2026-11-03:** [Mogwai.sol](../contracts/Mogwai.sol) is a new
standalone Solidity implementation. It does not replace Gomez, Jethro,
JethroV2 or M64Dictionary. The existing Polygon writer remains allowlisted
to its current deployments. No Mogwai deployment address, deployment bytecode,
ABI verification, wallet authorization or live transaction is implied.

Mogwai combines six features without one giant arbitrary-call executor:

1. **Jethro-style dictionary.** `mapArtifact(string,string)` writes a current
   value under `(msg.sender, keccak256(bytes(artifact)))`. Permissionless
   callers cannot overwrite each other's namespaces. `getArtifact(writer,key)`
   returns body and revision (0 means absent). Every successful revision
   produces `ArtifactMapped` with the complete body.
2. **Structured log carrier.** `logRecord(bytes32 format,bytes data)` emits
   `RecordLogged`. Each writer has a monotonically increasing sequence shared
   by log and Thunderword publications. Only dictionary *latest values* are
   stored; event payloads persist in transaction receipts/logs.
3. **Variable-length atomic batch.** `execute((uint8 kind,bytes data)[])`
   accepts 1 to 32 operations. Kinds: 1 = `(string artifact,string body)`;
   2 = `(bytes32 format,bytes data)`; 3 =
   `(address thunderword,bytes32 format,bytes data)`; 4 =
   `(address peer,bytes32 format,bytes data)`. All use Solidity ABI tuple
   encoding. Any failure reverts the entire transaction. Each body or payload
   is capped at 24,576 bytes. There is **no arbitrary delegatecall, native-token
   transfer, proxy upgrade or owner-only write gate**.
4. **Peer messaging.** `sendToPeer` calls `receiveFromPeer` on another
   compatible contract. The receiver proves the *immediate sending contract*
   using `msg.sender`. `claimedWriter` is explicitly untrusted, because a
   peer contract can claim any origin; it is never used to authorize a
   dictionary mutation. Chisel must not label claimed origins as verified
   signers without checking the sending contract's own event/call context.
5. **CREATE2 contract factory.** `deployChild(bytes32 userSalt)` deploys
   an EIP-1167 minimal-proxy Mogwai, initializes its creator to the external
   caller in the same transaction and emits `ChildDeployed`. `creator` is a
   display/canonical namespace convention, not a write gate. Child instances
   can create more instances using the immutable full-code root. User salts
   are wallet-namespaced; `predictChildAddress(author,salt)` predicts the
   address for the *instance being called*, not a global registry.
6. **EVM Thunderwords.** `thunderwordAddress(string)` interprets 1 to 20
   printable ASCII bytes, case-sensitively, and right-pads with zero bytes to
   fill a 20-byte EVM address. Example `westend` =
   `0x77657374656e64000000000000000000000000`. This is a **v1 proposed
   encoding convention**, not an established cross-chain standard.
   No Base58Check, address hashing, or private-key derivation occurs.
   `decodeThunderword` reverses only valid ASCII/right-zero-padded words.
   `publishThunderword` and `publishThunderwordText` emit indexed
   `ThunderwordPublished(writer,thunderword,format,sequence,data)`.
   The `thunderwordCount` mapping exposes a numeric count per subject.

### Retrieval and safety boundaries

- Find Thunderword records with `eth_getLogs` for the known Mogwai contract
  address and `ThunderwordPublished` indexed topics (writer, subject, format).
  Chisel or another indexer must page event ranges, track log index and block
  hash, and handle chain reorganizations. Neither contract storage nor ordinary
  **recipient address history** can enumerate these logs. No dust/zero-value
  transfer is made to a Thunderword address, so a block explorer's address
  transaction list is not a discovery guarantee.
- Addresses produced from readable bytes are **not provably unspendable**.
  They could collide with a spendable address. Do not send assets to them.
- A Mogwai clone delegates execution to its root. A malicious or mutable
  implementation outside this audited template would change its trust model;
  use explicit code/implementation checks at registration time.
- Peer calls are synchronous, can revert, and could re-enter public
  permissionless operations. No external authorization or accounting depends
  on a peer's untrusted writer claim. Batch atomicity applies across peer calls.
- ABI encoding, contract deployment and smart-contract calls happen inside
  a user-initiated transaction. A contract does **not** originate independently
  signed EOA transactions. Solidity cannot query historical events internally.
- This code is **not audited**. It requires local compilation, tests, a
  security review and chain-specific deployment verification before Chisel
  enables it in the wallet workbench.

### Chisel / testing

`chisel.evm.mogwai.js` provides a static browser adapter
`CHISEL_EVM_MOGWAI`: human-readable v1 ABI, `KINDS`, client-side
`thunderwordAddress/decodeThunderword`, and `operation()/batch()` helpers
using the existing ethers v6 `AbiCoder`. It deliberately has **no address,
signer, deployment or transaction-send side effects**. Browser code may load it
from IPFS alongside the current EVM workbench; registering an actual deployment
must remain an explicit separate action after verification.

`tests/mogwai-browser.test.mjs` checks browser encoding and input bounds.
`tools/m64Artifact/test/Mogwai.ts` compiles the root Solidity with pinned
`solc 0.8.30` and exercises multi-wallet dictionary isolation, log batches,
rollback, peer provenance and deterministic factory clones in Hardhat's local
EVM. The existing Hardhat CI job discovers this test, without deploying to a
public chain.

Local verification from the repository root:

```sh
node --test tests/mogwai-browser.test.mjs
node --check chisel.evm.mogwai.js
cd tools/m64Artifact && npm install && npm test
```


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
The subsequent `Chisel` contract (`contracts/Chisel.sol`, formerly named
Mogwai during development) has a Polygon mainnet deployment transaction
recorded in [`contracts/deployed.txt`](../contracts/deployed.txt):
[`0x5b398b...83a02d`](https://polygonscan.com/tx/0x5b398b46531cdc47eaed8cc3f28d2079f42d154effdd6c72712c51ea5e83a02d).
The deployer provided the contract address
[`0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3`](https://polygonscan.com/address/0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3)
for Polygon mainnet (chain ID 137). Both the address and the transaction are
now recorded in [`contracts/deployed.txt`](../contracts/deployed.txt) and
the shared `chisel.evm.contracts.js` registry (`chisel.polygon.137`).
This address is user-provided; independent receipt/bytecode verification has
not been completed by the assistant.

[`evm.html`](../evm.html) includes a **Mogwai / Chisel** Polygon-137
profile, alongside Gomez, Jethro, and the all-ones Polygon Thunderword.
The address is usable immediately for Etherscan V2 transaction imports and
FileProxy split-archive operations, without requiring a receipt lookup.
The **Verify on-chain deployment** action separately checks the recorded
deployment transaction receipt using a Polygon-137 RPC or Etherscan proxy and
rejects an address mismatch. Failure to reach an RPC does not remove the
registered address. This is a **read/inspect integration**, not a new
wallet-write panel or independent Solidity source verification. Gomez and
Jethro write interfaces remain unchanged.
