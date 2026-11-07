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
  let chain = "0x89", accounts = [ACCOUNT], receipt = null, switchError = null, ignoreSwitch = false;
  return {
    calls,
    switchCalls: [],
    setChain(value) {chain = value;},
    setSwitchError(value) {switchError = value;},
    setIgnoreSwitch(value) {ignoreSwitch = value;},
    setAccounts(value) {accounts = value;},
    setReceipt(value) {receipt = value;},
    async request({method,params}) {
      calls.push(method);
      if (method === "wallet_switchEthereumChain") {
        const requested = params[0].chainId;
        this.switchCalls.push(requested);
        if (switchError) throw switchError;
        if (!ignoreSwitch) chain = requested;
        return null;
      }
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
        Tiny: {abi:[],evm:{bytecode:{object:"60006000"},deployedBytecode:{object:"6000"}}},
        IEmpty: {abi:[],evm:{bytecode:{object:""},deployedBytecode:{object:""}}}
      }
    }
  };
  assert.equal(api.collectArtifacts(output).length,1);
  assert.equal(api.collectArtifacts(output)[0].name,"contracts/Tiny.sol:Tiny");
  assert.throws(() => api.collectArtifacts({...SAMPLE,bytecode:"0x__$unlinked$__"}),/Invalid or unlinked/);
  assert.throws(() => api.collectArtifacts({errors:[{severity:"error"}],...SAMPLE}),/Solidity errors/);
});

test("rejects an artifact with a mismatched declared creation hash", async () => {
  const provider = mockedProvider();
  const bad = api.collectArtifacts({...SAMPLE,bytecodeSha256:"0".repeat(64)})[0];
  await assert.rejects(api.reviewDeployment(provider,bad,"137"),/SHA-256 does not match/);
  assert.ok(!provider.calls.includes("eth_sendTransaction"));
});

test("enforces chain selection, no implicit connect and rejects missing constructor args", async () => {
  const provider = mockedProvider();
  const artifact = api.collectArtifacts(SAMPLE)[0];
  provider.setChain("0xaa36a7");
  await assert.rejects(api.reviewDeployment(provider,artifact,"137"),/expected 137/);
  assert.ok(!provider.calls.includes("eth_sendTransaction"));
  provider.setChain("0x89"); provider.setAccounts([]);
  await assert.rejects(api.reviewDeployment(provider,artifact,"137"),/Connect the wallet/);
  const ctor = api.collectArtifacts({...SAMPLE,abi:[{type:"constructor",inputs:[{name:"owner",type:"address"}]}]})[0];
  await assert.rejects(api.reviewDeployment(provider,ctor,"137"),/requires 1 JSON values/);
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

test("switches injected provider with hex chain ID and skips request when already selected", async () => {
  const provider = mockedProvider();
  provider.setChain("0x1");
  const switched = await api.switchWalletChain(provider, "137");
  assert.equal(switched.chainId, 137);
  assert.equal(switched.switched, true);
  assert.deepEqual(provider.switchCalls, ["0x89"]);
  assert.ok(!provider.calls.includes("eth_sendTransaction"));
  const again = await api.switchWalletChain(provider, "137");
  assert.equal(again.switched, false);
  assert.deepEqual(provider.switchCalls, ["0x89"]);
});

test("handles rejected, unknown, and ineffective chain-switch requests", async () => {
  const provider = mockedProvider();
  provider.setChain("0x1");
  provider.setSwitchError({code: 4001});
  await assert.rejects(api.switchWalletChain(provider, "137"), /rejected/);
  provider.setSwitchError({code: 4902});
  await assert.rejects(api.switchWalletChain(provider, "137"), /Add it manually/);
  provider.setSwitchError(null);
  provider.setIgnoreSwitch(true);
  await assert.rejects(api.switchWalletChain(provider, "137"), /still on chain 1/);
  await assert.rejects(api.switchWalletChain(provider, "invalid"), /positive decimal chain ID/);
  assert.ok(!provider.calls.includes("eth_sendTransaction"));
});

const W = hex => hex.padStart(64, "0");
const m64Params = ["string", "string", "string", "string", "string", "bytes[]", "bytes[]", "uint32[]"];
const m64Artifact = api.collectArtifacts({
  ...SAMPLE, contractName:"M64SymbolDictionary",
  abi:[{type:"constructor",inputs:m64Params.map((type, i)=>({name:"arg"+i,type}))}]
})[0];
function hexString(value) {
  const bytes = new TextEncoder().encode(value);
  const hex = Buffer.from(bytes).toString("hex");
  return W(bytes.length.toString(16)) + hex.padEnd(Math.ceil(bytes.length/32)*64,"0");
}
test("ABI encodes dynamic strings with correct head-relative offsets", () => {
  const a = api.collectArtifacts({...SAMPLE,abi:[{type:"constructor",inputs:[
    {type:"string",name:"first"},{type:"string",name:"second"}]}]})[0];
  assert.equal(api.encodeConstructorArgs(a,["Hi","X"]), "0x" +
    W("40") + W("80") + hexString("Hi") + hexString("X"));
});
test("M64 constructor encodes all eight values and primary/secondary byte arrays", async () => {
  const args=["M64 Dictionary","M64","javascript","text/javascript","Dark Star",
    ["0x20","0x000102","0xff"],["0xa0","0x01ff"],[9, 4]];
  assert.equal(m64Artifact.constructorInputs,8);
  assert.deepEqual(Array.from(m64Artifact.constructorParameters,p=>p.type),m64Params);
  const output=api.encodeConstructorArgs(m64Artifact,args);
  const words=output.slice(2).match(/.{64}/g);
  assert.equal(BigInt("0x"+words[0]),256n);
  assert.equal(BigInt("0x"+words[1]),320n); // first string = 64 bytes
  // Last (uint32[]) tail ends with length 2 and two uint32 values.
  assert.ok(output.endsWith(W("2") + W("9") + W("4")));
  assert.equal(api.creationData(m64Artifact,args).data,SAMPLE.bytecode + output.slice(2));
  const provider=mockedProvider();
  const review=await api.reviewDeployment(provider,m64Artifact,"137",args);
  assert.equal(review.encodedArgumentBytes,(output.length-2)/2);
  assert.equal(review.transaction.data,SAMPLE.bytecode+output.slice(2));
  assert.equal(review.creationSha256,await api.sha256(review.transaction.data));
  assert.notEqual(review.creationSha256,review.compiledSha256);
  assert.ok(!provider.calls.includes("eth_sendTransaction"));
  const send=await api.sendReviewed(provider,review);
  assert.equal(send.hash,HASH);
});
test("constructor validation rejects bad hex, unsigned range and wrong counts before gas estimation", async () => {
  const provider=mockedProvider();
  const good=["M64","M64","javascript","text/javascript","test",
    ["0x00"],[],[1]];
  for(const bad of [
    good.slice(0,7),
    [...good.slice(0,5), ["not hex"], [], [1]],
    [...good.slice(0,7), [-1]],
    [...good.slice(0,7), [4294967296]],
    [...good.slice(0,5), "not an array", [], [1]],
  ]){
    await assert.rejects(api.reviewDeployment(provider,m64Artifact,"137",bad));
  }
  assert.ok(!provider.calls.includes("eth_estimateGas"));
});
test("supports fixed arrays, nested dynamic tuples, bool, address, signed ints, fixed bytes",()=>{
  const artifact=api.collectArtifacts({...SAMPLE,abi:[{type:"constructor",inputs:[
    {name:"fixed",type:"uint8[2]"},
    {name:"s",type:"int8"},
    {name:"ok",type:"bool"},
    {name:"account",type:"address"},
    {name:"id",type:"bytes2"},
    {name:"nested",type:"tuple[]",components:[{name:"a",type:"string"},{name:"b",type:"uint16"}]}
  ]}]})[0];
  const result=api.encodeConstructorArgs(artifact,[[3,4],-2,true,ACCOUNT,"0x1234",[["one",7],["two",8]]]);
  assert.ok(result.startsWith("0x"+W("3")+W("4")+"f".repeat(62)+"fe"+W("1")+W(ACCOUNT.slice(2))+"1234".padEnd(64,"0")));
  assert.ok(result.endsWith(W("3") + Buffer.from("two").toString("hex").padEnd(64,"0")));
});
test("rejects ABI-encoded initcode beyond EIP-3860 bound",()=>{
  const artifact=api.collectArtifacts({...SAMPLE,abi:[{type:"constructor",inputs:[{name:"huge",type:"bytes"}]}]})[0];
  assert.throws(()=>api.creationData(artifact,["0x"+"aa".repeat(49152)]),/49,152|supported size/);
});

test("runtime comparison honors only Solidity compiler-declared immutable locations",()=>{
  const expected="0x60000102aabbcc";
  const runtime="0x6000ffffaabbcc";
  const refs={"123":[{start:2,length:2}]};
  assert.deepEqual(JSON.parse(JSON.stringify(api.compareRuntime(runtime,expected,refs))),
    {status:"immutable-adjusted",ignoredBytes:2});
  assert.equal(api.compareRuntime(expected,expected,null).status,"exact");
  assert.equal(api.compareRuntime(runtime,expected,null).immutableReferencesMissing,true);
  assert.equal(api.compareRuntime("0x6100ffffaabbcc",expected,refs).status,"mismatch");
  assert.equal(api.compareRuntime("0x6000ffffaabb",expected,refs).status,"mismatch");
  assert.throws(()=>api.compareRuntime(runtime,expected,{"x":[{start:900,length:2}]}),/outside compiled runtime/);
  assert.throws(()=>api.compareRuntime(runtime,expected,{"x":[{start:2,length:2},{start:3,length:1}]}),/Overlapping/);
});
test("Solidity Standard JSON immutableReferences propagate to reviewed artifacts and receipts",async()=>{
  const refs={"97":[{start:1,length:1}]};
  const artifacts=api.collectArtifacts({contracts:{"Dict.sol":{Dict:{
    abi:[],evm:{bytecode:{object:"60006000"},deployedBytecode:{object:"600000",immutableReferences:refs}}
  }}}});
  assert.equal(JSON.stringify(artifacts[0].immutableReferences),JSON.stringify(refs));
  const p=mockedProvider();
  p.setReceipt({status:"0x1",blockNumber:"0x1",contractAddress:CONTRACT});
  // Mock getCode yields 0x6000 and compiled template is 0x600000, so length mismatch.
  const result=await api.checkReceipt(p,{hash:HASH,chainId:137,artifact:artifacts[0]});
  assert.equal(result.runtimeComparison.status,"mismatch");
  assert.equal(result.runtimeMatch,false);
});
test("read-only M64 inspector validates language, counts and snapshot digests without signing",async()=>{
  const selectors={
    "0x9bad6d4d":2,"0xa5c0def6":1,"0xe56be999":62,"0x2ac237df":24
  };
  const texts={"0x06fdde03":"M64 JS","0x95d89b41":"M64","0xed9978c7":"javascript",
    "0x6abe0c0c":"text/javascript","0x7284e416":"Dark Star"};
  const baseDigest="0x"+"a1".repeat(32),definitionDigest="0x"+"b2".repeat(32);
  const word=n=>BigInt(n).toString(16).padStart(64,"0");
  const str=s=>{
    const hex=Buffer.from(s,"utf8").toString("hex");
    return "0x"+word(32)+word(hex.length/2)+hex.padEnd(Math.ceil(hex.length/64)*64,"0");
  };
  const p=mockedProvider(),request=p.request.bind(p);
  p.request=async({method,params})=>{
    if(method!=="eth_call")return request({method,params});
    p.calls.push(method);
    const key=params[0].data.slice(0,10);
    if(key in selectors)return "0x"+word(selectors[key]);
    if(key in texts)return str(texts[key]);
    if(key==="0x67718087")return baseDigest;
    if(key==="0x9ab0fb6e")return definitionDigest;
    if(key==="0xddbbe90b")return params[0].data.endsWith(word(0))?baseDigest:definitionDigest;
    throw Error("Unexpected selector: "+key);
  };
  const info=await api.inspectM64Dictionary(p,CONTRACT,137);
  assert.equal(info.consistent,true);
  assert.equal(info.primaryCount,62);
  assert.equal(info.secondaryCount,24);
  assert.equal(info.language,"javascript");
  assert.equal(info.mediaType,"text/javascript");
  assert.equal(info.snapshotDigest,definitionDigest);
  assert.ok(p.calls.includes("eth_call"));
  assert.ok(!p.calls.includes("eth_sendTransaction"));
  p.setChain("0x1");
  await assert.rejects(api.inspectM64Dictionary(p,CONTRACT,137),/expected 137/);
});
