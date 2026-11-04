# Chisel: minimal composable EVM publisher

The current `Chisel.sol` combines three *optional* on-chain behaviors:
a writer-scoped dictionary (Jethro), an array of native-token payments (Gomez),
and receipt logs. `execute` can perform any combination in one transaction.

There is no owner-only write gate. The dictionary namespace is always the
actual EVM `msg.sender`, so two wallets can write the same artifact name
without overwriting each other's entries. The immutable `creator` is
informational, not privileged.

## Solidity entry points

| Function | Behavior |
| --- | --- |
| `mapArtifact(string,string)` | Update the caller's dictionary key and emit `ArtifactMapped`. |
| `getArtifact(address,string)` | Read a specific writer's latest body/revision. |
| `logRecord(bytes32,bytes)` | Emit `RecordLogged`; no state write. |
| `distribute(Payment[])` | Best-effort native-token payments; failures do not abort other payments. |
| `distributeChecked(Payment[])` | Optional on-chain checks; all-or-nothing payments. |
| `execute(string,string,Payment[],bytes32,bytes)` | Optional dictionary, optional payments, optional log, in one call. |
| `pendingRefunds(address)` / `withdrawRefund()` | Recover value when an automatic refund could not be delivered. |

`Payment` is `(address payable recipient, uint256 amount)`, an array of
pairs rather than two independently sized arrays. Amounts are **wei**
(native chain base units), not token balances or decimal POL/ETH.

The composite function applies these omission conventions:

- Empty `artifact`: no dictionary update. `body` is ignored in this case.
- Empty `payments`: no recipient calls.
- Empty `logData`: no log. Set `logFormat` to zero bytes32 when unused.

For best-effort calls, the contract starts with the current call's
`msg.value` as its spending budget. Each recipient is visited in order.
A payment above the remaining budget is skipped; a failing recipient call
does not debit the budget. Each entry emits `TransferResult` with
`status = 0` (insufficient budget, no CALL), `1` (CALL failed), or
`2` (CALL succeeded). Value remaining after all attempts is automatically
returned to the caller. If the caller's receiving function rejects the
refund, the value is credited to `pendingRefunds` for later withdrawal.

Each best-effort recipient CALL has a **50,000 gas cap**. That limits
individual gas griefing, but a contract with a complex receive hook may
fail within that limit. A transaction-wide out-of-gas error **still reverts
the whole transaction**, so best-effort does not guarantee processing an
unbounded array. A successful zero-value call does not guarantee that a
block explorer will show an internal transfer. Inspect the contract's
`TransferResult` logs and the actual balances, not just internal traces.

`distributeChecked` disallows a zero recipient or zero amount, requires
the sum of payments to equal `msg.value`, and reverts if any recipient
CALL fails. That function intentionally has no best-effort gas cap.

## JavaScript interface

`chisel.evm.chisel.js` is browser-compatible, keeps Thunderword
conversion outside Solidity, and does not send transactions. For example:

```js
const M = window.CHISEL_EVM_CHISEL;
const reviewed = M.encode(ethers, "execute", {
  artifact: "certificate-1",
  body: "sha256:...",
  payments: [
    {recipient: M.thunderwordAddress("westend"), amountWei: "1"}
  ],
  logFormat: M.ZERO_FORMAT,
  logData: "0x"
});

// reviewed.data: ABI-encoded call to execute()
// reviewed.value: hex native value to attach to the transaction
// reviewed.paymentTotalWei: total wei across payment entries
// Chisel must review recipient addresses, calldata, gas, wallet and chain
// before submitting a transaction to the NEW deployed Chisel address.
```

`M.prepare("execute", options)` validates data types and payment units
without needing ethers. The amount defaults to the sum of payments but
`valueWei` can be set explicitly to explore insufficient-value behavior.
`M.encode(ethers, functionName, options)` additionally ABI-encodes the
chosen function. Supported write methods are `execute`, `mapArtifact`,
`logRecord`, `distribute`, `distributeChecked`, and `withdrawRefund`.

## Build and deployment

Recompile **the current** `contracts/Chisel.sol` before deploying. The
historical `Mogwai.bin` and `Mogwai.txt` were committed from an older
contract with a different ABI. **Do not deploy those old artifacts.**

From the `contracts/` directory:

```sh
solc --bin --abi Chisel.sol
```

Alternatively, use the Standard JSON recipe in
`tools/evmFactory/README.md` to produce a deployable JSON artifact.
Compile, deploy, check the receipt and deployed runtime bytecode before
registering an address in Chisel. The repo does not assume a deployed
instance or chain-specific address.

To run the browser adapter's unit tests (Node is for tests only, not the
IPFS runtime):

```sh
node --test tests/chisel-contract-browser.test.mjs
```

These JavaScript tests do not simulate actual EVM execution. On-chain
payment semantics and receipt traces must still be tested on a testnet
with actual compiled bytecode.
