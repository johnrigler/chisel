import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({TextEncoder, Date});
context.window = context;
for (const path of ["chisel.evm.contracts.js", "chisel.evm.write.js"]) {
  vm.runInContext(await readFile(new URL("../" + path, import.meta.url), "utf8"), context, {filename:path});
}
const REG = context.CHISEL_EVM_CONTRACTS;
const W = context.CHISEL_EVM_WRITE;
const CONTRACT = REG.deployments["jethro.polygon.137"].address;
const ACCOUNT = "0x" + "ab".repeat(20);
const HASH = "0x" + "fe".repeat(32);
const ethers = {
  getAddress(address) { return address; },
  keccak256(value) { return "hash:" + value; },
  Interface: class {
    constructor(abi) { assert.ok(abi.some(x => x.startsWith("function mapArtifact("))); }
    encodeFunctionData(name, args) {
      assert.equal(name, "mapArtifact");
      assert.equal(args.length, 2);
      return "0x12345678" + Buffer.from(JSON.stringify(args)).toString("hex");
    }
  }
};
function mock() {
  const calls = [];
  let chain = "0x89", code = "0x6000", account = ACCOUNT, simulationError = null, hash = HASH, receipt = null;
  const provider = {async request({method, params}) {
    calls.push({method, params});
    if (method === "eth_chainId") return chain;
    if (method === "eth_accounts" || method === "eth_requestAccounts") return account ? [account] : [];
    if (method === "eth_getCode") return code;
    if (method === "eth_call") { if (simulationError) throw new Error(simulationError); return "0x"; }
    if (method === "eth_estimateGas") return "0x18000";
    if (method === "eth_sendTransaction") return hash;
    if (method === "eth_getTransactionReceipt") return receipt;
    throw new Error("Unexpected wallet call: " + method);
  }};
  return {provider,calls, setChain(value) {chain = value;}, setCode(value) {code = value;},
    setAccount(value) {account = value;}, setSimulationError(value) {simulationError = value;},
    setReceipt(value) {receipt = value;}, setHash(value) {hash = value;}};
}
function writer() { return W.createWriter({registry:REG, ethers}); }
function params(artifact = "Café", body = "Hello, 你好!") {
  return {deploymentId:"jethro.polygon.137", artifact, body};
}
function methodCount(mockWallet, method) { return mockWallet.calls.filter(x => x.method === method).length; }

test("contract registry separates shared ABI, implementation and deployed Polygon address", () => {
  const j = REG.descriptor("jethro.polygon.137");
  assert.equal(j.deployment.chainId, 137);
  assert.equal(j.deployment.address, CONTRACT);
  assert.equal(j.implementation.interfaceId, j.contractInterface.id);
  assert.equal(j.implementation.source, null, "unknown source is not invented");
  assert.equal(j.implementation.runtimeBytecodeHash, null);
  assert.notEqual(REG.descriptor("gomez.polygon.137").contractInterface.id, j.contractInterface.id);
  assert.throws(() => REG.descriptor("nonexistent"), /Unknown/);
});

test("Jethro calldata retains exact Unicode and never signs or sends in the build stage", () => {
  const encoded = REG.buildCall(ethers,"jethro.polygon.137","mapArtifact",["Café","Hi\n☃"]);
  assert.equal(encoded.artifact,"Café");
  assert.equal(encoded.body,"Hi\n☃");
  assert.equal(encoded.byteLength,new TextEncoder().encode("CaféHi\n☃").length);
  assert.equal(encoded.functionSignature,"mapArtifact(string,string)");
  assert.equal(encoded.to,CONTRACT);
  assert.equal(encoded.value,"0x0");
  assert.equal(encoded.data.slice(10),Buffer.from(JSON.stringify(["Café","Hi\n☃"])).toString("hex"));
  assert.throws(() => REG.buildCall(ethers,"gomez.polygon.137","tell",["x"]),/Only Jethro/);
  assert.throws(() => REG.buildCall(ethers,"jethro.polygon.137","mapArtifact",["",""]),/Enter/);
  assert.throws(() => REG.buildCall(ethers,"jethro.polygon.137","mapArtifact",["x".repeat(65537),""]),/64 KiB/);
});

test("wallet connect, simulation and gas review never send a transaction", async () => {
  const m = mock(), w = writer();
  const connected = await w.connect(m.provider);
  assert.equal(connected.chainId,137);
  assert.equal(connected.from,ACCOUNT);
  const review = await w.prepare(m.provider,params());
  assert.equal(review.chainId,137);
  assert.equal(review.from,ACCOUNT);
  assert.equal(review.gasEstimate,String(0x18000));
  assert.equal(review.codeHash,"hash:0x6000");
  const simulation = m.calls.find(x => x.method === "eth_call");
  assert.equal(simulation.params[0].to, CONTRACT);
  assert.equal(simulation.params[0].from, ACCOUNT);
  assert.equal(simulation.params[0].data, review.data);
  assert.equal(simulation.params[0].value,"0x0");
  assert.equal(methodCount(m,"eth_sendTransaction"),0);
});

test("wrong chain, no bytecode, and simulation failure all stop before send", async () => {
  for (const failure of ["wrongchain","nocode","simulation"]) {
    const m = mock(), w = writer();
    if (failure === "wrongchain") m.setChain("0x1");
    if (failure === "nocode") m.setCode("0x");
    if (failure === "simulation") m.setSimulationError("reverted: permission denied");
    await assert.rejects(w.prepare(m.provider,params()),
      failure === "wrongchain" ? /Wrong wallet chain/ :
      failure === "nocode" ? /No usable contract bytecode/ : /Contract simulation failed/);
    assert.equal(w.review,null);
    assert.equal(methodCount(m,"eth_sendTransaction"),0);
  }
});

test("only exact previously reviewed calldata can be sent; a send cannot be replayed", async () => {
  const m = mock(), w = writer();
  const reviewed = await w.prepare(m.provider,params("artifact","payload"));
  await assert.rejects(w.submit(m.provider,{...reviewed}),/stale/);
  const submitted = await w.submit(m.provider,reviewed);
  assert.equal(submitted.hash,HASH);
  assert.equal(methodCount(m,"eth_sendTransaction"),1);
  const sent = m.calls.find(x => x.method === "eth_sendTransaction");
  assert.equal(Object.keys(sent.params[0]).sort().join(","),"data,from,to,value");
  assert.equal(sent.params[0].data,reviewed.data);
  assert.equal(sent.params[0].to,CONTRACT);
  assert.equal(w.review,null);
  await assert.rejects(w.submit(m.provider,reviewed),/stale/);
  assert.equal(methodCount(m,"eth_sendTransaction"),1);
});

test("account changes, chain changes, code changes, and invalidation block stale submission", async () => {
  for (const reason of ["account","chain","bytecode","invalidate"]) {
    const m=mock(), w=writer();
    const review=await w.prepare(m.provider,params());
    if(reason==="account") m.setAccount("0x"+"cd".repeat(20));
    if(reason==="chain") m.setChain("0x1");
    if(reason==="bytecode") m.setCode("0x6001");
    if(reason==="invalidate") w.invalidate();
    await assert.rejects(w.submit(m.provider,review),/changed|Wrong|stale/i);
    assert.equal(methodCount(m,"eth_sendTransaction"),0);
  }
});

test("an input or wallet change during asynchronous review cannot reactivate a stale send", async () => {
  const m=mock(), w=writer();
  let release;
  const original=m.provider.request.bind(m.provider);
  m.provider.request=async function(request) {
    if(request.method==="eth_call") await new Promise(resolve=>{release=resolve;});
    return original(request);
  };
  const pending=w.prepare(m.provider,params());
  // Wait for the asynchronous account, chain and code reads.
  for(let i=0;i<6&&!release;i++) await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof release,"function");
  w.invalidate();
  release();
  await assert.rejects(pending,/changed during review/);
  assert.equal(w.review,null);
  assert.equal(methodCount(m,"eth_sendTransaction"),0);
});

test("transaction receipt distinguishes pending, confirmed, and reverted execution", async () => {
  const m=mock(), w=writer();
  assert.equal((await w.receipt(m.provider,HASH,137,CONTRACT)).state,"pending");
  m.setReceipt({transactionHash:HASH,to:CONTRACT,blockNumber:"0x123",status:"0x1"});
  assert.equal((await w.receipt(m.provider,HASH,137,CONTRACT)).state,"confirmed");
  m.setReceipt({transactionHash:HASH,to:CONTRACT,blockNumber:"0x124",status:"0x0"});
  assert.equal((await w.receipt(m.provider,HASH,137,CONTRACT)).state,"reverted");
  m.setReceipt({transactionHash:HASH,to:"0x"+"11".repeat(20),blockNumber:"0x123",status:"0x1"});
  await assert.rejects(w.receipt(m.provider,HASH,137,CONTRACT),/mismatched/);
});

test("EVM workbench includes the writer scripts and explicit review and send controls", async () => {
  const html=await readFile(new URL("../evm.html",import.meta.url),"utf8");
  const scripts=["chisel.evm.contracts.js","chisel.evm.write.js","chisel.evm.write.ui.js"];
  for(const script of scripts) assert.match(html,new RegExp(script.replaceAll(".","\\.")+"\\?rev="));
  assert.ok(html.indexOf(scripts[0])<html.indexOf(scripts[1]));
  assert.ok(html.indexOf(scripts[1])<html.indexOf(scripts[2]));
  assert.match(html,/id="jethroSendBtn"[^>]+disabled/);
  assert.match(html,/id="jethroReviewBtn"/);
  assert.match(html,/id="jethroReceiptBtn"[^>]+disabled/);
  assert.match(html,/id="jethroContractLink"/);
});
