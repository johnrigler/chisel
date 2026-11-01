(function (root) {
  "use strict";

  const SCHEMA = "chisel-transaction-notes-v1", MAX_NOTE = 24000, MAX_METADATA = 65536;

  function metadata(value) {
    const result = typeof value === "string" ? (value.trim() ? JSON.parse(value) : {}) : value === undefined ? {} : value;
    if (typeof result !== "object" || Array.isArray(result) || result === null) throw new Error("Metadata must be a JSON object.");
    if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_METADATA) throw new Error("Metadata exceeds 64 KiB.");
    return result;
  }

  function normalize(value) {
    const source = value && typeof value === "object" ? value : {};
    let note = String(source.note || "");
    if (source.schema !== SCHEMA) note = [source.category ? "Category: " + source.category : "", note,
      source.fix ? "Follow-up:\n" + source.fix : ""].filter(Boolean).join("\n\n");
    if (note.length > MAX_NOTE) throw new Error("Note exceeds 24,000 characters.");
    const stamp = Number(source.updatedAt || 0);
    return {schema: SCHEMA, note: note, metadata: metadata(source.metadata), updatedAt: Number.isFinite(stamp) && stamp > 0 ? stamp : 0};
  }

  function hasContent(value) {
    const annotation = normalize(value);
    return !!(annotation.note.trim() || Object.keys(annotation.metadata).length);
  }

  function identity(row) {
    const store = root.CHISEL_PORTAL_STORE, coin = store.canonicalCoinForRow(row);
    const txid = String(row.txid || "").replace(/^0x/i, "").toLowerCase();
    if (!store.tickerForCoin(coin) || !/^[0-9a-f]{64}$/.test(txid)) throw new Error("Notes require a supported currency and TXID.");
    const result = {coin: coin, txid: txid};
    if (coin === "evm") {
      result.chainId = String(row.index && row.index.chainId || "137");
      result.sourceId = store.sourceIdForRow(row);
      if (!/^\d{1,15}$/.test(result.chainId) || !/^[a-zA-Z0-9_-]{1,80}$/.test(result.sourceId)) throw new Error("Invalid EVM notes identity.");
    }
    return result;
  }

  function path(row) {
    const id = identity(row);
    return "annotations/" + id.coin + "/" + (id.coin === "evm" ? id.chainId + "/" + id.sourceId + "/" : "") + id.txid + ".json";
  }

  function documentFor(row, value) { return Object.assign(identity(row), normalize(value)); }

  function parseDocument(row, value) {
    if (!value || value.schema !== SCHEMA) throw new Error("Unsupported transaction notes format.");
    const expected = identity(row);
    for (const field of Object.keys(expected)) if (String(value[field]) !== String(expected[field])) throw new Error("Transaction notes identity does not match this record.");
    return documentFor(row, value);
  }

  root.CHISEL_PORTAL_NOTES = {SCHEMA: SCHEMA, MAX_NOTE: MAX_NOTE, metadata: metadata,
    normalize: normalize, hasContent: hasContent, identity: identity, path: path, documentFor: documentFor, parseDocument: parseDocument};
})(window);
