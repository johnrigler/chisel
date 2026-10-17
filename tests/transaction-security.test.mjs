import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto, createHash } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';

export const context = { URL, crypto: webcrypto, Uint8Array, TextEncoder, TextDecoder, console, setTimeout, clearTimeout };
context.window = context;
vm.createContext(context);
for (const file of ['chisel.js', 'chisel.sign.js']) vm.runInContext(await readFile(new URL('../' + file, import.meta.url), 'utf8'), context);
export const C = context.CHISEL;
export const fixture = JSON.parse(await readFile(new URL('fixtures/security-known-values.json', import.meta.url), 'utf8'));
export const script = '76a914751e76e8199196d454941c45d1b3a323f1433bd688ac';
export function rawTransaction(inputs = 1, outputScript = script, value = 100000, scriptSig = '') {
  return '01000000' + C.varInt(inputs) + Array.from({ length: inputs }, (_, i) => '12'.repeat(32) + C.uint32LEHex(i) + C.varInt(scriptSig.length / 2) + scriptSig + 'ffffffff').join('') + '01' + C.uint64LEHex(value) + C.varInt(outputScript.length / 2) + outputScript + '00000000';
}

test('known transaction signatures remain byte-for-byte compatible', async () => {
  for (const v of fixture.vectors) {
    const inputs = Array.from({ length: v.inputs }, () => ({ privateKeyHex: fixture.privateKeyHex, compressed: true }));
    assert.equal(await C.signRawTransaction(v.unsignedHex, inputs), v.signedHex);
  }
});

test('CompactSize input/output/script lengths handle the 252/253 boundary', () => {
  for (const n of [1, 252, 253, 300]) {
    const raw = rawTransaction(n, '6a4d2c01' + '41'.repeat(300), 0, '00'.repeat(253));
    const decoded = C.parseRawTransactionDetailed(raw), signing = C.parseRawTransaction(raw);
    assert.equal(decoded.vinCount, n); assert.equal(signing.vins.length, n);
    assert.equal(decoded.vin[n - 1].vout, n - 1); assert.equal(decoded.vin[0].scriptSigBytes, 253);
    assert.equal(decoded.vout[0].scriptPubKeyBytes, 304); assert.equal(signing.outputsAndLock, decoded.outputsAndLock);
  }
  const output = C.uint64LEHex(1000) + '19' + script;
  const raw = rawTransaction().slice(0, 92) + C.varInt(253) + output.repeat(253) + '00000000';
  assert.equal(C.parseRawTransactionDetailed(raw).voutCount, 253);
});

test('malformed, duplicate, unsafe, and nonminimal transaction encodings fail closed', () => {
  for (const value of ['', '01', rawTransaction().slice(0, -2), rawTransaction() + '00', rawTransaction().slice(0, 8) + 'fd0100' + rawTransaction().slice(10)]) assert.throws(() => C.parseRawTransactionDetailed(value));
  assert.throws(() => C.parseRawTransactionDetailed(rawTransaction(2).replace('0100000000ffffffff01', '0000000000ffffffff01')), /Duplicate/);
  for (const value of ['fd', 'fdfc00', 'feffff0000', 'ff0000000001000000'.slice(0, -2), 'ffffffffffffffffff']) assert.throws(() => C.readVarInt(value, 0));
  assert.equal(C.readVarInt('ff0000000001000000', 0).value, 4294967296);
});

test('previous witness transaction IDs exclude witness data; legacy signing rejects witness', async () => {
  const legacy = rawTransaction(), witness = legacy.slice(0, 8) + '0001' + legacy.slice(8, -8) + '010141' + legacy.slice(-8);
  const expected = createHash('sha256').update(createHash('sha256').update(Buffer.from(legacy, 'hex')).digest()).digest().reverse().toString('hex');
  assert.equal(await C.transactionId(witness), expected); assert.equal(C.parseRawTransactionDetailed(witness).strippedHex, legacy);
  assert.throws(() => C.parseRawTransaction(witness), /witness|segwit/i);
});

test('decimal amounts are exact and reject hex, exponent, rounding, and unsafe values', () => {
  for (const [text, units] of [['0', 0], ['0.00000001', 1], ['1.23456789', 123456789], ['16', 1600000000], [' 0.1 ', 10000000]]) assert.equal(C.parseAmountUnits(text), units);
  assert.equal(C.parseAmountUnits(1e-8), 1);
  for (const value of ['0x10', '1e2', '1e-8', '0.000000001', '1.234567899', '-1', '+1', '1.', '.1', '', 'Infinity', '90071992.54740992', 0.000000001, NaN]) assert.throws(() => C.parseAmountUnits(value), String(value));
});

await vm.runInContext(await readFile(new URL('../chisel.safety.js', import.meta.url), 'utf8'), context);
const safety = C.transactionSafety;
async function coinFixture(value = 1000000) {
  const raw = rawTransaction(1, script, value), txid = await C.transactionId(raw);
  return { raw, txid, utxo: { txid, vout: 0, satoshis: value }, loadRaw: async id => { assert.equal(id, txid); return raw; } };
}
function spending(txid, value, destination = script) {
  return rawTransaction(1, destination, value).replace('12'.repeat(32), C.reverseHex(txid));
}

test('input selection uses verified values, leaves unused coins alone, and rejects duplicates or large batches', async () => {
  const f = await coinFixture(), options = { loadRaw: f.loadRaw, expectedScript: script, recipientUnits: 100000, feeForInputs: () => 10000, limitForFee: () => 100000 };
  const result = await safety.selectInputs([{ ...f.utxo, satoshis: 200000 }, { txid: 'ab'.repeat(32), vout: 0, satoshis: 1000 }], options);
  assert.equal(result.utxos.length, 1); assert.equal(result.totalUnits, 1000000); assert.equal(result.utxos[0].reportedSatoshis, 200000);
  await assert.rejects(safety.selectInputs([f.utxo, f.utxo], options), /Duplicate/);
  const output = C.uint64LEHex(1000) + '19' + script;
  const raw = rawTransaction().slice(0, 92) + C.varInt(101) + output.repeat(101) + '00000000';
  const id = await C.transactionId(raw), many = Array.from({ length: 101 }, (_, vout) => ({ txid: id, vout, satoshis: 1000 }));
  let reads = 0;
  await assert.rejects(safety.selectInputs(many, { ...options, recipientUnits: 110000, loadRaw: async () => { reads++; return raw; } }), /more than 100 inputs/);
  assert.equal(reads, 1, 'one cached raw lookup for outputs of the same transaction');
});

test('previous transaction hash, ownership, outpoint and local fee bounds are enforced', async () => {
  const f = await coinFixture();
  await assert.rejects(safety.inputVerifier(async () => rawTransaction(1, script, 1000), script)(f.utxo), /txid/);
  await assert.rejects(safety.inputVerifier(f.loadRaw, '76a914' + '11'.repeat(20) + '88ac')(f.utxo), /controlled/);
  await assert.rejects(safety.inputVerifier(f.loadRaw, script)({ ...f.utxo, vout: 1 }), /does not exist/);
  assert.equal(safety.feeLimit(10000, 10000), 100000);
  for (const fee of [0, -1, 100001, 1.2, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => safety.checkFee(fee, 100000));
});

test('raw audit catches explorer under-reporting, RPC output replacement and wrong fees before signing', async () => {
  const f = await coinFixture();
  const address = await C.base58CheckEncode(C.concatBytes(new Uint8Array([48]), C.hexToUint8Array(script.slice(6, 46))));
  const options = { coin: C.litecoin, loadRaw: f.loadRaw, expectedScript: script, vin: [f.utxo], vout: { [address]: '0.0099' }, expectedFee: 10000, feeLimit: 100000 };
  const good = await safety.audit(spending(f.txid, 990000), options);
  assert.equal(good.feeUnits, 10000); assert.equal(good.outputs[0].address, address);
  await assert.rejects(safety.audit(spending(f.txid, 90000), options), /Fee/);
  await assert.rejects(safety.audit(spending(f.txid, 990000, '76a914' + '11'.repeat(20) + '88ac'), options), /outputs differ/);
  await assert.rejects(safety.audit(spending(f.txid, 989999), options), /fee differs/);
});

test('web URL allowlist rejects executable schemes, credentials and control-character evasions', () => {
  for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///tmp/a', 'https://user:pass@example.com', 'java\nscript:x']) assert.equal(C.safeWebUrl(url), '');
  assert.equal(C.safeWebUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(C.safeWebUrl('../ipfs/QmFixture', 'https://gateway.example/a/b'), 'https://gateway.example/ipfs/QmFixture');
});
