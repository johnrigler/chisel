import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const window={};
vm.runInNewContext(await readFile(new URL('../chisel.bsv.media.js',import.meta.url),'utf8'),{window,TextDecoder});
const api=window.CHISEL_BSV_MEDIA;
const prefix='76a91422279c0922241838120eae3a7780bd6323e0eda888ac0063036f726451116d6f64656c2f676c74662d62696e617279004eb07e1400';
const map='006a223150755161374b36324d694b43747373534c4b79316b683536575755374d745552350353455403617070055a6f69646504747970650c6f7264696e616c5f6d696e740756657273696f6e027631';
test('Zoide transaction exact script prefix and MAP output',()=>{
 const raw={vout:[{n:0,scriptPubKey:{hex:prefix+'676c544602000000b07e1400781d00004a534f4e',isTruncated:true}},{n:3,scriptPubKey:{hex:map}}]};
 const result=api.summarize(raw);
 assert.equal(result.files[0].bytes,1343152);
 assert.equal(result.files[0].complete,false);
 assert.equal(result.files[0].mime,'model/gltf-binary');
 assert.equal(result.files[0].data,undefined);
 assert.equal(result.metadata[0].fields[1].value,'ordinal_mint');
 assert.equal(api.files({vout:[{scriptPubKey:{hex:raw.vout[0].scriptPubKey.hex}}]}).length,0);
});
test('complete GLB metadata and closing envelope',()=>{
 const obj=JSON.stringify({asset:{extras:{name:'Zoide #0216',collection:'Zoide 1000'}},meshes:[{}]});
 const json=Buffer.from(obj.padEnd(Math.ceil(obj.length/4)*4,' '));
 const head=Buffer.alloc(20); head.write('glTF'); head.writeUInt32LE(2,4); head.writeUInt32LE(20+json.length,8); head.writeUInt32LE(json.length,12); head.write('JSON',16);
 const payload=Buffer.concat([head,json]), len=Buffer.alloc(4);len.writeUInt32LE(payload.length);
 const hex=prefix.slice(0,-8)+len.toString('hex')+payload.toString('hex');
 const full=api.files({vout:[{scriptPubKey:{hex:hex+'68'}}]})[0];
 assert.equal(full.complete,true);assert.equal(full.name,'Zoide #0216');
 assert.equal(api.files({vout:[{scriptPubKey:{hex}}]}).length,0);
});
