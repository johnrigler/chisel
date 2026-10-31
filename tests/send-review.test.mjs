import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
function handler(name, next) {
  const start = app.indexOf('function ' + name + '('), end = app.indexOf('function ' + next + '(', start + 1);
  assert(start >= 0 && end > start);
  let source = app.slice(start, end).replace(/\s*(?:async )?$/, '');
  if (app.slice(start - 6, start) === 'async ') source = 'async ' + source;
  return source;
}
function flow(accepted = true) {
  const calls = [], tx = { rawHex: 'unsigned fixture' };
  const context = { window: {}, STATUS_DONE: 'sent',
    buildTransactionContext: async () => { calls.push('build'); return tx; },
    reviewTransactionContext: async (c, hex, manual, label) => { calls.push('review'); assert.equal(hex, tx.rawHex); assert.equal(label, 'Sign & broadcast'); if (!accepted) throw new Error('Transaction cancelled'); },
    signTransactionContext: async () => calls.push('sign'), sendTransactionContext: async () => calls.push('broadcast'),
    setStatusMessage: () => {}, setGuiMode: () => {},
  };
  vm.createContext(context); vm.runInContext(handler('runBuildSignDecodeSend', 'loadManualEditorsFromState'), context);
  return { calls, context };
}
test('declining the actual send review prevents signing and broadcast', async () => {
  const f = flow(false); await assert.rejects(f.context.runBuildSignDecodeSend(), /cancelled/);
  assert.deepEqual(f.calls, ['build', 'review']);
});
test('an accepted transaction is signed and broadcast only after its review', async () => {
  const f = flow(); await f.context.runBuildSignDecodeSend(); assert.deepEqual(f.calls, ['build', 'review', 'sign', 'broadcast']);
});
test('malicious minimum-fee response cannot change the fee or trigger a second signing flow', async () => {
  const fee = { value: '0.00010000' }, statuses = []; let runs = 0;
  const context = { window: {}, elems: { feeRvn: fee }, console: { error() {} },
    clearOutputs() {}, setLoadingState() {}, setStatusMessage: text => statuses.push(text),
    runBuildSignDecodeSend: async () => { runs++; throw new Error('min relay fee not met, 10000 < 99000000'); },
  };
  vm.createContext(context); vm.runInContext(handler('onClickSendButton', 'onKeydownSenderWif'), context);
  await context.onClickSendButton(); assert.equal(runs, 1); assert.equal(fee.value, '0.00010000'); assert.match(statuses[0], /change it yourself/);
});
test('manual signing also requires the audited review before invoking the signer', async () => {
  const calls = [], context = { rawHex: 'fixture', manual: true, coin: {} };
  const sandbox = { reviewTransactionContext: async () => { calls.push('review'); throw new Error('cancelled'); } };
  vm.createContext(sandbox); vm.runInContext(handler('signTransactionContext', 'sendTransactionContext'), sandbox);
  await assert.rejects(sandbox.signTransactionContext(context), /cancelled/); assert.deepEqual(calls, ['review']);
});

function broadcastFlow(fail = false) {
  const calls = [], modes = [];
  const context = {review: {feeUnits: 1000}, values: {rpcUrl: 'public-provider', explorerUrl: 'https://explorer.example/'},
    client: {publicClient: true}, signedHex: 'already-audited-signed-bytes', coin: {
      NAME: 'litecoin', USES_THIRD_PARTY_PROVIDERS: true,
      async sendRawTransaction() { calls.push('broadcast'); if (fail) throw Error('rejected'); return {txid: 'a'.repeat(64)}; },
      async getRawTransaction(client, values, txid) {
        assert.equal(client.publicClient, true); assert.equal(txid, 'a'.repeat(64));
        assert.deepEqual(Object.keys(values).sort(), ['explorerUrl', 'rpcUrl']);
        return 'live bytes';
      }
    }};
  Object.defineProperty(context.values, 'senderWif', {get() { assert.fail('receipt retained or read a WIF'); }});
  const sandbox = {console, window: {
    CHISEL_RECORD_PREVIEW: {capture() { return {summary: {title: 'Reviewed record'}}; }},
    CHISEL_PUBLICATION: {async publish(data, reader) {
      calls.push('insert'); assert.equal(data.coin, 'litecoin'); assert.equal(data.feeUnits, 1000);
      assert.equal(data.signedHex, context.signedHex); assert.equal(data.display.summary.title, 'Reviewed record');
      assert.doesNotMatch(JSON.stringify(data), /senderWif|privateKeyHex|account|client/);
      assert.equal(await reader('a'.repeat(64)), 'live bytes');
    }}}, auditTransactionContext: async () => calls.push('audit'),
    setStatusMessage() {}, logSafeSendStage() {}, setSendResultData() {}, setGuiMode: mode => modes.push(mode)};
  vm.createContext(sandbox); vm.runInContext(handler('sendTransactionContext', 'runBuildSignDecodeSend'), sandbox);
  return {calls, modes, run: () => sandbox.sendTransactionContext(context)};
}

test('accepted broadcasts insert their public Portal receipt and navigate to Portal', async () => {
  const f = broadcastFlow(); await f.run();
  assert.deepEqual(f.calls, ['audit', 'broadcast', 'insert']); assert.deepEqual(f.modes, ['portal']);
});

test('rejected broadcasts create no optimistic Portal record and do not redirect', async () => {
  const f = broadcastFlow(true); await assert.rejects(f.run(), /rejected/);
  assert.deepEqual(f.calls, ['audit', 'broadcast']); assert.deepEqual(f.modes, []);
});
