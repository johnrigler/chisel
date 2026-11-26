import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const window={CHISEL_PORTAL_STORE:{canonicalCoinForRow:r=>r.coin}};
for(const path of ['chisel.bsv.media.js','chisel.portal.explore.js'])vm.runInNewContext(await readFile(new URL('../'+path,import.meta.url),'utf8'),{window,TextDecoder});
const api=window.CHISEL_PORTAL_EXPLORE,parent='7a90cec7e748b65a9b938ed21cba9f2dbac483e5c6c41f6a9235115e9ce1426d',maphex='006a223150755161374b36324d694b43747373534c4b79316b683536575755374d745552350353455403617070055a6f69646504747970650c6f7264696e616c5f6d696e740756657273696f6e027631';
const rows=[0,1,2].map((v,i)=>({coin:'bsv',txid:String(i+1).repeat(64),raw:{vin:[{txid:parent,vout:v}],vout:[{n:3,scriptPubKey:{hex:maphex}}]},summary:{files:[{protocol:'1Sat Ordinals',mime:'model/gltf-binary',name:['Zoide #0321','Zoide #0216','Zoide #0104'][i],metadata:{collection:'Zoide 1000'}}]}}));
rows.push({coin:'bsv',txid:'4'.repeat(64),summary:{title:'Zoide mention only'}},{coin:'bsvTestnet',txid:'5'.repeat(64),raw:rows[0].raw,summary:rows[0].summary});
test('application, collection and parent facets isolate same-chain records',()=>{
 for(const facet of [{kind:'app',value:'Zoide'},{kind:'collection',value:'Zoide 1000'},{kind:'parent',value:parent}])assert.equal(api.search(rows,rows[0],{facet,type:'all'}).length,3);
 assert.equal(api.facts(rows[0]).name,'Zoide #0321 · 3D ordinal');
 assert.equal(api.facts(rows[0]).parents[0].vout,0);
 assert.equal(api.matchesFacet(rows[3],{kind:'app',value:'Zoide'}),false);
});
