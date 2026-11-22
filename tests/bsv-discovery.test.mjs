import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {webcrypto} from "node:crypto";
import test from "node:test";
import vm from "node:vm";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const modules = ["chisel.js", "chisel.thunderwords.js", "chisel.portal.static-data.js", "chisel.portal.payload.js",
  "chisel.portal.queue.js", "chisel.portal.view.js", "chisel.portal.store.js", "chisel.portal.discovery.js",
  "chisel.portal.notes.js", "chisel.portal.note-function.js", "chisel.portal.record.js", "chisel.interactions.js", "chisel.portal.js"];
const sources = await Promise.all(modules.map(async file => [file, await read(file)]));
const manifest = JSON.parse(await read("data-bsv/manifest.json"));
const index = JSON.parse(await read("data-bsv/" + manifest.defaultIndex));

function fixture(responder = () => ({ok: false, status: 404, json: async () => ({})})) {
  const calls = [], nodes = new Map([["#portalStatus", {}], ["#portalThunderwordRaw", {}]]);
  const context = vm.createContext({URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, AbortController,
    console, crypto: webcrypto, location: {href: "https://chisel.example/"},
    document: {readyState: "loading", addEventListener() {}, querySelector: selector => nodes.get(selector) || null},
    localStorage: {getItem() { return null; }, setItem() {}},
    addEventListener() {}, setTimeout() { return 1; }, clearTimeout() {}, setInterval() {}, clearInterval() {},
    async fetch(url, options) { calls.push(String(url)); return responder(String(url), options); }});
  context.window = context;
  for (const [file, source] of sources) vm.runInContext(source, context, {filename: file});
  return {context, calls, portal: context.CHISEL_PORTAL};
}

test("the live historical sample preserves coverage, candidate ordering and original data scripts", async () => {
  assert.equal(index.scan.transactionsChecked, 66);
  assert.equal(index.scan.blocksComplete, 5);
  assert.equal(index.transactions.length, 12);
  assert.equal(index.scan.blocks.reduce((sum, b) => sum + b.checked, 0), 66);
  const f = fixture(), P = f.context.CHISEL_PORTAL_PAYLOAD;
  let previousSize = Infinity;
  for (const row of index.transactions) {
    const raw = JSON.parse(await read("data-bsv/" + row.rawPath));
    assert.equal(raw.txid, row.txid);
    assert.equal(raw.size, row.summary.transactionBytes);
    assert.ok(raw.size <= previousSize); previousSize = raw.size;
    const payloads = raw.vout.map(output => P.fromOutput(output)).filter(Boolean);
    if (!row.summary.dataComplete) assert.ok(payloads.some(p => p.kind === "truncated"));
    assert.equal(raw.blockhash, index.scan.blocks.find(b => b.height === row.summary.blockHeight).hash);
  }
  const digest = Buffer.from(await webcrypto.subtle.digest("SHA-256", Buffer.from(await read("data-bsv/" + manifest.defaultIndex)))).toString("hex");
  assert.equal(manifest.hashes[manifest.defaultIndex], "sha256-" + digest);
});

test("BSV identity stays separate from Bitcoin while duplicate BSV feed rows merge", () => {
  const f = fixture(), S = f.context.CHISEL_PORTAL_STORE;
  const store = S.createStore({extractBlockTime: () => 0});
  const row = index.transactions[0];
  const one = store.upsert({...row, discoverySource: "block-scan"});
  assert.equal(store.upsert({...row, coin: "Bitcoin SV", discoverySource: "bundled"}), one);
  store.upsert({...row, coin: "bitcoin", sourceId: "bitcoin"});
  assert.equal(store.records.portalRows.length, 2);
  assert.equal(one.key, "bsv:" + row.txid);
  assert.equal(S.ledgerDisplayState(one), "awaiting-ledger");
  assert.equal(S.sourceIdForRow(one), "bsv");
  assert.equal(S.tickerForCoin("BSV"), "BSV");
});

test("discovery feeds load even when the general mirror succeeds and use their own raw paths", async () => {
  const json = value => ({ok: true, status: 200, json: async () => value});
  const general = "https://data.example/general/manifest.json";
  const discovery = "https://data.example/bsv/manifest.json";
  const f = fixture(url => {
    if (url === general) return json({defaultIndex: "general.json"});
    if (url === "https://data.example/general/general.json") return json({transactions: []});
    if (url === discovery) return json(manifest);
    if (url === "https://data.example/bsv/" + manifest.defaultIndex) return json(index);
    throw new Error("Unexpected network dependency " + url);
  });
  Object.assign(f.portal.state.config, {staticDataSources: [], staticManifestPaths: [], staticManifestMirrors: [general],
    staticDiscoveryManifestPaths: [discovery], persistMainThunderwords: false, autoLoadTransactionNotes: false,
    backgroundHydrateTransactions: false});
  await f.portal.loadConfiguredStaticDatasets({quiet: true});
  assert.equal(f.portal.state.portalRows.length, 12);
  const row = f.portal.state.portalRows[0];
  assert.equal(row.index.coin, "bsv");
  assert.ok(row.staticRawPath.startsWith("transactions/bsv/"));
  assert.equal(row.staticBaseUrl, "https://data.example/bsv/");
  assert.ok(f.calls.includes(general) && f.calls.includes(discovery));
});

test("preview labels preserve incomplete payloads and partial block coverage", () => {
  const D = fixture().context.CHISEL_PORTAL_DISCOVERY;
  assert.match(D.recordLabel(index.transactions[0].summary), /at least.*payload preview incomplete/);
  assert.match(D.recordLabel({transactionBytes: 1500, dataOutputs: 0}), /size candidate/);
  assert.match(D.coverageLabel({...index.scan, blocksComplete: 4}), /4\/5 visited blocks complete/);
});

test("BSV records have navigable URLs, note paths and activity identities", () => {
  const f = fixture(), row = index.transactions[0], c = f.context;
  const url = c.CHISEL_PORTAL_RECORD.recordUrl(row, "https://chisel.example/", "https://data.example/" + row.rawPath);
  const route = c.CHISEL_PORTAL_RECORD.parseRoute(url);
  assert.equal(route.coin, "bsv");
  assert.equal(route.txid, row.txid);
  assert.equal(c.CHISEL_INTERACTIONS.subjectKey(route), "bsv:" + row.txid);
  assert.equal(c.CHISEL_PORTAL_NOTES.path(row), "annotations/bsv/" + row.txid + ".json");
});

test("coverage notes render as text, including provider errors and partial rows", () => {
  function element(tag) {
    return {tag, children: [], textContent: "", appendChild(child) { this.children.push(child); },
      replaceChildren() { this.children = []; }};
  }
  const container = element("div"); container.ownerDocument = {createElement: element};
  const scan = {...index.scan, lastError: "<img onerror=alert(1)>",
    topBlocks: [{...index.scan.topBlocks[0], status: "partial", note: "<script>untrusted</script>"}]};
  fixture().context.CHISEL_PORTAL_DISCOVERY.renderCoverage(container, scan);
  const nodes = [];
  function visit(n) { nodes.push(n); n.children.forEach(visit); }
  visit(container);
  assert.ok(nodes.some(n => n.textContent === "partial"));
  assert.ok(nodes.some(n => n.textContent === "<script>untrusted</script>"));
  assert.ok(!nodes.some(n => n.tag === "script" || n.tag === "img"));
});
