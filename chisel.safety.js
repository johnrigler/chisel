(function () {
  'use strict';
  const C = window.CHISEL;
  if (!C) throw new Error('Load Chisel before transaction safety.');
  const MAX_INPUTS = 100;

  function units(value, label) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error((label || 'Amount') + ' must be non-negative safe integer units.');
    return value;
  }
  function sum(values) {
    return values.reduce(function (total, value) { return units(total + units(value), 'Total'); }, 0);
  }
  function outpoint(input) {
    const txid = String(input.txid || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(txid) || !Number.isInteger(input.vout) || input.vout < 0 || input.vout > 0xffffffff) throw new Error('Invalid input outpoint.');
    return txid + ':' + input.vout;
  }
  function feeLimit(baseFee, minimumFee) {
    return Math.min(units(baseFee) * 100, units(minimumFee) * 10);
  }
  function checkFee(fee, limit) {
    units(fee, 'Fee'); units(limit, 'Fee limit');
    if (fee <= 0 || fee > limit) throw new Error('Fee exceeds the local safety limit or is zero. No transaction was signed or sent.');
    return fee;
  }

  function inputVerifier(loadRaw, expectedScript) {
    if (typeof loadRaw !== 'function') throw new Error('Raw previous-transaction lookup is required before signing.');
    const cache = new Map();
    return async function verifyInput(input) {
      outpoint(input);
      const txid = input.txid.toLowerCase();
      if (!cache.has(txid)) cache.set(txid, (async function () {
        const raw = await loadRaw(txid);
        if (await C.transactionId(raw) !== txid) throw new Error('Previous transaction does not match its requested txid.');
        return C.parseRawTransactionDetailed(raw);
      })());
      const previous = await cache.get(txid), output = previous.vout[input.vout];
      if (!output) throw new Error('Previous transaction output does not exist.');
      if (expectedScript && output.scriptPubKey !== expectedScript) throw new Error('Input is not a plain P2PKH output controlled by this key.');
      if (output.valueSats <= 0) throw new Error('Cannot spend a zero-value input.');
      return { txid: txid, vout: input.vout, satoshis: output.valueSats, scriptPubKey: output.scriptPubKey,
        reportedSatoshis: input.satoshis, verified: true };
    };
  }

  async function selectInputs(utxos, options) {
    const opts = options || {}, seen = new Set(), selected = [];
    const candidates = utxos.slice().sort(function (a, b) { return Number(b.satoshis) - Number(a.satoshis); });
    candidates.forEach(function (input) {
      const key = outpoint(input);
      if (seen.has(key)) throw new Error('Duplicate UTXO in provider response.');
      seen.add(key); units(input.satoshis, 'Reported input amount');
    });
    const verify = inputVerifier(opts.loadRaw, opts.expectedScript);
    let total = 0;
    for (const input of candidates) {
      if (selected.length >= MAX_INPUTS) throw new Error('Transaction needs more than ' + MAX_INPUTS + ' inputs. Use smaller payments or consolidate in batches.');
      selected.push(await verify(input));
      total = sum(selected.map(function (row) { return row.satoshis; }));
      const fee = opts.feeForInputs(selected.length);
      checkFee(fee, opts.limitForFee(fee, selected.length));
      if (total >= sum([opts.recipientUnits, fee, opts.minimumChange || 547])) return { utxos: selected, totalUnits: total, feeUnits: fee };
    }
    throw new Error('Not enough verified balance for the recipients, fee, and non-dust change.');
  }

  async function expectedOutputs(vout, coin) {
    const outputs = [];
    for (const key of Object.keys(vout)) {
      if (key === 'ipfs') continue; // Node-specific zero-value IPFS output is displayed verbatim in review.
      if (key === 'data') { outputs.push({ script: C.buildOpReturnScript(vout[key]), value: 0 }); continue; }
      const payload = await C.base58CheckDecode(key);
      if (payload.length !== 21) throw new Error('Only plain P2PKH address outputs are supported.');
      outputs.push({ script: '76a914' + C.bytesToHex(payload.slice(1)) + '88ac', value: coin.coinToUnits(vout[key]), address: key });
    }
    return outputs;
  }

  async function audit(raw, options) {
    const opts = options || {}, decoded = C.parseRawTransactionDetailed(raw);
    if (decoded.segwit || decoded.vinCount > MAX_INPUTS) throw new Error('Only legacy transactions with at most ' + MAX_INPUTS + ' inputs can be signed here.');
    if (opts.vin && JSON.stringify(decoded.vin.map(outpoint)) !== JSON.stringify(opts.vin.map(outpoint))) throw new Error('Raw transaction inputs differ from the prepared inputs.');
    const verify = inputVerifier(opts.loadRaw, opts.expectedScript), inputs = [];
    for (const input of decoded.vin) inputs.push(await verify(input));
    const inputUnits = sum(inputs.map(function (input) { return input.satoshis; }));
    const outputUnits = sum(decoded.vout.map(function (output) { return output.valueSats; }));
    const feeUnits = checkFee(inputUnits - outputUnits, opts.feeLimit);
    if (opts.expectedFee !== undefined && feeUnits !== opts.expectedFee) throw new Error('Raw transaction fee differs from the prepared fee.');
    let expected = opts.vout ? await expectedOutputs(opts.vout, opts.coin) : [];
    if (opts.vout) {
      const remaining = decoded.vout.slice();
      expected.forEach(function (output) {
        const i = remaining.findIndex(function (actual) { return actual.valueSats === output.value && actual.scriptPubKey === output.script; });
        if (i < 0) throw new Error('Raw transaction outputs differ from the prepared recipients, change, or data.');
        remaining.splice(i, 1);
      });
      if (remaining.some(function (output) { return !opts.vout.ipfs || output.valueSats !== 0 || output.type !== 'op_return'; })) throw new Error('Raw transaction contains an unexpected output.');
    }
    return { inputCount: inputs.length, inputUnits: inputUnits, outputUnits: outputUnits, feeUnits: feeUnits,
      outputs: decoded.vout.map(function (output) {
        const named = expected.find(function (item) { return item.script === output.scriptPubKey; });
        return { address: named && named.address || '', valueUnits: output.valueSats, script: output.scriptPubKey, type: output.type };
      }) };
  }

  C.transactionSafety = Object.freeze({ MAX_INPUTS: MAX_INPUTS, sum: sum, feeLimit: feeLimit, checkFee: checkFee,
    inputVerifier: inputVerifier, selectInputs: selectInputs, audit: audit });
})();
