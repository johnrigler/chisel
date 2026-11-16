/* Chisel subject-index records: interpret only what the transaction actually carries. */
(function (root) {
  "use strict";
  const B58 = /^[1-9A-HJ-NP-Za-km-z]{26,40}$/;
  const TXID = /^[0-9a-f]{64}$/i;
  const HASH = /^(?:sha256:)?([0-9a-f]{64})$/i;
  const COMMONS_URL = "https://johnrigler.github.io/commons/tools/ledger-reference.html";
  const outputAddress = output => {
    const spk = output && output.scriptPubKey || {};
    return String(output && (output.scriptpubkey_address || output.address || output.addr) ||
      spk.address || (Array.isArray(spk.addresses) && spk.addresses[0]) || (Array.isArray(output && output.addresses) && output.addresses[0]) || "");
  };
  const outputsOf = data => {
    const tx = data && data.tx && typeof data.tx === "object" ? data.tx : data;
    return tx && (Array.isArray(tx.vout) ? tx.vout : Array.isArray(tx.outputs) ? tx.outputs : []) || [];
  };
  function decodeAddress(address) {
    if (!B58.test(address) || !/^L[CK]x/.test(address) || address.length <= 9) return null;
    const raw = address.slice(3, -6).replace(/z+$/g, "");
    if (!raw || raw.length > 40 || !/^[A-Za-z1-9xyvwoicz]+$/.test(raw)) return null;
    // The display is a reading of the inscription, not an identity assertion.
    const text = raw.replace(/x/g, " ").replace(/y/g, "-").replace(/v/g, ".")
      .replace(/w/g, ":").replace(/o/g, "O").replace(/i/g, "I").replace(/c/g, "0").trim();
    if (!/^[a-zA-Z0-9 .:-]+$/.test(text)) return null;
    const words = text.split(/(\s+)/);
    const label = words.map(part => /\s+/.test(part) ? part : part.toLowerCase().replace(/(^|[-:])([a-z])/g, (_m, mark, c) => mark + c.toUpperCase())).join("");
    return {address, label, rawText: text};
  }
  function safeUrl(value) {
    try {
      const url = new URL(String(value || "").trim());
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch (_error) { return ""; }
  }
  function interpret(data, txid, payloadFromOutput) {
    if (!data) return null;
    const outputs = outputsOf(data);
    const topic = outputs.map(output => decodeAddress(outputAddress(output))).find(Boolean);
    if (!topic) return null;
    const payloads = outputs.map(output => payloadFromOutput(output)).filter(p => p && typeof p.text === "string");
    const digestText = payloads.map(p => p.text.trim()).find(t => HASH.test(t));
    const sha256 = digestText ? digestText.match(HASH)[1].toLowerCase() : "";
    const url = payloads.map(p => safeUrl(p.text.trim())).find(Boolean) || "";
    if (!sha256 && !url) return null;
    return {
      address: topic.address, subject: topic.label, rawSubject: topic.rawText,
      sha256, url, txid: TXID.test(String(txid || "")) ? String(txid).toLowerCase() : "",
      kind: sha256 ? "sha256" : "link",
      bytesOnLedger: sha256 ? digestText.length : url.length
    };
  }
  function commonsHandoff(record) {
    if (!record || !record.sha256 || !TXID.test(record.txid)) return "";
    const params = new URLSearchParams({coin:"litecoin",txid:record.txid,sha256:record.sha256,subject:record.subject,address:record.address});
    return COMMONS_URL + "#" + params;
  }
  root.CHISEL_PORTAL_SUBJECT = Object.freeze({interpret, decodeAddress, commonsHandoff});
})(typeof window !== "undefined" ? window : globalThis);
