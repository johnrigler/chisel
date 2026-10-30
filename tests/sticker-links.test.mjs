import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const helper=await readFile(new URL('../chisel.stickers.js',import.meta.url),'utf8');
const landing=await readFile(new URL('../sticker.js',import.meta.url),'utf8');
const id='0123456789abcdef';
function fixture({href='https://local.example/ipfs/bafyfixture/sticker.html#sticker='+id,entry=false,saved=new Map(),blocked=false}={}) {
  const nodes=new Map(),navigations=[];
  for(const name of ['status','public-page','private-key','sticker-id','swatch']) nodes.set(name,{textContent:'',style:{},disabled:true,listeners:{},addEventListener(type,handler){this.listeners[type]=handler;}});
  const context=vm.createContext({URL,URLSearchParams,
    document:{currentScript:{hasAttribute:()=>entry},getElementById:name=>nodes.get(name)},
    location:{href,replace:target=>navigations.push(target)},
    localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>{if(blocked)throw Error('blocked');saved.set(key,value);}},
  });
  vm.runInContext(helper,context);
  return {context,nodes,navigations,saved,C:context.ChiselSticker,load:()=>vm.runInContext(landing,context)};
}

test('eight-byte sticker links round-trip, keep the ID out of the request, and accept legacy raw hex',()=>{
  const {C}=fixture();const url=new URL(C.url(id));
  assert.equal(url.origin+url.pathname,'https://johnrigler.github.io/chisel/');
  assert.equal(url.search,'');assert.equal(url.hash,'#sticker='+id.toUpperCase());
  for(const value of [url.href,id.toUpperCase(),'0x'+id,'https://custom.example/ipfs/cid/#sticker='+id,'http://localhost:8000/?sticker='+id])assert.equal(C.parse(value),id);
  for(const value of ['',id.slice(1),id+'0',id.repeat(4),'javascript:alert(1)#sticker='+id,'https://user:secret@example.test/#sticker='+id,'https://example.test/?sticker='+id+'#sticker='+id])assert.equal(C.parse(value),'');
});

test('main-page entry sends only a validated sticker and currency to the local landing page',()=>{
  const f=fixture({href:'https://custom.example/ipfs/cid/?currency=digibyte#sticker='+id,entry:true});
  const next=new URL(f.navigations[0]);
  assert.equal(next.pathname,'/ipfs/cid/sticker.html');
  assert.equal(next.searchParams.get('currency'),'digibyte');
  assert.equal(f.C.parse(next.href),id);
  assert.equal(fixture({href:'https://custom.example/?mode=portal',entry:true}).navigations.length,0);
});

test('opening the public page persists the exclusion, and later visits cannot start a private scan',()=>{
  const f=fixture();f.load();
  assert.equal(f.nodes.get('private-key').disabled,false);
  f.nodes.get('public-page').listeners.click();
  const next=new URL(f.navigations[0]);
  assert.equal(next.pathname,'/ipfs/bafyfixture/tools/recorder/index.html');
  assert.equal(next.searchParams.get('scanMode'),'artifact1');
  assert.equal(new URLSearchParams(next.hash.slice(1)).get('open'),'1');
  const again=fixture({saved:f.saved});again.load();
  assert.equal(again.nodes.get('private-key').disabled,true);
  assert.throws(()=>again.C.assertPrivate('1'.repeat(16)+id+'2'.repeat(32)),/used publicly/);
  assert.equal(again.C.parse(again.C.url(id)),id);
});

test('continuing a private scan carries only the first fragment and does not mark it public',()=>{
  const f=fixture();f.load();f.nodes.get('private-key').listeners.click();
  const next=new URL(f.navigations[0]);
  assert.equal(next.searchParams.get('scanMode'),'key4');
  assert.equal(f.C.parse(next.href),id);assert.equal(f.saved.size,0);
  assert.doesNotThrow(()=>f.C.assertPrivate(id));
});

test('invalid links and failed public-use storage stay on the landing page',()=>{
  const bad=fixture({href:'https://local.example/sticker.html#sticker=xyz'});bad.load();
  assert.equal(bad.nodes.get('public-page').disabled,true);assert.equal(bad.navigations.length,0);
  const blocked=fixture({blocked:true});blocked.load();blocked.nodes.get('public-page').listeners.click();
  assert.equal(blocked.navigations.length,0);assert.match(blocked.nodes.get('status').textContent,/site storage/);
});
