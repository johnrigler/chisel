import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const payloadContext = vm.createContext({TextDecoder, Uint8Array});
payloadContext.window = payloadContext;
vm.runInContext(await readFile(new URL('../chisel.portal.payload.js', import.meta.url), 'utf8'), payloadContext);
const payloadData = payloadContext.CHISEL_PORTAL_PAYLOAD;

// Exercise the actual browser finance functions without a DOM or explorer API.
const source = await readFile(new URL('../chisel.portal.js', import.meta.url), 'utf8');
const begin = source.indexOf('  function satoshiInteger(value)');
const end = source.indexOf('  function extractOutputs(value)', begin);
assert.ok(begin >= 0 && end > begin, 'portal satoshi helpers are present');
const firstValue = values => values.find(value => value !== undefined && value !== null && value !== '');
const getOutputAddress = output => output?.scriptpubkey_address ||
  output?.scriptPubKey?.address || output?.scriptPubKey?.addresses?.[0] ||
  output?.addresses?.[0] || output?.addr || '';
const getInputAddress = input => getOutputAddress(input?.prevout || input?.prevOut) ||
  input?.address || input?.addresses?.[0] || '';
const testHarness = new Function('firstValue', 'txObject', 'getInputAddress',
  'getOutputAddress', 'getOutputType', 'canonicalCoinForRow', 'normalizePersonalAccount',
  'state', 'makeInlinePre', 'pretty', 'document', 'payloadData',
  source.slice(begin, end) +
  '\nreturn {portalFinanceForRow,portalOutputSatoshis,portalLedgerTarget};');
const state = { personalAccount: { coin: 'litecoin', address: 'LTEST' } };
const finance = testHarness(firstValue, value => value?.tx || value, getInputAddress,
  getOutputAddress, () => 'p2pkh', row => row.coin || 'litecoin',
  account => account?.address ? account : null, state, () => null, JSON.stringify, {},
  payloadData);
const esplo = (address, value) => ({ scriptpubkey_address: address, value });

test('visible ledger data returns before a slow FileProxy save completes', async () => {
  const start = source.indexOf('  async function loadTransactionLocalFirst(');
  const end = source.indexOf('  function selectRelativePortalRow(', start);
  assert.ok(start >= 0 && end > start);
  const raw = {txid: 'a'.repeat(64), vin: [], vout: []};
  let finishSave, savedOptions;
  const saving = new Promise(resolve => { finishSave = resolve; });
  const load = new Function('TXID_RE', 'state', 'rowKey', 'configBool', 'getThunderwords',
    'indexCanFetch', 'autoSaveTransactionMaybe', source.slice(start, end) + '\nreturn loadTransactionLocalFirst;')(
    /^[a-f0-9]{64}$/, {portalRowKeys: {}}, () => 'row', () => false,
    () => ({fetchTransaction: async () => ({json: raw, url: 'https://ledger.example/tx'})}), () => true,
    (json, txid, entry, options) => { assert.equal(json, raw); savedOptions = options; return saving; }
  );
  const result = await Promise.race([
    load({coin: 'litecoin'}, raw.txid, 'litecoin', {deferCache: true}),
    new Promise(resolve => setImmediate(() => resolve('blocked by FileProxy')))
  ]);
  assert.notEqual(result, 'blocked by FileProxy');
  assert.equal(result.json, raw);
  assert.equal(result.path, '');
  assert.equal(savedOptions.refreshIndex, false, 'index rebuilding is batched after saves');
  finishSave({path: 'data/transactions/litecoin/saved.json'});
  assert.equal((await result.cachePromise).path, 'data/transactions/litecoin/saved.json');
});

test('Esplora incoming and outgoing amounts are per-address net, not all outputs', () => {
  const incoming = finance.portalFinanceForRow({ raw: {
    vin: [{ prevout: esplo('OTHER', 100000) }],
    vout: [esplo('LTEST', 40000), esplo('OTHER', 59000)], fee: 1000
  } });
  assert.equal(incoming.netSat, 40000);
  assert.equal(incoming.outputTotalSat, 99000);
  assert.equal(incoming.feeSat, 1000);

  const outgoing = finance.portalFinanceForRow({ raw: {
    vin: [{ prevout: esplo('LTEST', 100000) }],
    vout: [esplo('LTEST', 30000), esplo('OTHER', 69000)], fee: 1000
  } });
  assert.equal(outgoing.netSat, -70000);
  assert.equal(outgoing.outputTotalSat, 99000);
  assert.equal(outgoing.feeSat, 1000);
});

test('Bitcoin Core decimal LTC amounts convert to integer satoshis', () => {
  assert.equal(finance.portalOutputSatoshis({ value: 0.00042, scriptPubKey: {} }), 42000);
  const result = finance.portalFinanceForRow({ raw: { vin: [{
    prevout: { value: 0.0005, scriptPubKey: { address: 'LTEST' } }
  }], vout: [
    { value: 0.0004, scriptPubKey: { address: 'OTHER' } },
    { value: 0.00009, scriptPubKey: { address: 'LTEST' } }
  ], fee: 0.00001 } });
  assert.equal(result.feeSat, 1000);
  assert.equal(result.netSat, -41000);
});

test('unknown addresses, missing values and unsafe numbers do not invent a net', () => {
  const unknown = finance.portalFinanceForRow({ raw: {
    vin: [{ prevout: { value: 100000 } }],
    vout: [esplo('LTEST', 99000)], fee: 1000
  } });
  assert.equal(unknown.netSat, null);
  assert.equal(unknown.outputTotalSat, 99000);
  assert.equal(finance.portalOutputSatoshis(esplo('LTEST', 9007199254740992)), null);
  assert.equal(finance.portalOutputSatoshis(esplo('LTEST', -1)), null);
});

test('fees are derived only when all input and output values are present', () => {
  const complete = finance.portalFinanceForRow({ raw: {
    vin: [{ prevout: esplo('LTEST', 10000) }],
    vout: [esplo('OTHER', 9500)]
  } });
  assert.equal(complete.feeSat, 500);
  const incomplete = finance.portalFinanceForRow({ raw: {
    vin: [{ prevout: { scriptpubkey_address: 'LTEST' } }],
    vout: [esplo('OTHER', 9500)]
  } });
  assert.equal(incomplete.feeSat, null);
  assert.equal(incomplete.netSat, null);
});

test('non-Litecoin transactions do not get LTC satoshi interpretations', () => {
  assert.equal(finance.portalFinanceForRow({ coin: 'digibyte', raw: {
    vin: [], vout: [esplo('LTEST', 100)]
  } }), null);
});

test('silent background hydration does not trigger the blocking transaction spinner', () => {
  const match = source.match(/const busyTracked = ([\s\S]*?);\s*if \(busyTracked\) portalBusyStart/);
  assert.ok(match, 'transaction hydration controls its busy overlay');
  const expanded = { expandedRowKeys: { tx1: true } };
  const state = { expandedRowKeys: {} };
  // The helper references key, which is a variable in hydratePortalRow scope.
  const shouldTrack = new Function('state', 'key', 'opts', 'return ' + match[1] + ';');
  assert.equal(shouldTrack(expanded, 'tx1', undefined), true);
  assert.equal(shouldTrack(expanded, 'tx1', { silent: true }), false);
  assert.equal(shouldTrack(expanded, 'tx1', { suppressRender: true }), false);
  assert.equal(shouldTrack(expanded, 'tx1', { quiet: true }), false);
  assert.equal(shouldTrack(state, 'tx1', undefined), false);
});

test('BlockCypher outputs and previous output_value supply a visible amount', () => {
  const tx = { coin: 'litecoin', raw: {
    inputs: [{ addresses: ['LTEST'], output_value: 100000 }],
    outputs: [{ addresses: ['LTEST'], value: 30000 }, { addresses: ['OTHER'], value: 69000 }],
    fees: 1000
  } };
  const values = finance.portalFinanceForRow(tx);
  assert.equal(values.outputTotalSat, 99000);
  assert.equal(values.netSat, -70000);
  assert.equal(values.feeSat, 1000);
});

test('Insight normalization aliases do not turn decimal LTC into satoshi integers', () => {
  const output = { value: 0.00042, scriptPubKey: { addresses: ['LTEST'] },
    scriptpubkey_address: 'LTEST', scriptpubkey: '76a914' };
  assert.equal(finance.portalOutputSatoshis(output), 42000);
});

test('BlockCypher transactions are treated as full UTXO rows', () => {
  assert.match(source, /function hasPortalUtxoOutputs\(raw\)/);
  assert.match(source, /raw: hasPortalUtxoOutputs\(tx.raw\) \? tx.raw : null/);
});

test('expanded Litecoin view renders two transaction-flow tables while retaining raw JSON', () => {
  assert.match(source, /function appendPortalFinanceDetails\(container, row\)/);
  assert.match(source, /appendSide\("Inputs", sources, finance.inputs, "input"\)/);
  assert.match(source, /appendSide\("Outputs", destinations, finance.outputs, "output"\)/);
  assert.match(source, /makeInlinePre\("Raw transaction JSON", pretty\(row.raw\), false\)/);
  assert.match(source, /makeInlineDrawer\("VIN address actions", false\)/);
});

test('transaction-flow output targets label zero-value scripts', () => {
  const helperStart = source.indexOf('  function portalLedgerTarget(raw, parsed, direction)');
  const helperEnd = source.indexOf('  function appendPortalFinanceDetails(container, row)', helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  const target = new Function('payloadData',
    source.slice(helperStart, helperEnd) + '\nreturn portalLedgerTarget;')(
      payloadData
    );
  assert.equal(target({ script: '6a00' }, { valueSat: 0 }, 'output').label, 'OP_RETURN');
  assert.equal(target({ output_index: -1 }, { valueSat: null }, 'input').label, 'Coinbase');
  assert.equal(target({}, { address: 'LTEST' }, 'output').label, 'LTEST');
});

test('base58 LTC addresses use exact case for per-address net calculations', () => {
  const result = finance.portalFinanceForRow({ raw: {
    vin: [{ prevout: esplo('ltest', 100000) }],
    vout: [esplo('LTEST', 40000), esplo('OTHER', 59000)], fee: 1000
  } });
  assert.equal(result.netSat, 40000, 'different-case base58 addresses must not match');
});

test('coinbase and OP_RETURN rows remain visible with sensible labels', () => {
  assert.equal(finance.portalLedgerTarget({ coinbase: '0123' }, {}, 'input').label, 'Coinbase');
  assert.equal(finance.portalLedgerTarget({
    scriptpubkey: '6a02abcd', scriptpubkey_asm: 'OP_RETURN abcd'
  }, {}, 'output').label, 'OP_RETURN');
  assert.match(source, /amountCell\.textContent = target\.kind === "coinbase" \? "new coins"/);
});

test('expanded Litecoin view keeps ledger flow ahead of supporting artifacts after the leading media preview', () => {
  assert.match(source, /if \(ledgerFirst\) appendPortalFinanceDetails\(container, row\)/);
  assert.match(source, /Chisel artifacts, annotations and raw JSON/);
  assert.ok(source.indexOf('if (ledgerFirst) appendPortalFinanceDetails(container, row)') <
    source.indexOf('appendPortalInterpretedRecord(supportTarget, row)'));
});

test('Blockchair is a mainnet verification option without becoming a JSON API', async () => {
  const thunderwords = await readFile(new URL('../chisel.thunderwords.js', import.meta.url), 'utf8');
  assert.match(source, /blockchair\.com\/litecoin\/transaction\//);
  assert.match(source, /litecoinspace\.org\/tx\//);
  assert.match(thunderwords, /blockchair\.com\/litecoin\/transaction\/\{txid\}/);
  assert.match(thunderwords, /electrsBaseUrl: "https:\/\/litecoinspace\.org\/api"/);
});
