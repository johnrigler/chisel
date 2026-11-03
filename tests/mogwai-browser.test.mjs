import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const scope = vm.createContext({});
scope.window = scope;
vm.runInContext(await readFile(new URL("../chisel.evm.mogwai.js", import.meta.url), "utf8"), scope);
const M = scope.CHISEL_EVM_MOGWAI;

test("Thunderwords encode ASCII bytes directly into a 20-byte address without Base58", () => {
  const expected = "0x77657374656e64" + "00".repeat(13);
  assert.equal(M.thunderwordAddress("westend"), expected);
  assert.equal(M.decodeThunderword(expected), "westend");
  assert.notEqual(M.thunderwordAddress("WESTEND"), expected);
  for (const value of ["", "x".repeat(21), "café", "\n"]) {
    assert.throws(() => M.thunderwordAddress(value), /Thunderword/);
  }
  assert.throws(() => M.decodeThunderword("0x" + "00".repeat(20)), /Empty/);
  assert.throws(() => M.decodeThunderword("0x610062" + "00".repeat(17)), /Not a v1/);
});

const encoded = [];
const ethers = {
  AbiCoder: { defaultAbiCoder() {
    return { encode(types, values) {
      encoded.push({types, values});
      return "0x" + "aa".repeat(32);
    }};
  }}
};
const fmt = "0x" + "ab".repeat(32);
test("Mogwai batch ABI tuples preserve type and validate size and subject", () => {
  const ops = M.batch(ethers, [
    {kind:M.KINDS.ARTIFACT, artifact:"key",body:"value"},
    {kind:M.KINDS.LOG,format:fmt,data:"0x1234"},
    {kind:M.KINDS.THUNDERWORD,text:"westend",format:fmt,data:"0x"},
    {kind:M.KINDS.PEER,peer:"0x" + "12".repeat(20),format:fmt,data:"0xab"}
  ]);
  assert.deepEqual(Array.from(ops, op => op.kind), [1,2,3,4]);
  assert.deepEqual(Array.from(encoded[0].types), ["string","string"]);
  assert.deepEqual(Array.from(encoded[2].types), ["address","bytes32","bytes"]);
  assert.equal(encoded[2].values[0], M.thunderwordAddress("westend"));
  assert.throws(() => M.batch(ethers, []), /1-32/);
  assert.throws(() => M.operation(ethers,2,{format:fmt,data:"xyz"}), /hexadecimal/);
  assert.throws(() => M.operation(ethers,3,{thunderword:"0x" + "00".repeat(20),format:fmt,data:"0x"}), /nonzero/);
  assert.throws(() => M.operation(ethers,4,{peer:"0x" + "00".repeat(20),format:fmt,data:"0x"}), /nonzero/);
  assert.throws(() => M.operation(ethers,2,{format:fmt,data:"0x" + "01".repeat(24577)}), /24 KiB/);
});

test("adapter deliberately contains no hardcoded deployment address or signer", () => {
  assert.ok(M.ABI.includes("function execute((uint8 kind,bytes data)[] operations)"));
  assert.ok(M.ABI.some(fragment => fragment.includes("ThunderwordPublished")));
  assert.equal(Object.prototype.hasOwnProperty.call(M,"deployment"), false);
});
