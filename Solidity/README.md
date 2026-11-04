# Solidity contracts: Chisel and M64

This language-specific directory is the source of truth for EVM Solidity
contracts. The Chisel project may also support contracts or scripts written
in other languages. The browser interfaces and tools remain under `tools/`.

- [Chisel.sol](Chisel.sol): permissionless writer-scoped artifact mapping,
  native-token recipient arrays, event logs, and composite `execute()`.
- [M64Dictionary.sol](M64Dictionary.sol): separate append-only vocabulary
  with stable numeric term IDs and an indexed `Packet` log carrier.
- [Chisel compiled JSON](compiled/Chisel.json) and
  [M64 dictionary compiled JSON](compiled/M64Dictionary.json): deployment
  ABI and bytecode for compatible EVM networks.
- [M64 dictionary design](M64Dictionary.md) and
  [M64 browser workbench](../tools/m64Artifact/index.html).
- [Browse tools and deploy](index.html) or use the
  [EVM Contract Factory](../tools/evmFactory/index.html).

## Chisel: composable EVM publisher

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

Create the canonical, versioned deployment artifact with native `solc` and
Python standard library:

```sh
python3 Solidity/build-chisel.py
python3 Solidity/build-chisel.py --check
git add Solidity/compiled/Chisel.json
git commit -m "Compile Chisel deployment artifact"
```

The compiled JSON includes `abi`, `bytecode`, `deployedBytecode`,
`compiler`, `settings`, `sourceSha256`, and `bytecodeSha256`. Deploy the
**same exact creation bytecode** on supported EVM chains by choosing the chain
ID and wallet in `tools/evmFactory/index.html`. No Solidity compiler runs
in the browser; the wallet signs the creation transaction.

Compilation uses optimizer runs=200 and `evmVersion=paris`. Each chain still
requires a separate signed deployment and receipt/code verification. Its
`creator` immutable records that deployment's actual sender; a compiled
runtime comparison may differ because immutables are patched in the constructor.

The historical `archive/Mogwai.bin` and `archive/Mogwai.txt` files were generated from
an earlier, incompatible contract. Do not deploy them.

`solc --bin --abi Chisel.sol` remains a useful inspection command but its
header-wrapped console output is **not** the committed deployment manifest.
For optional tests:

```sh
node --test tests/evm-factory.test.mjs tests/chisel-build-artifact.test.mjs tests/chisel-contract-browser.test.mjs
```

JavaScript tests do not replace real EVM execution and balance/receipt tests.
