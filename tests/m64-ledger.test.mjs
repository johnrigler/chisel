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

test('CM64 v3 is compact binary: native addresses, hashes, and dictionary stream, no JSON',async()=>{
 const {artifact,canonical,resolver}=await build();
 const packed=packageArtifact(artifact);
 const decoded=M.unpackLedgerProgram(packed);
 const raw=M.decode64(artifact.payload,M.M64_V3_CODEC.alphabet);
 assert.equal(FORMAT,'chisel-m64-program-v3');
 assert.deepEqual([...packed.subarray(0,5)],[0x43,0x4d,0x36,0x34,3]);
 assert.equal(decoded.version,3);
 assert.equal(decoded.payloadEncoding,'m64-binary');
 assert.equal(decoded.rawPayloadBytes,raw.length);
 assert.deepEqual([...packed.subarray(packed.length-raw.length)],[...raw]);
 assert.equal(decoded.artifact.payload,artifact.payload);
 assert.deepEqual(decoded.artifact.input,artifact.input);
 assert.equal(decoded.carrier,CARRIER);
 assert.equal(decoded.template.tx,TEMPLATE);
 assert.equal(decoded.template.sha256,TEMPLATE_HASH);
 assert.equal(decoded.artifact.dictionary.ref,DICT);
 assert.equal(decoded.artifact.entry,artifact.entry);
 assert.equal(decoded.artifact.sha256,artifact.sha256);
 assert.equal(decoded.artifact.canonicalBytes,artifact.canonicalBytes);
 assert.ok(packed.length>raw.length);
 assert.equal(new TextDecoder().decode(packed).includes('"kind"'),false);
 const hydrated=await M.hydrateArtifactV3(decoded.artifact,resolver);
 assert.equal(hydrated.canonical,canonical);
 assert.equal(hydrated.sha256,artifact.sha256);
});

test('CM64 v3 supports no input, compact known numeric schema, and generic numeric maps',async()=>{
 const {artifact}=await build();
 const withoutInput={...artifact};
 delete withoutInput.input;
 const plain=M.unpackLedgerProgram(packageArtifact(withoutInput)).artifact;
 assert.equal(Object.hasOwn(plain,'input'),false);
 const sparse={...artifact,input:{x0:1,y0:-2,x1:255,y1:123456}};
 const bytes=packageArtifact(sparse);
 assert.deepEqual(M.unpackLedgerProgram(bytes).artifact.input,sparse.input);
 assert.throws(()=>packageArtifact({...artifact,input:{foo:"not numeric"}}),/safe integer|numeric/i);
 assert.throws(()=>packageArtifact({...artifact,input:{not_safe:2**53}}),/safe integer|numeric/i);
});

test('CM64 v3 rejects truncation, unsupported versions, and noncanonical varints',async()=>{
 const {artifact}=await build();
 const packed=packageArtifact(artifact);
 const unsupported=new Uint8Array(packed);unsupported[4]=1;
 assert.throws(()=>M.unpackLedgerProgram(unsupported),/magic\/version/);
 const corrupt=new Uint8Array(packed);corrupt[0]=0;
 assert.throws(()=>M.unpackLedgerProgram(corrupt),/magic\/version/);
 assert.throws(()=>M.unpackLedgerProgram(packed.subarray(0,18)),/Truncated/);
 const noncanonical=new Uint8Array([...packed.subarray(0,5),0x89,0x00,...packed.subarray(6)]);
 assert.throws(()=>M.unpackLedgerProgram(noncanonical),/Noncanonical/);
});

test('old CM64 envelope version is deliberately not supported',async()=>{
 const {artifact}=await build();
 const v3=packageArtifact(artifact);
 const old=new Uint8Array(v3);
 old[4]=2;
 assert.throws(()=>M.unpackLedgerProgram(old),/binary v3 required/);
 assert.equal(typeof M.packLedgerProgramV2,'undefined');
 assert.equal(typeof M.M64_LEDGER_PROGRAM_FORMAT_V2,'undefined');
});
test('compression report counts binary M64 bytes and full record separately from transport text',async()=>{
 const {source,artifact}=await build();
 const ledger=packageArtifact(artifact);
 const info=M.m64CompressionReport(source,artifact,ledger.length);
 assert.equal(info.sourceBytes,new TextEncoder().encode(source).length);
 assert.equal(info.m64Characters,artifact.payload.length);
 assert.equal(info.payloadTextBytes,artifact.payload.length);
 assert.equal(info.rawPayloadBytes,M.decode64(artifact.payload,M.M64_V3_CODEC.alphabet).length);
 assert.equal(info.ledgerRecordBytes,ledger.length);
 assert.ok(Math.abs(info.envelopeSavingsPct-100*(1-ledger.length/info.sourceBytes))<1e-9);
 assert.ok(ledger.length>info.rawPayloadBytes);
});

test('standalone renderer template contains landscape controls and all three replacement markers',async()=>{
 const html=await readFile(new URL('../tools/m64Artifact/examples/darkstar-ledger-template.html',import.meta.url),'utf8');
 for(const token of ['__CHISEL_SOURCE_JSON__','__CHISEL_ENTRY_JSON__','__CHISEL_INPUT_JSON__'])
  assert.equal(html.split(token).length-1,1);
 for(const token of ['Landscape controls','Save PNG','Save parameters','sandbox','Render'])
  assert.ok(html.includes(token),token);
});

test('read-only M64 build uses existing dictionary entries without writing or dropping missing words',async()=>{
 const resolver=M.createMemoryDictionary({ref:DICT,language:'javascript',terms:['function','return','const']});
 const source='function f(x){const thing=x+1;return thing}';
 const before=resolver.snapshotTerms();
 const built=await M.buildJavascriptArtifactV3(source,{resolver,entry:'f',identifierMap:'f=a',learn:false});
 assert.deepEqual(resolver.snapshotTerms(),before);
 assert.deepEqual([...built.resolvedTerms.keys()],['function','const','return']);
 assert.ok(built.missingTerms.includes('thing'));
 const decoded=await M.hydrateArtifactV3(built.artifact,resolver);
 assert.equal(decoded.canonical,built.canonical);
 assert.equal(decoded.sha256,built.artifact.sha256);
});

test('empty dictionary compresses read-only with literals and never appends',async()=>{
 const resolver=M.createMemoryDictionary({ref:DICT,language:'javascript'});
 const source='function f(x){return x+17}';
 const built=await M.buildJavascriptArtifactV3(source,{resolver,entry:'f',identifierMap:'f=a',learn:false});
 assert.equal(resolver.snapshotTerms().length,0);
 assert.equal(built.resolvedTerms.size,0);
 assert.ok(built.missingTerms.includes('function'));
 assert.ok(built.missingTerms.includes('return'));
 const decoded=await M.hydrateArtifactV3(built.artifact,resolver);
 assert.equal(decoded.canonical,built.canonical);
});

test('new ledger envelope size is predictable before the renderer transaction is published',async()=>{
 const {artifact}=await build();
 const before=M.packLedgerProgram(artifact,{
  carrier:CARRIER,templateTx:'0x'+'0'.repeat(64),templateSha256:'0'.repeat(64)
 });
 const after=packageArtifact(artifact);
 assert.equal(before.length,after.length);
 const report=M.m64CompressionReport('function f(){}',artifact,before.length);
 assert.equal(report.ledgerRecordBytes,before.length);
 assert.equal(report.envelopeSavingsPct,100*(report.sourceBytes-before.length)/report.sourceBytes);
});

test('workbench surfaces both contract inputs, read-only compression and full-record metrics',async()=>{
 const html=await readFile(new URL('../tools/m64Artifact/dark-star-z.html',import.meta.url),'utf8');
 for(const required of ['id="dictionary"','id="chiselAddress"','id="dictEntries"','id="dictNext"',
   'id="extendDictionary"','learn:false','Projected','calldataSavingsPct','id="publishProgram"'])
   assert.ok(html.includes(required),required);
});

test('diagnostic savings and gas analysis stay in UI, never in the record bytes',async()=>{
 const html=await readFile(new URL('../tools/m64Artifact/dark-star-z.html',import.meta.url),'utf8');
 const record=await readFile(new URL('../tools/m64Artifact/m64.ledger.js',import.meta.url),'utf8');
 assert.ok(html.includes('S("unsignedTx").value=JSON.stringify(unsigned,null,2);'));
 assert.ok(html.includes('Screen-only diagnostics: percentages and gas estimates are not transmitted.'));
 assert.ok(html.includes('M64 binary payload:'));
 assert.ok(html.includes('On-chain CM64 v3 stores binary program bytes'));
 assert.ok(html.includes('const summary={kind,format,chainId'));
 assert.ok(record.includes('const out=[...MAGIC,BINARY_VERSION]'));
 const v3=record.substring(record.indexOf('function packLedgerProgram(artifact,options={})'),
   record.indexOf('function unpackLedgerProgramV3(value)'));
 assert.ok(!v3.includes('JSON.stringify'));
 assert.ok(!v3.includes('calldataSavingsPct'));
});

test('workbench distinguishes unsigned previews from mined renderer-template transaction hashes',async()=>{
 const html=await readFile(new URL('../tools/m64Artifact/dark-star-z.html',import.meta.url),'utf8');
 assert.ok(html.includes('A preview is not a mined Polygon transaction'));
 assert.ok(html.includes('if(kind==="program"&&!TX_HASH_RE.test(S("templateTx").value.trim()))'));
 assert.ok(html.includes('await prepareChiselTransaction("template")'));
 assert.ok(html.includes('RENDERER PREVIEW READY (NOT BROADCAST)'));
 assert.ok(html.includes('rememberConfirmedTemplateTx(receipt.txHash)'));
 assert.ok(html.includes('getRememberedTemplateTx()'));
 assert.ok(html.includes('The unsigned preview is not a published transaction'));
});

test('EVM addresses and transaction hash fields use fixed-width presentation across tools',async()=>{
 const root=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(root.includes('select[id*="address" i] option'));
 assert.ok(root.includes('font-variant-ligatures: none'));
 const html=await readFile(new URL('../tools/m64Artifact/dark-star-z.html',import.meta.url),'utf8');
 for(const id of ['dictionary','chiselAddress','templateTx','programTx']){
  assert.ok(html.includes('data-fixed-width id="'+id+'"'),id);
 }
 assert.ok(html.includes('font-kerning:none'));
 for(const path of ['dictionary-polygon.html','packet-polygon.html']){
  const tool=await readFile(new URL('../tools/m64Artifact/'+path,import.meta.url),'utf8');
  assert.ok(tool.includes('font-variant-ligatures:none'),path);
 }
});

test('outer workbench iframe forwards known contract and transaction query fields',async()=>{
 const html=await readFile(new URL('../tools/m64Artifact/index.html',import.meta.url),'utf8');
 assert.ok(html.includes('darkstarWorkbench'));
 assert.ok(html.includes('"templateTx","programTx"'));
});
