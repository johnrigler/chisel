import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ethers = require('../vendor/ethers-6.6.0.umd.min.js');
const html = await readFile(new URL('../identity.html', import.meta.url), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const nodes = new Map();
const document = { getElementById(id) {
  if (!nodes.has(id)) nodes.set(id, { value: id === 'addressNetwork' ? 'litecoin' : '', addEventListener(event, fn) { this[event] = fn; } });
  return nodes.get(id);
}};
const instrumented = script.replace(/\}\)\(\);\s*$/, 'globalThis.identityTest = { derive, addressFromPublicKey, setKey: key => { currentPublicKey = key; renderPublicAddress(); } }; })();');
const context = { document, ethers, URLSearchParams, location: {search: ''} };
vm.runInNewContext(instrumented, context);
const { derive, addressFromPublicKey, setKey } = context.identityTest;
const phrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test('same Chisel key produces known Bitcoin address and legacy Litecoin address', () => {
  const d = derive(phrase);
  assert.equal(addressFromPublicKey(d.publicKey, 'bitcoin'), '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
  assert.equal(d.identity, 'chisel:v1:' + d.publicKey.slice(2));
  const hash = ethers.ripemd160(ethers.sha256(d.publicKey)).slice(2);
  for (const [network, prefix] of Object.entries({ bitcoin: '00', litecoin: '30', digibyte: '1e', dogecoin: '1e', ravencoin: '3c' })) {
    const address = addressFromPublicKey(d.publicKey, network);
    const payload = ethers.toBeHex(ethers.decodeBase58(address), 25);
    assert.equal(payload.slice(2, 44), prefix + hash);
    assert.equal(payload.slice(44), ethers.sha256(ethers.sha256(payload.slice(0, 44))).slice(2, 10));
  }
  assert.equal(addressFromPublicKey(d.publicKey, 'polygon'), ethers.computeAddress('0x' + d.privateKey));
});

test('format change updates the public output with the same key', () => {
  const d = derive(phrase);
  const selector = nodes.get('addressNetwork'), output = nodes.get('publicAddress');
  setKey(d.publicKey);
  for (const network of ['bitcoin', 'polygon', 'litecoin']) {
    selector.value = network;
    selector.change();
    assert.equal(output.textContent, addressFromPublicKey(d.publicKey, network));
  }
});

test('standard 24-word phrase recovers; invalid phrase rejects', () => {
  const longPhrase = ethers.Mnemonic.fromEntropy('0x' + '00'.repeat(32)).phrase;
  assert.equal(longPhrase.split(' ').length, 24);
  assert.match(derive(longPhrase).identity, /^chisel:v1:[0-9a-f]{66}$/);
  assert.throws(() => derive('abandon abandon'));
  assert.throws(() => derive('abandon '.repeat(12)));
});
