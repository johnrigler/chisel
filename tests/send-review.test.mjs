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
