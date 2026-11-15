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
    tag, className: "", textContent: "", hidden: false, disabled: false,
    title: "", dataset: {}, children: [],
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {}, get isConnected() { return true; }
  };
}
function findClass(parent, name) {
  if ((parent.className || "").split(/\s+/).includes(name)) return parent;
  for (const child of parent.children || []) {
    const match = findClass(child, name);
    if (match) return match;
  }
  return null;
}
function entry(kind, title, id, txid = "", url = "", at = "2026-11-15T17:20:00.000Z") {
  return {seq: 1, endpoint: "https://example.org", receivedAt: at,
    document: {payload: {kind, title, id, url, at, synopsis: "",
      subject: txid ? {coin: "digibyte", txid} : null}}};
}
function fixture(initialItems, saved = new Map()) {
  const ids = ["portalViewingNow", "portalInteractionHistory", "portalInteractionLatest",
    "portalInteractionStatus", "portalInteractionEnabled", "portalInteractionRefresh",
    "portalInteractionExport", "portalInteractionClear"];
  const elements = new Map(ids.map(id => [id, node(id)]));
  const doc = {hidden: false, body: {dataset: {mode: "portal"}},
    createElement: node, getElementById: id => elements.get(id), addEventListener() {}};
  let items = initialItems, grouped = [];
  const recorded = [], opened = [], rendered = new Map();
  const client = {
    session: "local-session",
    state: {enabled: true, online: true, storageAvailable: true, outbox: [], error: ""},
    feed: () => ({items, hasMore: false, busy: false, loaded: true, error: ""}),
    subscribe: () => () => {},
    record: (...args) => { recorded.push(args); return Promise.resolve(); },
    refresh: () => Promise.resolve(), flush: () => Promise.resolve(),
    clearLocal: () => { items = []; }
  };
  const root = {document: doc,
    localStorage: {getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
      removeItem: key => saved.delete(key)},
    CHISEL_INTERACTIONS: {
      publicUrl: value => value,
      subjectKey: subject => subject.coin + ":" + subject.txid
    },
    CHISEL_PORTAL_VIEW: {createList: options => ({
      render: (_list, owners) => {
        grouped = owners.map(owner => owner.record);
        for (const owner of owners) {
          const previous = rendered.get(owner.key);
          if (previous) options.update(previous, owner);
          else rendered.set(owner.key, options.create(owner));
        }
        for (const key of rendered.keys()) if (!owners.some(owner => owner.key === key)) rendered.delete(key);
      }
    })},
    addEventListener() {}, setInterval: () => 1, clearInterval() {}, setTimeout() {}};
  vm.runInNewContext(uiSource, {window: root, URL}, {filename: "chisel.interactions.ui.js"});
  const view = root.CHISEL_INTERACTIONS_UI.create({client, document: doc,
    open: subject => { opened.push(subject.coin + ":" + subject.txid); }});
  return {view, saved, elements, recorded, opened, rendered,
    setItems: value => { items = value; },
    get grouped() { return grouped; }};
}

test("Viewing now ignores Arrived and opens the selected Portal record", () => {
  const app = fixture([entry("visit", "Chisel", "arrival"),
    entry("select", "Eric Clapton on understanding JJ Cale's music", "select-1", "tx-eric",
      "https://www.youtube.com/watch?v=abcdefghijk")]);
  app.view.paint();
  const preview = app.elements.get("portalInteractionLatest");
  assert.equal(findClass(preview, "portalViewingNowTitle").textContent,
    "Eric Clapton on understanding JJ Cale's music");
  assert.equal(findClass(preview, "portalViewingNowThumb").src,
    "https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg");
  assert.equal(preview.disabled, false);
  let stopped = 0;
  preview.onclick({preventDefault() { stopped++; }, stopPropagation() { stopped++; }});
  assert.deepEqual(app.opened, ["digibyte:tx-eric"]);
  assert.equal(stopped, 2);
  assert.deepEqual(app.grouped, [], "Current preview must not be repeated in expanded list");
  app.view.start();
  assert.deepEqual(app.recorded, [], "Opening Chisel must not log an arrival");
});

test("Duplicate events collapse by ledger record and show a popularity count", () => {
  const eric = "tx-eric", other = "tx-other";
  const app = fixture([
    entry("select", "Eric Clapton on JJ Cale", "eric-3", eric, "https://youtu.be/abcdefghijk", "2026-11-15T17:30:00.000Z"),
    entry("select", "Other song", "other-1", other),
    entry("engage", "Eric Clapton on JJ Cale", "eric-open", eric, "https://youtu.be/abcdefghijk", "2026-11-15T17:28:00.000Z"),
    entry("select", "Eric Clapton on JJ Cale", "eric-2", eric, "https://youtu.be/abcdefghijk", "2026-11-15T17:25:00.000Z"),
    entry("select", "Eric Clapton on JJ Cale", "eric-1", eric, "https://youtu.be/abcdefghijk", "2026-11-15T17:22:00.000Z"),
    entry("visit", "Chisel", "arrival")
  ]);
  app.view.paint();
  assert.equal(findClass(app.elements.get("portalInteractionLatest"), "portalViewedCount").textContent,
    "3 views · 1 media open");
  assert.deepEqual(app.grouped.map(row => row.key), ["digibyte:tx-other"]);
  assert.equal(app.grouped[0].views, 1);
  app.view.rememberSelection({title: "Other song", url: "", subject: {coin: "digibyte", txid: other}});
  assert.deepEqual(app.grouped.map(row => row.key), ["digibyte:tx-eric"]);
  assert.equal(app.grouped[0].views, 3);
  assert.equal(app.rendered.get("digibyte:tx-eric").children[0].children[1].children[1].textContent,
    "3 views · 1 media open");
  app.rendered.get("digibyte:tx-eric").children[0].onclick();
  assert.deepEqual(app.opened, ["digibyte:tx-eric"], "Grouped record should open the canonical Portal page");
});

test("Latest selected record survives reload with its ledger identity", () => {
  const saved = new Map(), txid = "tx-eric";
  const app = fixture([entry("select", "Older video", "a", "tx-old")], saved);
  app.view.rememberSelection({title: "My Eric Clapton record",
    url: "https://youtu.be/abcdefghijk", subject: {coin: "digibyte", txid}});
  assert.equal(JSON.parse(saved.get("chisel.portal.lastSelected.v1")).subject.txid, txid);
  const reloaded = fixture([entry("visit", "Chisel", "b")], saved);
  reloaded.view.paint();
  const preview = reloaded.elements.get("portalInteractionLatest");
  assert.equal(findClass(preview, "portalViewingNowTitle").textContent, "My Eric Clapton record");
  assert.equal(preview.disabled, false);
  preview.onclick({preventDefault() {}, stopPropagation() {}});
  assert.deepEqual(reloaded.opened, ["digibyte:tx-eric"]);
});

test("Legacy title-only cache can resolve a matching selection before opening", () => {
  const saved = new Map([["chisel.portal.lastSelected.v1",
    JSON.stringify({title: "Eric video", url: "https://youtu.be/abcdefghijk"})]]);
  const app = fixture([entry("select", "Eric video", "b", "tx-eric", "https://youtu.be/abcdefghijk")], saved);
  app.view.paint();
  assert.equal(JSON.parse(saved.get("chisel.portal.lastSelected.v1")).subject.txid, "tx-eric");
  assert.equal(app.elements.get("portalInteractionLatest").disabled, false);
});

test("No selected record displays a neutral non-clickable state", () => {
  const app = fixture([entry("visit", "Chisel", "arrival")]);
  app.view.paint();
  const latest = app.elements.get("portalInteractionLatest");
  assert.equal(findClass(latest, "portalViewingNowTitle").textContent, "No record selected");
  assert.equal(latest.disabled, true);
  assert.deepEqual(app.grouped, []);
});

test("Compact Portal links and release cache keys are current", () => {
  assert.match(html, /\.portalViewingNow\s*\{[^}]*justify-self:end/);
  assert.match(html, /id="portalInteractionLatest" type="button"|id="portalInteractionLatest" type="button"/);
  assert.match(html, /chisel\.interactions\.ui\.js\?rev=20261115-grouped-records-v2831/);
  assert.match(portalSource, /interactionView\.rememberSelection\(record\)/);
  assert.doesNotMatch(portalSource, /recordPortalInteraction\("visit"/);
});
