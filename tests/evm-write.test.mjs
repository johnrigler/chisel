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
    constructor(abi) {
      assert.ok(abi.some(x => x.startsWith("function mapArtifact(") || x.startsWith("function tell(")));
    }
    encodeFunctionData(name, args) {
      if (name === "mapArtifact") {
        assert.equal(args.length, 2);
        return "0x12345678" + Buffer.from(JSON.stringify(args)).toString("hex");
      }
      assert.equal(name, "tell");
      assert.equal(args.length, 9);
      return "0x87654321" + Buffer.from(JSON.stringify(args.map(value =>
        typeof value === "bigint" ? value.toString() : value))).toString("hex");
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
  assert.throws(() => REG.buildCall(ethers,"gomez.polygon.137","tell",["x"]),/four address\/amount pairs/);
  assert.throws(() => REG.buildCall(ethers,"jethro.polygon.137","mapArtifact",["",""]),/Enter/);
  assert.throws(() => REG.buildCall(ethers,"jethro.polygon.137","mapArtifact",["x".repeat(65537),""]),/64 KiB/);
});


const ZERO = "0x" + "00".repeat(20);
const GOMEZ = REG.deployments["gomez.polygon.137"].address;
const RECEIVER = "0x" + "12".repeat(20);
function gomezArgs(message = "Gomez on Chisel") {
  return [message, RECEIVER, "42", ZERO, "0", ZERO, "0", ZERO, "0"];
}
function gomezParams(args = gomezArgs()) {
  return {deploymentId: "gomez.polygon.137", functionName: "tell", args};
}

test("Gomez registry encodes four address/uint256 pairs with exact, decimal-string amounts", () => {
  const payload = REG.buildCall(ethers,"gomez.polygon.137","tell",gomezArgs("Map 🧭"));
  assert.equal(payload.to,GOMEZ);
  assert.equal(payload.chainId,137);
  assert.equal(payload.functionSignature,"tell(string,address,uint256,address,uint256,address,uint256,address,uint256)");
  assert.equal(payload.message,"Map 🧭");
  assert.deepEqual(Array.from(payload.receivers),[RECEIVER,ZERO,ZERO,ZERO]);
  assert.deepEqual(Array.from(payload.amounts),["42","0","0","0"]);
  assert.equal(payload.byteLength,new TextEncoder().encode("Map 🧭").length);
  assert.equal(payload.data.slice(0,10),"0x87654321");
  assert.deepEqual(JSON.parse(Buffer.from(payload.data.slice(10),"hex").toString()),
    ["Map 🧭",RECEIVER,"42",ZERO,"0",ZERO,"0",ZERO,"0"]);
  assert.equal(payload.value,"0x0", "Gomez write must not attach native POL");
  assert.equal(payload.interfaceId,REG.descriptor("gomez.polygon.137").contractInterface.id);
});

test("Gomez rejects malformed input before wallet interaction", () => {
  const bad = (args,pattern) => assert.throws(() => REG.buildCall(ethers,
    "gomez.polygon.137","tell",args),pattern);
  bad(gomezArgs(""),/Enter a Gomez message/);
  bad(gomezArgs("x".repeat(65537)),/64 KiB/);
  bad(gomezArgs().slice(0,-1),/four address\/amount pairs/);
  const invalid = (index,value,pattern) => {
    const args=gomezArgs();
    args[index]=value;
    bad(args,pattern);
  };
  invalid(1,"not a wallet",/20-byte EVM address/);
  invalid(2,"-10",/unsigned decimal/);
  invalid(2,"1.2",/unsigned decimal/);
  invalid(2,"1e18",/unsigned decimal/);
  invalid(2,"01",/unsigned decimal/);
  invalid(2,0,/unsigned decimal/);
  invalid(2,(1n<<256n).toString(),/exceeds uint256/);
  invalid(1,ZERO,/must be zero when receiver/);
  assert.throws(() => REG.buildCall(ethers,"gomez.polygon.137","mapArtifact",gomezArgs()),/not enabled/);
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


test("Gomez wallet review simulates tell, checks code, and sends only approved calldata", async () => {
  const m=mock(), w=writer();
  await w.connect(m.provider);
  const review=await w.prepare(m.provider,gomezParams());
  assert.equal(review.to,GOMEZ);
  assert.equal(review.functionName,"tell");
  assert.deepEqual(Array.from(review.amounts),["42","0","0","0"]);
  assert.equal(methodCount(m,"eth_call"),1);
  assert.equal(methodCount(m,"eth_estimateGas"),1);
  assert.equal(methodCount(m,"eth_sendTransaction"),0);
  assert.equal(m.calls.find(x => x.method === "eth_call").params[0].data,review.data);
  const sent=await w.submit(m.provider,review);
  assert.equal(sent.to,GOMEZ);
  assert.equal(sent.hash,HASH);
  assert.equal(methodCount(m,"eth_call"),2,"re-simulate before sending");
  assert.equal(methodCount(m,"eth_sendTransaction"),1);
  const tx=m.calls.find(x => x.method === "eth_sendTransaction").params[0];
  assert.deepEqual(Object.keys(tx).sort(),["data","from","to","value"]);
  assert.equal(tx.data,review.data);
  assert.equal(tx.value,"0x0");
  await assert.rejects(w.submit(m.provider,review),/stale/);
});

test("Gomez owner-only revert, wrong chain, missing code and stale review prevent sends", async () => {
  const cases=[
    {set:m => m.setSimulationError('execution reverted: "Only the contract owner can run this"'),message:/Only the contract owner/},
    {set:m => m.setChain("0x1"),message:/Wrong wallet chain/},
    {set:m => m.setCode("0x"),message:/No usable contract bytecode/}
  ];
  for(const entry of cases) {
    const m=mock(),w=writer();
    entry.set(m);
    await assert.rejects(w.prepare(m.provider,gomezParams()),entry.message);
    assert.equal(methodCount(m,"eth_sendTransaction"),0);
  }
  const m=mock(),w=writer(),review=await w.prepare(m.provider,gomezParams());
  w.invalidate();
  await assert.rejects(w.submit(m.provider,review),/stale/);
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
  assert.match(html,/id="gomezSendBtn"[^>]+disabled/);
  assert.match(html,/id="gomezReviewBtn"/);
  assert.match(html,/id="gomezReceiptBtn"[^>]+disabled/);
  assert.match(html,/id="gomezContractLink"/);
  for(let n=1;n<=4;n++) {
    assert.match(html,new RegExp('id="gomezReceiver'+n+'"'));
    assert.match(html,new RegExp('id="gomezAmount'+n+'"'));
  }
});
