import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
import vm from "node:vm";

const ctx = vm.createContext({crypto: webcrypto, Uint8Array, BigInt, TextEncoder});
vm.runInContext(readFileSync(new URL("../tools/evmFactory/factory.js", import.meta.url), "utf8"), ctx);
const api = ctx.CHISEL_EVM_FACTORY;
const ACCOUNT = "0x1111111111111111111111111111111111111111";
const CONTRACT = "0x2222222222222222222222222222222222222222";
const HASH = "0x" + "ab".repeat(32);
const SAMPLE = {abi:[],bytecode:"0x60006000",deployedBytecode:"0x6000",contractName:"Tiny"};

function mockedProvider() {
  const calls = [];
  let chain = "0x89", accounts = [ACCOUNT], receipt = null;
  return {
    calls,
    setChain(value) {chain = value;},
    setAccounts(value) {accounts = value;},
    setReceipt(value) {receipt = value;},
    async request({method}) {
      calls.push(method);
      if (method === "eth_chainId") return chain;
      if (method === "eth_accounts") return accounts;
      if (method === "eth_estimateGas") return "0x5208";
      if (method === "eth_sendTransaction") return HASH;
      if (method === "eth_getTransactionReceipt") return receipt;
      if (method === "eth_getCode") return "0x6000";
      throw new Error("Unexpected RPC: " + method);
    }
  };
}

test("accepts minimal artifact and solc Standard JSON, rejects unlinked bytecode", () => {
  const one = api.collectArtifacts(SAMPLE);
  assert.equal(one.length, 1);
  assert.equal(one[0].bytecode, SAMPLE.bytecode);
  const output = {
    contracts: {
      "contracts/Tiny.sol": {
        Tiny: {abi:[],evm:{bytecode:{object:"60006000"},deployedBytecode:{object:"6000"}}}
      }
    }
  };
  assert.equal(api.collectArtifacts(output)[0].name,"contracts/Tiny.sol:Tiny");
  assert.throws(() => api.collectArtifacts({...SAMPLE,bytecode:"0x__$unlinked$__"}),/Invalid or unlinked/);
  assert.throws(() => api.collectArtifacts({errors:[{severity:"error"}],...SAMPLE}),/Solidity errors/);
});

test("enforces chain selection, no implicit connect and no constructor args", async () => {
  const provider = mockedProvider();
  const artifact = api.collectArtifacts(SAMPLE)[0];
  provider.setChain("0xaa36a7");
  await assert.rejects(api.reviewDeployment(provider,artifact,"137"),/expected 137/);
  assert.ok(!provider.calls.includes("eth_sendTransaction"));
  provider.setChain("0x89"); provider.setAccounts([]);
  await assert.rejects(api.reviewDeployment(provider,artifact,"137"),/Connect the wallet/);
  await assert.rejects(api.reviewDeployment(provider,{...artifact,constructorInputs:1},"137"),/zero-argument/);
});

test("review does not send; sender and network are revalidated before sending", async () => {
  const provider = mockedProvider();
  const artifact = api.collectArtifacts(SAMPLE)[0];
  const review = await api.reviewDeployment(provider,artifact,"137");
  assert.equal(review.gasEstimate, "21000");
  assert.equal(review.byteLength, 4);
  assert.ok(!provider.calls.includes("eth_sendTransaction"));
  provider.setAccounts([CONTRACT]);
  await assert.rejects(api.sendReviewed(provider,review),/account changed/);
  assert.ok(!provider.calls.includes("eth_sendTransaction"));
  provider.setAccounts([ACCOUNT]);
  const sent = await api.sendReviewed(provider,review);
  assert.equal(sent.hash,HASH);
  assert.equal(provider.calls.filter(call=>call==="eth_sendTransaction").length,1);
});

test("receipt distinguishes pending, failed and mined with exact runtime match", async () => {
  const provider = mockedProvider();
  const artifact = api.collectArtifacts(SAMPLE)[0];
  const pending = {hash:HASH,chainId:137,artifact};
  assert.equal((await api.checkReceipt(provider,pending)).state,"pending");
  provider.setReceipt({status:"0x0",blockNumber:"0x1"});
  assert.equal((await api.checkReceipt(provider,pending)).state,"reverted");
  provider.setReceipt({status:"0x1",blockNumber:"0x2",contractAddress:CONTRACT});
  const final = await api.checkReceipt(provider,pending);
  assert.equal(final.state,"mined");
  assert.equal(final.runtimeMatch,true);
  provider.setChain("0x1");
  await assert.rejects(api.checkReceipt(provider,pending),/Switch to deployment chain/);
});
