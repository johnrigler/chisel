import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const window={};vm.runInNewContext(await readFile(new URL('../chisel.bsv.media.js',import.meta.url),'utf8'),{window,TextDecoder});
const api=window.CHISEL_BSV_MEDIA;
const tx='e8f394c79169cad3f6cbdf9889c1eca2dfde773bf778f6b3e02cb997b4e1c46e', file={protocol:'1Sat Ordinals',output:0};
const map=[{protocol:'MAP',fields:[{key:'app',value:'Zoide'},{key:'type',value:'ordinal_mint'}]}];
test('external destinations use inscription output and recognized mint application',()=>{
 const links=api.externalLinks('bsv',tx,file,map);
 assert.equal(links.length,2);
 assert.equal(links[0].url,'https://1sat.market/outpoint/'+tx+'_0/timeline');
 assert.equal(links[1].url,'https://zoide.io/market/inscription/'+tx+'_0');
 assert.equal(api.externalLinks('bsv',tx,file,[]).length,1);
 assert.equal(api.externalLinks('bsvTestnet',tx,file,map).length,0);
 assert.equal(api.externalLinks('bsv','invalid',file,map).length,0);
 assert.equal(api.externalLinks('bsv',tx,{protocol:'B',output:0},map).length,0);
 assert.equal(api.externalLinks('bsv',tx,{...file,output:-1},map).length,0);
});
