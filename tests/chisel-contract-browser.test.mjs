import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const scope = vm.createContext({});
scope.window = scope;
vm.runInContext(await readFile(new URL("../chisel.evm.chisel.js", import.meta.url), "utf8"), scope);
const M = scope.CHISEL_EVM_CHISEL;
const ZERO = "0x" + "00".repeat(20);
const ALICE = "0x" + "12".repeat(20);
const BOB = "0x" + "34".repeat(20);

test("Thunderword formatting stays entirely in JavaScript and is round-trip safe", () => {
  const expected = "0x77657374656e64" + "00".repeat(13);
  assert.equal(M.thunderwordAddress("westend"), expected);
  assert.equal(M.decodeThunderword(expected), "westend");
  assert.notEqual(M.thunderwordAddress("WESTEND"), expected);
  for (const value of ["", "x".repeat(21), "café", "\n"]) {
    assert.throws(() => M.thunderwordAddress(value), /Thunderword/);
  }
  assert.throws(() => M.decodeThunderword(ZERO), /Empty/);
  assert.throws(() => M.decodeThunderword("0x610062" + "00".repeat(17)), /Not a v1/);
});

test("composite call supports all sections or any omitted section", () => {
  const empty = M.prepare("execute");
  assert.equal(empty.value, "0x0");
  assert.equal(empty.args[0], "");
  assert.equal(empty.args[1], "");
  assert.equal(empty.args[2].length, 0);
  assert.equal(empty.args[4], "0x");

  const full = M.prepare("execute", {
    artifact: "certificate", body: "sha256:...",
    payments: [{recipient:ALICE,amountWei:"3"},{recipient:BOB,amount:"5"}],
    logFormat: "0x" + "cc".repeat(32), logData: "0x1234"
  });
  assert.equal(full.value, "0x8");
  assert.equal(full.paymentTotalWei, 8n);
  assert.equal(full.args[0], "certificate");
  assert.equal(full.args[1], "sha256:...");
  assert.equal(full.args[2].length, 2);
  assert.equal(full.args[2][1].amount, 5n);
  assert.equal(full.args[3], "0x" + "cc".repeat(32));
  assert.equal(full.args[4], "0x1234");

  assert.equal(M.prepare("execute", {payments:[{recipient:ALICE,amount:"9"}]}).value, "0x9");
  assert.equal(M.prepare("execute", {logData:"0xab"}).value, "0x0");
  assert.equal(M.prepare("mapArtifact", {artifact:"a",body:"b"}).value, "0x0");
  assert.equal(M.prepare("logRecord", {logData:"0xab"}).value, "0x0");
});

test("best-effort allows zero addresses, zero amounts, and deliberate underfunding", () => {
  const p = M.prepare("distribute", {
    payments:[{recipient:ZERO,amountWei:"0"},{recipient:ALICE,amountWei:"7"}],
    valueWei:"3"
  });
  assert.equal(p.value, "0x3");
  assert.equal(p.paymentTotalWei, 7n);
  assert.deepEqual(Array.from(p.payments, x => x.recipient), [ZERO, ALICE]);
  assert.deepEqual(Array.from(p.payments, x => x.amount.toString()), ["0", "7"]);
  assert.equal(M.TRANSFER_STATUS.UNFUNDED, 0);
  assert.equal(M.TRANSFER_STATUS.FAILED_CALL, 1);
  assert.equal(M.TRANSFER_STATUS.SUCCEEDED, 2);
});

test("checked transfers validate recipients and exactly funded native value", () => {
  const valid = M.prepare("distributeChecked", {
    payments:[{recipient:ALICE,amountWei:"2"},{recipient:BOB,amountWei:"3"}]
  });
  assert.equal(valid.value,"0x5");
  assert.throws(() => M.prepare("distributeChecked",
    {payments:[{recipient:ALICE,amountWei:"2"}],valueWei:"3"}), /must equal/);
  assert.throws(() => M.prepare("distributeChecked",
    {payments:[{recipient:ZERO,amountWei:"2"}]}), /nonzero/);
  assert.throws(() => M.prepare("distributeChecked",
    {payments:[{recipient:ALICE,amountWei:"0"}]}), /nonzero/);
});

test("JavaScript rejects malformed calldata and money fields before wallet interaction", () => {
  assert.throws(() => M.prepare("execute", {payments:"not an array"}), /array/);
  assert.throws(() => M.prepare("execute", {payments:[{recipient:"x",amount:"1"}]}), /20-byte/);
  assert.throws(() => M.prepare("execute", {payments:[{recipient:ALICE,amount:1.5}]}), /wei/);
  assert.throws(() => M.prepare("execute", {payments:[{recipient:ALICE,amount:"1e18"}]}), /wei/);
  assert.throws(() => M.prepare("execute", {payments:[{recipient:ALICE,amount:"-1"}]}), /wei/);
  assert.throws(() => M.prepare("execute", {payments:[{recipient:ALICE,amount:(1n<<256n)}]}), /uint256/);
  assert.throws(() => M.prepare("execute", {logData:"abc"}), /hexadecimal/);
  assert.throws(() => M.prepare("execute", {logFormat:"0x1234"}), /bytes32/);
  assert.throws(() => M.prepare("unknown"), /Unsupported/);
});

test("adapter emits a reviewed-call payload, never sends or hardcodes a deployment", () => {
  const calls = [];
  const ethers = {Interface: class {
    constructor(abi) { assert.ok(abi.some(x => x.startsWith("function execute("))); }
    encodeFunctionData(method, args) {
      calls.push({method,args});
      return "0xcafebabe";
    }
  }};
  const encoded = M.encode(ethers,"execute",{
    artifact:"note",body:"hello",
    payments:[{recipient:M.thunderwordAddress("westend"),amountWei:"1"}],
    logData:"0x55"
  });
  assert.equal(encoded.data,"0xcafebabe");
  assert.equal(encoded.value,"0x1");
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,"execute");
  assert.equal(calls[0].args[2][0].recipient,M.thunderwordAddress("westend"));
  assert.ok(M.ABI.some(fragment => fragment.includes("TransferResult")));
  assert.equal(Object.prototype.hasOwnProperty.call(M, "deployment"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(encoded, "to"), false);
});

test("Solidity exposes the optional operations and limits spending to msg.value", async () => {
  const source = await readFile(new URL("../contracts/Chisel.sol",import.meta.url),"utf8");
  for(const signature of ["mapArtifact(", "logRecord(", "distribute(", "distributeChecked(", "execute(", "withdrawRefund("]) {
    assert.ok(source.includes("function " + signature),signature);
  }
  assert.match(source,/uint256 unspent = msg\.value;/);
  assert.match(source,/if \(payment\.amount > unspent\)/);
  assert.match(source,/if \(success\) unspent -= payment\.amount;/);
  assert.match(source,/emit TransferResult/);
  assert.match(source,/pendingRefunds\[msg\.sender\] \+= unspent/);
  assert.doesNotMatch(source,/onlyOwner|owner\(\)/i);
});
