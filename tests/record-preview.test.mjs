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
const savedMetadata = new Map();
const context = vm.createContext({URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, console, addEventListener() {},
  setTimeout() { return 1; }, clearTimeout() {},
  document: {readyState: "loading", addEventListener() {}, createElement: tag => new Element(tag),
    getElementById(id) { assert.notEqual(id, "senderWif", "preview must never read a key"); return nodes.get(id) || null; },
    querySelector(selector) { return nodes.get(selector) || null; }, querySelectorAll() { return []; }},
  localStorage: {getItem(key) { return savedMetadata.get(key) || null; }, setItem() { assert.fail("preview wrote storage"); }},
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

test("BlockCypher OP_RETURN script text appears in closed records even with a generic saved title", () => {
  const text = "Testing, testing.";
  const raw = {hash: "1".repeat(64), inputs: [], outputs: [
    {value: 0, script: "6a" + text.length.toString(16).padStart(2, "0") + Buffer.from(text).toString("hex")}
  ]};
  const row = {key: "blockcypher-note", coin: "litecoin", txid: raw.hash, raw,
    summary: {title: "transaction " + raw.hash.slice(0, 10)}};
  assert.equal(portal.extractSummary(raw, {coin: "litecoin"}).opReturnText, text);
  for (const expanded of [false, true, false]) {
    const container = new Element("div");
    portal.renderStreamItem(container, row, {expanded, onToggle() {}});
    const payload = descendants(container).find(node => node.className === "portalStreamOpReturn");
    assert.equal(payload?.textContent, text);
    assert.doesNotMatch(container.firstChild.className, /isCompactGeneric/);
    if (!expanded) assert.equal(descendants(container).filter(node => node.className === "portalInlineDetails").length, 0);
  }
});

test("all decoded OP_RETURN outputs remain visible as literal text beside media metadata", () => {
  const texts = [("<img src=x onerror=alert(1)> " + "Readable note. ".repeat(10)).trim(), "Second output"];
  const raw = {txid: "2".repeat(64), vin: [], vout: texts.map(text => ({value: 0,
    scriptPubKey: {asm: "OP_RETURN " + Buffer.from(text).toString("hex"), type: "nulldata"}}))};
  const row = {key: "multiple-notes", coin: "litecoin", txid: raw.txid, raw, summary: record.summary};
  const container = new Element("div"); portal.renderStreamItem(container, row, {expanded: false});
  const payload = descendants(container).find(node => node.className === "portalStreamOpReturn");
  assert.equal(payload.textContent, texts.join("\n"));
  assert.equal(payload.children.length, 0, "ledger text is never inserted as HTML");
  assert.match(container.textContent, /A complete shared title/);
  assert.ok(descendants(container).some(node => node.tagName === "img" && node.src === picture));
});

test("cached OP_RETURN notes display in full before raw data loads without repeating the title", () => {
  const text = "Visible from the summary. ".repeat(10).trim();
  const row = {key: "cached-note", coin: "litecoin", txid: "3".repeat(64),
    summary: {title: text.slice(0, 95) + "…", opReturnText: text}};
  const container = new Element("div"); portal.renderStreamItem(container, row, {expanded: false});
  const title = descendants(container).find(node => node.className === "portalStreamTitle");
  assert.equal(title.textContent, text);
  assert.match(container.firstChild.className, /hasOpReturnText/);
});

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

test("a sent record changes ledger color without changing visible content or layout, and survives refresh", () => {
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
  assert.equal(container.firstChild.attributes["aria-label"], "Transaction awaiting ledger read");
  assert.doesNotMatch(container.textContent, /Awaiting ledger read|Seen by ledger|Broadcast accepted|CHECK LEDGER NOW/);
  assert.match(container.textContent, /Synthetic channel/);
  assert.ok(descendants(container).some(node => node.tagName === "img" && node.src === picture));
  const pendingText = container.textContent;
  const shape = node => [node.tagName, node.className.replace(/isAwaitingLedger|isLedgerSeen/g, ""), node.children.map(shape)];
  const pendingShape = shape(container);
  const pendingTime = descendants(container).find(node => node.className === "portalStreamTime").textContent;
  assert.match(pendingTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  publication.ledgerState = "seen";
  const observed = portal.presentPublication(publication, {reveal: false});
  assert.equal(observed, row); assert.equal(portal.state.portalRows.length, 2);
  container.replaceChildren(); portal.renderStreamItem(container, row, {expanded: true, onToggle() {}});
  assert.match(container.firstChild.className, /isLedgerSeen/);
  assert.doesNotMatch(container.firstChild.className, /isAwaitingLedger/);
  assert.equal(container.firstChild.attributes["aria-label"], "Transaction observed by ledger");
  assert.equal(container.textContent, pendingText);
  assert.deepEqual(shape(container), pendingShape);
  portal.clearPortalStream("refresh");
  assert.equal(portal.state.portalRows.length, 2);
  assert.equal(portal.state.portalRowKeys[row.key].publication, publication);
  assert.equal(portal.state.portalRowKeys[row.key].txid, raw.txid);
  nodes.delete("#portalEvmWordSearch");
});

test("a fetched ledger result replaces the submitted data in the same row and later receipt updates retain it", async () => {
  const txid = "d".repeat(64);
  const draft = P.buildDraft(values, record);
  const publication = {coin: "litecoin", txid, raw: {txid, vin: [], vout: []},
    index: {coin: "litecoin", name: "local-receipt", ticker: "LTC", canFetchTx: false},
    summary: draft.portal.summary, metadata: record.metadata, submittedAt: 1793450000000, ledgerState: "awaiting-ledger", error: ""};
  const row = portal.presentPublication(publication, {reveal: false});
  const ledgerRaw = {txid, status: {block_time: 1793451000, block_height: 3200000}, fee: 1000,
    vin: [{prevout: {scriptpubkey_address: "LTEST", value: 50000}}],
    vout: [{scriptpubkey_address: "LTEST", value: 49000}, {value: 0, scriptpubkey: "6a00"}]};
  const entry = {coin: "litecoin", name: "litecoinGeneral", ticker: "LTC", label: "live Litecoin", canFetchAddress: true, canFetchTx: true};
  context.CHISEL_THUNDERWORDS = {listIndexes: () => [entry], getTxUrl: () => "https://explorer.example/tx/" + txid,
    async fetchAddressTransactions(index) { return {index, transactions: [{txid, raw: ledgerRaw}]}; }};
  portal.state.personalAccount = null;
  try {
    const size = portal.state.portalRows.length;
    await portal.loadAddressIndex(entry, "LTEST");
    portal.state.personalAccount = {coin: "litecoin", address: "LTEST"};
    assert.equal(portal.state.portalRows.length, size);
    assert.equal(portal.state.portalRowKeys[row.key], row);
    assert.equal(row.raw, ledgerRaw);
    assert.equal(row.summary.blockTime, 1793451000);
    assert.equal(row.summary.blockHeight, 3200000);
    assert.equal(row.index.name, "litecoinGeneral");
    assert.equal(row.publication.ledgerState, "awaiting-ledger", "discovery does not bypass the independent byte check");
    publication.ledgerState = "seen";
    assert.equal(portal.presentPublication(publication, {reveal: false}), row);
    assert.equal(row.raw, ledgerRaw, "seen notification must not restore the local raw copy");
    assert.equal(row.summary.blockTime, 1793451000);
    assert.equal(row.index.name, "litecoinGeneral");
    assert.equal(row.discoverySource, "live-search");
    assert.equal(row.summary.title, record.summary.title);
    const container = new Element("div");
    portal.renderStreamItem(container, row, {expanded: false});
    assert.match(container.firstChild.className, /isLedgerSeen/);
    assert.match(container.textContent, /-0\.00001000 LTC/);
    assert.match(container.textContent, /fee 1,000 sat/);
    assert.doesNotMatch(container.textContent, /outputs |Seen by ledger|sent /);
    assert.ok(descendants(container).some(node => node.tagName === "img" && node.src === picture));
    portal.clearPortalStream("refresh");
    assert.equal(portal.state.portalRowKeys[row.key].raw, ledgerRaw);
  } finally {
    delete context.CHISEL_THUNDERWORDS;
    portal.state.personalAccount = null;
  }
});

test("cached and submitted UTXO copies share chain/TXID identity while mainnet and testnet stay distinct", () => {
  const txid = "e".repeat(64);
  const raw = {txid, vin: [], vout: [], blocktime: 1793451000};
  context.CHISEL_PORTAL_STARTER_DATA = {transactions: [{coin: "litecoin", txid: txid.toUpperCase(),
    sourceId: "saved-address-index", raw, summary: {title: "Saved transaction", blockTime: raw.blocktime}}]};
  portal.state.staticDatasetLoaded = false;
  try {
    portal.loadEmbeddedStaticDataset();
    const cached = portal.state.portalRowKeys["litecoin:" + txid];
    assert.ok(cached);
    const publication = {coin: "litecoin", txid, raw: {txid, vin: [], vout: []},
      summary: {title: "Reviewed title"}, index: {coin: "litecoin"}, metadata: {},
      submittedAt: 1793450000000, ledgerState: "awaiting-ledger", error: ""};
    const size = portal.state.portalRows.length;
    assert.equal(portal.presentPublication(publication, {reveal: false}), cached);
    assert.equal(portal.state.portalRows.length, size);
    assert.equal(cached.raw, raw, "a restored receipt retains an already loaded transaction");
    assert.equal(cached.publication.ledgerState, "awaiting-ledger", "a cache cannot mark the receipt observed");
    const testnet = portal.presentPublication({...publication, coin: "litecoinTestnet", index: {coin: "litecoinTestnet"}}, {reveal: false});
    assert.notEqual(testnet.key, cached.key);
    assert.equal(portal.state.portalRows.length, size + 1);
  } finally {
    delete context.CHISEL_PORTAL_STARTER_DATA;
  }
});

test("closed Netflix rows show saved title, description and a small picture; expanded records put that picture first", () => {
  const watch = "https://www.netflix.com/watch/00000001";
  const image = "https://gateway.example/ipfs/bafyImageFixture";
  const storageKey = "chisel.portal.pageMetadata.v1:" + encodeURIComponent(watch);
  savedMetadata.set(storageKey, JSON.stringify({schema: "chisel-page-metadata-v1", url: watch,
    title: "Plaything", description: "Synthetic Netflix episode metadata for this rendering test.", image}));
  const row = {key: "netflix-picture", coin: "litecoin", txid: "c".repeat(64),
    summary: {title: watch, primaryUrl: watch, mediaCards: [{kind: "link", url: watch, title: watch}]},
    raw: {txid: "c".repeat(64), vin: [], vout: [{value: 0, scriptPubKey: {hex: "6a00", type: "op_return"}}]}};
  try {
    const closed = new Element("div"); portal.renderStreamItem(closed, row, {expanded: false, onToggle() {}});
    assert.match(closed.textContent, /Plaything/); assert.match(closed.textContent, /Netflix/);
    assert.match(closed.textContent, /Synthetic Netflix episode metadata/);
    assert.equal(descendants(closed).filter(node => node.tagName === "img" && node.src === image).length, 1);
    assert.ok(descendants(closed).some(node => node.tagName === "a" && node.href === watch));
    assert.equal(descendants(closed).filter(node => node.className === "portalInlineDetails").length, 0);
    const open = new Element("div"); portal.renderStreamItem(open, row, {expanded: true, onToggle() {}});
    const details = descendants(open).find(node => node.className === "portalInlineDetails");
    assert.match(details.firstChild.className, /portalMediaHero/);
    const heroImages = descendants(details.firstChild).filter(node => node.tagName === "img");
    assert.equal(heroImages.length, 1); assert.equal(heroImages[0].src, image);
    assert.equal(descendants(details).filter(node => node.tagName === "img" && node.src === image).length, 1);
    assert.ok(descendants(details).some(node => node.className === "portalFinanceDetails" || node.textContent.includes("Raw transaction JSON")), "ledger details must remain available below the picture");
  } finally { savedMetadata.delete(storageKey); }
});

test("legacy Netflix preview metadata supplies the same picture to the closed and expanded views", () => {
  const watch = "https://www.netflix.com/watch/00000002";
  const storageKey = "chisel.portal.netflixMetadata.v1:" + encodeURIComponent(watch);
  savedMetadata.set(storageKey, JSON.stringify({title: "Plaything", artwork: "https://www.netflix.com/title/70264888"}));
  const row = {key: "legacy-netflix", coin: "evm", txid: "d".repeat(64), summary: {title: watch, primaryUrl: watch}};
  try {
    const closed = new Element("div"), open = new Element("div");
    portal.renderStreamItem(closed, row, {expanded: false, onToggle() {}});
    portal.renderStreamItem(open, row, {expanded: true, onToggle() {}});
    const small = descendants(closed).find(node => node.tagName === "img");
    const details = descendants(open).find(node => node.className === "portalInlineDetails");
    const big = descendants(details.firstChild).find(node => node.tagName === "img");
    assert.ok(small); assert.ok(big); assert.equal(small.src, big.src);
    assert.match(small.src, /\.nflxso\.net\//); assert.notEqual(small.src, watch);
    assert.match(closed.textContent, /Plaything/);
  } finally { savedMetadata.delete(storageKey); }
});

test("captured media titles remain visible without a local annotation and unsafe picture sources stay inert", () => {
  const watch = "https://www.netflix.com/watch/00000003";
  const row = {key: "fetched-netflix", coin: "evm", txid: "e".repeat(64), summary: {title: watch, primaryUrl: watch,
    mediaCards: [{kind: "link", url: watch, title: "Plaything", description: "Synthetic captured description", thumbnailUrl: "javascript:alert(1)"}]}};
  const closed = new Element("div"), open = new Element("div");
  portal.renderStreamItem(closed, row, {expanded: false, onToggle() {}});
  portal.renderStreamItem(open, row, {expanded: true, onToggle() {}});
  assert.match(closed.textContent, /Plaything/); assert.match(closed.textContent, /Synthetic captured description/);
  assert.doesNotMatch(open.textContent, /Netflix reference \(metadata not captured\)/);
  assert.equal(descendants(open).filter(node => node.tagName === "img").length, 0);
});
