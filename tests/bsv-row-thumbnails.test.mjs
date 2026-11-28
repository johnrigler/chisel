import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const portal = await readFile(new URL('../chisel.portal.js', import.meta.url), 'utf8');
const helper = portal.slice(portal.indexOf('  const bsvRowThumbnails ='), portal.indexOf('  function appendRowThumbnail('));
test('BSV thumbnails resize decoded images, retrieve incomplete bytes and revoke source URLs', async () => {
  const raw = {}, row = {raw, txid: 'a'.repeat(64)};
  const partial = {mime:'image/png', complete:false};
  let fetched = 0, revoked = 0, canvas;
  const context = {
    window: {fetch(){}, CHISEL_BSV_MEDIA: {
      files: value => {assert.equal(value, raw); return [{mime:'model/gltf-binary'},partial];},
      loadFile: async (coin,id,file) => {assert.equal(coin,'bsv');assert.equal(id,row.txid);assert.equal(file,partial);fetched++;return {mime:'image/png',data:new Uint8Array([1])};}
    }},
    canonicalCoinForRow: () => 'bsv', AbortSignal, Blob,
    URL: {createObjectURL: () => 'blob:test',revokeObjectURL: () => revoked++},
    document: {createElement: tag => tag === 'img' ? {naturalWidth:1000,naturalHeight:500,decode:async()=>{}} :
      (canvas = {getContext:()=>({drawImage(){}}),toDataURL:()=> 'data:image/png;base64,test'})}
  };
  vm.createContext(context);
  vm.runInContext(helper,context);
  assert.equal(await context.makeBsvRowThumbnail(row),'data:image/png;base64,test');
  assert.equal(fetched,1);assert.equal(revoked,1);
  assert.equal(canvas.width,208);assert.equal(canvas.height,104);
});
test('BSV thumbnails participate in collapsed feed rendering and display invalidation', () => {
  assert.match(portal,/function appendRowThumbnail\(cell, row\) \{\s*const bsvThumbnail = bsvThumbnailForRow\(row\)/);
  assert.match(portal,/JSON\.stringify\(\[bsvThumbnailForRow\(row\), row\.raw/);
  assert.match(portal,/genericTitle && thumb\.classList\.contains\("isEmpty"\)/);
  assert.match(portal,/scheduleVisibleBsvThumbnails\(pageRows\);/);
});

test('persistent thumbnail keys separate BSV networks and cache only small PNG previews', async () => {
  const context = vm.createContext({canonicalCoinForRow: row => row.coin});
  vm.runInContext(helper, context);
  const items = new Map(), writes = [];
  let hits = 0;
  const cache = {get: async key => items.get(key), hit: () => hits++,
    put: async (key,text,group,generation) => {writes.push({key,group,generation});items.set(key,{text});}};
  const row = {coin:'bsv',txid:'a'.repeat(64)}, testnet = {...row,coin:'bsvTestnet'};
  const png = 'data:image/png;base64,AAAA';
  await context.saveCachedBsvThumbnail(row,cache,png,7);
  assert.equal(writes[0].group,'thumbnail');assert.equal(writes[0].generation,7);
  assert.equal(await context.readCachedBsvThumbnail({...row,raw:null},cache),png);
  assert.equal(await context.readCachedBsvThumbnail(testnet,cache),'');
  assert.equal(hits,1);
  await context.saveCachedBsvThumbnail(row,cache,'data:image/svg+xml;base64,AAAA',7);
  await context.saveCachedBsvThumbnail(row,cache,'data:image/png;base64,'+'A'.repeat(262144),7);
  assert.equal(writes.length,1);
});
test('the visible thumbnail scheduler reads the persistent cache before hydrating transaction data', () => {
  assert.ok(helper.indexOf('const cached = await readCachedBsvThumbnail(row, dataCache)') <
    helper.indexOf('await hydratePortalRow(row.key'));
  assert.match(helper,/if \(cached\) \{[\s\S]*?return;/);
});
