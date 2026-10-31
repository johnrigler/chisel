(function (root) {
  "use strict";

  const STORAGE_KEY = "chisel.portal.publications.v1";
  const LIMIT = 20;
  const RETRY_MS = [3000, 8000, 15000, 30000];

  async function prepare(options) {
    const coin = root.CHISEL.getCoin(options.coin);
    const decoded = root.CHISEL.parseRawTransactionDetailed(options.signedHex);
    const txid = await root.CHISEL.transactionId(decoded.hex);
    const outputs = await Promise.all(decoded.vout.map(async output => {
      const address = output.type === "p2pkh" ? await root.CHISEL.base58CheckEncode(
        root.CHISEL.concatBytes(new Uint8Array([coin.P2PKH_PREFIX]), root.CHISEL.hexToUint8Array(output.hash160))) : "";
      return {n: output.n, value: output.valueSats / coin.BASE_UNITS,
        scriptPubKey: {hex: output.scriptPubKey, type: output.type, addresses: address ? [address] : []}};
    }));
    const raw = {txid, version: decoded.version, locktime: decoded.locktime, hex: decoded.hex,
      vin: decoded.vin.map(input => ({txid: input.txid, vout: input.vout, scriptSig: {hex: input.scriptSig}})), vout: outputs};
    if (Number.isSafeInteger(options.feeUnits) && options.feeUnits >= 0) raw.fees = options.feeUnits;
    const index = {name: coin.NAME, coin: coin.NAME, ticker: coin.TICKER, label: coin.DISPLAY_NAME,
      canFetchTx: false, txUrlTemplate: coin.DEFAULT_EXPLORER_URL + "{txid}"};
    const summary = root.CHISEL_PORTAL.extractSummary(raw, index);
    const payloads = decoded.vout.filter(output => output.type === "op_return");
    const display = options.display;
    if (display && payloads.length === 1 && display.opReturnHex === payloads[0].opReturnHex) {
      ["title", "primaryUrl", "opReturnUrls", "mediaCards"].forEach(key => {
        if (display.summary && display.summary[key]) summary[key] = display.summary[key];
      });
    }
    // Everything retained here is public transaction/display data. Never pass
    // a signing context, WIF, account, or form/transport values to this record.
    return {coin: coin.NAME, txid, raw, index, summary,
      metadata: display && payloads.length === 1 && display.opReturnHex === payloads[0].opReturnHex ? display.metadata || {} : {},
      submittedAt: Number(options.submittedAt) || Date.now(), ledgerState: "awaiting-ledger", seenAt: null, error: ""};
  }

  function createTracker(options) {
    const entries = new Map();
    const emit = options.emit;
    const later = options.setTimeout || root.setTimeout.bind(root);
    const cancel = options.clearTimeout || root.clearTimeout.bind(root);

    function save() {
      try {
        if (!options.storage) return;
        const data = Array.from(entries.values()).slice(-LIMIT).map(entry => ({coin: entry.record.coin,
          signedHex: entry.record.raw.hex, feeUnits: entry.record.raw.fees, submittedAt: entry.record.submittedAt,
          display: {opReturnHex: root.CHISEL.stringToHex(entry.record.summary.opReturnText || ""),
            summary: entry.record.summary, metadata: entry.record.metadata}}));
        let json = JSON.stringify(data);
        while (data.length && json.length > 1000000) { data.shift(); json = JSON.stringify(data); }
        options.storage.setItem(STORAGE_KEY, json);
      } catch (_) {}
    }

    function schedule(entry) {
      if (entry.timer || entry.record.ledgerState === "seen") return;
      const delay = RETRY_MS[Math.min(Math.max(0, entry.attempts - 1), RETRY_MS.length - 1)];
      entry.timer = later(() => { entry.timer = null; check(entry.key); }, delay);
    }

    async function check(key) {
      const entry = entries.get(key);
      if (!entry || entry.busy || entry.record.ledgerState === "seen") return false;
      if (entry.timer) { cancel(entry.timer); entry.timer = null; }
      entry.busy = true;
      let timeout;
      try {
        // This calls a live node/provider reader, never Portal's local-first
        // transaction loader, the broadcast response, or the local signed copy.
        if (!entry.reading) {
          entry.reading = Promise.resolve().then(() => entry.readRaw(entry.record.txid)).finally(() => { entry.reading = null; });
        }
        const result = await Promise.race([entry.reading, new Promise((_, reject) => {
          timeout = later(() => reject(new Error("Ledger read timed out; retrying.")), 45000);
        })]);
        const hex = root.CHISEL.parseRawTransactionDetailed(typeof result === "string" ? result : result && result.hex).hex;
        if (hex !== entry.record.raw.hex || await root.CHISEL.transactionId(hex) !== entry.record.txid) {
          throw new Error("Ledger response did not match the sent transaction.");
        }
        if (entries.get(key) !== entry) return false;
        entry.record.ledgerState = "seen";
        entry.record.seenAt = Date.now();
        entry.record.error = "";
        emit(entry.record, false);
        save();
        return true;
      } catch (error) {
        if (entries.get(key) !== entry) return false;
        entry.record.error = String(error.message || error).slice(0, 240);
        entry.attempts++;
        emit(entry.record, false);
        schedule(entry);
        return false;
      } finally {
        cancel(timeout);
        entry.busy = false;
      }
    }

    async function publish(data, readRaw, reveal = true) {
      const record = await prepare(data);
      const key = record.coin + ":" + record.txid;
      const existing = entries.get(key);
      if (existing) { emit(existing.record, reveal); return existing.record; }
      const entry = {key, record, readRaw, timer: null, busy: false, attempts: 0};
      entries.set(key, entry);
      emit(record, reveal);
      save();
      // Paint the local record first, independently of the provider's speed.
      entry.timer = later(() => { entry.timer = null; check(key); }, 0);
      return record;
    }

    async function restore(readRawForCoin) {
      let rows;
      try {
        const json = options.storage && options.storage.getItem(STORAGE_KEY);
        rows = json && json.length <= 1000000 ? JSON.parse(json) : [];
      } catch (_) { return; }
      if (!Array.isArray(rows)) return;
      for (const data of rows.slice(-LIMIT)) {
        try {
          // Ignore persisted status claims. Rebuild the TXID from the bytes and
          // independently read it again before restoring black/seen status.
          await publish({coin: data.coin, signedHex: data.signedHex, feeUnits: data.feeUnits,
            submittedAt: data.submittedAt, display: data.display}, readRawForCoin(data.coin), false);
        } catch (_) {}
      }
    }

    return {publish, check, restore};
  }

  let storage = null;
  try { storage = root.sessionStorage; } catch (_) {}
  const tracker = createTracker({storage, emit(record, reveal) {
    root.CHISEL_PORTAL.presentPublication(record, {reveal});
  }});

  function defaultReader(name) {
    let client = null;
    const coin = root.CHISEL.getCoin(name);
    const values = {rpcUrl: coin.DEFAULT_RPC_URL, explorerUrl: coin.DEFAULT_EXPLORER_URL};
    return async txid => {
      if (!coin.USES_THIRD_PARTY_PROVIDERS && !client) { client = new root.CHISEL(values.rpcUrl); await client.load(); }
      return coin.getRawTransaction(client, values, txid);
    };
  }

  root.CHISEL_PUBLICATION = Object.freeze({prepare, createTracker,
    publish: tracker.publish, check: tracker.check, restore: () => tracker.restore(defaultReader)});
  if (typeof document === "object") {
    const restore = () => root.CHISEL_PUBLICATION.restore();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", restore, {once: true});
    else root.setTimeout(restore, 0);
  }
})(typeof window === "object" ? window : globalThis);
