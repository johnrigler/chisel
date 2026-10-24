import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../tools/certLedger/core.js',import.meta.url),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);const C=context.ChiselCertLedger;
const hash='0123456789abcdef'.repeat(4);

test('CertLedger handoff reconstructs the fixed tags and 71-byte ASCII without trusting imported outputs',()=>{
 const digest=C.fromDraft({schema:'chisel-certledger-anchor-v1',currency:'litecoin',network:'mainnet',sha256:hash,namespace:{address:C.ADDRESS},opReturnAscii:'sha256:'+hash,recipients:[{address:'attacker',amount:'999'}],wif:'must not reach Send'});
 const p=C.payload(digest,'0.00001000');
 assert.equal(p.currency,'litecoin');assert.equal(p.replaceRecipients,true);assert.equal(p.opReturnAscii,'sha256:'+hash);assert.equal(Buffer.byteLength(p.opReturnAscii),71);
 assert.deepEqual(Array.from(p.recipients,r=>r.address),[C.ROOT,C.ADDRESS]);
 assert.ok(p.recipients.every(r=>r.amount==='0.00001000'&&r.outputType==='unspendable'));
 assert.ok(!JSON.stringify(p).includes('attacker'));assert.ok(!JSON.stringify(p).includes('must not reach Send'));
 assert.throws(()=>C.payload(hash,'0.00000001'));assert.throws(()=>C.payload(hash,'1.00000000'));assert.throws(()=>C.digest('x'.repeat(64)));
 assert.throws(()=>C.fromDraft({schema:'chisel-certledger-anchor-v1',currency:'litecoin',network:'testnet'}));
});

test('the existing Send artifact loader accepts the CertLedger plan, replaces recipients and leaves signing to review',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const start=app.indexOf('  function loadArtifactPayload('),end=app.indexOf('  function loadPendingArtifactPayloadFromStorage()',start);
 const values={opReturnAscii:{value:'old',dispatchEvent(){}},opReturnHex:{value:'00',dispatchEvent(){}},recipientRows:{innerHTML:'old recipients'}};
 const calls={recipients:[]};
 const ctx=vm.createContext({elems:values,Event:class{},Number,Boolean,String,Array,
  setCurrencyValue:value=>calls.currency=value,addRecipientRow:(address,amount,options)=>calls.recipients.push({address,amount,options}),setSuggestedFeeValue:()=>{},setGuiMode:mode=>calls.mode=mode,setStatusMessage:message=>calls.status=message,
 });
 vm.runInContext(app.slice(start,end),ctx);
 assert.equal(ctx.loadArtifactPayload(C.payload(hash,'0.00001000'),'CertLedger'),true);
 assert.equal(calls.currency,'litecoin');assert.equal(calls.mode,'send');assert.equal(values.recipientRows.innerHTML,'');
 assert.equal(values.opReturnAscii.value,'sha256:'+hash);assert.equal(values.opReturnHex.value,'');assert.equal(calls.recipients.length,2);
 assert.match(calls.status,/review output order before signing/);
 // No signing, funding, network or broadcast methods exist in the fixture.
});

test('CertLedger review refreshes a changed URL fragment instead of retaining an earlier digest',async()=>{
 const ids=new Map(['sha256','load-send','payload','tag-amount','cost','status','draft-file'].map(id=>[id,{value:'',textContent:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}}]));
 ids.get('tag-amount').value='0.00001000';const events={};
 const location={hash:'#sha256='+hash};
 const ctx=vm.createContext({ChiselCertLedger:C,document:{getElementById:id=>ids.get(id)},location,URLSearchParams,window:{addEventListener(name,fn){events[name]=fn;}}});
 vm.runInContext(await readFile(new URL('../tools/certLedger/app.js',import.meta.url),'utf8'),ctx);
 assert.equal(ids.get('sha256').value,hash);
 const second='f'.repeat(64);location.hash='#sha256='+second;events.hashchange();
 assert.equal(ids.get('sha256').value,second);assert.equal(ids.get('payload').textContent,'sha256:'+second);
 location.hash='#sha256=invalid';events.hashchange();assert.equal(ids.get('load-send').disabled,true);
 location.hash='';events.hashchange();assert.equal(ids.get('sha256').value,'');assert.equal(ids.get('load-send').disabled,true);
});
