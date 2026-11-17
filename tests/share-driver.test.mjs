import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const js = await readFile(new URL('../chisel.share-driver.js', import.meta.url), 'utf8');
const context = {URL, URLSearchParams, TextEncoder};
vm.createContext(context); vm.runInContext(js, context);
const share = context.CHISEL_SHARE_DRIVER;
test('YouTube subclass recognizes videos without matching hostile hostnames', () => {
  assert.equal(share.forContent('https://youtu.be/dQw4w9WgXcQ').kind,'youtube');
  assert.equal(share.forContent('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ').kind,'link');
  assert.equal(share.forContent('https://example.org').kind,'link');
});
test('Share driver hands off a draft, not signing authority', () => {
  const value='https://youtu.be/dQw4w9WgXcQ';
  const target=new URL(share.sendToChisel('https://gateway.example/ipfs/demo/#keep=1',value,{opReturnText:value}));
  assert.equal(target.searchParams.get('mode'),'send');
  const fragment=new URLSearchParams(target.hash.slice(1));
  assert.equal(fragment.get('keep'),'1');
  assert.equal(fragment.get('opreturn'),value);
  assert.equal(JSON.parse(fragment.get('record')).opReturnText,value);
  assert.throws(()=>share.sendToChisel('javascript:alert(1)',value),/HTTP or HTTPS/);
});
