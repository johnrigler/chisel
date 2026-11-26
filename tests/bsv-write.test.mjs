import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const coins={bsv:{NAME:"bsv",DISPLAY_NAME:"Bitcoin SV",CAN_SEND:false},bsvTestnet:{NAME:"bsvTestnet",DISPLAY_NAME:"Bitcoin SV Testnet",CAN_SEND:false},ravencoin:{NAME:"ravencoin",DISPLAY_NAME:"Ravencoin"}};
const window={CHISEL:{coins,getCoins:()=>Object.values(coins)}};
const context=vm.createContext({window,TextEncoder,TextDecoder,Uint8Array,DataView});
for(const path of ["chisel.send.registry.js","chisel.bsv.write.js","chisel.bsv.media.js"])vm.runInContext(fs.readFileSync(new URL("../"+path,import.meta.url),"utf8"),context);
const W=window.CHISEL_BSV_WRITE,M=window.CHISEL_BSV_MEDIA,R=window.CHISEL_SEND;
for(const n of [1,75,76,255,256,65535,65536,247193]){
  const bytes=new Uint8Array(n).fill(0xa5),o=W.build({content:bytes,mime:"image/png",filename:"test.png"});
  const f=M.fromOutput({n:0,scriptPubKey:{hex:o.scriptHex}},0)[0];
  assert.equal(f.bytes,n);assert.equal(f.name,"test.png");assert.equal(f.encoding,"");assert.ok(f.data.every(b=>b===0xa5));
  assert.equal(o.outputHex,"0000000000000000"+W.compactSize(o.scriptBytes)+o.scriptHex);
}
assert.equal(W.push(new Uint8Array(65536)).slice(0,10),"4e00000100");
assert.equal(W.compactSize(65536),"fe00000100");
assert.equal(R.get("bsv").canBroadcast,false);assert.equal(R.href("polygon"),"?mode=send&coin=evm&chain=137");
assert.ok(!R.get("ravencoin").formats.some(f=>f.id==="ipfs"));
assert.throws(()=>W.build({content:"",mime:"text/plain"}));
assert.throws(()=>W.build({content:"a",mime:"invalid"}));
console.log("BSV output roundtrip and Send registry checks passed");
