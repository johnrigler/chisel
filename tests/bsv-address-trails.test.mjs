import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const window={CHISEL_PORTAL_STORE:{canonicalCoinForRow:r=>r.coin}};
for(const path of ['chisel.bsv.media.js','chisel.portal.explore.js'])vm.runInNewContext(await readFile(new URL('../'+path,import.meta.url),'utf8'),{window,TextDecoder});
const api=window.CHISEL_PORTAL_EXPLORE;
const signer='1Mg2Zb2VbidHmJh9ZEXLaYKGndVEierdWt',word='1AxSECRETxBEACHxSoLUTioNSzzzRf6MZh';
const metadata=[{protocol:'AIP',fields:[{key:'signing address',value:signer}]}];
const raw={vin:[{prevout:{scriptPubKey:{addresses:[signer]}}}],vout:[{n:2,scriptPubKey:{addresses:[word,signer]}},{n:3,scriptPubKey:{address:'not an address'}}]};
test('address evidence combines roles without asserting ownership',()=>{
 const trails=api.addressTrails(raw,metadata,'bsv');
 assert.equal(trails.length,2);
 assert.equal(trails[0].roles.join('|'),'input 0 prevout|output 2|AIP signer (unverified)');
 assert.equal(trails[1].wordCandidate,true);
 assert.equal(api.addressExplorerLinks('bsv',word).length,3);
 assert.equal(api.addressExplorerLinks('bsvTestnet',word).length,0);
 assert.equal(api.addressExplorerLinks('bsv','javascript:alert(1)').length,0);
});
test('address facet is case-sensitive and limited to the current ledger',()=>{
 const row={coin:'bsv',txid:'a'.repeat(64),raw,summary:{metadata}};
 const other={coin:'bsv',txid:'b'.repeat(64),raw:{vout:[{scriptPubKey:{address:word.toLowerCase()}}]}};
 const btc={...row,coin:'bitcoin'};
 assert.equal(api.search([row,other,btc],row,{facet:{kind:'address',value:word},type:'all'}).length,1);
 assert.equal(api.matchesFacet(row,{kind:'address',value:signer}),true);
 assert.equal(api.matchesFacet({coin:'bsv',summary:{metadata}},{kind:'address',value:signer}),true);
});
