import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({TextEncoder, Date});
context.window = context;
for (const name of ["chisel.evm.contracts.js", "chisel.evm.chisel.js", "chisel.evm.write.js"]) {
  vm.runInContext(await readFile(new URL("../" + name, import.meta.url), "utf8"), context);
}
const registry = context.CHISEL_EVM_CONTRACTS;
const writerApi = context.CHISEL_EVM_WRITE;
const address = "0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3";
const from = "0x" + "ab".repeat(20);
const txid = "0x" + "cd".repeat(32);
const recipient = "0x" + "12".repeat(20);
const zero = "0x" + "00".repeat(20);
const ethers = {
  getAddress(input) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(input)) throw Error("Invalid EVM address");
    return input;
  },
  keccak256(code) { return "hash:" + code; },
  Interface: class {
    constructor(abi) { assert.ok(abi.some(s => s.startsWith("function "))); }
    encodeFunctionData(name, args) {
      return "0x12345678" + Buffer.from(JSON.stringify({name, args},
        (_key, v) => typeof v === "bigint" ? v.toString() : v)).toString("hex");
    }
  }
};
function build(method, args={}) {
  return registry.buildCall(ethers, "chisel.polygon.137", method, args);
}
function payment(amountWei="123", recipientAddress=recipient) {
  return {recipient: recipientAddress, amountWei};
}
function mock() {
  const calls=[];
  let chain="0x89", account=from, code="0x6000", fail=false;
  const provider = {async request({method,params}) {
    calls.push({method,params});
    if (method==="eth_chainId") return chain;
    if (method==="eth_accounts" || method==="eth_requestAccounts") return [account];
    if (method==="eth_getCode") return code;
    if (method==="eth_call") { if (fail) throw Error("execution reverted"); return "0x"; }
    if (method==="eth_estimateGas") return "0x10000";
    if (method==="eth_sendTransaction") return txid;
    if (method==="eth_getTransactionReceipt") return null;
    throw Error("Unexpected provider call: " + method);
  }};
  return {calls, provider, setChain:v=>chain=v, setAccount:v=>account=v,
    setCode:v=>code=v, setFail:v=>fail=v};
}

test("deployer-supplied Chisel address is registered separately from Gomez and Jethro", () => {
  const found=registry.descriptor("chisel.polygon.137");
  assert.equal(found.deployment.address,address);
  assert.equal(found.deployment.chainId,137);
  assert.equal(found.contractInterface.id,"chisel.v1");
  assert.equal(found.deployment.verificationStatus,"address-provided-by-deployer");
  assert.notEqual(found.deployment.address,registry.deployments["jethro.polygon.137"].address);
});

test("Chisel allowlist encodes every supported method with exact native value", () => {
  const map=build("mapArtifact",{artifact:"Résumé",body:"Body"});
  assert.equal(map.value,"0x0");
  assert.equal(map.artifact,"Résumé");
  assert.equal(map.functionSignature,"mapArtifact(string,string)");
  const log=build("logRecord",{logFormat:"0x"+"00".repeat(32),logData:"0x6869"});
  assert.equal(log.value,"0x0");
  assert.equal(log.logData,"0x6869");
  const amount="1234567890123456789";
  for (const method of ["distribute","distributeChecked"]) {
    const result=build(method,{payments:[payment(amount)]});
    assert.equal(result.value,"0x"+BigInt(amount).toString(16));
    assert.equal(result.nativeValueWei,amount);
    assert.equal(result.payments[0].amountWei,amount);
  }
  const exec=build("execute",{
    artifact:"example",body:"document", logFormat:"0x"+"00".repeat(32),
    logData:"0x6869",payments:[payment("17"),payment("3","0x"+"34".repeat(20))]
  });
  assert.equal(exec.value,"0x14");
  assert.equal(exec.nativeValueWei,"20");
  assert.equal(exec.functionSignature,"execute(string,string,(address,uint256)[],bytes32,bytes)");
  const refund=build("withdrawRefund");
  assert.equal(refund.value,"0x0");
  assert.equal(refund.functionSignature,"withdrawRefund()");
  assert.throws(() => build("getArtifact",{artifact:"key"}),/not enabled/);
});

test("Chisel rejects invalid payment, log and artifact input before wallet interaction", () => {
  const bad=(method,params,pattern)=>assert.throws(()=>build(method,params),pattern);
  bad("mapArtifact",{artifact:"",body:"body"},/artifact key/);
  bad("mapArtifact",{artifact:"x".repeat(65537)},/64 KiB/);
  bad("logRecord",{logData:"0x"},/nonempty/);
  bad("logRecord",{logData:"0x1"},/even-length/);
  bad("distributeChecked",{payments:[payment("0")]},/between 1/);
  bad("distribute",{payments:[payment("1",zero)]},/zero address/);
  bad("distribute",{payments:[payment("1.2")]},/decimal integer/);
  bad("distribute",{payments:[payment("1e18")]},/decimal integer/);
  bad("distribute",{payments:[payment("-1")]},/decimal integer/);
  bad("distribute",{payments:[payment("01")]},/decimal integer/);
  bad("distribute",{payments:[payment("1","invalid")]},/invalid EVM address/);
  bad("distribute",{payments:[payment("1")],valueWei:"2"},/exactly equal/);
  bad("distribute",{payments:Array.from({length:33},()=>payment("1"))},/32 payments/);
  bad("execute",{artifact:"",body:"",payments:[],logData:"0x"},/requires an artifact, log, or payment/);
  bad("distribute",{payments:[payment(((1n<<256n)-1n).toString()),payment("1")]},/total exceeds uint256/);
});

test("Chisel wallet simulation keeps payment value and sends only after explicit submit", async () => {
  const m=mock(),writer=writerApi.createWriter({registry,ethers});
  await writer.connect(m.provider);
  const args={deploymentId:"chisel.polygon.137",functionName:"distributeChecked",
    args:{payments:[payment("1000000000000000")]}};
  const review=await writer.prepare(m.provider,args);
  assert.equal(review.to,address);
  assert.equal(review.value,"0x"+BigInt("1000000000000000").toString(16));
  assert.equal(m.calls.filter(c=>c.method==="eth_sendTransaction").length,0);
  assert.equal(m.calls.find(c=>c.method==="eth_call").params[0].value,review.value);
  const sent=await writer.submit(m.provider,review);
  assert.equal(sent.hash,txid);
  assert.equal(m.calls.filter(c=>c.method==="eth_sendTransaction").length,1);
  assert.equal(m.calls.find(c=>c.method==="eth_sendTransaction").params[0].value,review.value);
  await assert.rejects(writer.submit(m.provider,review),/stale/);
});

test("Chisel review blocks missing code, wrong chain, and reverted simulation", async () => {
  for (const kind of ["code","chain","revert"]) {
    const m=mock(),writer=writerApi.createWriter({registry,ethers});
    if (kind==="code") m.setCode("0x");
    if (kind==="chain") m.setChain("0x1");
    if (kind==="revert") m.setFail(true);
    await assert.rejects(writer.prepare(m.provider,{
      deploymentId:"chisel.polygon.137",functionName:"mapArtifact",
      args:{artifact:"test",body:"body"}
    }),kind==="code" ? /No usable contract bytecode/ :
       kind==="chain" ? /Wrong wallet chain/ : /simulation failed/i);
    assert.equal(m.calls.filter(c=>c.method==="eth_sendTransaction").length,0);
  }
});
