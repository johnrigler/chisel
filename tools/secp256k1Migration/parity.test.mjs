import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import * as noble from '@noble/secp256k1';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

globalThis.window = globalThis;
await import('../../vendor/elliptic-6-6-1.min.js');
await import('../../chisel.secp256k1.js');
await import('../../chisel.secp256k1.noble.js');

const LegacyEC = globalThis.elliptic.ec;
const legacy = new LegacyEC('secp256k1');
const boundary = globalThis.ChiselSecp256k1;
const nobleBackend = globalThis.ChiselNobleSecp256k1.createBackend(noble);

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function compactLegacySignature(signature) {
  return Uint8Array.from([
    ...signature.r.toArray('be', 32),
    ...signature.s.toArray('be', 32),
  ]);
}

function keyFromSmallInteger(value) {
  const key = new Uint8Array(32);
  key[31] = value;
  return key;
}

const vectors = [
  {
    name: 'generator private key / zero digest',
    privateKey: keyFromSmallInteger(1),
    digest: new Uint8Array(32),
  },
  {
    name: 'private key 2 / ascending digest',
    privateKey: keyFromSmallInteger(2),
    digest: Uint8Array.from({ length: 32 }, (_, i) => i),
  },
  {
    name: 'private key 7 / descending digest',
    privateKey: keyFromSmallInteger(7),
    digest: Uint8Array.from({ length: 32 }, (_, i) => 255 - i),
  },
];

test('Noble adapter and Chisel elliptic derive the same public keys', () => {
  for (const vector of vectors) {
    const legacyKey = legacy.keyFromPrivate(bytesToHex(vector.privateKey), 'hex');
    const legacyCompressed = Uint8Array.from(legacyKey.getPublic().encode('array', true));
    const legacyUncompressed = Uint8Array.from(legacyKey.getPublic().encode('array', false));

    assert.deepEqual(
      [...nobleBackend.getPublicKey(vector.privateKey, true)],
      [...legacyCompressed],
      vector.name + ' compressed public key',
    );
    assert.deepEqual(
      [...nobleBackend.getPublicKey(vector.privateKey, false)],
      [...legacyUncompressed],
      vector.name + ' uncompressed public key',
    );
  }
});

test('Noble adapter matches legacy deterministic low-S signatures on ordinary vectors', async () => {
  for (const vector of vectors) {
    const legacySignature = legacy.sign(
      Array.from(vector.digest),
      bytesToHex(vector.privateKey),
      'hex',
      { canonical: true },
    );
    const legacyCompact = compactLegacySignature(legacySignature);
    const nobleCompact = await nobleBackend.signDigest(vector.digest, vector.privateKey);

    assert.deepEqual([...nobleCompact], [...legacyCompact], vector.name + ' compact signature');
    assert.deepEqual(
      [...boundary.compactToDer(nobleCompact)],
      [...legacySignature.toDER()],
      vector.name + ' DER signature',
    );
  }
});

test('Noble adapter verifies legacy signatures and legacy elliptic verifies Noble signatures', async () => {
  for (const vector of vectors) {
    const legacyKey = legacy.keyFromPrivate(bytesToHex(vector.privateKey), 'hex');
    const publicKey = nobleBackend.getPublicKey(vector.privateKey, true);
    const legacySignature = legacy.sign(
      Array.from(vector.digest),
      bytesToHex(vector.privateKey),
      'hex',
      { canonical: true },
    );
    const legacyCompact = compactLegacySignature(legacySignature);
    const nobleCompact = await nobleBackend.signDigest(vector.digest, vector.privateKey);

    assert.equal(
      nobleBackend.verifyDigest(vector.digest, legacyCompact, publicKey),
      true,
      vector.name + ' Noble verifies legacy',
    );

    assert.equal(
      legacy.verify(Array.from(vector.digest), boundary.compactToDer(nobleCompact), legacyKey.getPublic()),
      true,
      vector.name + ' legacy verifies Noble',
    );
  }
});
