import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const window={};
vm.runInNewContext(await readFile(new URL('../chisel.bsv.media.js',import.meta.url),'utf8'),{window,TextDecoder});
const api=window.CHISEL_BSV_MEDIA;
const payload=JSON.stringify({protocol:'indelible.claude-code',encrypted:[12,16,12559].map(n=>Buffer.alloc(n,42).toString('base64')).join(':'),wrap_owner:'synthetic-owner-wrap'});
const buf=Buffer.from(payload), len=Buffer.alloc(2);len.writeUInt16LE(buf.length);
const marker=Buffer.from('BSVWRAPPER_MERKLE_E').toString('hex');
const hex='006a13'+marker+'4d'+len.toString('hex')+buf.toString('hex');
test('encrypted wrapper preserves exact envelope and summarizes only metadata',()=>{
 const raw={vout:[{n:0,scriptPubKey:{hex}}]};
 const f=api.files(raw)[0], summary=api.summarize(raw).files[0];
 assert.equal(f.name,'Indelible · Claude Code');
 assert.equal(f.metadata.ciphertextBytes,12559);
 assert.equal(f.metadata.validEnvelope,true);
 assert.equal(Buffer.from(f.data).toString(),payload);
 assert.equal(summary.data,undefined);
 assert.ok(!JSON.stringify(summary).includes('synthetic-owner-wrap'));
 assert.equal(api.encryptedFiles({scriptPubKey:{hex:hex.slice(0,-20)}},0)[0].complete,false);
 assert.equal(api.files({vout:[{scriptPubKey:{hex:hex.replace(marker,'00'.repeat(19))}}]}).length,0);
});
test('portal does not insert encrypted raw transaction JSON into the document',async()=>{
 const portal=await readFile(new URL('../chisel.portal.js',import.meta.url),'utf8');
 assert.match(portal,/Download encrypted envelope/);
 assert.match(portal,/if \(!encryptedFiles.length\) dataContainer.appendChild\(makeInlinePre/);
});
