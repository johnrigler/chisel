import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';

const context = { crypto: webcrypto, Uint8Array, TextEncoder, TextDecoder, console };
context.window = context; vm.createContext(context);
for (const file of ['chisel.js', 'chisel.sign.js', 'vendor/noble-secp256k1-3.2.0.browser.js', 'chisel.secp256k1.js', 'chisel.secp256k1.noble.js']) vm.runInContext(await readFile(new URL('../' + file, import.meta.url), 'utf8'), context);
// Poison the legacy signer before the dispatcher captures it. Production must
// never generate a legacy comparison signature with a user's private key.
context.CHISEL.signRawTransaction = () => { throw new Error('Legacy signing must stay offline'); };
for (const file of ['chisel.sign.backend.js', 'chisel.identity.js']) vm.runInContext(await readFile(new URL('../' + file, import.meta.url), 'utf8'), context);
const C = context.CHISEL;
const f = JSON.parse(await readFile(new URL('fixtures/security-known-values.json', import.meta.url), 'utf8'));
const order = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

test('production Noble transaction and identity signing preserve known-good bytes without legacy signing', async () => {
  assert.equal(C.getSigningBackend(), 'noble');
  for (const v of f.vectors) assert.equal(await C.signRawTransaction(v.unsignedHex, Array.from({ length: v.inputs }, () => ({ privateKeyHex: f.privateKeyHex, compressed: true }))), v.signedHex);
  const envelope = await C.signArtifact({ privateKeyHex: f.privateKeyHex, type: f.envelope.type, payload: f.envelope.payload });
  assert.equal(JSON.stringify(envelope), JSON.stringify(f.envelope));
  assert.equal(await C.verifyArtifact(f.envelope), true);
});

test('high-S signature twins, invalid keys, altered payloads and malformed signatures are rejected', async () => {
  const twin = structuredClone(f.envelope), sig = twin.proof.signature;
  twin.proof.signature = sig.slice(0, 64) + (order - BigInt('0x' + sig.slice(64))).toString(16).padStart(64, '0');
  assert.equal(await C.verifyArtifact(twin), false);
  const altered = structuredClone(f.envelope); altered.payload.count++;
  assert.equal(await C.verifyArtifact(altered), false);
  for (const key of ['0'.repeat(64), order.toString(16), 'f'.repeat(64)]) await assert.rejects(C.signArtifact({ privateKeyHex: key, type: 'test', payload: {} }));
  assert.equal(C.verifyDigestSignature({ ...f.envelope.proof, identity: f.envelope.identity, signature: '00'.repeat(64) }), false);
});

test('canonical signing rejects exotic objects, getters, cycles, sparse arrays, hidden and unsupported values', () => {
  const cycle = {}; cycle.self = cycle;
  let reads = 0; const getter = { get value() { reads++; return 1; } };
  for (const value of [new Date(), new Map(), new Set(), new Uint8Array(1), /x/, new (class Thing {})(), cycle, [1, , 3], Object.assign([1], { extra: 2 }), getter, Object.defineProperty({}, 'hidden', { value: 1 }), { x: undefined }, { x: Symbol() }, { x: 1n }, { x: Infinity }]) assert.throws(() => C.canonicalize(value));
  assert.equal(reads, 0);
  assert.equal(C.canonicalize({ b: [true, null], a: 1 }), '{"a":1,"b":[true,null]}');
});

test('artifact signing snapshots JSON before awaiting cryptography', async () => {
  const payload = { count: 1 }, pending = C.signArtifact({ privateKeyHex: f.privateKeyHex, type: 'snapshot', payload });
  payload.count = 2; const envelope = await pending;
  assert.equal(envelope.payload.count, 1); assert.equal(await C.verifyArtifact(envelope), true);
});

test('Noble signs all 253 inputs with canonical CompactSize and locally verifiable signatures', async () => {
  const v = f.vectors[0].unsignedHex;
  const input = i => '12'.repeat(32) + C.uint32LEHex(i) + '00ffffffff';
  const raw = v.slice(0, 8) + C.varInt(253) + Array.from({ length: 253 }, (_, i) => input(i)).join('') + v.slice(92);
  const signed = await C.signRawTransaction(raw, Array.from({ length: 253 }, () => ({ privateKeyHex: f.privateKeyHex, compressed: true })));
  const decoded = C.parseRawTransactionDetailed(signed);
  assert.equal(decoded.vinCount, 253); assert.equal(decoded.vin[252].vout, 252);
  // Verify the first and final signatures against independently reconstructed SIGHASH_ALL preimages.
  for (const index of [0, 252]) {
    const preimage = '01000000' + C.varInt(253) + Array.from({ length: 253 }, (_, i) => '12'.repeat(32) + C.uint32LEHex(i) + (i === index ? '19' + '76a914751e76e8199196d454941c45d1b3a323f1433bd688ac' : '00') + 'ffffffff').join('') + v.slice(92) + '01000000';
    const sig = decoded.vin[index].scriptSig, size = parseInt(sig.slice(0, 2), 16);
    const der = C.hexToUint8Array(sig.slice(2, size * 2)); // omit SIGHASH_ALL byte
    const compact = context.ChiselSecp256k1.derToCompact(der);
    assert(C.secp256k1.verifyDigest(C.hexToUint8Array(await C.doubleSha256Hex(preimage)), compact, C.hexToUint8Array(f.envelope.identity.slice(10))));
  }
});

test('a missing Noble vendor cannot silently fall back to legacy signing', async () => {
  const c = { crypto: webcrypto, Uint8Array, TextEncoder, TextDecoder }; c.window = c; vm.createContext(c);
  for (const file of ['chisel.js', 'chisel.sign.js', 'chisel.secp256k1.js', 'chisel.sign.backend.js']) vm.runInContext(await readFile(new URL('../' + file, import.meta.url), 'utf8'), c);
  assert.equal(c.CHISEL.getSigningBackend(), 'noble');
  await assert.rejects(c.CHISEL.signRawTransaction(f.vectors[0].unsignedHex, [{ privateKeyHex: f.privateKeyHex, compressed: true }]), /not installed/);
  assert.throws(() => c.CHISEL.privateKeyHexToPublicKeyHex(f.privateKeyHex, true), /not installed/);
});
