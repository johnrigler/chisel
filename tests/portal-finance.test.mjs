import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// Exercise the actual browser finance functions without a DOM or explorer API.
const source = await readFile(new URL('../chisel.portal.js', import.meta.url), 'utf8');
const begin = source.indexOf('  function satoshiInteger(value)');
const end = source.indexOf('  function extractOutputs(value)', begin);
assert.ok(begin >= 0 && end > begin, 'portal satoshi helpers are present');
const firstValue = values => values.find(value => value !== undefined && value !== null && value !== '');
const getOutputAddress = output => output?.scriptpubkey_address ||
  output?.scriptPubKey?.address || output?.scriptPubKey?.addresses?.[0] || '';
const getInputAddress = input => getOutputAddress(input?.prevout || input?.prevOut) || input?.address || '';
const testHarness = new Function('firstValue', 'txObject', 'getInputAddress',
  'getOutputAddress', 'getOutputType', 'canonicalCoinForRow', 'normalizePersonalAccount',
  'state', 'makeInlinePre', 'pretty', 'document', source.slice(begin, end) +
  '\nreturn {portalFinanceForRow,portalOutputSatoshis};');
const state = { personalAccount: { coin: 'litecoin', address: 'LTEST' } };
const finance = testHarness(firstValue, value => value?.tx || value, getInputAddress,
  getOutputAddress, () => 'p2pkh', row => row.coin || 'litecoin',
  account => account?.address ? account : null, state, () => null, JSON.stringify, {});
const esplo = (address, value) => ({ scriptpubkey_address: address, value });

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
