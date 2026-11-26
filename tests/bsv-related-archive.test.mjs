import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const window={CHISEL_PORTAL_STORE:{canonicalCoinForRow:r=>r.coin}};
for(const name of ['chisel.bsv.media.js','chisel.portal.explore.js'])vm.runInNewContext(await readFile(new URL('../'+name,import.meta.url),'utf8'),{window,TextDecoder});
const id='7a90cec7e748b65a9b938ed21cba9f2dbac483e5c6c41f6a9235115e9ce1426d',path=window.CHISEL_BSV_MEDIA.archivePath('bsv',id);
const raw=JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
test('archived parent has correct hash and MAP application',()=>{
 const sha=b=>createHash('sha256').update(b).digest();
 assert.equal(sha(sha(Buffer.from(raw.hex,'hex'))).reverse().toString('hex'),id);
 assert.equal(raw.vin.length,16);assert.equal(raw.vout.length,12);
 assert.equal(window.CHISEL_PORTAL_EXPLORE.facts({coin:'bsv',txid:id,raw}).name,'Zoide · bulk payment');
 assert.equal(window.CHISEL_BSV_MEDIA.archivePath('bsvTestnet',id),'');
});
