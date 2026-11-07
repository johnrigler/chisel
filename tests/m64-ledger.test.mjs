import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

await import('../tools/m64Artifact/m64.js');
await import('../tools/m64Artifact/m64.artifact.js');
await import('../tools/m64Artifact/m64.javascript.js');
await import('../tools/m64Artifact/m64.dictionary.js');
await import('../tools/m64Artifact/m64.v3.js');
await import('../tools/m64Artifact/m64.ledger.js');

const M=globalThis.ChiselM64;
const CARRIER='eip155:137:0x683cfa103fe5dbd0a47402d78fbf818d4160b1d3';
const DICT='eip155:137:0x522afe4f086da1df80531dea1e8793b05cace9cf';
const TEMPLATE='0x'+'12'.repeat(32);
const TEMPLATE_HASH='34'.repeat(32);
const FORMAT=M.M64_LEDGER_PROGRAM_FORMAT;

async function build(){
 const resolver=M.createMemoryDictionary({ref:DICT,language:'javascript'});
 const source='function darkStar(p){const v=p.width+p.height;return v+1}';
 const made=await M.buildJavascriptArtifactV3(source,{
  resolver,entry:'darkStar',identifierMap:'darkStar=a',
  input:{width:20,height:10}
 });
 return {source,resolver,...made};
}
function packageArtifact(artifact){
 return M.packLedgerProgram(artifact,{carrier:CARRIER,templateTx:TEMPLATE,templateSha256:TEMPLATE_HASH});
}

test('M64 transport uses 64 actual characters; expansion escape lives in binary dictionary stream',()=>{
 assert.equal(M.M64_V3_CODEC.alphabet.length,64);
 assert.equal(new Set(M.M64_V3_CODEC.alphabet).size,64);
 assert.equal(M.M64_V3_CODEC.alphabet.at(-1),'_');
 const decoded=Uint8Array.of(0x80,0xbf,0xc0,0x00,0xc0,0x01);
 assert.deepEqual(M.dictionaryIndexes(decoded),[0,63,64,65]);
 const asText=M.encode64(decoded,M.M64_V3_CODEC.alphabet);
 assert.deepEqual([...M.decode64(asText,M.M64_V3_CODEC.alphabet)],[...decoded]);
});

test('Chisel envelope v2 preserves M64 Base64url payload characters exactly in UTF-8 bytes',async()=>{
 const {artifact,canonical,resolver}=await build();
 const packed=packageArtifact(artifact);
 const decoded=M.unpackLedgerProgram(packed);
 assert.equal(FORMAT,'chisel-m64-program-v2');
 assert.equal(packed[0],0x43);
 assert.equal(packed[1],0x4d);
 assert.equal(packed[2],0x36);
 assert.equal(packed[3],0x34);
 assert.equal(packed[4],2);
 assert.equal(decoded.artifact.payload,artifact.payload);
 assert.equal(decoded.payloadEncoding,'m64-base64url-ascii');
 assert.equal(decoded.carrier,CARRIER);
 assert.equal(decoded.template.tx,TEMPLATE);
 assert.equal(decoded.artifact.dictionary.ref,DICT);
 const headerLength=new DataView(packed.buffer,packed.byteOffset,packed.byteLength).getUint32(5,false);
 const actualTail=new TextDecoder().decode(packed.subarray(9+headerLength));
 assert.equal(actualTail,artifact.payload);
 assert.equal(decoded.m64TextBytes,artifact.payload.length);
 const hydrated=await M.hydrateArtifactV3(decoded.artifact,resolver);
 assert.equal(hydrated.canonical,canonical);
 assert.equal(hydrated.sha256,artifact.sha256);
});

test('Chisel ledger record rejects altered payload characters and wrong metadata',async()=>{
 const {artifact}=await build();
 const packed=packageArtifact(artifact);
 const headerLength=new DataView(packed.buffer,packed.byteOffset,packed.byteLength).getUint32(5,false);
 const tampered=new Uint8Array(packed);
 tampered[9+headerLength]='!'.charCodeAt(0);
 assert.throws(()=>M.unpackLedgerProgram(tampered),/M64|alphabet|noncanonical/i);
 const wrongVersion=new Uint8Array(packed);
 wrongVersion[4]=1;
 assert.throws(()=>M.unpackLedgerProgram(wrongVersion),/magic\/version/);
 const unsupported=new Uint8Array(packed);
 unsupported.set([0,0,0,0],0);
 assert.throws(()=>M.unpackLedgerProgram(unsupported),/magic\/version/);
});

test('compression report distinguishes internal abstract bytes, published M64 text and full envelope',async()=>{
 const {source,artifact}=await build();
 const ledger=packageArtifact(artifact);
 const info=M.m64CompressionReport(source,artifact,ledger.length);
 assert.equal(info.sourceBytes,new TextEncoder().encode(source).length);
 assert.equal(info.m64Characters,artifact.payload.length);
 assert.equal(info.payloadTextBytes,artifact.payload.length);
 assert.equal(info.rawPayloadBytes,M.decode64(artifact.payload,M.M64_V3_CODEC.alphabet).length);
 assert.equal(info.ledgerRecordBytes,ledger.length);
 assert.ok(Math.abs(info.envelopeSavingsPct-100*(1-ledger.length/info.sourceBytes))<1e-9);
 assert.ok(ledger.length>artifact.payload.length);
});

test('standalone renderer template contains landscape controls and all three replacement markers',async()=>{
 const html=await readFile(new URL('../tools/m64Artifact/examples/darkstar-ledger-template.html',import.meta.url),'utf8');
 for(const token of ['__CHISEL_SOURCE_JSON__','__CHISEL_ENTRY_JSON__','__CHISEL_INPUT_JSON__'])
  assert.equal(html.split(token).length-1,1);
 for(const token of ['Landscape controls','Save PNG','Save parameters','sandbox','Render'])
  assert.ok(html.includes(token),token);
});
