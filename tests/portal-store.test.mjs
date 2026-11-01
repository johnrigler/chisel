import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

// No DOM, fetch, browser storage or timers are supplied to the module.
const context = vm.createContext({}, {codeGeneration: {strings: false, wasm: false}});
context.window = context;
vm.runInContext(await readFile(new URL("../chisel.portal.store.js", import.meta.url), "utf8"), context);
const S = context.CHISEL_PORTAL_STORE;
const fixture = JSON.parse(await readFile(new URL("fixtures/portal-store-v2818.json", import.meta.url), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));
const txid = "ab".repeat(32);

function createStore(options = {}) {
  return S.createStore({
    extractBlockTime(value) {
      const tx = value?.tx || value;
      return S.normalizeUnixTime(value?.summary?.blockTime ?? tx?.blocktime ?? 0);
    },
    normalizeMediaUrl(value) {
      const url = new URL(value);
      if (url.hostname === "youtu.be") return "https://www.youtube.com/watch?v=" + url.pathname.slice(1);
      return url.href;
    },
    ...options
  });
}

for (const scenario of fixture.scenarios) {
  test("2.8.18 parity: " + scenario.name, () => {
    const store = createStore();
    for (const step of scenario.steps) {
      const row = store.upsert(clone(step.row), step.options);
      assert.deepEqual(clone({key: row?.key || null, rows: store.records.portalRows}), step.expected);
      for (const existing of store.records.portalRows) {
        assert.equal(store.records.portalRowKeys[S.rowKey(existing)], existing, "rows and identity lookup share the same objects");
      }
    }
  });
}

test("the public state object remains writable and the store resets only its record fields", () => {
  const expanded = {["litecoin:" + txid]: true};
  const records = {portalRows: [], portalRowKeys: Object.create(null),
    selectedRowKey: "selected", expandedRowKeys: expanded, portalLoadGeneration: 4};
  const store = createStore({records});
  const row = store.upsert({coin: "litecoin", txid, summary: {title: "First title"}});
  assert.equal(store.records, records);
  assert.equal(store.upsert({coin: "ltc", txid, summary: {title: "Second title"}}), row);
  assert.equal(row.summary.title, "Second title");
  assert.equal(records.portalRows.length, 1);
  records.portalRows = [row];
  records.portalRowKeys = {[row.key]: row};
  assert.equal(store.upsert({coin: "litecoin", txid, summary: {opReturnText: "Testing, testing."}}), row);
  store.reset();
  assert.equal(records.portalRows.length, 0);
  assert.equal(Object.keys(records.portalRowKeys).length, 0);
  assert.equal(records.selectedRowKey, "selected");
  assert.equal(records.expandedRowKeys, expanded);
  assert.equal(records.portalLoadGeneration, 4);
});

test("recent display snapshots preserve the existing cache schema without storing receipt authority", () => {
  const saved = new Map();
  const adapters = {readStorage: key => saved.get(key), writeStorage: (key, value) => saved.set(key, value)};
  const first = createStore(adapters);
  const row = first.upsert({coin: "litecoin", txid, raw: {hex: "excluded raw bytes"},
    publication: {ledgerState: "seen", summary: {title: "Testing, testing."}},
    summary: {title: "Testing, testing.", opReturnText: "Testing, testing.",
      senderWif: "excluded field", ledgerFinance: {feeSat: 1000, outputTotalSat: 49000}}});
  first.snapshotRecent([row]);
  const json = saved.get("chisel.portal.recentDisplay.v1");
  const snapshot = JSON.parse(json);
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].key, "litecoin:" + txid);
  assert.equal(snapshot[0].summary.opReturnText, "Testing, testing.");
  assert.doesNotMatch(json, /publication|ledgerState|senderWif|excluded/);
  const second = createStore(adapters);
  const restored = second.upsert({coin: "litecoin", txid, summary: {title: "transaction ababababab", opReturnText: ""}});
  assert.equal(restored.summary.title, row.summary.title);
  assert.equal(restored.summary.opReturnText, row.summary.opReturnText);
  assert.equal(restored.summary.ledgerFinance.feeSat, 1000);
  assert.equal(restored.publication, undefined);
  assert.equal(restored.raw, undefined);
});

test("the caller controls snapshot priority and reset retains an in-memory snapshot without a write", () => {
  let writes = 0;
  const store = createStore({writeStorage() { writes++; }});
  const rows = Array.from({length: 80}, (_, i) => store.upsert({coin: "litecoin",
    txid: i.toString(16).padStart(64, "0"), summary: {opReturnText: "Note " + i, blockTime: i + 1}}));
  const ordered = rows.slice().reverse();
  store.snapshotRecent(ordered, false);
  assert.equal(writes, 0);
  store.reset();
  assert.equal(store.upsert({coin: "litecoin", txid: ordered[0].txid}).summary.opReturnText, "Note 79");
  assert.equal(store.upsert({coin: "litecoin", txid: ordered[59].txid}).summary.opReturnText, "Note 20");
  assert.equal(store.upsert({coin: "litecoin", txid: rows[0].txid}).summary.opReturnText, undefined);
});

test("unavailable or malformed storage does not prevent reading records and failed saves keep the prior snapshot", () => {
  const errors = [], saved = new Map([["chisel.portal.recentDisplay.v1", "malformed"]]);
  const store = createStore({readStorage: key => saved.get(key),
    writeStorage() { throw new Error("quota exceeded"); }, onStorageError: error => errors.push(error.message)});
  const row = store.upsert({coin: "litecoin", txid, summary: {opReturnText: "Visible note"}});
  store.snapshotRecent([row]);
  assert.equal(row.summary.opReturnText, "Visible note");
  assert.deepEqual(errors, ["quota exceeded"]);
  assert.equal(saved.get("chisel.portal.recentDisplay.v1"), "malformed");
  const unavailable = createStore({readStorage() { throw new Error("storage unavailable"); }});
  assert.ok(unavailable.upsert({coin: "litecoin", txid}));
});

test("the browser entry loads the store before Portal with relative script paths", async () => {
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const scripts = [...index.matchAll(/<script\b[^>]*\bsrc="([^"?]+)[^"]*"/g)].map(match => match[1]);
  const store = scripts.indexOf("chisel.portal.store.js"), portal = scripts.indexOf("chisel.portal.js");
  assert.ok(store >= 0 && portal > store);
  assert.equal(scripts.filter(path => path === "chisel.portal.store.js").length, 1);
});
