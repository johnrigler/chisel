import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const uiSource = await read("chisel.interactions.ui.js");
const html = await read("index.html");
const portalSource = await read("chisel.portal.js");

function node(tag) {
  return {
    tag, className: "", textContent: "", hidden: false, title: "", dataset: {}, children: [],
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {},
    get isConnected() { return true; }
  };
}
function entry(kind, title, id, url = "") {
  return {seq: 1, endpoint: "https://example.org", receivedAt: "2026-11-15T17:20:00.000Z",
    document: {payload: {kind, title, id, url, at: "2026-11-15T17:20:00.000Z",
      subject: kind === "visit" ? null : {txid: id}}}};
}
function fixture(initialItems, saved = new Map()) {
  const ids = ["portalViewingNow", "portalInteractionHistory", "portalInteractionLatest",
    "portalInteractionStatus", "portalInteractionEnabled", "portalInteractionRefresh",
    "portalInteractionExport", "portalInteractionClear"];
  const elements = new Map(ids.map(id => [id, node(id)]));
  const doc = {hidden: false, body: {dataset: {mode: "portal"}},
    createElement: node, getElementById: id => elements.get(id), addEventListener() {}};
  let items = initialItems, historyKinds = [];
  const records = [];
  const client = {
    session: "local-session",
    state: {enabled: true, online: true, storageAvailable: true, outbox: [], error: ""},
    feed: () => ({items, hasMore: false, busy: false, loaded: true, error: ""}),
    subscribe: () => () => {},
    record: (...args) => { records.push(args); return Promise.resolve(); },
    refresh: () => Promise.resolve(), flush: () => Promise.resolve(),
    clearLocal: () => { items = []; }
  };
  const root = {document: doc,
    localStorage: {getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: key => saved.delete(key)},
    CHISEL_INTERACTIONS: {publicUrl: value => value},
    CHISEL_PORTAL_VIEW: {createList: () => ({
      render: (_list, owners) => { historyKinds = owners.map(owner => owner.entry.document.payload.kind); }
    })},
    addEventListener() {}, setInterval: () => 1, clearInterval() {}, setTimeout() {}};
  vm.runInNewContext(uiSource, {window: root, URL}, {filename: "chisel.interactions.ui.js"});
  const view = root.CHISEL_INTERACTIONS_UI.create({client, document: doc, open() {}});
  return {view, saved, elements, records, setItems: value => { items = value; },
    get historyKinds() {return historyKinds;}};
}

test("Viewing now ignores Arrived and previews the last selected video", () => {
  const app = fixture([entry("visit", "Chisel", "a"), entry("select",
    "Eric Clapton on understanding JJ Cale's music", "b",
    "https://www.youtube.com/watch?v=abcdefghijk")]);
  app.view.paint();
  const preview = app.elements.get("portalInteractionLatest");
  assert.equal(preview.children.find(child => child.className === "portalViewingNowTitle").textContent,
    "Eric Clapton on understanding JJ Cale's music");
  assert.equal(preview.children.find(child => child.className === "portalViewingNowThumb").src,
    "https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg");
  assert.deepEqual(app.historyKinds, ["select"]);
  app.view.start();
  assert.deepEqual(app.records, [], "Opening Chisel must not log an arrival");
});

test("Viewing now keeps the browser's own selection after a new arrival or reload", () => {
  const saved = new Map();
  const app = fixture([entry("visit", "Chisel", "a"), entry("select", "Other selection", "b")], saved);
  app.view.rememberSelection({title: "My Eric Clapton record",
    url: "https://youtu.be/abcdefghijk", subject: {txid: "a"}});
  assert.ok(saved.has("chisel.portal.lastSelected.v1"));
  app.setItems([entry("visit", "Chisel", "c"), entry("select", "Another visitor's video", "d")]);
  app.view.paint();
  const preview = app.elements.get("portalInteractionLatest");
  assert.equal(preview.children.find(child => child.className === "portalViewingNowTitle").textContent,
    "My Eric Clapton record");
  const reloaded = fixture([entry("visit", "Chisel", "e")], saved);
  reloaded.view.paint();
  assert.equal(reloaded.elements.get("portalInteractionLatest").children[0].className, "portalViewingNowThumb");
  assert.equal(reloaded.elements.get("portalInteractionLatest").children[1].textContent,
    "My Eric Clapton record");
});

test("No selected record displays neutral empty state, not Arrived", () => {
  const app = fixture([entry("visit", "Chisel", "a")]);
  app.view.paint();
  const latest = app.elements.get("portalInteractionLatest");
  assert.equal(latest.children[0].textContent, "No record selected");
  assert.deepEqual(app.historyKinds, []);
});

test("Compact card and Portal selections are connected without mode-visit logging", () => {
  assert.match(html, /\.portalViewingNow\s*\{[^}]*justify-self:end/);
  assert.match(html, /class="portalViewingNowHeader"/);
  assert.match(html, /chisel\.interactions\.ui\.js\?rev=20261115-viewing-card-v2830/);
  assert.match(html, /chisel\.portal\.js\?rev=20261115-viewing-card-v2830/);
  assert.match(portalSource, /interactionView\.rememberSelection\(record\)/);
  assert.doesNotMatch(portalSource, /recordPortalInteraction\("visit"/);
});
