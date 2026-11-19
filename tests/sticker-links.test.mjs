import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const helper=await readFile(new URL('../chisel.stickers.js',import.meta.url),'utf8');
const id='0123456789abcdef';
function fixture(href='https://johnrigler.github.io/#'+id) {
  const navigations=[];
  const context=vm.createContext({URL,URLSearchParams,
    document:{currentScript:{hasAttribute:()=>true}},
    location:{href,replace:target=>navigations.push(target)},
    localStorage:{getItem(){throw Error('unexpected storage read');},setItem(){throw Error('unexpected storage write');}},
  });
  vm.runInContext(helper,context);
  return {C:context.ChiselSticker,navigations};
}

test('sticker URLs contain only the homepage and a bare hex fragment',()=>{
  const {C}=fixture();
  const url=new URL(C.url(id));
  assert.equal(url.origin+url.pathname,'https://johnrigler.github.io/');
  assert.equal(url.search,'');
  assert.equal(url.hash,'#'+id.toUpperCase());
  assert.equal(C.parse(url.href),id);
});

test('raw hex and previously printed sticker URLs remain readable',()=>{
  const {C}=fixture();
  for(const value of [id.toUpperCase(),'0x'+id,
    'https://johnrigler.github.io/#'+id,
    'https://johnrigler.github.io/chisel/#sticker='+id,
    'https://custom.example/ipfs/cid/#sticker='+id,
    'http://localhost:8000/?sticker='+id]) assert.equal(C.parse(value),id);
});

test('invalid or ambiguous sticker values are rejected',()=>{
  const {C}=fixture();
  for(const value of ['',id.slice(1),id+'0',id.repeat(4),
    'javascript:alert(1)#sticker='+id,
    'https://user:secret@example.test/#'+id,
    'https://example.test/?sticker='+id+'#sticker='+id,
    'https://example.test/?sticker='+id+'#'+id]) assert.equal(C.parse(value),'');
  assert.throws(()=>C.url('invalid'),/16 hex/);
});

test('loading or reading a sticker URL never redirects or records a usage choice',()=>{
  for(const href of ['https://johnrigler.github.io/#'+id,'https://johnrigler.github.io/chisel/#sticker='+id]) {
    const {C,navigations}=fixture(href);
    assert.equal(C.parse(href),id);
    assert.equal(C.parse(C.url(id)),id);
    assert.deepEqual(navigations,[]);
  }
});
