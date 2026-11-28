import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const sources = await Promise.all(['chisel.portal.cache.js', 'chisel.portal.static-data.js']
  .map(async name => [name, await readFile(new URL('../' + name, import.meta.url), 'utf8')]));
const root = 'https://records.example/data/';
const id = 'ab'.repeat(32), other = 'cd'.repeat(32);
function fixture(settings = {}) {
  let time = 1000000;
  const context = vm.createContext({URL, TextEncoder, AbortController, setTimeout, clearTimeout, addEventListener() {},
    document: {readyState: 'loading', addEventListener() {}}});
  context.window = context;
  for (const [name, source] of sources) vm.runInContext(source, context, {filename: name});
  const cache = context.CHISEL_PORTAL_CACHE.createCache({indexedDB: null, now: () => time, ...settings});
  const routes = new Map(), calls = [];
  const fetch = async (url, options) => {
    calls.push({url, options});
    const value = routes.get(url);
    if (value instanceof Error) throw value;
    const status = value?.status || (value === undefined ? 404 : 200);
    const body = value && Object.hasOwn(value, 'body') ? value.body : value;
    return {ok: status >= 200 && status < 300, status,
      text: async () => typeof body === 'string' ? body : JSON.stringify(body), json: async () => body};
  };
  const transport = () => context.CHISEL_PORTAL_STATIC_DATA.createTransport({cache, fetch, baseUrl: root, now: () => time});
  return {cache, routes, calls, transport, advance: ms => { time += ms; }};
}

test('a repeated multi-currency catalog reuses its index and all inventories without fetching transaction bodies', async () => {
  const f = fixture(), coins = ['bsv', 'litecoin', 'digibyte', 'dogecoin', 'ravencoin', 'evm'];
  f.routes.set(root + 'index/transactions.index.json', {transactions: []});
  // A nonempty summarized row lets the portable index complement inventories.
  f.routes.set(root + 'index/transactions.index.json', {transactions: [{coin: 'bsv', txid: id, summary: {title: 'Saved title'}}]});
  f.routes.set(root + 'transactions/.files', coins.join('\n'));
  for (const coin of coins) f.routes.set(root + 'transactions/' + coin + '/.files', id + '.json\n');
  const cold = await f.transport().loadCatalog(root);
  assert.equal(cold.index.transactions.length, 6); assert.equal(f.calls.length, 8);
  assert.ok(f.calls.every(call => !call.url.endsWith('/' + id + '.json')));
  assert.ok(f.calls.every(call => call.options.cache === 'no-cache'));
  const warm = await f.transport().loadCatalog(root);
  assert.equal(warm.index.transactions.length, 6); assert.equal(f.calls.length, 8);
  assert.equal(f.cache.stats().hits, 8); assert.equal(f.cache.stats().groups.catalog, 8);
});

test('simultaneous manifest/index reads and repeated transaction reads share their pending fetches', async () => {
  const f = fixture();
  f.routes.set(root + 'manifest.json', {defaultIndex: 'index/portal.index.json'});
  f.routes.set(root + 'index/portal.index.json', {transactions: []});
  const transport = f.transport();
  await Promise.all([transport.loadManifest(root + 'manifest.json'), transport.loadManifest(root + 'manifest.json')]);
  assert.equal(f.calls.length, 2);
  const url = root + 'transactions/bsv/' + id + '.json', row = {coin: 'bsv', txid: id};
  f.routes.set(url, {txid: id, vout: []});
  const results = await Promise.all(Array.from({length: 10}, () => transport.fetchTransactionJson(url, row)));
  assert.ok(results.every(result => result.json.txid === id)); assert.equal(f.calls.length, 3);
  assert.equal(f.cache.stats().groups.transaction, 1);
});

test('catalogs revalidate after five minutes and explicit refresh bypasses fresh cached content', async () => {
  const f = fixture();
  f.routes.set(root + 'manifest.json', {defaultIndex: 'index/portal.index.json'});
  f.routes.set(root + 'index/portal.index.json', {transactions: [{txid: id}]});
  const transport = f.transport();
  await transport.loadManifest(root + 'manifest.json');
  f.routes.set(root + 'index/portal.index.json', {transactions: [{txid: other}]});
  assert.equal((await transport.loadManifest(root + 'manifest.json')).index.transactions[0].txid, id);
  const changed = await transport.loadManifest(root + 'manifest.json', {refresh: true});
  assert.equal(changed.index.transactions[0].txid, other); assert.equal(f.calls.length, 4);
  f.advance(5 * 60000 + 1);
  await transport.loadManifest(root + 'manifest.json'); assert.equal(f.calls.length, 6);
});

test('transaction files survive transient failures with bounded stale reuse and a retry pause', async () => {
  const f = fixture(), url = root + id + '.json', row = {coin: 'bsv', txid: id};
  f.routes.set(url, {txid: id, vout: []}); const transport = f.transport();
  await transport.fetchTransactionJson(url, row);
  f.advance(15 * 60000 + 1); f.routes.set(url, {status: 503});
  const saved = await transport.fetchTransactionJson(url, row);
  assert.equal(saved.json.txid, id); assert.equal(saved.cached, true); assert.equal(saved.offline, true);
  await transport.fetchTransactionJson(url, row); assert.equal(f.calls.length, 2);
  f.advance(30001); f.routes.set(url, {txid: id, confirmations: 2, vout: []});
  const recovered = await transport.fetchTransactionJson(url, row);
  assert.equal(recovered.cached, false); assert.equal(recovered.json.confirmations, 2);
  f.advance(31 * 86400000); f.routes.set(url, new TypeError('Network offline'));
  await assert.rejects(transport.fetchTransactionJson(url, row), /Network offline/);
});

test('fresh cached files stay readable offline without claiming a new live ledger observation', async () => {
  const f = fixture(), url = root + id + '.json', row = {coin: 'litecoin', txid: id, staticRawUrl: url};
  f.routes.set(url, {txid: id, confirmations: 10});
  await f.transport().fetchStaticRawFromRow(row);
  f.routes.set(url, new TypeError('Offline'));
  const loaded = await f.transport().fetchStaticRawFromRow(row);
  assert.equal(loaded.source, 'browser-cache'); assert.equal(loaded.cached, true);
  assert.equal(f.calls.length, 1); assert.equal(loaded.ledgerObserved, undefined);
});

test('invalid JSON, mismatched identities and hard HTTP failures cannot hide behind stale cache entries', async () => {
  for (const failure of [{status: 404}, {status: 403}, '<html>bad response</html>', {txid: other}]) {
    const f = fixture(), url = root + id + '.json', row = {coin: 'bsv', txid: id};
    f.routes.set(url, {txid: id}); const transport = f.transport();
    await transport.fetchTransactionJson(url, row); f.advance(15 * 60000 + 1); f.routes.set(url, failure);
    await assert.rejects(transport.fetchTransactionJson(url, row));
    assert.equal(f.cache.stats().offlineHits, 0);
  }
  const f = fixture(), url = root + id + '.json'; f.routes.set(url, {txid: other});
  await assert.rejects(f.transport().fetchTransactionJson(url, {coin: 'bsv', txid: id}));
  assert.equal(f.cache.stats().entries, 0);
});

test('chain identities stay distinct and credential-bearing URLs are never persisted', async () => {
  const f = fixture(), url = root + id + '.json'; f.routes.set(url, {txid: id});
  const transport = f.transport();
  await transport.fetchTransactionJson(url, {coin: 'bitcoin', txid: id});
  await transport.fetchTransactionJson(url, {coin: 'bsv', txid: id});
  assert.equal(f.calls.length, 2); assert.equal(f.cache.stats().groups.transaction, 2);
  const secretUrl = url + '?api_key=private'; f.routes.set(secretUrl, {txid: id});
  await transport.fetchTransactionJson(secretUrl, {coin: 'bsv', txid: id});
  await transport.fetchTransactionJson(secretUrl, {coin: 'bsv', txid: id});
  assert.equal(f.cache.stats().entries, 2); assert.equal(f.calls.length, 4);
});

test('storage limits evict least recently used files, account for UTF-8 bytes and skip oversized payloads', async () => {
  const f = fixture({maxBytes: 12, maxEntryBytes: 10});
  await f.cache.put('a', '12345', 'catalog'); f.advance(1);
  await f.cache.put('b', '12345', 'catalog'); f.advance(1);
  await f.cache.get('a'); f.advance(1);
  await f.cache.put('c', '12345', 'transaction');
  assert.equal(await f.cache.get('b'), null); assert.equal((await f.cache.get('a')).text, '12345');
  assert.equal(f.cache.stats().bytes, 10);
  assert.equal(await f.cache.put('huge', 'x'.repeat(11), 'transaction'), false);
  await f.cache.clear(); await f.cache.put('unicode', 'ééé', 'catalog'); assert.equal(f.cache.stats().bytes, 6);
});

test('clearing catalogs preserves transaction files and fences late downloads from an older generation', async () => {
  const f = fixture();
  await f.cache.put('index', '{}', 'catalog'); await f.cache.put('raw', '{}', 'transaction');
  const generation = f.cache.generation(); await f.cache.clear('catalog');
  assert.equal(await f.cache.get('index'), null); assert.ok(await f.cache.get('raw'));
  assert.equal(await f.cache.put('late', '{}', 'catalog', generation), false);
  await f.cache.clear(); assert.equal(f.cache.stats().entries, 0);
});
