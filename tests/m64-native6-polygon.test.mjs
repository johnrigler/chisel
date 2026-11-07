import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
import vm from "node:vm";
const root=new URL("../tools/m64Artifact/",import.meta.url);
const bytes=a=>"0x"+Buffer.from(a).toString("hex");
const ctx=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,BigInt});
ctx.globalThis=ctx;
for(const file of ["m64.native6.js","seeds/darkstar-native6-v1.js","m64.native6.polygon.js"])
  vm.runInContext(readFileSync(new URL(file,root),"utf8"),ctx,{filename:file});
const API=ctx.ChiselM64Native6Polygon,codec=ctx.ChiselM64Native6;
const seed=ctx.ChiselM64Native6DarkStarSeed.create();
const addr=API.DICTIONARY,chisel=API.CHISEL,txHash="0x"+"66".repeat(32);
const base="0x"+"bb".repeat(32),snap="0x"+"cc".repeat(32),topic="0x"+"ee".repeat(32);
const values=[
  "M64 JavaScript Dictionary","M64","javascript","text/javascript",
  "Dark Star Z six-bit M64 experiment; reusable JS source fragments"
];
const calls=[];
class FakeContract {
  constructor(address,abi,provider){this.address=address.toLowerCase();this.provider=provider;}
  async codecVersion(){return 2n}
  async dictionaryVersion(){return 1n}
  async primaryCount(){return 62n}
  async secondaryCount(){return 24n}
  async name(){return values[0]}
  async symbol(){return values[1]}
  async language(){return values[2]}
  async mediaType(){return values[3]}
  async description(){return values[4]}
  async primaryDigest(){return base}
  async definitionDigest(){return snap}
  async digestAtCount(n){return Number(n)===0?base:Number(n)===24?snap:"0x"+"00".repeat(32)}
  async primary(i){calls.push("p"+i);return bytes(seed.primary[Number(i)])}
  async entry(i){calls.push("s"+i);const entry=seed.secondary[Number(i)];return [0n,bytes(entry.packed),BigInt(entry.symbolCount)]}
}
class FakeInterface {
  encodeFunctionData(name,args){assert.equal(name,"logRecord");assert.equal(args[0],topic);return "0x56"}
  parseLog(log){return log.parsed}
}
const fakeE={Contract:FakeContract,BrowserProvider:class{},Interface:FakeInterface,id(name){assert.equal(name,API.FORMAT_NAME);return topic},ZeroHash:"0x"+"00".repeat(32)};
const provider={
  async getNetwork(){return {chainId:137n}},
  async getCode(address){assert.ok([addr.toLowerCase(),chisel.toLowerCase()].includes(address.toLowerCase()));return "0x6000"},
  async getTransaction(hash){assert.equal(hash,txHash);return {to:chisel}},
  async getTransactionReceipt(hash){
    assert.equal(hash,txHash);
    return {status:1,blockNumber:101,logs:[{
      address:chisel,parsed:{
        name:"RecordLogged",args:{format:topic,writer:"0x"+"aa".repeat(20),data:bytes(record)}
      }
    }]};
  },
  async estimateGas(obj){assert.equal(obj.to,chisel);assert.equal(obj.value,0n);return 123456n;}
};
let record=new Uint8Array(0);
test("real on-chain adapter reads and compares 62 primary and 24 secondary seed entries",async()=>{
 const v=await API.verifyDictionary(provider,{ethers:fakeE,seed,address:addr});
 assert.equal(v.codecVersion,2);
 assert.equal(v.snapshotCount,24);
 assert.equal(v.snapshotDigest,snap);
 assert.equal(calls.filter(x=>x[0]==="p").length,62);
 assert.equal(calls.filter(x=>x[0]==="s").length,24);
});
test("native M6P2 binary record roundtrips the seeded Dark Star source by byte and SHA-256",async()=>{
 const v=await API.verifyDictionary(provider,{ethers:fakeE,seed,address:addr});
 const source=new TextEncoder().encode("function darkStar(x){return x*2;}\n");
 const built=await API.prepare(source,v);
 record=built.record;
 const result=await API.rebuildRecord(record,v);
 assert.equal(result.sourceSha256,built.sourceSha256);
 assert.deepEqual([...result.source],[...source]);
 assert.notEqual(record[0],123); // not JSON source
 assert.equal(String.fromCharCode(...record.slice(0,4)),"M6P2");
 assert.equal(built.recordBytes,built.wireBytes+91); // header: 5 + 20 + 1 + 32 + 1 + 32
 assert.equal(result.address,addr);
 assert.equal(result.snapshotCount,24);
});
test("reads native Chisel log from chain 137 and reconstructs without executing the source",async()=>{
 const v=await API.verifyDictionary(provider,{ethers:fakeE,seed,address:addr});
 const source=new TextEncoder().encode("const x=1;\n");
 const built=await API.prepare(source,v);
 record=built.record;
 const published=await API.readReceipt(provider,txHash,v,{ethers:fakeE});
 assert.equal(published.verified,true);
 assert.equal(published.blockNumber,101);
 assert.deepEqual([...published.source],[...source]);
 const review=await API.previewPublish(provider,built,{ethers:fakeE,account:"0x"+"11".repeat(20)});
 assert.equal(review.to,chisel);
 assert.equal(review.gas,"123456");
 assert.equal(review.recordSha256,built.recordSha256);
});
test("rejects altered snapshot, byte count, checksum, truncated records, bad chain, wrong publisher",async()=>{
 const v=await API.verifyDictionary(provider,{ethers:fakeE,seed,address:addr});
 const source=new TextEncoder().encode("a=10;");
 const built=await API.prepare(source,v);
 const parsed=API.unpackRecord(built.record);
 assert.equal(parsed.sourceLength,source.length);
 const damaged=Uint8Array.from(built.record);
 damaged[27]^=1; // dictionary snapshot digest offset
 await assert.rejects(API.rebuildRecord(damaged,v),/snapshot/);
 const damagedHash=Uint8Array.from(built.record);
 damagedHash[62]^=1; // source SHA-256
 await assert.rejects(API.rebuildRecord(damagedHash,v),/SHA-256/);
 assert.throws(()=>API.unpackRecord(built.record.slice(0,10)),/Invalid|Truncated/);
 assert.throws(()=>API.unpackRecord(new Uint8Array(100)),/Invalid/);
 await assert.rejects(API.verifyDictionary({...provider,getNetwork:async()=>({chainId:1n})},{ethers:fakeE,seed,address:addr}),/expected Polygon 137/);
 const delegated={...provider,getTransaction:async()=>({to:addr})};
 record=built.record;
 const delegation=await API.readReceipt(delegated,txHash,v,{ethers:fakeE});
 assert.equal(delegation.direct,false);
 assert.equal(delegation.outerTo,addr);
 const wrong={...provider,getTransactionReceipt:async()=>({status:1,blockNumber:100,logs:[{
   address:addr,parsed:{name:"RecordLogged",args:{format:topic,writer:addr,data:bytes(built.record)}}
 }]})};
 await assert.rejects(API.readReceipt(wrong,txHash,v,{ethers:fakeE}),/Expected one native M64 record log/);
});
test("fails closed when an on-chain seed byte differs and when entries have the wrong kind",async()=>{
 class WrongSeed extends FakeContract {
   async primary(i){return Number(i)===3?"0xff":super.primary(i)}
 }
 class WrongKind extends FakeContract {
   async entry(i){return Number(i)===0?[1n,"0xff",0n]:super.entry(i)}
 }
 await assert.rejects(API.verifyDictionary(provider,{ethers:{...fakeE,Contract:WrongSeed},seed,address:addr}),/Primary dictionary entry 3 differs/);
 await assert.rejects(API.verifyDictionary(provider,{ethers:{...fakeE,Contract:WrongKind},seed,address:addr}),/Secondary entry 0 differs/);
});
test("native M64 source is opaque binary; cannot be fed as JSON or silently downgrade to legacy v3",async()=>{
 const v=await API.verifyDictionary(provider,{ethers:fakeE,seed,address:addr});
 const binary=Uint8Array.of(0,255,1,2,0,128);
 const built=await API.prepare(binary,v);
 const decoded=await API.rebuildRecord(built.record,v);
 assert.deepEqual([...decoded.source],[...binary]);
 assert.ok(!new TextDecoder().decode(built.record).includes("kind"));
 assert.equal(codec.decode(built.wire,v.dictionary).length,binary.length);
});
