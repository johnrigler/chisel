import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.style = {}; this.className = ""; this.value = ""; this.ownText = ""; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(""); }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get firstChild() { return this.children[0] || null; }
  get childNodes() { return this.children; }
  set innerHTML(value) { assert.equal(value, ""); this.replaceChildren(); }
  appendChild(child) { if (child.parentNode) child.parentNode.removeChild(child); this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
  replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.ownText = ""; children.forEach(child => this.appendChild(child)); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener() {}
  get classList() { return {contains: name => this.className.split(" ").includes(name), add: name => { this.className += " " + name; }}; }
}
const nodes = new Map();
const context = vm.createContext({URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, console, addEventListener() {},
  setTimeout() { return 1; }, clearTimeout() {},
  document: {readyState: "loading", addEventListener() {}, createElement: tag => new Element(tag),
    getElementById(id) { assert.notEqual(id, "senderWif", "preview must never read a key"); return nodes.get(id) || null; },
    querySelector(selector) { return nodes.get(selector) || null; }, querySelectorAll() { return []; }},
  localStorage: {getItem() { return null; }, setItem() { assert.fail("preview wrote storage"); }},
  fetch() { assert.fail("preview fetched a transaction or saved data"); }, location: {href: "https://chisel.example/"}
});
context.window = context;
for (const file of ["chisel.js", "chisel.portal.static-data.js", "chisel.portal.js", "chisel.record-preview.js"]) {
  vm.runInContext(await readFile(new URL("../" + file, import.meta.url), "utf8"), context);
}
const P = context.CHISEL_RECORD_PREVIEW, portal = context.CHISEL_PORTAL;
const url = "https://youtu.be/jNQXAC9IVRw?t=90";
const picture = "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg";
const record = {schema: "chisel-shared-record-v1", opReturnText: url,
  summary: {opReturnText: url, primaryUrl: url, title: "A complete shared title", mediaCards: [{kind: "youtube", url, sourceUrl: url,
    title: "A complete shared title", thumbnailUrl: picture, authorName: "Synthetic channel", videoId: "jNQXAC9IVRw"}]},
  metadata: {title: "A complete shared title", authorName: "Synthetic channel", fetchedAt: "2026-10-31T12:00:00Z", metadataSource: "https://www.youtube.com/oembed", extra: "Inspect every metadata field"}};
const values = {coin: "litecoin", ascii: url, hex: "", fee: "0.0001", ipfs: "", recipients: [{address: "LLxPUBLIC", amount: "0.00000546", outputType: "unspendable"}]};
const descendants = node => [node, ...node.children.flatMap(descendants)];

test("rich record parsing binds metadata to the exact shared text and rejects malformed or oversized records", () => {
  assert.equal(P.parseRecord(null, url), null);
  assert.equal(P.parseRecord(JSON.stringify(record), url).metadata.extra, record.metadata.extra);
  for (const raw of ["broken", "null", "[]", JSON.stringify({...record, schema: "unknown"}),
    JSON.stringify({...record, opReturnText: url + "1"}), JSON.stringify({...record, summary: {...record.summary, opReturnText: "another link"}}),
    JSON.stringify({...record, summary: {...record.summary, mediaCards: [null]}}), "é".repeat(32769)]) {
    assert.throws(() => P.parseRecord(raw, url));
  }
});

test("ledger preview uses form values and exact outgoing bytes, while imported metadata supplies display fields only", () => {
  const data = P.buildDraft(values, {...record, coin: "ravencoin", recipients: [{address: "ATTACKER"}], txid: "f".repeat(64), senderWif: "ignored"});
  assert.equal(data.ledger.opReturnHex, Buffer.from(url).toString("hex"));
  assert.equal(data.ledger.bytes, Buffer.byteLength(url));
  assert.equal(data.portal.summary.title, record.summary.title);
  assert.equal(data.portal.summary.mediaCards[0].thumbnailUrl, picture);
  assert.equal(data.metadata.extra, record.metadata.extra);
  assert.equal(data.ledger.coin, "litecoin");
  assert.equal(data.ledger.recipients[0].address, "LLxPUBLIC");
  assert.equal(data.portal.txid, null); assert.equal(data.ledger.inputs, null); assert.equal(data.ledger.change, null);
  assert.equal(data.ledger.requestedFee, values.fee);
});

test("editing text or switching to HEX removes the previous record's title, picture and metadata", () => {
  const changed = P.buildDraft({...values, ascii: "A different note"}, record);
  assert.equal(changed.portal.summary.title, "A different note");
  assert.equal(changed.receivedRecord, null); assert.equal(Object.keys(changed.metadata).length, 0);
  assert.equal(changed.portal.summary.mediaCards.length, 0);
  assert.match(changed.metadataNotice, /previous shared metadata/);
  const hex = P.buildDraft({...values, ascii: "", hex: Buffer.from("Hello ✓").toString("hex")}, record);
  assert.equal(hex.ledger.opReturnText, "Hello ✓"); assert.equal(hex.receivedRecord, null);
});

test("preview matches Send normalization and rejects conflicting or invalid payload fields", () => {
  assert.equal(P.buildDraft({...values, ascii: "  Hello\nworld  "}, null).ledger.opReturnHex, Buffer.from("Hello\nworld").toString("hex"));
  assert.equal(P.buildDraft({...values, ascii: "", hex: "0x00 ff"}, null).ledger.opReturnHex, "00ff");
  for (const input of [{ascii: "text", hex: "abcd"}, {ascii: "", hex: "xyz"}, {ascii: "", hex: "abc"}]) {
    assert.throws(() => P.buildDraft({...values, ...input}, null));
  }
});

test("unsafe media links are inert and invalid metadata cannot break the working text draft", () => {
  const bad = {...record, summary: {...record.summary, primaryUrl: "javascript:alert(1)", mediaCards: [{url: "javascript:alert(1)",
    thumbnailUrl: "https://user:secret@example.test/image.jpg", title: "<img onerror=alert(1)>"}]}};
  const data = P.buildDraft(values, bad);
  assert.equal(data.portal.summary.primaryUrl, "");
  assert.equal(data.portal.summary.mediaCards[0].url, "");
  assert.equal(data.portal.summary.mediaCards[0].thumbnailUrl, "");
  assert.match(P.receive("not-json", url), /metadata was not loaded/);
});

test("the actual Portal renderer shows one image and full metadata, expands independently, and never inserts the draft into its live stream", () => {
  const container = new Element("div"), before = JSON.stringify(portal.state.portalRows);
  const data = P.buildDraft(values, record);
  let toggles = 0;
  portal.renderDraftRecord(container, data, {expanded: true, onToggle() { toggles++; }});
  assert.equal(container.children.length, 1);
  const all = descendants(container);
  assert.equal(all.filter(node => node.className.includes("portalEvmMediaCard")).length, 1);
  assert.ok(all.some(node => node.tagName === "img" && node.src === picture));
  assert.match(container.textContent, /Synthetic channel/);
  assert.match(container.textContent, /Inspect every metadata field/);
  assert.match(container.textContent, /Draft|draft/);
  assert.doesNotMatch(container.textContent, /save local note|amount pending|verify tx/);
  const toggle = all.find(node => node.className.includes("portalExpandButton"));
  assert.equal(toggle.attributes["aria-expanded"], "true");
  toggle.onclick({preventDefault() {}, stopPropagation() {}}); assert.equal(toggles, 1);
  portal.renderDraftRecord(container, data, {expanded: false, onToggle() {}});
  assert.equal(descendants(container).filter(node => node.className === "portalInlineDetails").length, 0);
  assert.equal(JSON.stringify(portal.state.portalRows), before);
  assert.deepEqual(Object.keys(portal.state.expandedRowKeys), []);
});

test("a sent record leads the stream, renders pending/seen states on the same row, and survives a stream refresh", () => {
  const draft = P.buildDraft(values, record);
  const raw = {txid: "a".repeat(64), vin: [], vout: [{value: 0,
    scriptPubKey: {hex: "6a" + (draft.ledger.bytes).toString(16).padStart(2, "0") + draft.ledger.opReturnHex, type: "op_return"}}]};
  const publication = {coin: "litecoin", txid: raw.txid, raw,
    index: {coin: "litecoin", name: "litecoin", ticker: "LTC", canFetchTx: false},
    summary: draft.portal.summary, metadata: record.metadata, submittedAt: Date.now(), ledgerState: "awaiting-ledger", error: ""};
  const search = new Element("input"); search.value = "a filter hiding the new transaction";
  nodes.set("#portalEvmWordSearch", search);
  const future = {...publication, txid: "b".repeat(64), raw: {txid: "b".repeat(64)},
    summary: {title: "Existing future-dated row", blockTime: 4000000000}, ledgerState: "seen"};
  portal.presentPublication(future, {reveal: false});
  const row = portal.presentPublication(publication, {reveal: true});
  assert.equal(search.value, ""); assert.equal(portal.state.portalPage, 1);
  assert.equal(portal.state.portalRows[0], row, "awaiting record must lead even a future-dated row");
  assert.equal(portal.state.expandedRowKeys[row.key], true);
  const container = new Element("div");
  portal.renderStreamItem(container, row, {expanded: true, onToggle() {}});
  assert.match(container.firstChild.className, /isAwaitingLedger/);
  assert.match(container.textContent, /Awaiting ledger read/);
  assert.match(container.textContent, /Synthetic channel/);
  assert.ok(descendants(container).some(node => node.tagName === "img" && node.src === picture));
  publication.ledgerState = "seen";
  const observed = portal.presentPublication(publication, {reveal: false});
  assert.equal(observed, row); assert.equal(portal.state.portalRows.length, 2);
  container.replaceChildren(); portal.renderStreamItem(container, row, {expanded: true, onToggle() {}});
  assert.match(container.firstChild.className, /isLedgerSeen/);
  assert.doesNotMatch(container.firstChild.className, /isAwaitingLedger/);
  assert.match(container.textContent, /Seen by ledger/);
  assert.match(container.textContent, /not a block-confirmation claim/);
  portal.clearPortalStream("refresh");
  assert.equal(portal.state.portalRows.length, 2);
  assert.equal(portal.state.portalRowKeys[row.key].publication, publication);
  assert.equal(portal.state.portalRowKeys[row.key].txid, raw.txid);
  nodes.delete("#portalEvmWordSearch");
});
