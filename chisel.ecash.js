/* Native eCash note etching. Load on demand; no requests or signing at import. */
import { Ecc, Script, Tx, TxBuilder, P2PKHSignatory, ALL_BIP143,
  OP_RETURN, pushBytesOp, fromHex, toHex, shaRmd160, ChronikClient } from './vendor/ecash-sdk-4.14.4.js';

export const DEFAULT_CHRONIK = 'https://chronik.e.cash';
export const MAX_NOTE_BYTES = 180;
export const MAX_FEE_SATS = 5000n;
const DUST = 546n, FEE_PER_KB = 1000n, MAX_INPUTS = 12;
const PREFIX = 'ZORKMID1 ';

export function endpointUrl(value = DEFAULT_CHRONIK) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash) throw new Error('Use an HTTPS endpoint without credentials, a query, or a fragment.');
  return url.href.replace(/\/$/, '');
}

export function chronikClient(url = DEFAULT_CHRONIK) { return new ChronikClient([endpointUrl(url)]); }
export function formatXec(sats) {
  const amount = BigInt(sats), sign = amount < 0n ? '-' : '', absolute = amount < 0n ? -amount : amount;
  return sign + (absolute / 100n).toString() + '.' + (absolute % 100n).toString().padStart(2, '0');
}
function noteScript(note) {
  if (typeof note !== 'string' || !note.trim() || new TextEncoder().encode(note).length > MAX_NOTE_BYTES) {
    throw new Error('Enter a note or IPFS address of 1–180 UTF-8 bytes.');
  }
  return Script.fromOps([OP_RETURN, pushBytesOp(new TextEncoder().encode(PREFIX + note))]);
}
function addressScript(address) {
  if (!/^ecash:q[a-z0-9]+$/.test(address)) throw new Error('Use an eCash mainnet P2PKH address.');
  const script = Script.fromAddress(address);
  if (script.bytecode.length !== 25 || script.bytecode[0] !== 0x76) throw new Error('Use an eCash P2PKH address.');
  return script;
}
function nativeCoins(snapshot, script) {
  if (snapshot.outputScript !== toHex(script.bytecode) || !Array.isArray(snapshot.utxos)) throw new Error('Chronik returned a different address script.');
  const seen = new Set();
  return snapshot.utxos.filter(coin => !coin.token && !coin.isCoinbase).map(coin => {
    const point = coin.outpoint || {}, id = point.txid + ':' + point.outIdx;
    if (!/^[a-f0-9]{64}$/.test(point.txid) || !Number.isSafeInteger(point.outIdx) || point.outIdx < 0 || point.outIdx > 0xffffffff || seen.has(id)) throw new Error('Invalid or duplicate Chronik outpoint.');
    seen.add(id);
    const sats = BigInt(coin.sats);
    if (sats <= 0n || sats > 2100000000000000n) throw new Error('Invalid native eCash amount.');
    return { ...coin, sats };
  }).sort((a, b) => a.sats === b.sats ? 0 : a.sats > b.sats ? -1 : 1);
}

/** Build locally. Returns signed bytes for review; never broadcasts. Token UTXOs are excluded. */
export function prepareEtch({ privateKeyHex, compressed = true, address, note, snapshot }) {
  const ecc = new Ecc(), sk = fromHex(privateKeyHex), script = addressScript(address), data = noteScript(note);
  try {
    if (!ecc.isValidSeckey(sk)) throw new Error('Invalid private key.');
    const pk = compressed ? ecc.derivePubkey(sk) : ecc.uncompressPk(ecc.derivePubkey(sk));
    if (toHex(Script.p2pkh(shaRmd160(pk)).bytecode) !== toHex(script.bytecode)) throw new Error('The recovery key does not control this address.');
    const coins = nativeCoins(snapshot, script), selected = [];
    for (const coin of coins.slice(0, MAX_INPUTS)) {
      selected.push(coin);
      let tx;
      try {
        tx = new TxBuilder({
          inputs: selected.map(c => ({ input: { prevOut: c.outpoint, signData: { sats: c.sats, outputScript: script } }, signatory: P2PKHSignatory(sk, pk, ALL_BIP143) })),
          outputs: [{ sats: 0n, script: data }, script],
        }).sign({ feePerKb: FEE_PER_KB, dustSats: DUST });
      } catch (error) {
        if (/Insufficient input sats/.test(error.message)) continue;
        throw error;
      }
      // The SDK may omit dust change. Always return change rather than burning a small input.
      if (tx.outputs.length !== 2 || tx.outputs[1].sats < DUST) continue;
      const fee = selected.reduce((sum, c) => sum + c.sats, 0n) - tx.outputs[1].sats;
      if (fee > MAX_FEE_SATS) throw new Error('The transaction fee exceeds the 50 XEC limit.');
      return Object.freeze({ network: 'ecash', address, note, rawTx: tx.toHex(), txid: tx.txid(),
        feeSats: fee.toString(), changeSats: tx.outputs[1].sats.toString(), byteLength: tx.serSize(),
        inputs: Object.freeze(selected.map(c => Object.freeze({ txid: c.outpoint.txid, outIdx: c.outpoint.outIdx, sats: c.sats.toString() }))) });
    }
    throw new Error('Insufficient non-token funds for the fee and at least 5.46 XEC returned as change. Fund this address, then refresh.');
  } finally { sk.fill(0); }
}

/** Recheck the reviewed transaction and spendable coins. Only an explicit UI action calls this. */
export async function broadcastEtch(client, review) {
  const script = addressScript(review.address), data = noteScript(review.note), tx = Tx.fromHex(review.rawTx);
  if (review.network !== 'ecash' || tx.txid() !== review.txid || tx.outputs.length !== 2 || tx.inputs.length !== review.inputs.length || tx.inputs.length > MAX_INPUTS ||
      tx.outputs[0].sats !== 0n || toHex(tx.outputs[0].script.bytecode) !== toHex(data.bytecode) ||
      toHex(tx.outputs[1].script.bytecode) !== toHex(script.bytecode) || tx.outputs[1].sats < DUST || tx.outputs[1].sats.toString() !== review.changeSats) throw new Error('The reviewed transaction changed. Prepare it again.');
  const snapshot = await client.address(review.address).utxos(), coins = nativeCoins(snapshot, script);
  const available = new Map(coins.map(c => [c.outpoint.txid + ':' + c.outpoint.outIdx, c.sats]));
  const used = new Set(); let total = 0n;
  tx.inputs.forEach((input, i) => {
    const point = input.prevOut, expected = review.inputs[i];
    const txid = typeof point.txid === 'string' ? point.txid : toHex(new Uint8Array(point.txid).reverse());
    const id = txid + ':' + point.outIdx;
    if (used.has(id) || txid !== expected.txid || point.outIdx !== expected.outIdx || available.get(id)?.toString() !== expected.sats) throw new Error('A reviewed input changed or is no longer available. Prepare again.');
    used.add(id); total += available.get(id);
  });
  const fee = total - tx.outputs[1].sats, minimum = (BigInt(tx.serSize()) * FEE_PER_KB + 999n) / 1000n;
  if (fee.toString() !== review.feeSats || fee < minimum || fee > MAX_FEE_SATS) throw new Error('Invalid reviewed fee. Prepare again.');
  const result = await client.broadcastTx(review.rawTx, false);
  if (result.txid !== review.txid) throw new Error('The broadcast response did not match the reviewed transaction. Check its transaction ID.');
  return result;
}

export async function nativeActivity(client, address) {
  const script = addressScript(address);
  const [snapshot, history] = await Promise.all([client.address(address).utxos(), client.address(address).history(0, 10)]);
  const spendable = nativeCoins(snapshot, script).reduce((sum, coin) => sum + coin.sats, 0n);
  return { spendableSats: spendable.toString(), txs: history.txs.map(tx => ({ txid: tx.txid, confirmed: Boolean(tx.block), timestamp: tx.block?.timestamp || tx.timeFirstSeen || 0 })) };
}
