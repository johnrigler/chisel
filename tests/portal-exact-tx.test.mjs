import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../chisel.portal.js', import.meta.url), 'utf8');
const start = source.indexOf('  function exactPortalSearchId(');
const end = source.indexOf('  let exactSearchSequence', start);
const id = '2a1d929620e0661c2f036d74aad5357dabc8725d128606a29ec9a5fa7370ad51';
function harness(staticResult) {
  const calls = [];
  const tx = {txid:id,vin:[],vout:[]};
  const context = {
    URL, window:{location:{href:'https://example.test/'},CHISEL_PORTAL_RECORD:{encodeTxid:()=> 'base58'}},
    getCoinIndexByCoinName:()=>({coin:'bsv'}), normalizeCoinName:x=>x,
    getStaticDataSources:()=>['https://example.test/data/'],
    staticData:{sourceLocation:x=>({baseUrl:x}),joinDataPath:(a,b)=>a+b},
    staticTransport:{
      fetchStaticRawFromRow:async row=>{calls.push(row.staticRawUrl);if(staticResult)return {json:tx,source:'static',url:row.staticRawUrl};throw Error('missing')},
      request:async (url,opts,read)=>{calls.push(url);return read({ok:true,json:async()=>tx})}
    },
    txObject:x=>x, extractTxid:x=>x.txid, extractSummary:()=>({title:'test'}), upsertPortalRow:x=>x
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start,end)+';globalThis.api={exactPortalSearchId,readExactBsvTransaction};',context);
  return {api:context.api,calls};
}
test('full hex and actual Twetch URL only',()=>{
  const {api}=harness(false);
  assert.equal(api.exactPortalSearchId(id.toUpperCase()),id);
  assert.equal(api.exactPortalSearchId('https://twetch.com/t/'+id),id);
  assert.equal(api.exactPortalSearchId('https://twetch.com.example/t/'+id),'');
  assert.equal(api.exactPortalSearchId('ordinary search words'),'');
});
test('static first, then BSV provider only on miss',async()=>{
  const cached=harness(true), live=harness(false);
  assert.equal((await cached.api.readExactBsvTransaction(id)).source,'static');
  assert.equal(cached.calls.length,2);
  assert.equal((await live.api.readExactBsvTransaction(id)).source,'live');
  assert.equal(live.calls[2],'https://api.whatsonchain.com/v1/bsv/main/tx/hash/'+id);
});
