import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import * as noble from '@noble/secp256k1';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

globalThis.window = globalThis;

const ellipticModule = await import('../../vendor/elliptic-6-6-1.min.js');
globalThis.elliptic = ellipticModule.default || ellipticModule;

await import('../../chisel.js');
await import('../../chisel.sign.js');
await import('../../chisel.secp256k1.js');
await import('../../chisel.secp256k1.noble.js');
await import('../../chisel.sign.backend.js');

const C = globalThis.CHISEL;
globalThis.ChiselNobleSecp256k1.install(noble, C);

function keyFromSmallInteger(value) {
  const key = new Uint8Array(32);
  key[31] = value;
  return key;
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function syntheticUnsignedTransaction(privateKeyHex) {
  const publicKeyHex = C.signRawTransactionWithElliptic
    ? C.privateKeyHexToPublicKeyHex(privateKeyHex, true)
    : C.privateKeyHexToPublicKeyHex(privateKeyHex, true);
  const publicKeyHashHex = await C.hash160Hex(publicKeyHex);
  const outputScript = '76a914' + publicKeyHashHex + '88ac';

  return (
    '01000000' +
    '01' +
    '00'.repeat(32) +
    '00000000' +
    '00' +
    'ffffffff' +
    '01' +
    C.uint64LEHex(100000) +
    C.varInt(outputScript.length / 2) +
    outputScript +
    '00000000'
  );
}

test('Noble reproduces the exact legacy signed raw transaction', async () => {
  const privateKeyHex = bytesToHex(keyFromSmallInteger(7));

  C.setSigningBackend('elliptic');
  const unsignedHex = await syntheticUnsignedTransaction(privateKeyHex);
  const signingInputs = [{ privateKeyHex, compressed: true }];
  const legacyHex = await C.signRawTransactionWithElliptic(unsignedHex, signingInputs);

  C.setSigningBackend('noble');
  const nobleHex = await C.signRawTransaction(unsignedHex, signingInputs);

  assert.equal(nobleHex, legacyHex);
  assert.deepEqual(C.lastSignerParity, {
    backend: 'noble',
    compared: true,
    ok: true,
    signedBytes: nobleHex.length / 2,
  });

  const decoded = C.parseRawTransactionDetailed(nobleHex);
  assert.equal(decoded.vinCount, 1);
  assert.equal(decoded.voutCount, 1);
  assert.ok(decoded.vin[0].scriptSig.length > 0);
});
