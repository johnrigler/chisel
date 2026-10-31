(function (root) {
  "use strict";

  const MAX_RECORD_BYTES = 65536;
  let received = null, importError = "", snapshot = "", expanded = true, current = null;
  const object = value => value && typeof value === "object" && !Array.isArray(value);

  function webURL(value) {
    if (typeof value !== "string" || !value) return "";
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch (_) { return ""; }
  }

  function parseRecord(raw, text) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "string" || new TextEncoder().encode(raw).length > MAX_RECORD_BYTES) throw new Error("Shared record exceeds 65,536 bytes.");
    const value = JSON.parse(raw);
    if (!object(value) || value.schema !== "chisel-shared-record-v1" || value.opReturnText !== text ||
        !object(value.summary) || value.summary.opReturnText !== text ||
        (value.metadata !== undefined && !object(value.metadata)) ||
        (value.summary.mediaCards !== undefined && (!Array.isArray(value.summary.mediaCards) ||
          value.summary.mediaCards.length > 32 || !value.summary.mediaCards.every(object)))) {
      throw new Error("Shared record does not match this OP_RETURN text or has an unsupported format.");
    }
    return value;
  }

  function safeCard(card) {
    const copy = {};
    ["kind", "title", "text", "authorName", "videoId", "fetchedAt", "metadataSource"].forEach(key => {
      if (typeof card[key] === "string") copy[key] = card[key];
    });
    ["url", "sourceUrl", "thumbnailUrl", "authorUrl"].forEach(key => { copy[key] = webURL(card[key]); });
    return copy;
  }

  function buildDraft(values, record) {
    // Match the Send form's existing whitespace and HEX normalization exactly.
    const ascii = values.ascii.trim();
    const hex = root.CHISEL.resolveOpReturnHex({opReturnAscii: ascii, opReturnHex: root.CHISEL.normalizePushDataHex(values.hex)});
    let text = ascii;
    if (!ascii && hex) {
      try { text = new TextDecoder("utf-8", {fatal: true}).decode(Uint8Array.from(hex.match(/../g), byte => parseInt(byte, 16))); }
      catch (_) { text = ""; }
    }
    const matches = !!record && record.opReturnText === values.ascii && !values.hex.trim();
    const source = matches ? record.summary : {};
    const cards = Array.isArray(source.mediaCards) && source.mediaCards.length
      ? source.mediaCards.map(safeCard)
      : root.CHISEL_PORTAL.buildEvmMediaCardsFromValues([text], []).map(safeCard);
    const urls = Array.from(new Set(cards.map(card => card.sourceUrl || card.url).filter(Boolean)));
    const metadata = matches ? record.metadata || {} : {};
    const summary = {
      title: (typeof source.title === "string" && source.title) || metadata.title || (cards[0] && cards[0].title) || text || "Transaction draft",
      opReturnText: text, opReturnUrls: urls,
      primaryUrl: webURL(source.primaryUrl) || urls[0] || "", mediaCards: cards
    };
    // Transaction identity and funding are unknown until Build. Imported data
    // cannot supply a chain, output, key, fee, TXID or signing instruction.
    return {
      schema: "chisel-record-preview-v1", stage: "Draft — not sent",
      ledger: {coin: values.coin, opReturnText: text, opReturnHex: hex, bytes: hex.length / 2,
        recipients: values.recipients, requestedFee: values.fee, ipfs: values.ipfs,
        txid: null, inputs: null, change: null},
      portal: {coin: values.coin, txid: null, summary}, metadata,
      receivedRecord: matches ? record : null,
      metadataNotice: record && !matches ? "Content edited. The previous shared metadata is no longer used." : ""
    };
  }

  function formValues() {
    const $ = id => document.getElementById(id);
    if (!$("opReturnAscii") || !$("opReturnHex")) return null;
    return {
      coin: $("currency").value, ascii: $("opReturnAscii").value, hex: $("opReturnHex").value,
      fee: $("feeRvn").value, ipfs: $("ipfsField")?.value || "",
      recipients: Array.from(document.querySelectorAll("#recipientRows .recipientRow"), row => ({
        address: row.querySelector(".recipientAddress").value,
        amount: row.querySelector(".recipientAmount").value,
        outputType: row.dataset.outputType || "standard"
      }))
    };
  }

  function draw() {
    const container = document.getElementById("draftRecordRows");
    if (!container || !current) return;
    root.CHISEL_PORTAL.renderDraftRecord(container, current, {expanded, onToggle() { expanded = !expanded; draw(); }});
  }

  function refresh() {
    const panel = document.getElementById("draftRecordPreview");
    if (!panel || !root.CHISEL_PORTAL || !root.CHISEL) return;
    const values = formValues();
    if (!values) return;
    const next = JSON.stringify([values, received, importError]);
    if (next === snapshot) return;
    snapshot = next;
    panel.hidden = !values.ascii.trim() && !values.hex.trim() && !values.ipfs.trim() && !values.recipients.some(row => row.address || row.amount);
    const status = document.getElementById("draftRecordStatus");
    try {
      current = buildDraft(values, received);
      const warning = [importError, current.metadataNotice, current.ledger.bytes > 80 ? "Payload exceeds 80 bytes; the selected chain’s limits still apply." : ""].filter(Boolean).join(" ");
      status.textContent = warning || "Draft — not sent. Review the record, then Send below.";
      status.className = warning ? "help error" : "help";
      draw();
    } catch (error) {
      current = null;
      document.getElementById("draftRecordRows").replaceChildren();
      status.textContent = "Preview unavailable: " + error.message;
      status.className = "help error";
    }
  }

  function receive(raw, text) {
    received = null; importError = ""; expanded = true; snapshot = "";
    try { received = parseRecord(raw, text); }
    catch (error) { importError = "Shared metadata was not loaded: " + error.message; }
    refresh();
    return importError;
  }

  function capture(opReturnHex) {
    if (!current || current.ledger.opReturnHex !== opReturnHex) return null;
    return JSON.parse(JSON.stringify({opReturnHex, summary: current.portal.summary, metadata: current.metadata}));
  }

  root.CHISEL_RECORD_PREVIEW = Object.freeze({parseRecord, buildDraft, receive, refresh, capture});
  if (typeof document === "object") {
    const form = document.getElementById("sendCredentialForm");
    if (form) ["input", "change"].forEach(type => form.addEventListener(type, refresh));
  }
})(typeof window === "object" ? window : globalThis);
