import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const files = ["chisel.js", "chisel.thunderwords.js", "chisel.portal.static-data.js", "chisel.portal.payload.js",
  "chisel.portal.store.js", "chisel.portal.record.js", "chisel.portal.js"];
const sources = await Promise.all(files.map(async file => [file, await readFile(new URL("../" + file, import.meta.url), "utf8")]));
const txid = "ab".repeat(32), dataUrl = "https://records.example/chisel-data/transactions/litecoin/" + txid + ".json";
const raw = {txid, vin: [], vout: [{value: 0, scriptpubkey: "6a0754657374696e67"}]};
const json = value => ({ok: true, status: 200, json: async () => value});

class Element {
  constructor(tag, doc) { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.attributes = {}; this.style = {}; this.className = ""; this.value = ""; this.ownText = ""; this.hidden = false; this.scrollTop = 0; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(""); }
  set textContent(value) { this.ownText = String(value); this.replaceChildren(); }
  get firstChild() { return this.children[0] || null; }
  get childNodes() { return this.children; }
  set innerHTML(value) { assert.equal(value, ""); this.ownText = ""; this.replaceChildren(); }
  appendChild(child) { if (child.parentNode) child.parentNode.removeChild(child); this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
  replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; children.forEach(child => this.appendChild(child)); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener() {}
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
  click() { this.ownerDocument.clicks.push(this); }
  get classList() { return {contains: name => this.className.split(" ").includes(name),
    add: name => { this.className += " " + name; },
    remove: name => { this.className = this.className.split(" ").filter(value => value !== name).join(" "); },
    toggle: (name, on) => { this.classList[on ? "add" : "remove"](name); }}; }
}

function fixture(href = "https://chisel.example/ipfs/bafyApp/?mode=portal&address=LSAVED#unrelated", responder) {
  const nodes = new Map(), events = new Map(), timers = new Map(), calls = [], clipboard = [], blobs = [];
  let serial = 0;
  const document = {readyState: "loading", hidden: false, clicks: [],
    addEventListener() {}, querySelector: selector => nodes.get(selector.slice(1)) || null, querySelectorAll: () => [],
    createElement: tag => new Element(tag, document)};
  document.body = new Element("body", document); document.body.dataset.mode = "portal";
  for (const id of ["portalListView", "portalTransactionList", "portalRecordPage", "portalRecordContent", "portalRecordHeading",
    "portalRecordUrl", "portalRecordStatus", "portalRecordSource", "portalRecordCopyLink", "portalRecordBack", "portalRecordDownload", "portalStatus", "portalEvmWordSearch"]) nodes.set(id, new Element("div", document));
  nodes.get("portalRecordPage").hidden = true;
  class BrowserURL extends URL {
    static createObjectURL(blob) { blobs.push(blob); return "blob:record-download"; }
    static revokeObjectURL() {}
  }
  const context = vm.createContext({URL: BrowserURL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, AbortController, Blob, console,
    location: {href}, document, scrollY: 450, isSecureContext: true,
    navigator: {clipboard: {writeText: async text => clipboard.push(text)}},
    addEventListener: (name, callback) => events.set(name, callback),
    setTimeout(callback, ms) { const key = ++serial; timers.set(key, {callback, ms}); return key; }, clearTimeout: key => timers.delete(key),
    scrollTo(options) { context.scrollY = options.top; },
    localStorage: {getItem() { return null; }, setItem() {}},
    fetch: async url => { calls.push(String(url)); if (responder) return responder(String(url)); throw new Error("Unexpected network request: " + url); }});
  const entries = [{url: href, state: null}]; let position = 0;
  context.history = {get state() { return entries[position].state; },
    pushState(state, _, url) { entries.splice(++position); entries.push({state, url}); context.location.href = url; },
    replaceState(state, _, url) { entries[position] = {state, url}; context.location.href = url; },
    back() { if (position) { context.location.href = entries[--position].url; events.get("popstate")?.(); } },
    forward() { if (position + 1 < entries.length) { context.location.href = entries[++position].url; events.get("popstate")?.(); } }};
  context.window = context;
  for (const [file, source] of sources) vm.runInContext(source, context, {filename: file});
  Object.assign(context.CHISEL_PORTAL.state.config, {backgroundHydrateTransactions: false, persistMainThunderwords: false});
  return {context, portal: context.CHISEL_PORTAL, record: context.CHISEL_PORTAL_RECORD, nodes, events, timers, calls, clipboard, blobs, entries};
}

function addRow(f, value = raw) {
  f.context.CHISEL_PORTAL_STARTER_DATA = {transactions: [{coin: "litecoin", txid, raw: value,
    rawUrl: dataUrl, summary: {title: "A readable note", opReturnText: "Testing"}}]};
  f.portal.loadEmbeddedStaticDataset();
  return f.portal.state.portalRows[0];
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test("record URLs preserve the app/IPFS path, identify currency and source, and exclude unrelated state", () => {
  const f = fixture();
  const url = f.record.recordUrl({coin: "ltc", txid}, f.context.location.href, dataUrl), route = f.record.parseRoute(url);
  assert.ok(url.startsWith("https://chisel.example/ipfs/bafyApp/?mode=portal&coin=litecoin&txid="));
  assert.equal(route.coin, "litecoin"); assert.equal(route.txid, txid); assert.equal(route.dataUrl, dataUrl);
  assert.equal(new URL(url).searchParams.has("address"), false); assert.equal(new URL(url).hash, "");
  const evm = f.record.parseRoute(f.record.recordUrl({coin: "evm", sourceId: "evmGomez", txid, index: {chainId: "137"}}, url));
  assert.equal(evm.sourceId, "evmGomez"); assert.equal(evm.chainId, "137");
  assert.equal(f.record.parseRoute("https://chisel.example/?mode=portal"), null);
  for (const coin of ["unknown", "", "litecoin&senderWif=secret"]) assert.throws(() => f.record.parseRoute("https://chisel.example/?coin=" + encodeURIComponent(coin) + "&txid=" + txid));
  assert.throws(() => f.record.parseRoute("https://chisel.example/?coin=litecoin&txid=broken"));
});

test("shared links exclude API credentials, private hosts and token-bearing source URLs", () => {
  const f = fixture();
  for (const source of ["javascript:alert(1)", "https://user:secret@example.com/a.json", "https://example.com/a.json?token=secret",
    "http://127.0.0.1:7799/tx", "http://192.168.1.2/data/a.json", "http://localhost/data/a.json"]) {
    assert.equal(new URL(f.record.recordUrl({coin: "litecoin", txid}, f.context.location.href, source)).searchParams.has("data"), false);
  }
});

test("open and Back preserve the existing list nodes, page, filter, expansion and scroll with no network reads", async () => {
  const f = fixture(), row = addRow(f), list = f.nodes.get("portalTransactionList");
  const existing = new Element("article", f.context.document); list.appendChild(existing); list.scrollTop = 225;
  f.portal.state.portalPage = 4; f.portal.state.expandedRowKeys[row.key] = true;
  f.nodes.get("portalEvmWordSearch").value = "keep this filter";
  await f.portal.openRecord(row.key);
  assert.equal(f.nodes.get("portalListView").hidden, true); assert.equal(f.nodes.get("portalRecordPage").hidden, false);
  assert.match(f.nodes.get("portalRecordContent").textContent, /Testing/);
  assert.equal(f.record.parseRoute(f.context.location.href).txid, txid);
  f.nodes.get("portalRecordCopyLink").onclick(); await flush();
  assert.equal(f.record.parseRoute(f.clipboard[0]).dataUrl, dataUrl);
  f.nodes.get("portalRecordBack").onclick();
  assert.equal(f.nodes.get("portalListView").hidden, false); assert.equal(f.nodes.get("portalRecordPage").hidden, true);
  assert.equal(list.children[0], existing); assert.equal(list.scrollTop, 225); assert.equal(f.context.scrollY, 450);
  assert.equal(f.portal.state.portalPage, 4); assert.equal(f.portal.state.expandedRowKeys[row.key], true);
  assert.equal(f.nodes.get("portalEvmWordSearch").value, "keep this filter"); assert.equal(f.calls.length, 0);
  f.context.history.forward(); await flush();
  assert.equal(f.nodes.get("portalRecordPage").hidden, false); assert.equal(f.calls.length, 0);
});

test("a fresh record URL reads its direct JSON source without an index, Python or ledger request", async () => {
  const href = "https://chisel.example/?mode=portal&coin=litecoin&txid=" + txid + "&data=" + encodeURIComponent(dataUrl);
  const f = fixture(href, url => { assert.equal(url, dataUrl); return json(raw); });
  await f.portal.loadRecordFromUrl();
  assert.equal(f.portal.state.portalRows.length, 1); assert.equal(f.portal.state.portalRows[0].raw.txid, txid);
  assert.equal(f.nodes.get("portalRecordSource").href, dataUrl);
  assert.match(f.nodes.get("portalRecordContent").textContent, /Testing/);
  assert.deepEqual(f.calls, [dataUrl]);
  f.nodes.get("portalRecordBack").onclick();
  assert.equal(f.nodes.get("portalListView").hidden, false); assert.equal(new URL(f.context.location.href).searchParams.has("txid"), false);
});

test("returning while a record is loading prevents a late completion from reopening the page", async () => {
  let release;
  const f = fixture(undefined, url => { assert.equal(url, dataUrl); return new Promise(resolve => { release = resolve; }); });
  const row = addRow(f, null), pending = f.portal.openRecord(row.key);
  await flush();
  f.nodes.get("portalRecordBack").onclick();
  release(json(raw)); await pending;
  assert.equal(f.nodes.get("portalRecordPage").hidden, true); assert.equal(f.nodes.get("portalListView").hidden, false);
  assert.equal(f.portal.state.portalRows.length, 1);
});

test("opening a record already loading in the background shares its pending read", async () => {
  let release;
  const f = fixture(undefined, url => { assert.equal(url, dataUrl); return new Promise(resolve => { release = resolve; }); });
  const row = addRow(f, null);
  row.localPath = "data/transactions/litecoin/" + txid + ".json";
  f.portal.state.config.backgroundHydrateTransactions = true;
  const background = f.portal.hydrateLocalRowsInBackground([row]);
  await flush();
  const opened = f.portal.openRecord(row.key);
  await flush();
  assert.equal(f.calls.length, 1);
  release(json(raw)); await Promise.all([opened, background]);
  assert.equal(f.nodes.get("portalRecordStatus").textContent, "");
  assert.match(f.nodes.get("portalRecordContent").textContent, /Testing/);
  assert.equal(f.calls.length, 1);
});

test("JSON download contains the public transaction and lossless payloads without identity or receipt state", async () => {
  const f = fixture(), screenshot = JSON.parse(await readFile(new URL("fixtures/portal-binary-opreturn.json", import.meta.url), "utf8"));
  const row = addRow(f, {...screenshot, txid});
  row.publication = {ledgerState: "awaiting-ledger", summary: {}, secret: "exclude-publication-state"};
  row.senderWif = "exclude-key";
  await f.portal.openRecord(row.key);
  f.nodes.get("portalRecordDownload").onclick();
  const saved = JSON.parse(await f.blobs[0].text());
  assert.equal(saved.schema, "chisel-record-v1"); assert.equal(saved.raw.txid, txid);
  assert.equal(saved.opReturn[0].kind, "binary"); assert.equal(saved.opReturn[0].bytes, 80);
  assert.equal(Buffer.from(saved.opReturn[0].base64, "base64").toString("hex"), saved.opReturn[0].hex);
  assert.equal(saved.summary.opReturnText, "");
  assert.doesNotMatch(JSON.stringify(saved), /exclude-key|exclude-publication-state|ledgerState/);
  assert.match(f.context.document.clicks[0].download, /^chisel-litecoin-[a-f0-9]{64}\.json$/);
  assert.equal(f.nodes.get("portalRecordPage").classList.contains("isAwaitingLedger"), true);
});
