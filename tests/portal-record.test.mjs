import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const files = ["chisel.js", "chisel.thunderwords.js", "chisel.portal.static-data.js", "chisel.portal.payload.js",
  "chisel.portal.queue.js", "chisel.portal.view.js", "chisel.portal.store.js", "chisel.portal.notes.js", "chisel.portal.note-function.js", "chisel.portal.record.js", "chisel.portal.js"];
const sources = await Promise.all(files.map(async file => [file, await readFile(new URL("../" + file, import.meta.url), "utf8")]));
const txid = "ab".repeat(32), dataUrl = "https://records.example/chisel-data/transactions/litecoin/" + txid + ".json";
const raw = {txid, vin: [], vout: [{value: 0, scriptpubkey: "6a0754657374696e67"}]};
const json = (value, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => value});

class Element {
  constructor(tag, doc) { this.tagName = tag; this.nodeType = tag === "#text" ? 3 : 1; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.attributes = {}; this.style = {}; this.className = ""; this.value = ""; this.ownText = ""; this.hidden = false; this.scrollTop = 0; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(""); }
  set textContent(value) { this.replaceChildren(); if (this.nodeType === 3) this.ownText = String(value); else if (String(value)) { const node = new Element("#text", this.ownerDocument); node.ownText = String(value); this.appendChild(node); } }
  get nodeValue() { return this.nodeType === 3 ? this.ownText : null; }
  set nodeValue(value) { this.ownText = String(value); }
  get firstChild() { return this.children[0] || null; }
  get childNodes() { return this.children; }
  set innerHTML(value) { assert.equal(value, ""); this.ownText = ""; this.replaceChildren(); }
  appendChild(child) { if (child.parentNode) child.parentNode.removeChild(child); this.children.push(child); child.parentNode = this; return child; }
  insertBefore(child, before) { if (child === before) return child; if (child.parentNode) child.parentNode.removeChild(child); const at = before ? this.children.indexOf(before) : this.children.length; assert.ok(at >= 0); this.children.splice(at, 0, child); child.parentNode = this; return child; }
  replaceChild(child, old) { this.insertBefore(child, old); this.removeChild(old); return old; }
  contains(child) { for (let node = child; node; node = node.parentNode) if (node === this) return true; return false; }
  remove() { this.parentNode?.removeChild(this); }
  removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; }
  replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.ownText = ""; children.forEach(child => this.appendChild(child)); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener() {}
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
  click() { this.ownerDocument.clicks.push(this); }
  closest(selector) { for (let node = this; node; node = node.parentNode) if (node.classList.contains(selector.slice(1))) return node; return null; }
  get classList() { return {contains: name => this.className.split(" ").includes(name),
    add: name => { this.className += " " + name; },
    remove: name => { this.className = this.className.split(" ").filter(value => value !== name).join(" "); },
    toggle: (name, on) => { this.classList[on ? "add" : "remove"](name); }}; }
}

function fixture(href = "https://chisel.example/ipfs/bafyApp/?mode=portal&address=LSAVED#unrelated", responder) {
  const nodes = new Map(), events = new Map(), timers = new Map(), calls = [], clipboard = [], blobs = [], storage = new Map();
  let serial = 0;
  const document = {readyState: "loading", hidden: false, clicks: [],
    addEventListener() {}, querySelector: selector => nodes.get(selector.slice(1)) || null, querySelectorAll: () => [],
    createElement: tag => new Element(tag, document), createTextNode(text) { const node = new Element("#text", document); node.ownText = String(text); return node; }};
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
    removeEventListener: (name, callback) => { if (events.get(name) === callback) events.delete(name); },
    setTimeout(callback, ms) { const key = ++serial; timers.set(key, {callback, ms}); return key; }, clearTimeout: key => timers.delete(key),
    scrollTo(options) { context.scrollY = options.top; },
    localStorage: {getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); }},
    fetch: async (url, options) => { calls.push(String(url)); if (responder) return responder(String(url), options); throw new Error("Unexpected network request: " + url); }});
  const entries = [{url: href, state: null}]; let position = 0;
  context.history = {get state() { return entries[position].state; },
    pushState(state, _, url) { entries.splice(++position); entries.push({state, url}); context.location.href = url; },
    replaceState(state, _, url) { entries[position] = {state, url}; context.location.href = url; },
    back() { if (position) { context.location.href = entries[--position].url; events.get("popstate")?.(); } },
    forward() { if (position + 1 < entries.length) { context.location.href = entries[++position].url; events.get("popstate")?.(); } }};
  context.window = context;
  for (const [file, source] of sources) vm.runInContext(source, context, {filename: file});
  Object.assign(context.CHISEL_PORTAL.state.config, {backgroundHydrateTransactions: false, autoLoadTransactionNotes: false, persistMainThunderwords: false});
  return {context, portal: context.CHISEL_PORTAL, record: context.CHISEL_PORTAL_RECORD, nodes, events, timers, calls, clipboard, blobs, entries, storage};
}

function addRow(f, value = raw) {
  f.context.CHISEL_PORTAL_STARTER_DATA = {transactions: [{coin: "litecoin", txid, raw: value,
    rawUrl: dataUrl, summary: {title: "A readable note", opReturnText: "Testing"}}]};
  f.portal.loadEmbeddedStaticDataset();
  return f.portal.state.portalRows[0];
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const descendants = node => [node, ...node.children.flatMap(descendants)];

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

function addQueuedRows(f, count = 8) {
  f.context.CHISEL_PORTAL_STARTER_DATA = {transactions: Array.from({length: count}, (_, i) => {
    const id = (i + 1).toString(16).padStart(64, "0");
    return {coin: "litecoin", txid: id, localPath: "data/transactions/litecoin/" + id + ".json",
      rawUrl: "https://records.example/" + id + ".json", summary: {title: "Queued record " + i}};
  })};
  f.portal.loadEmbeddedStaticDataset();
  Object.assign(f.portal.state.config, {backgroundHydrateTransactions: true, autoHydrateLocalTransactions: true,
    autoSaveFetchedTransactions: false, cacheFetchedTransactionsWithFileProxy: false});
  return f.portal.state.portalRows.slice();
}

test("a visible date lookup and record expansion share one transaction request", async () => {
  let release;
  const f = fixture(undefined, () => new Promise(resolve => { release = resolve; }));
  const row = addQueuedRows(f, 1)[0];
  // Paint the list, then run its scheduled visible date/amount readers.
  const paint = Array.from(f.timers).find(([, timer]) => timer.ms === 0);
  assert.ok(paint); f.timers.delete(paint[0]); paint[1].callback();
  const readers = Array.from(f.timers).filter(([, timer]) => timer.ms === 0);
  for (const [id, timer] of readers) { f.timers.delete(id); timer.callback(); }
  await flush(); assert.equal(f.portal.state.pendingDateLookup[row.key], true);
  assert.equal(f.calls.length, 1);
  const opened = f.portal.openRecord(row.key); await flush(); assert.equal(f.calls.length, 1);
  release(json({...raw, txid: row.txid, status: {confirmed: true, block_time: 1788662610, block_height: 3172893}}));
  await opened; await flush();
  assert.equal(f.calls.length, 1); assert.equal(row.blockTime, 1788662610);
  assert.equal(f.portal.state.pendingDateLookup[row.key], undefined);
  assert.equal(f.portal.state.pendingHydration[row.key], undefined);
});

test("opening a queued record uses reserved capacity and shares the background transaction read", async () => {
  const releases = new Map();
  const f = fixture(undefined, url => new Promise(resolve => { releases.set(url, resolve); }));
  const rows = addQueuedRows(f), backgrounds = rows.map(row => f.portal.hydrateLocalRowsInBackground([row]));
  await flush(); assert.equal(f.calls.length, 5);
  const wanted = rows[7], url = wanted.staticRawUrl;
  assert.equal(f.calls.includes(url), false);
  const opened = f.portal.openRecord(wanted.key); await flush();
  assert.equal(f.calls.length, 6); assert.equal(f.calls.at(-1), url);
  releases.get(url)(json({...raw, txid: wanted.txid})); await opened;
  assert.equal(wanted.raw.txid, wanted.txid);
  for (const [url, release] of releases) release(json({...raw, txid: url.match(/([0-9a-f]{64})\.json$/)[1]}));
  await flush();
  for (const [url, release] of releases) release(json({...raw, txid: url.match(/([0-9a-f]{64})\.json$/)[1]}));
  await Promise.all(backgrounds);
  assert.equal(new Set(f.calls).size, rows.length); assert.equal(f.calls.length, rows.length);
});

test("reset drops queued reads and old completions cannot detach the new read for the same transaction", async () => {
  const releases = new Map();
  const f = fixture(undefined, url => new Promise(resolve => {
    if (!releases.has(url)) releases.set(url, []); releases.get(url).push(resolve);
  }));
  const oldRows = addQueuedRows(f), backgrounds = oldRows.map(row => f.portal.hydrateLocalRowsInBackground([row]));
  await flush(); assert.equal(f.calls.length, 5);
  const notes = f.portal.loadPortalAnnotation(oldRows[0], {force: true});
  f.portal.clearPortalStream("reset queue test"); await notes; await Promise.all(backgrounds);
  const fresh = addQueuedRows(f).find(row => row.txid === oldRows[0].txid), url = fresh.staticRawUrl;
  const opening = f.portal.openRecord(fresh.key); await flush();
  assert.equal(releases.get(url).length, 2); assert.equal(f.calls.length, 6);
  releases.get(url)[0](json({...raw, txid: fresh.txid})); await flush();
  assert.equal(fresh.raw, null);
  const reopened = f.portal.openRecord(fresh.key); await flush();
  assert.equal(releases.get(url).length, 2, "old cleanup cannot make a duplicate fetch necessary");
  releases.get(url)[1](json({...raw, txid: fresh.txid})); await Promise.all([opening, reopened]);
  assert.equal(fresh.raw.txid, fresh.txid); assert.equal(f.calls.length, 6, "obsolete queued transactions and notes never start");
  for (const [url, callbacks] of releases) for (const release of callbacks) release(json({...raw, txid: url.match(/([0-9a-f]{64})\.json$/)[1]}));
  await flush(); assert.equal(f.portal.state.portalRows.find(row => row.key === fresh.key), fresh);
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

test("FileProxy notes round-trip across browsers and export without rewriting transaction data", async () => {
  let saved = null;
  const responder = (url, options) => {
    if (url.endsWith("/save")) {
      const body = JSON.parse(options.body);
      assert.equal(body.path, "data/annotations/litecoin/" + txid + ".json");
      saved = JSON.parse(body.text);
      return json({ok: true, path: body.path});
    }
    return saved && url.includes("/fileproxy/raw?") ? json(saved) : json({}, 404);
  };
  const first = fixture(undefined, responder), row = addRow(first), before = JSON.stringify(row.raw);
  await first.portal.loadPortalAnnotation(row, {force: true});
  await first.portal.savePortalAnnotationToFileProxy(row, {note: "The trapezoid analysis", metadata: {title: "Trapezoid"}});
  assert.equal(saved.coin, "litecoin"); assert.equal(saved.txid, txid);
  assert.equal(first.portal.displayTitleForRow(row), "Trapezoid"); assert.equal(JSON.stringify(row.raw), before);
  const second = fixture(undefined, responder), copy = addRow(second);
  await second.portal.loadPortalAnnotation(copy, {force: true});
  await second.portal.openRecord(copy.key);
  assert.match(second.nodes.get("portalRecordContent").textContent, /The trapezoid analysis/);
  second.nodes.get("portalRecordDownload").onclick();
  const packet = JSON.parse(await second.blobs[0].text());
  assert.equal(packet.notes.note, "The trapezoid analysis"); assert.equal(packet.notes.metadata.title, "Trapezoid");
});

test("ordinary HTTP notes load when Python is unavailable and newer browser notes survive older mirrors", async () => {
  let document;
  const f = fixture(undefined, url => {
    if (url.includes("/fileproxy/")) throw new TypeError("Python unavailable");
    if (url.includes("/data-bundled/annotations/")) return json(document);
    return json({}, 404);
  });
  const row = addRow(f);
  f.portal.state.config.autoLoadTransactionNotes = true;
  document = f.context.CHISEL_PORTAL_NOTES.documentFor(row, {note: "Published HTTP context", metadata: {title: "Trapezoid"}, updatedAt: 10});
  await f.portal.loadPortalAnnotation(row);
  assert.equal(f.portal.getPortalAnnotation(row).note, "Published HTTP context");
  const calls = f.calls.length; await f.portal.loadPortalAnnotation(row); assert.equal(f.calls.length, calls);
  f.portal.setPortalAnnotation(row, {note: "A newer browser edit"});
  await f.portal.loadPortalAnnotation(row, {force: true});
  assert.equal(f.portal.getPortalAnnotation(row).note, "A newer browser edit");
});

test("a concurrently edited shared note is detected before writing and the draft remains intact", async () => {
  let document;
  const f = fixture(undefined, url => { assert.ok(url.includes("/fileproxy/raw?")); return json(document); });
  const row = addRow(f), N = f.context.CHISEL_PORTAL_NOTES;
  document = N.documentFor(row, {note: "Original shared note", updatedAt: 10});
  await f.portal.loadPortalAnnotation(row, {force: true});
  row.annotationDraft = {note: "Unsent work", metadataText: "", dirty: true};
  document = N.documentFor(row, {note: "Someone else's newer edit", updatedAt: 20});
  await assert.rejects(f.portal.savePortalAnnotationToFileProxy(row, {note: "Unsent work"}), /shared note changed/);
  assert.equal(row.annotationDraft.note, "Unsent work");
  assert.equal(f.portal.getPortalAnnotation(row).note, "Original shared note");
  assert.equal(f.calls.some(url => url.endsWith("/save")), false);
});

test("a failed FileProxy save preserves both the previous note and the unsent draft", async () => {
  let document;
  const f = fixture(undefined, url => url.endsWith("/save") ? json({ok: false, error: "disk full"}, 500) : json(document));
  const row = addRow(f);
  document = f.context.CHISEL_PORTAL_NOTES.documentFor(row, {note: "Saved note", updatedAt: 10});
  await f.portal.loadPortalAnnotation(row, {force: true});
  row.annotationDraft = {note: "Unsent work", metadataText: "", dirty: true};
  await assert.rejects(f.portal.savePortalAnnotationToFileProxy(row, {note: "Unsent work"}), /disk full/);
  assert.equal(f.portal.getPortalAnnotation(row).note, "Saved note"); assert.equal(row.annotationDraft.note, "Unsent work");
});

test("the two-field editor retains an active draft during background rendering and rejects invalid metadata", async () => {
  const f = fixture(), row = addRow(f);
  f.portal.setPortalAnnotation(row, {category: "old category", note: "Original note", fix: "A follow-up"});
  await f.portal.openRecord(row.key);
  const content = f.nodes.get("portalRecordContent"), controls = descendants(content);
  const fields = controls.filter(node => node.tagName === "textarea");
  assert.equal(fields.length, 2); assert.match(fields[0].value, /old category/); assert.match(fields[0].value, /A follow-up/);
  fields[0].value = "Keep my typing"; fields[0].oninput(); fields[0].focus();
  f.portal.setPortalAnnotation(row, {note: "A background update"});
  for (const [key, timer] of [...f.timers]) if (timer.ms === 0) { f.timers.delete(key); timer.callback(); }
  assert.ok(descendants(content).includes(fields[0])); assert.equal(fields[0].value, "Keep my typing");
  assert.match(byClass(content, "portalAnnotationText").textContent, /A background update/);
  fields[1].value = "invalid JSON"; fields[1].oninput();
  const save = descendants(content).find(node => node.textContent === "SAVE IN BROWSER");
  save.onclick({preventDefault() {}, stopPropagation() {}});
  assert.equal(f.portal.getPortalAnnotation(row).note, "A background update");
  assert.equal(row.annotationDraft.note, "Keep my typing"); assert.equal(row.annotationDraft.metadataText, "invalid JSON");
});

function paint(f) {
  const handle = f.portal.state.portalRenderHandle, timer = f.timers.get(handle);
  assert.ok(timer, "a Portal render was requested");
  f.timers.delete(handle); timer.callback();
}
function streamFixture(count = 2) {
  const f = fixture();
  Object.assign(f.portal.state.config, {autoFetchVisibleTransactionDates: false, autoFetchVisibleTransactionAmounts: false, portalPageSize: 2});
  f.context.CHISEL_PORTAL_STARTER_DATA = {transactions: Array.from({length: count}, (_, i) => ({coin: "litecoin", txid: (i + 1).toString(16).padStart(64, "0"),
    raw: {...raw, txid: (i + 1).toString(16).padStart(64, "0")}, summary: {title: "Record " + i, blockTime: 1700000000 - i * 100}}))};
  f.portal.loadEmbeddedStaticDataset(); paint(f);
  return f;
}
function refreshStream(f) {
  f.portal.state.staticDatasetLoaded = false;
  f.portal.loadEmbeddedStaticDataset(); paint(f);
}
const byClass = (node, name) => descendants(node).find(child => child.classList.contains(name));

test("an unrelated history update preserves mounted rows, an open editor, caret, payload control and disclosure", async () => {
  const f = streamFixture(), list = f.nodes.get("portalTransactionList"), row = f.portal.state.portalRows[0];
  const item = list.children[0], toggle = byClass(item, "portalExpandButton");
  await toggle.onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  const details = byClass(item, "portalInlineDetails"), fields = descendants(details).filter(node => node.tagName === "textarea");
  const editor = fields[0].closest(".portalAnnotationBlock").children.find(node => node.tagName === "details" && descendants(node).includes(fields[0]));
  editor.open = true; fields[0].value = "Typing through a ledger refresh"; fields[0].oninput(); fields[0].focus(); fields[0].selectionStart = 8; fields[0].selectionEnd = 12;
  const payload = descendants(details).find(node => node.tagName === "select"); payload.value = "hex"; payload.onchange();
  const drawer = byClass(details, "portalInlineDrawer"); drawer.open = true;
  const neighbor = list.children[1]; f.portal.setPortalAnnotation(f.portal.state.portalRows[1], {metadata: {title: "Updated neighbor"}});
  refreshStream(f);
  assert.equal(list.children[0], item); assert.equal(list.children[1], neighbor);
  assert.equal(byClass(item, "portalExpandButton"), toggle); assert.equal(byClass(item, "portalInlineDetails"), details);
  assert.equal(f.context.document.activeElement, fields[0]); assert.equal(fields[0].value, "Typing through a ledger refresh");
  assert.equal(fields[0].selectionStart, 8); assert.equal(fields[0].selectionEnd, 12); assert.equal(editor.open, true);
  assert.ok(descendants(details).includes(payload)); assert.equal(payload.value, "hex"); assert.equal(drawer.open, true);
  assert.match(neighbor.textContent, /Updated neighbor/); assert.equal(row.annotationDraft.dirty, true);
});

test("a changed transaction updates its own date, ledger state and amounts without replacing its editor", async () => {
  const f = streamFixture(), list = f.nodes.get("portalTransactionList"), row = f.portal.state.portalRows[0], item = list.children[0];
  row.publication = {ledgerState: "awaiting", submittedAt: 1700000001, summary: {}, metadata: {}}; refreshStream(f);
  await byClass(item, "portalExpandButton").onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  const note = descendants(item).find(node => node.tagName === "textarea"); note.value = "Unsent note"; note.oninput(); note.focus();
  const beforeTime = byClass(item, "portalStreamTime").textContent;
  row.publication.ledgerState = "seen";
  const incoming = f.context.CHISEL_PORTAL_STARTER_DATA.transactions[0];
  incoming.summary.blockTime += 3600;
  incoming.raw = {...incoming.raw, vin: [{prevout: {value: 100000, scriptpubkey_address: "LSource"}}],
    vout: [...raw.vout, {value: 99000, scriptpubkey_address: row.index.address}]};
  refreshStream(f);
  assert.equal(list.children[0], item); assert.ok(item.classList.contains("isLedgerSeen")); assert.equal(item.dataset.ledgerState, "seen");
  assert.notEqual(byClass(item, "portalStreamTime").textContent, beforeTime);
  assert.match(byClass(item, "portalStreamFinance").textContent, /\+0\.00099000 LTC/);
  assert.equal(descendants(item).find(node => node.tagName === "textarea"), note);
  assert.equal(note.value, "Unsent note"); assert.equal(f.context.document.activeElement, note);
});

test("shared note updates retain the dirty editor and its live save handler while refreshing displayed text", async () => {
  const f = streamFixture(), row = f.portal.state.portalRows[0], item = f.nodes.get("portalTransactionList").children[0];
  await byClass(item, "portalExpandButton").onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  const fields = descendants(item).filter(node => node.tagName === "textarea"), save = descendants(item).find(node => node.textContent === "SAVE IN BROWSER");
  fields[0].value = "My draft"; fields[0].oninput(); fields[1].value = '{"title":"My metadata"}'; fields[1].oninput(); fields[0].focus();
  f.portal.setPortalAnnotation(row, {note: "New shared text"}); refreshStream(f);
  assert.match(byClass(item, "portalAnnotationText").textContent, /New shared text/);
  assert.equal(descendants(item).find(node => node.textContent === "SAVE IN BROWSER"), save);
  save.onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  assert.equal(f.portal.getPortalAnnotation(row).note, "My draft"); assert.equal(f.portal.getPortalAnnotation(row).metadata.title, "My metadata");
  assert.equal(row.annotationDraft, null); assert.equal(fields[0].value, "My draft");
});

test("a running note function keeps its iframe, canvas and pending execution across its own record updates", async () => {
  const f = streamFixture(), row = f.portal.state.portalRows[0], item = f.nodes.get("portalTransactionList").children[0];
  f.portal.setPortalAnnotation(row, {note: "Drawing", metadata: {runtime: "canvas", canonicalJavaScript: "function draw(canvas){return canvas;}", entry: "draw"}});
  await byClass(item, "portalExpandButton").onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  const runtime = byClass(item, "portalNoteFunction"), frame = descendants(runtime).find(node => node.tagName === "iframe"), canvas = byClass(runtime, "portalNoteFunctionCanvas");
  const run = descendants(runtime).find(node => node.textContent === "RUN FUNCTION"); run.onclick();
  const timeout = Array.from(f.timers).find(([, timer]) => timer.ms === 6000)?.[0]; assert.ok(timeout); assert.equal(run.disabled, true);
  f.portal.setPortalAnnotation(row, {...f.portal.getPortalAnnotation(row), note: "A changed note, same function"});
  f.context.CHISEL_PORTAL_STARTER_DATA.transactions[0].summary.title = "New title"; refreshStream(f);
  assert.equal(byClass(item, "portalNoteFunction"), runtime); assert.ok(descendants(runtime).includes(frame)); assert.ok(descendants(runtime).includes(canvas));
  assert.equal(run.disabled, true); assert.equal(f.timers.has(timeout), true); assert.match(runtime.textContent, /Running function/);
  await byClass(item, "portalExpandButton").onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  assert.equal(f.timers.has(timeout), false); assert.equal(frame.parentNode, null); assert.equal(f.events.has("message"), false);
});

test("a changed function disposes its old runtime but keeps the open editor and row", async () => {
  const f = streamFixture(), row = f.portal.state.portalRows[0], item = f.nodes.get("portalTransactionList").children[0];
  f.portal.setPortalAnnotation(row, {metadata: {canonicalJavaScript: "function draw(canvas){return canvas;}", entry: "draw"}});
  await byClass(item, "portalExpandButton").onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  const runtime = byClass(item, "portalNoteFunction"), frame = descendants(runtime).find(node => node.tagName === "iframe"), note = descendants(item).find(node => node.tagName === "textarea");
  descendants(runtime).find(node => node.textContent === "RUN FUNCTION").onclick();
  f.portal.setPortalAnnotation(row, {metadata: {canonicalJavaScript: "function draw(canvas){canvas.width=200;}", entry: "draw"}}); refreshStream(f);
  assert.notEqual(byClass(item, "portalNoteFunction"), runtime); assert.equal(frame.parentNode, null);
  assert.equal(descendants(item).find(node => node.tagName === "textarea"), note); assert.equal(f.nodes.get("portalTransactionList").children[0], item);
  assert.equal(Array.from(f.timers.values()).some(timer => timer.ms === 6000), false);
});

test("record-page background changes retain the running function and its existing note controls", async () => {
  const f = streamFixture(), row = f.portal.state.portalRows[0];
  f.portal.setPortalAnnotation(row, {metadata: {canonicalJavaScript: "function draw(canvas){return canvas;}", entry: "draw"}});
  await f.portal.openRecord(row);
  const content = f.nodes.get("portalRecordContent"), runtime = byClass(content, "portalNoteFunction"), note = descendants(content).find(node => node.tagName === "textarea");
  const run = descendants(runtime).find(node => node.textContent === "RUN FUNCTION"); run.onclick();
  f.portal.setPortalAnnotation(row, {...f.portal.getPortalAnnotation(row), metadata: {...f.portal.getPortalAnnotation(row).metadata, title: "Changed while running"}}); refreshStream(f);
  assert.match(content.textContent, /Changed while running/); assert.equal(byClass(content, "portalNoteFunction"), runtime);
  assert.equal(descendants(content).find(node => node.tagName === "textarea"), note); assert.equal(run.disabled, true);
  f.nodes.get("portalRecordBack").onclick(); if (f.portal.state.portalRenderScheduled) paint(f);
  assert.equal(f.nodes.get("portalListView").hidden, false);
});

test("keyed ordering preserves a focused row while inserting, sorting and removing its siblings", () => {
  const f = fixture(), doc = f.context.document, list = doc.createElement("div"), disposed = [], moves = [], originalInsert = list.insertBefore;
  list.insertBefore = function (node, before) { if (node.parentNode === list) moves.push(node.dataset.key); return originalInsert.call(this, node, before); };
  const renderer = f.context.CHISEL_PORTAL_VIEW.createList({key: row => row.key,
    create(row) { const node = doc.createElement("article"); node.dataset.key = row.key; return node; }, update() {}, dispose: node => disposed.push(node.dataset.key)});
  const [a, b, c, d] = ["a", "b", "c", "d"].map(key => ({key}));
  renderer.render(list, [a, b, c]); const focused = list.children[1]; focused.focus();
  renderer.render(list, [c, d, b, a]);
  assert.deepEqual(list.children.map(node => node.dataset.key), ["c", "d", "b", "a"]); assert.equal(list.children[2], focused);
  assert.equal(moves.includes("b"), false); assert.equal(doc.activeElement, focused);
  renderer.render(list, [d, b]); assert.equal(list.children[1], focused); assert.deepEqual(disposed.sort(), ["a", "c"]);
  renderer.render(list, [{key: "b"}]); assert.notEqual(list.children[0], focused); assert.deepEqual(disposed.sort(), ["a", "b", "c", "d"]);
});

test("keyed rendering keeps the visible scroll anchor after a new transaction is inserted above it", () => {
  const f = fixture(), doc = f.context.document, list = doc.createElement("div"); list.getBoundingClientRect = () => ({top: 0, bottom: 100});
  const renderer = f.context.CHISEL_PORTAL_VIEW.createList({key: row => row.key, create(row) {
    const node = doc.createElement("article"); node.dataset.key = row.key;
    node.getBoundingClientRect = () => { const top = list.children.indexOf(node) * 40 - list.scrollTop; return {top, bottom: top + 40}; };
    return node;
  }, update() {}});
  const [a, b, c, d] = ["a", "b", "c", "d"].map(key => ({key}));
  renderer.render(list, [a, b, c]); list.scrollTop = 45; const visible = list.children[1], top = visible.getBoundingClientRect().top;
  renderer.render(list, [d, a, b, c]);
  assert.equal(visible.getBoundingClientRect().top, top); assert.equal(list.scrollTop, 85);
});

test("same-source thumbnails and the expanded media image remain mounted when the record text changes", async () => {
  const f = streamFixture(), row = f.portal.state.portalRows[0], item = f.nodes.get("portalTransactionList").children[0];
  const media = {title: "Video", url: "https://youtu.be/jNQXAC9IVRw", thumbnailUrl: "https://images.example/video.png"};
  f.portal.setPortalAnnotation(row, {metadata: {media}}); refreshStream(f);
  await byClass(item, "portalExpandButton").onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  const thumb = byClass(item, "portalStreamThumbImage"), hero = byClass(item, "portalEvmMediaThumb"); assert.ok(thumb); assert.ok(hero);
  f.portal.setPortalAnnotation(row, {note: "More context", metadata: {title: "Updated title", media}}); refreshStream(f);
  assert.equal(byClass(item, "portalStreamThumbImage"), thumb); assert.equal(byClass(item, "portalEvmMediaThumb"), hero);
  assert.match(item.textContent, /Updated title/);
});

test("pagination reuses focused page controls and disposes only the rows leaving the visible page", async () => {
  const f = streamFixture(4), list = f.nodes.get("portalTransactionList"), doc = f.context.document;
  const controls = doc.createElement("div"); f.nodes.set("portalPageControls", controls); refreshStream(f);
  const next = descendants(controls).find(node => node.textContent === "page2"); next.focus(); refreshStream(f);
  assert.equal(descendants(controls).find(node => node.textContent === "page2"), next); assert.equal(doc.activeElement, next);
  const old = list.children[0], row = f.portal.state.portalRows[0];
  f.portal.setPortalAnnotation(row, {metadata: {canonicalJavaScript: "function draw(canvas){return canvas;}", entry: "draw"}});
  await byClass(old, "portalExpandButton").onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  const frame = descendants(old).find(node => node.tagName === "iframe"); assert.ok(frame);
  next.onclick();
  assert.equal(f.portal.state.portalPage, 2); assert.equal(list.children.includes(old), false); assert.equal(frame.parentNode, null);
  assert.deepEqual(list.children.map(node => node.dataset.key), Array.from(f.portal.state.portalRows.slice(2, 4), row => row.key));
  assert.equal(Object.keys(f.portal.state.expandedRowKeys).length, 0);
});

test("resetting a stream with the same transaction ID creates a fresh view and disposes the old function", async () => {
  const f = streamFixture(), row = f.portal.state.portalRows[0], list = f.nodes.get("portalTransactionList"), old = list.children[0];
  f.portal.setPortalAnnotation(row, {metadata: {canonicalJavaScript: "function draw(canvas){return canvas;}", entry: "draw"}});
  await byClass(old, "portalExpandButton").onclick({preventDefault() {}, stopPropagation() {}}); paint(f);
  const frame = descendants(old).find(node => node.tagName === "iframe");
  f.portal.clearPortalStream(); f.portal.loadEmbeddedStaticDataset(); paint(f);
  assert.notEqual(f.portal.state.portalRows[0], row); assert.notEqual(list.children[0], old);
  assert.equal(frame.parentNode, null); assert.equal(byClass(list.children[0], "portalInlineDetails"), undefined);
});

test("a static image that reached its fallback source is retained when its logical source list is unchanged", () => {
  const f = fixture(), doc = f.context.document, mounted = doc.createElement("div"), next = doc.createElement("div");
  const image = doc.createElement("img"), incoming = doc.createElement("img");
  image.dataset.portalImageSource = incoming.dataset.portalImageSource = "https://first.example/image.png|https://fallback.example/image.png";
  image.src = "https://fallback.example/image.png"; incoming.src = "https://first.example/image.png";
  image.setAttribute("src", image.src); incoming.setAttribute("src", incoming.src);
  mounted.appendChild(image); next.appendChild(incoming);
  f.context.CHISEL_PORTAL_VIEW.patchChildren(mounted, next);
  assert.equal(mounted.firstChild, image); assert.equal(image.src, "https://fallback.example/image.png");
  assert.equal(image.getAttribute("src"), "https://fallback.example/image.png");
});
