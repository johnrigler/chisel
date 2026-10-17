import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../chisel.js', import.meta.url), 'utf8');
const driver = await readFile(new URL('../chisel.litecoin.js', import.meta.url), 'utf8');
const names = ['litecoinspace', 'blockcypherLitecoin', 'blockchairLitecoin'];
const txid = '0123456789abcdef'.repeat(4), raw = '01000000deadbeef'; // Inert fixtures; fetch is always mocked.
const utxos = [{ txid, vout: 1, satoshis: 123456, scriptPubKey: '76a914' + '11'.repeat(20) + '88ac' }];
const tick = () => new Promise(resolve => setImmediate(resolve));
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });

function fixture(fetcher) {
  const calls = [], timers = new Map(); let nextTimer = 0;
  const context = { Uint8Array, TextEncoder, TextDecoder, AbortController,
    fetch: async (url, options) => { calls.push({ url, options }); if (!fetcher) throw new Error('Unexpected network request'); return fetcher(url, options); },
    setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
  };
  context.window = context; vm.createContext(context); vm.runInContext(source, context);
  const chisel = context.CHISEL;
  function install(name, methods) { chisel.installProvider(name, { NAME: name, coin: 'litecoin', network: 'mainnet', ...methods }); }
  return { context, chisel, resource: chisel.litecoin, calls, timers, install,
    expire() { const [id, timer] = timers.entries().next().value || []; assert(timer, 'expected a pending provider timeout'); timers.delete(id); timer.fn(); return timer.ms; },
  };
}

test('UTXO reads advance in configured order after HTTP/JSON failures and stop at success', async () => {
  const f = fixture(url => {
    if (url.includes('litecoinspace.org')) return new Response('<html>Unavailable</html>', { status: 503 });
    if (url.includes('blockcypher.com')) return json({ txrefs: [{ tx_hash: txid, tx_output_n: 1, value: 123456, script: utxos[0].scriptPubKey }] });
    throw new Error('The third provider must not be contacted after success');
  });
  const result = await f.resource.getAddressUtxosWithReport('LfixturePublicAddress', { providers: names });
  assert.equal(result.selectedProvider, names[1]); assert.equal(result.result[0].satoshis, 123456);
  assert.equal(result.attemptedProviders.length, 2); assert.equal(result.attemptedProviders[0].ok, false);
  assert.equal(f.calls.length, 2); assert.equal(f.timers.size, 0);
});

test('a stalled first provider is aborted and the coin GUI bridge automatically uses the next', async () => {
  const f = fixture(url => url.includes('litecoinspace.org') ? new Promise(() => {}) : json({ txrefs: [{ tx_hash: txid, tx_output_n: 1, value: 123456 }] }));
  vm.runInContext(driver, f.context);
  const result = f.chisel.getCoin('litecoin').getAddressUtxos(null, { rpcUrl: names.join(',') }, 'LfixturePublicAddress');
  await tick(); assert.equal(f.calls.length, 1); assert.equal(f.expire(), 10000);
  const rows = await result;
  assert.equal(rows.length, 1); assert.equal(f.calls.length, 2); assert.equal(f.calls[0].options.signal.aborted, true);
  assert.equal(f.timers.size, 0);
});

test('unknown providers, wrong networks, missing methods, and invalid UTXO payloads fall through', async () => {
  const f = fixture(), called = [];
  f.install('wrongNetwork', { network: 'testnet', getAddressUtxos() { assert.fail('cross-network provider was queried'); } });
  f.install('missingMethod', {});
  f.install('invalidPayload', { getAddressUtxos: async () => ({ error: 'not an array' }) });
  f.install('usable', { getAddressUtxos: async () => { called.push('usable'); return utxos; } });
  const result = await f.resource.getAddressUtxosWithReport('Lfixture', { providers: ['notInstalled', 'wrongNetwork', 'missingMethod', 'invalidPayload', 'usable'] });
  assert.equal(result.selectedProvider, 'usable'); assert.equal(result.attemptedProviders.length, 5); assert.deepEqual(called, ['usable']);
});

test('an empty but valid UTXO list is a successful result, and explicit cross-checks still query every provider', async () => {
  const f = fixture(), calls = [];
  f.install('empty', { getAddressUtxos: async () => { calls.push('empty'); return []; } });
  f.install('funded', { getAddressUtxos: async () => { calls.push('funded'); return utxos; } });
  const result = await f.resource.getAddressUtxosWithReport('Lfixture', { providers: ['empty', 'funded'] });
  assert.equal(result.selectedProvider, 'empty'); assert.equal(result.result.length, 0); assert.deepEqual(calls, ['empty']);
  await f.resource.compareAddressUtxos('Lfixture', { providers: ['empty', 'funded'] });
  assert.deepEqual(calls, ['empty', 'empty', 'funded']); assert.equal(f.timers.size, 0);
});

test('transaction lookups skip failed/stalled providers and return immediately on success', async () => {
  const f = fixture(), calls = [];
  f.install(names[0], { getTransaction: async () => { calls.push(names[0]); throw new Error('HTTP 503'); } });
  f.install(names[1], { getTransaction: () => { calls.push(names[1]); return new Promise(() => {}); } });
  f.install(names[2], { getTransaction: async () => { calls.push(names[2]); return { txid }; } });
  const pending = f.resource.getTransactionWithReport(txid, { providers: names });
  await tick(); f.expire(); const result = await pending;
  assert.equal(result.selectedProvider, names[2]); assert.deepEqual(calls, names);
  calls.length = 0;
  await f.resource.getTransactionWithReport(txid, { providers: [names[2], names[1]] });
  assert.deepEqual(calls, [names[2]]); assert.equal(f.timers.size, 0);
});

test('broadcast failures try the next provider with exactly the same signed bytes', async () => {
  const f = fixture(), submitted = [];
  names.forEach((name, i) => f.install(name, { broadcastRawTransaction: async hex => {
    submitted.push({ name, hex }); if (i < 2) throw new TypeError('Failed to fetch'); return txid;
  } }));
  const result = await f.resource.broadcastRawTransactionWithReport(raw, { providers: names });
  assert.equal(result.selectedProvider, names[2]); assert.equal(result.result, txid);
  assert.deepEqual(submitted, names.map(name => ({ name, hex: raw }))); assert.equal(result.attemptedProviders.length, 3);
  assert.equal(f.timers.size, 0);
});

test('a broadcast timeout advances to the next provider and passes cancellation to native fetch', async () => {
  const f = fixture(url => url.includes('litecoinspace.org') ? new Promise(() => {}) : json({ tx: { hash: txid } }));
  const pending = f.resource.broadcastRawTransactionWithReport(raw, { providers: names });
  await tick(); assert.equal(f.expire(), 12000); const result = await pending;
  assert.equal(result.selectedProvider, names[1]); assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].options.signal.aborted, true);
  assert.equal(f.calls[0].options.body, raw); assert.equal(JSON.parse(f.calls[1].options.body).tx, raw);
  assert.equal(f.timers.size, 0);
});

test('broadcast stops at first acceptance; total failure retains each attempt and uncertain outcome', async () => {
  const f = fixture(), calls = [];
  f.install('accepted', { broadcastRawTransaction: async hex => { calls.push(hex); return txid; } });
  f.install('stalled', { broadcastRawTransaction: () => new Promise(() => {}) });
  await f.resource.broadcastRawTransactionWithReport(raw, { providers: ['accepted', 'stalled'] });
  assert.deepEqual(calls, [raw]); assert.equal(f.timers.size, 0);
  f.install('rejected', { broadcastRawTransaction: async () => { throw new Error('HTTP 503'); } });
  const pending = f.resource.broadcastRawTransactionWithReport(raw, { providers: ['stalled', 'rejected'] });
  const failed = assert.rejects(pending, error => {
    assert.equal(error.broadcastOutcomeUnknown, true); assert.equal(error.attemptedProviders.length, 2);
    assert.match(error.message, /stalled/); assert.match(error.message, /rejected/); return true;
  });
  await tick(); f.expire(); await failed; assert.equal(f.timers.size, 0);
});

test('explicit caller cancellation stops the list instead of starting another provider', async () => {
  const f = fixture(), controller = new AbortController();
  f.install('stalled', { getAddressUtxos: () => new Promise(() => {}) });
  f.install('next', { getAddressUtxos() { assert.fail('a cancelled operation must not continue'); } });
  const pending = f.resource.getAddressUtxosWithReport('Lfixture', { providers: ['stalled', 'next'], signal: controller.signal });
  const failed = assert.rejects(pending, /cancelled/); await tick(); controller.abort(); await failed;
  assert.equal(f.timers.size, 0);
});

test('Blockchair can supply normalized UTXOs and accept the same raw transaction as a final fallback', async () => {
  const f = fixture((url, options) => {
    if (!url.includes('api.blockchair.com')) return json({ error: 'Unavailable' }, 503);
    if (url.includes('/dashboards/address/')) return json({ data: { Lfixture: { address: { script_hex: utxos[0].scriptPubKey, unspent_output_count: 1 }, utxo: [{ block_id: 123, transaction_hash: txid, index: 1, value: 123456 }] } }, context: { code: 200 } });
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(new URLSearchParams(options.body).get('data'), raw);
    return json({ data: { transaction_hash: txid }, context: { code: 200 } });
  });
  const coins = await f.resource.getAddressUtxosWithReport('Lfixture', { providers: names });
  assert.equal(coins.selectedProvider, names[2]); assert.equal(coins.result[0].scriptPubKey, utxos[0].scriptPubKey);
  assert.equal(coins.result[0].confirmed, true); assert.equal(coins.result[0].satoshis, 123456);
  const result = await f.resource.broadcastRawTransactionWithReport(raw, { providers: names });
  assert.equal(result.selectedProvider, names[2]); assert.equal(result.result, txid);
});

test('Blockchair truncation and malformed acceptance responses are failures, not successful fallbacks', async () => {
  const f = fixture(url => url.includes('/dashboards/address/')
    ? json({ data: { Lfixture: { address: { unspent_output_count: 2 }, utxo: [{ transaction_hash: txid, index: 0, value: 100 }] } }, context: { code: 200 } })
    : json({ data: null, context: { code: 400, error: 'Invalid transaction' } }));
  await assert.rejects(f.resource.getAddressUtxosWithReport('Lfixture', { providers: [names[2]] }), /truncated/);
  await assert.rejects(f.resource.broadcastRawTransactionWithReport(raw, { providers: [names[2]] }), /accepted transaction hash/);
});
