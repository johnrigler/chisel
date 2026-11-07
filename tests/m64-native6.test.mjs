import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
await import("../tools/m64Artifact/m64.js");
await import("../tools/m64Artifact/m64.javascript.js");
await import("../tools/m64Artifact/m64.native6.js");
await import("../tools/m64Artifact/seeds/darkstar-native6-v1.js");
const M=globalThis.ChiselM64Native6;
const make=globalThis.ChiselM64Native6DarkStarSeed.create;
const B=text=>new TextEncoder().encode(text);
const same=(a,b)=>assert.deepEqual([...a],[...b]);
test("native six-bit canonical Dark Star roundtrips with the fixed initial vocabulary",async()=>{
 const src=await readFile(new URL("../tools/m64Artifact/examples/darkstar-core.js",import.meta.url),"utf8");
 const canonical=globalThis.ChiselM64.canonicalizeJavascriptV1(src,"darkStar=a\nmod=m\nputPixel=q\ndrawLine=l");
 assert.equal(canonical.length,920);
 const dictionary=make();
 assert.equal(dictionary.primary.length,62);
 assert.equal(dictionary.secondary.length,24);
 const built=M.encode(B(canonical),dictionary);
 same(M.decode(built.wire,dictionary),B(canonical));
 assert.equal(built.wire.length,413);
 assert.ok(built.symbolCount>0);
 assert.equal(M.readUint(built.wire).value,built.symbolCount);
 assert.equal(dictionary.descriptor.mediaType,"text/javascript");
});
test("format-agnostic arbitrary UTF-8 and opaque binary lossless roundtrip",()=>{
 const d=make();
 for(const data of [B('{"type":"json","count":2,"nested":{"hello":true}}'),B("<span>Héllo 世界</span>"),B("def f(x):\n    return x + 2\n"),Uint8Array.of(0,1,2,63,64,127,128,254,255),new Uint8Array(0)]){
  const e=M.encode(data,d);
  same(M.decode(e.wire,d),data);
 }
});
test("secondary M64 definitions can include earlier secondary references",()=>{
 const d={primary:Array.from({length:62},(_,i)=>Uint8Array.of(i+1)),secondary:[
   {symbolCount:3,packed:M.packSymbols([0,1,2])},
   {symbolCount:2,packed:M.packSymbols([63,0])}
 ]};
 const prepared=M.prepareDictionary(d);
 same(prepared.expanded[0],Uint8Array.of(1,2,3));
 same(prepared.expanded[1],Uint8Array.of(1,2,3));
 const raw=Uint8Array.of(1,2,3,1,2,3,0,255);
 same(M.decode(M.encode(raw,d).wire,d),raw);
});
test("cycle, bad padding, malformed indices and truncation fail closed",()=>{
 const d={primary:Array.from({length:62},(_,i)=>Uint8Array.of(i+1)),secondary:[]};
 assert.throws(()=>M.prepareDictionary({...d,secondary:[{packed:M.packSymbols([63,0]),symbolCount:2}]}),/forward secondary reference/);
 assert.throws(()=>M.decode(Uint8Array.of(1,255),d),/Nonzero pad bits/);
 assert.throws(()=>M.decode(Uint8Array.of(1),d),/Wrong six-bit symbol count/);
 assert.throws(()=>M.decode(Uint8Array.of(2,...M.packSymbols([63,0])),d),/forward secondary reference/);
 assert.throws(()=>M.prepareDictionary({...d,secondary:[{packed:Uint8Array.of(255),symbolCount:1}]}),/Nonzero pad bits/);
 assert.throws(()=>M.prepareDictionary({...d,secondary:[{packed:M.packSymbols([62]),symbolCount:1}]}),/Truncated literal/);
});
test("wire never serializes the input as JSON or Base64 text",()=>{
 const raw=B('{"sample":true}');
 const wire=M.encode(raw,make()).wire;
 same(M.decode(wire,make()),raw);
 assert.notEqual(M.bytesHex(wire),M.bytesHex(raw));
 assert.ok(!new TextDecoder().decode(wire).includes('{"sample"'));
});

test("typed raw entries share the secondary index namespace with packed definitions",()=>{
 const dict={primary:Array.from({length:62},(_,i)=>Uint8Array.of(i+1)),secondary:[
  {kind:1,data:Uint8Array.of(0,128,255,4),symbolCount:0},
  {kind:0,packed:M.packSymbols([63,0,3]),symbolCount:3}
 ]};
 const prep=M.prepareDictionary(dict);
 same(prep.expanded[0],Uint8Array.of(0,128,255,4));
 same(prep.expanded[1],Uint8Array.of(0,128,255,4,4));
 const data=Uint8Array.of(0,128,255,4,4,0,128,255,4,4);
 const record=M.encode(data,dict);
 same(M.decode(record.wire,dict),data);
 assert.ok(record.symbols.includes(63));
});
test("malformed typed entries fail closed without changing the six-bit wire",()=>{
 const primary=Array.from({length:62},(_,i)=>Uint8Array.of(i+1));
 const d={primary,secondary:[]};
 assert.throws(()=>M.prepareDictionary({...d,secondary:[{kind:2,data:Uint8Array.of(1),symbolCount:0}]}),/Unknown secondary entry kind/);
 assert.throws(()=>M.prepareDictionary({...d,secondary:[{kind:1,data:Uint8Array.of(1),symbolCount:1}]}),/Invalid raw-byte dictionary entry/);
 assert.throws(()=>M.prepareDictionary({...d,secondary:[{kind:1,data:Uint8Array.of(),symbolCount:0}]}),/Invalid raw-byte dictionary entry/);
});
