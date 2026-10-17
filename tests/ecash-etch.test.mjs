import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareEtch, broadcastEtch, formatXec, endpointUrl } from '../chisel.ecash.js';
import { Ecc, Script, Tx, UnsignedTx, ALL_BIP143, sha256d, toHex } from '../vendor/ecash-sdk-4.14.4.js';

// Public fixture key, never fund it. All coins and broadcasts below are mocks.
const KEY = '1'.padStart(64, '0');
const ADDRESS = 'ecash:qp63uahgrxged4z5jswyt5dn5v3lzsem6cacy2kzvq';
const script = Script.fromAddress(ADDRESS);
const coin = (sats = 10000n, txid = '0123456789abcdef'.repeat(4), extra = {}) => ({ outpoint: { txid, outIdx: 0 }, sats, isCoinbase: false, ...extra });
const snapshot = (...utxos) => ({ outputScript: toHex(script.bytecode), utxos: utxos.length ? utxos : [coin()] });
const prepare = (funds = snapshot(), note = 'ipfs://test-fixture') => prepareEtch({ privateKeyHex: KEY, address: ADDRESS, note, snapshot: funds });

test('native etch signs a ForkID Schnorr transaction with exact fee and same-address change', () => {
  const review = prepare(), tx = Tx.fromHex(review.rawTx);
  assert.equal(tx.txid(), review.txid); assert.equal(tx.serSize(), review.byteLength);
  assert.equal(tx.outputs.length, 2); assert.equal(tx.outputs[0].sats, 0n);
  assert.equal(toHex(tx.outputs[1].script.bytecode), toHex(script.bytecode));
  assert.equal(10000n - tx.outputs[1].sats, BigInt(review.feeSats));
  assert.equal(BigInt(review.feeSats), BigInt(tx.serSize()));
  const dataOps = tx.outputs[0].script.ops(); assert.equal(dataOps.next(), 0x6a);
  assert.equal(new TextDecoder().decode(dataOps.next().data), 'ZORKMID1 ipfs://test-fixture');
  const spendOps = tx.inputs[0].script.ops(), sig = spendOps.next().data, pubkey = spendOps.next().data;
  assert.equal(sig.length, 65); assert.equal(sig[64], 0x41); // ALL | FORKID
  tx.inputs[0].signData = { sats: 10000n, outputScript: script };
  const preimage = UnsignedTx.fromTx(tx).inputAt(0).sigHashPreimage(ALL_BIP143);
  assert.doesNotThrow(() => new Ecc().schnorrVerify(sig.slice(0, -1), sha256d(preimage.bytes), pubkey));
  tx.inputs[0].signData.sats = 10001n;
  assert.throws(() => new Ecc().schnorrVerify(sig.slice(0, -1), sha256d(UnsignedTx.fromTx(tx).inputAt(0).sigHashPreimage(ALL_BIP143).bytes), pubkey));
});
test('uncompressed eCash keys retain their receiving address and verify', () => {
  const address = 'ecash:qzgmyjle755g2v5kptrg02asx5f8k8fg55mqj4vhng', ownScript = Script.fromAddress(address);
  const review = prepareEtch({ privateKeyHex: KEY, compressed: false, address, note: 'Uncompressed fixture', snapshot: { outputScript: toHex(ownScript.bytecode), utxos: [coin()] } });
  const tx = Tx.fromHex(review.rawTx), ops = tx.inputs[0].script.ops(), sig = ops.next().data, pk = ops.next().data;
  assert.equal(pk.length, 65); assert.equal(toHex(tx.outputs[1].script.bytecode), toHex(ownScript.bytecode));
  tx.inputs[0].signData = { sats: 10000n, outputScript: ownScript };
  assert.doesNotThrow(() => new Ecc().schnorrVerify(sig.slice(0,-1), sha256d(UnsignedTx.fromTx(tx).inputAt(0).sigHashPreimage(ALL_BIP143).bytes), new Ecc().compressPk(pk)));
});
test('token coins and coinbase coins cannot fund a note', () => {
  const funds = snapshot(coin(900000n, 'cd'.repeat(32), { token: { atoms: 1n } }), coin(800000n, 'ef'.repeat(32), { isCoinbase: true }), coin());
  assert.equal(prepare(funds).inputs.length, 1); assert.equal(prepare(funds).inputs[0].txid, '0123456789abcdef'.repeat(4));
  assert.throws(() => prepare(snapshot(coin(900000n, 'cd'.repeat(32), { token: { atoms: 1n } }))), /Insufficient non-token/);
});
test('dust change is never burned as the entire fee; small native inputs can combine', () => {
  assert.throws(() => prepare(snapshot(coin(600n))), /Insufficient non-token/);
  const review = prepare(snapshot(coin(600n), coin(600n, 'cd'.repeat(32))));
  assert.equal(review.inputs.length, 2); assert(BigInt(review.changeSats) >= 546n); assert(BigInt(review.feeSats) < 500n);
});
test('invalid keys, mismatched scripts, duplicate coins, and oversized UTF-8 notes fail', () => {
  assert.throws(() => prepareEtch({ privateKeyHex: '2'.padStart(64, '0'), address: ADDRESS, note: 'a', snapshot: snapshot() }), /does not control/);
  assert.throws(() => prepare({ ...snapshot(), outputScript: '00' }), /different address script/);
  assert.throws(() => prepare(snapshot(coin(), coin())), /duplicate/);
  assert.throws(() => prepare(snapshot(), 'é'.repeat(91)), /UTF-8/);
  assert.throws(() => prepare(snapshot(), ''), /UTF-8/);
  assert.doesNotThrow(() => prepare(snapshot(), 'é'.repeat(90)));
});
test('broadcast rechecks inputs and keeps token safety enabled', async () => {
  const review = prepare(), calls = [];
  const client = { address: address => { assert.equal(address, ADDRESS); return { utxos: async () => snapshot() }; }, broadcastTx: async (...args) => { calls.push(args); return { txid: review.txid }; } };
  assert.equal(calls.length, 0);
  await broadcastEtch(client, review); assert.deepEqual(calls, [[review.rawTx, false]]);
});
test('stale funds and altered reviews are rejected before broadcast', async () => {
  const review = prepare(); let broadcasts = 0;
  const client = { address: () => ({ utxos: async () => snapshot(coin(9999n)) }), broadcastTx: async () => { broadcasts++; } };
  await assert.rejects(broadcastEtch(client, review), /changed|available/);
  await assert.rejects(broadcastEtch(client, { ...review, txid: '00'.repeat(32) }), /changed/);
  assert.equal(broadcasts, 0);
});
test('an ambiguous broadcast failure is returned without automatic retries', async () => {
  const review = prepare(); let calls = 0;
  const client = { address: () => ({ utxos: async () => snapshot() }), broadcastTx: async () => { calls++; throw new Error('Connection lost'); } };
  await assert.rejects(broadcastEtch(client, review), /Connection lost/); assert.equal(calls, 1);
});
test('XEC units and endpoint restrictions are explicit', () => {
  assert.equal(formatXec(1n), '0.01'); assert.equal(formatXec(10000n), '100.00'); assert.equal(formatXec(-123n), '-1.23');
  assert.equal(endpointUrl('https://chronik.e.cash/'), 'https://chronik.e.cash');
  for (const url of ['http://example.com', 'https://key@example.com', 'https://example.com?a=1', 'file:///tmp/a']) assert.throws(() => endpointUrl(url));
});
