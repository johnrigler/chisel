import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const INDEX = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const BACKEND = fs.readFileSync(new URL('../chisel.sign.backend.js', import.meta.url), 'utf8');
const VENDOR = fs.readFileSync(new URL('../vendor/noble-secp256k1-3.2.0.iife.js', import.meta.url), 'utf8');

const SCRIPT_ORDER = [
  'vendor/noble-secp256k1-3.2.0.iife.js',
  'chisel.secp256k1.js',
  'chisel.secp256k1.noble.js',
  'chisel.sign.js',
  'chisel.secp256k1.bootstrap.js',
  'chisel.sign.backend.js'
];

test('ordinary Chisel page loads Noble before selecting the signing backend', () => {
  const positions = SCRIPT_ORDER.map((name) => INDEX.indexOf(name));

  positions.forEach((position, index) => {
    assert.notEqual(position, -1, SCRIPT_ORDER[index] + ' is missing from index.html');
  });

  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('signing selector defaults to Noble and fails closed when Noble is absent', () => {
  assert.match(BACKEND, /let selectedBackend = ['"]noble['"]/);
  assert.match(BACKEND, /requireNobleBackend\(\);/);
});

test('vendored Noble browser bundle exposes the expected secp256k1 API', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(VENDOR, context, { filename: 'noble-secp256k1-3.2.0.iife.js' });

  const noble = context.nobleSecp256k1;
  assert.ok(noble);
  assert.equal(typeof noble.getPublicKey, 'function');
  assert.equal(typeof noble.signAsync, 'function');
  assert.equal(typeof noble.verify, 'function');

  const privateKey = new Uint8Array(32);
  privateKey[31] = 1;
  const publicKey = noble.getPublicKey(privateKey, true);
  assert.equal(publicKey.length, 33);
});
