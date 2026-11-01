import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const sources = await Promise.all(["chisel.js", "chisel.thunderwords.js", "chisel.portal.static-data.js", "chisel.portal.payload.js", "chisel.portal.store.js", "chisel.portal.notes.js", "chisel.portal.record.js", "chisel.portal.js"].map(async file =>
  [file, await readFile(new URL("../" + file, import.meta.url), "utf8")]));
const address = "LZMFvkRUiNVJoQvDHJ9C8tzCyBTD2PxLwk";
const id = n => n.toString(16).padStart(64, "0");
const bc = (n, height = 1000 - n) => ({hash: id(n), block_height: height, confirmations: 1,
  confirmed: new Date(1700000000000 - n * 150000).toISOString(),
  inputs: [{addresses: [address], output_value: 100000}],
  outputs: [{addresses: [address], value: 99000, script: "76a914" + "12".repeat(20) + "88ac"}], fees: 1000});
const esplora = n => ({txid: id(n), status: {confirmed: true, block_height: 1000 - n, block_time: 1700000000 - n * 150},
  vin: [], vout: [{scriptpubkey_address: address, value: 100}]});
const json = (value, status = 200) => ({ok: status === 200, status, json: async () => value});

function fixture(responder, storage = new Map()) {
  let serial = 0;
  const calls = [], timers = new Map(), intervals = new Map(), events = new Map();
  const nodes = new Map([["#portalStatus", {}], ["#portalEvmWordSearch", {value: ""}], ["#portalPersonalAccountMeta", {}]]);
  const document = {readyState: "loading", hidden: false, body: {dataset: {mode: "portal"}},
    addEventListener(name, callback) { events.set("document:" + name, callback); },
    querySelector: selector => nodes.get(selector) || null, querySelectorAll: () => []};
  const context = vm.createContext({URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, AbortController, console,
    location: {href: "https://chisel.example/?mode=portal"}, document,
    addEventListener(name, callback) { events.set(name, callback); },
    setTimeout(callback, ms) {
      if (ms === 400) { queueMicrotask(callback); return 0; }
      const key = ++serial; timers.set(key, {callback, ms}); return key;
    },
    clearTimeout(key) { timers.delete(key); },
    setInterval(callback, ms) { const key = ++serial; intervals.set(key, {callback, ms}); return key; },
    clearInterval(key) { intervals.delete(key); },
    localStorage: {getItem: key => storage.get(key) || null, setItem(key, value) { storage.set(key, value); }},
    async fetch(url, options) { calls.push(String(url)); return responder(String(url), options); }
  });
  context.window = context;
  for (const [file, source] of sources) vm.runInContext(source, context, {filename: file});
  const api = context.CHISEL_THUNDERWORDS, portal = context.CHISEL_PORTAL;
  const entry = {...api.getIndex("litecoinGeneral"), address};
  portal.state.currentIndex = entry;
  portal.state.personalAccount = {coin: "litecoin", address, label: "Saved account"};
  Object.assign(portal.state.config, {persistMainThunderwords: false, autoLoadTransactionNotes: false, backgroundHydrateTransactions: false});
  portal.state.fileProxyAvailable = false;
  return {context, api, portal, entry, calls, storage, nodes, timers, intervals, events, document};
}

test("BlockCypher history follows every before cursor and reads confirmation timestamps", async () => {
  const pages = [];
  const f = fixture(url => {
    const before = new URL(url).searchParams.get("before");
    if (!before) return json({n_tx: 53, hasMore: true, txs: Array.from({length: 51}, (_, i) => bc(i + 1, i > 48 ? 950 : 1000 - i))});
    assert.equal(before, "950", "the complete boundary block supplies the exclusive cursor");
    return json({n_tx: 53, hasMore: false, txs: [bc(52, 949), bc(53, 948)]});
  });
  const result = await f.api.fetchAddressTransactions(f.entry, address, {onPage: page => pages.push(page.transactions.length)});
  assert.equal(result.transactions.length, 53); assert.equal(result.complete, true);
  assert.deepEqual(pages, [51, 2]); assert.equal(f.calls.length, 2);
  assert.equal(result.transactions[0].txid, id(1));
  assert.equal(result.transactions[0].blockTime, Date.parse(bc(1).confirmed) / 1000);
  assert.equal(result.transactions[0].raw.block_time, result.transactions[0].blockTime);
  assert.equal(result.transactions[0].confirmed, true);
});

test("Esplora failover pages all confirmed history after the first 25 while retaining mempool rows", async () => {
  const f = fixture(url => {
    if (url.includes("blockcypher")) return json({}, 503);
    if (url.endsWith("/txs")) return json([{txid: id(99), status: {confirmed: false}, vin: [], vout: []},
      ...Array.from({length: 25}, (_, i) => esplora(i + 1))]);
    assert.ok(url.endsWith("/txs/chain/" + id(25)));
    return json([esplora(26), esplora(27)]);
  });
  const result = await f.api.fetchAddressTransactions(f.entry, address);
  assert.equal(result.transactions.length, 28); assert.equal(result.complete, true);
  assert.equal(result.transactions[0].txid, id(99));
  assert.equal(f.calls.length, 3);
});

test("an unavailable older page preserves new rows and is retried instead of claiming complete history", async () => {
  let available = false;
  const f = fixture(url => {
    if (!new URL(url).searchParams.has("before")) return json({hasMore: true, txs: [bc(1)]});
    return available ? json({hasMore: false, txs: [bc(2)]}) : json({}, 429);
  });
  const first = await f.portal.loadAddressIndex(f.entry, address, {background: true});
  assert.equal(first.complete, false); assert.match(first.error, /429/);
  assert.equal(f.portal.state.portalRows.length, 1);
  assert.equal(JSON.parse(f.storage.get("chisel.portal.accountTxs.v1:litecoin:" + address)).length, 1);
  available = true;
  const second = await f.portal.loadAddressIndex(f.entry, address, {background: true});
  assert.equal(second.complete, true); assert.equal(f.portal.state.portalRows.length, 2);
  assert.equal(f.calls.length, 4, "partial history must revisit the older page on retry");
});

test("repeated pages terminate with a partial-history warning instead of an infinite loop", async () => {
  const f = fixture(() => json({hasMore: true, txs: [bc(1)]}));
  const result = await f.api.fetchAddressTransactions(f.entry, address);
  assert.equal(result.complete, false); assert.match(result.error, /cursor|repeated/i);
  assert.equal(f.calls.length, 2);
});

test("new transactions stream into Portal before older pages finish, with pending first and no duplicate rows", async () => {
  let release;
  const f = fixture(url => new URL(url).searchParams.has("before") ? new Promise(resolve => { release = resolve; }) :
    json({hasMore: true, txs: [bc(2), bc(1)]}));
  const publication = {coin: "litecoin", txid: id(90), index: f.entry, raw: {txid: id(90), vin: [], vout: []},
    summary: {title: "Just sent"}, submittedAt: Date.now(), ledgerState: "awaiting-ledger"};
  f.portal.presentPublication(publication);
  const pending = f.portal.loadAddressIndex(f.entry, address, {background: true});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(Array.from(f.portal.state.portalRows, row => row.txid), [id(90), id(1), id(2)]);
  assert.equal(typeof release, "function");
  release(json({hasMore: false, txs: [bc(3)]}));
  await pending;
  assert.deepEqual(Array.from(f.portal.state.portalRows, row => row.txid), [id(90), id(1), id(2), id(3)]);
  assert.equal(f.portal.state.portalRows[0].publication, publication);
  assert.equal(publication.ledgerState, "awaiting-ledger", "address discovery cannot validate a sent-byte receipt");
});

test("only a complete history permits refresh to stop at a previously known confirmed transaction", async () => {
  let refresh = false;
  const f = fixture(url => {
    const before = new URL(url).searchParams.has("before");
    if (refresh) { assert.equal(before, false); return json({hasMore: true, txs: [bc(99, 1001), bc(1)]}); }
    return before ? json({hasMore: false, txs: [bc(2)]}) : json({hasMore: true, txs: [bc(1)]});
  });
  await f.portal.loadAddressIndex(f.entry, address, {background: true});
  refresh = true;
  const result = await f.portal.loadAddressIndex(f.entry, address, {background: true});
  assert.equal(result.complete, true); assert.equal(f.calls.length, 3);
  assert.equal(f.portal.state.portalRows.length, 3, "older rows remain in the portal after incremental refresh");
  f.portal.clearPortalStream();
  refresh = false;
  await f.portal.loadAddressIndex(f.entry, address, {background: true});
  assert.equal(f.calls.length, 5, "clearing rows invalidates the previous complete-history boundary");
});

test("retrying an older page first catches up with new pages before resuming the previously covered history", async () => {
  let retry = false;
  const f = fixture(url => {
    const before = new URL(url).searchParams.get("before");
    if (!retry) {
      if (!before) return json({hasMore: true, txs: [bc(1, 1000)]});
      if (before === "1000") return json({hasMore: true, txs: [bc(2, 900)]});
      assert.equal(before, "900"); return json({}, 429);
    }
    if (!before) return json({hasMore: true, txs: [bc(10, 1100)]});
    if (before === "1100") return json({hasMore: true, txs: [bc(1, 1000)]});
    assert.equal(before, "900", "covered pages may be skipped only after the new head meets the old prefix");
    return json({hasMore: false, txs: [bc(3, 800)]});
  });
  assert.equal((await f.portal.loadAddressIndex(f.entry, address, {background: true})).complete, false);
  retry = true;
  assert.equal((await f.portal.loadAddressIndex(f.entry, address, {background: true})).complete, true);
  assert.equal(f.calls.length, 6);
  assert.deepEqual(Array.from(f.portal.state.portalRows, row => row.txid).sort(), [1, 2, 3, 10].map(id).sort());
});

test("the configured two-minute timer runs the live refresh and can be disabled", async () => {
  const f = fixture(() => json({txs: [bc(1)]}));
  const source = sources.find(([file]) => file === "chisel.portal.js")[1];
  const start = source.indexOf("  function startLiveLedgerPolling()");
  const end = source.indexOf("  async function discoverLocalAssets", start);
  const polling = new Function("state", "configBool", "configValue", "window", "refreshLiveLedger",
    source.slice(start, end) + "\nreturn startLiveLedgerPolling;")(f.portal.state,
    (key, fallback) => f.portal.state.config[key] ?? fallback,
    (key, fallback) => f.portal.state.config[key] ?? fallback, f.context, f.portal.refreshLiveLedger);
  polling(); assert.equal(f.intervals.size, 1);
  const timer = [...f.intervals.values()][0]; assert.equal(timer.ms, 120000);
  timer.callback(); await new Promise(resolve => setImmediate(resolve)); assert.equal(f.calls.length, 1);
  f.portal.state.config.liveLedgerRefresh = false;
  polling(); assert.equal(f.intervals.size, 0);
});

test("saved account history restores immediately offline with its own address and cannot overwrite fresher live rows", async () => {
  const first = fixture(() => json({txs: [bc(1), bc(2)]}));
  await first.portal.loadAddressIndex(first.entry, address, {background: true});
  const second = fixture(() => { throw new Error("offline"); }, first.storage);
  const restoring = second.portal.loadPersonalAccountStream(second.portal.state.personalAccount, {noReloadIfCurrent: false});
  assert.equal(second.portal.state.portalRows.length, 2, "saved rows appear before any network response");
  assert.ok(second.portal.state.portalRows.every(row => row.index.address === address));
  assert.equal(second.nodes.get("#portalEvmWordSearch").value, address);
  await assert.rejects(restoring, /offline/);
  const live = first.portal.state.portalRows[0];
  await first.portal.loadPersonalAccountStream(first.portal.state.personalAccount, {noReloadIfCurrent: false});
  assert.equal(live.discoverySource, "live-search"); assert.ok(live.raw);
});

test("recent decoded text and media survive a reset, a sparse index refresh and a new page load", async () => {
  const f = fixture(() => { throw new Error("offline"); });
  const txid = id(77), text = "Testing, testing.", url = "https://youtu.be/jNQXAC9IVRw";
  const rich = {coin: "litecoin", txid, index: f.entry, raw: {txid, vin: [], vout: []},
    summary: {title: "Reviewed video", opReturnText: text, primaryUrl: url, blockTime: 1700000000,
      ledgerFinance: {outputTotalSat: 9000, feeSat: 1000},
      mediaCards: [{url, title: "Reviewed video", authorName: "Saved channel", thumbnailUrl: "https://images.example/picture.jpg"}]},
    submittedAt: 1700000000000, ledgerState: "awaiting-ledger", metadata: {}};
  f.portal.presentPublication(rich);
  const snapshot = [...f.timers.values()].find(timer => timer.ms === 200);
  assert.ok(snapshot); snapshot.callback();
  const saved = f.storage.get("chisel.portal.recentDisplay.v1");
  assert.ok(saved.includes(text));
  assert.doesNotMatch(saved, /"raw"|"index"|"publication"|ledgerState|submittedAt/);

  const sparse = {coin: "litecoin", txid, summary: {title: "transaction " + txid.slice(0, 10),
    opReturnText: "", primaryUrl: "", mediaCards: [{url, title: url, thumbnailUrl: ""}]}};
  for (const session of [f, fixture(() => { throw new Error("offline"); }, f.storage)]) {
    session.portal.clearPortalStream();
    session.context.CHISEL_PORTAL_STARTER_DATA = {transactions: [sparse]};
    session.portal.loadEmbeddedStaticDataset();
    const summary = session.portal.state.portalRowKeys["litecoin:" + txid].summary;
    assert.equal(summary.opReturnText, text);
    assert.equal(summary.title, "Reviewed video");
    assert.equal(summary.primaryUrl, url);
    assert.equal(summary.ledgerFinance.feeSat, 1000);
    assert.equal(summary.mediaCards[0].title, "Reviewed video");
    assert.equal(summary.mediaCards[0].authorName, "Saved channel");
    assert.equal(summary.mediaCards[0].thumbnailUrl, "https://images.example/picture.jpg");
  }
});

test("FileProxy background reads hydrate the visible recent page before older records in index order", async () => {
  const order = [], times = [100, 300, 200];
  const indexed = times.map((time, i) => ({coin: "litecoin", txid: id(i + 1), path: "data/transactions/litecoin/" + id(i + 1) + ".json",
    summary: {title: "transaction " + id(i + 1), blockTime: time}}));
  const f = fixture(url => {
    if (new URL(url).pathname.endsWith("/tx-index")) return json({transactions: indexed});
    const path = new URL(url).searchParams.get("path"), index = indexed.findIndex(row => row.path === path);
    assert.ok(index >= 0, url); order.push(times[index]);
    return {ok: true, status: 200, text: async () => JSON.stringify({txid: indexed[index].txid, vin: [], vout: [], blocktime: times[index]})};
  });
  Object.assign(f.portal.state.config, {backgroundHydrateTransactions: true, autoHydrateLocalTransactions: true, portalPageSize: 2});
  const rows = await f.portal.listLocalTransactions();
  await f.portal.hydrateLocalRowsInBackground(rows);
  assert.deepEqual(order, [300, 200, 100]);
  assert.equal(f.portal.state.localHydrationReport.hydrated, 3);
});

test("a hung Python API times out once, then catalog and transaction reads use static HTTP", async () => {
  const root = "https://rigler.org/chisel-data/", txid = id(66);
  const raw = {txid, vin: [], vout: [{value: 0, scriptpubkey: "6a0754657374696e67"}]};
  const f = fixture(url => {
    if (url.includes("/fileproxy/")) return new Promise(() => {});
    if (url === root + "index/transactions.index.json") return json({transactions: [{coin: "litecoin", txid, path: "data-root:transactions/litecoin/" + txid + ".json"}]});
    if (url === root + "transactions/litecoin/" + txid + ".json") return json(raw);
    return json({}, 404);
  });
  const loading = f.portal.listLocalTransactions();
  await new Promise(resolve => setImmediate(resolve));
  const timeout = [...f.timers.values()].find(timer => timer.ms === 2000);
  assert.ok(timeout); timeout.callback();
  const rows = await loading;
  assert.equal(rows.length, 1); assert.equal(rows[0].discoverySource, "preloaded");
  const loaded = await f.portal.loadLocalTransaction(txid, "litecoin");
  assert.equal(loaded.source, "static"); assert.equal(loaded.raw.txid, txid);
  assert.equal(f.portal.extractSummary(loaded.raw, f.entry).opReturnText, "Testing");
  assert.equal(f.calls.filter(url => url.includes("/fileproxy/")).length, 1);
  assert.ok(f.calls.every(url => url.includes("/fileproxy/") || url.startsWith(root)));
});

test("the pasted HTTP directory remains unchanged and works without any Python or ledger request", async () => {
  const source = "https://archive.example/chisel-data/transactions/litecoin/", txid = id(67);
  const raw = {txid, vin: [], vout: [], blocktime: 1700000000};
  const f = fixture(url => {
    if (url === source) return {ok: true, status: 200, text: async () => '<a href="' + txid + '.json">transaction</a>'};
    if (url === source + txid + ".json") return json(raw);
    if (url.startsWith("https://archive.example/chisel-data/index/")) return json({}, 404);
    throw new Error("Reader depended on another service: " + url);
  });
  const input = {value: source, dataset: {edited: "true"}};
  f.nodes.set("#portalStaticDataUrl", input);
  const first = await f.portal.loadStaticHttpSources();
  const loaded = await f.portal.loadLocalTransactionPath("data-root:transactions/litecoin/" + txid + ".json", txid, "litecoin");
  assert.equal(loaded.raw.txid, txid); assert.equal(loaded.source, "static");
  assert.equal(input.value, source);
  const again = await f.portal.loadStaticHttpSources();
  assert.equal(first.rows[0], again.rows[0]); assert.equal(f.portal.state.portalRows.length, 1);
});

test("static HTTP hydration fills the visible recent records before older history", async () => {
  const root = "https://records.example/chisel-data/", read = [];
  const f = fixture(url => {
    if (url === root + "index/transactions.index.json") return json({transactions: Array.from({length: 6}, (_, i) => ({
      coin: "litecoin", txid: id(i + 70), path: "transactions/litecoin/" + id(i + 70) + ".json", summary: {blockTime: i + 1}}))});
    if (url.endsWith(".json") && url.startsWith(root + "transactions/litecoin/")) {
      const txid = url.split("/").pop().slice(0, -5); read.push(txid);
      return json({txid, vin: [], vout: [{value: 0, scriptpubkey: "6a0754657374696e67"}]});
    }
    if (url === root + "transactions/litecoin/") return json({}, 404);
    throw new Error("Unexpected dependency: " + url);
  });
  Object.assign(f.portal.state.config, {staticDataSources: [root], backgroundHydrateTransactions: true, portalPageSize: 2});
  const loaded = await f.portal.loadStaticHttpSources();
  for (let turn = 0; turn < 5 && loaded.rows.some(row => !row.raw); turn += 1) {
    for (const [key, timer] of [...f.timers]) if (timer.ms === 0) { f.timers.delete(key); timer.callback(); }
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.deepEqual(read.slice(0, 4), [id(75), id(74), id(73), id(72)]);
  assert.equal(loaded.rows.every(row => row.raw && row.summary.opReturnText === "Testing"), true);
  assert.equal(f.portal.state.portalRows.every(row => row.raw), true, "hydrate the stored row objects");
  assert.ok(f.calls.every(url => url.startsWith(root)), "static reads do not probe Python or live explorers");
});

test("recent presentation cache stays bounded and excludes unrelated summary fields", () => {
  const f = fixture(() => { throw new Error("offline"); });
  f.context.CHISEL_PORTAL_STARTER_DATA = {transactions: Array.from({length: 100}, (_, i) => ({
    coin: "litecoin", txid: id(i + 1), summary: {title: "A saved note", opReturnText: "Note " + i,
      blockTime: 1700000000 + i, senderWif: "never retain this", raw: {privateKey: "never retain this"}}
  }))};
  f.portal.loadEmbeddedStaticDataset();
  [...f.timers.values()].find(timer => timer.ms === 200).callback();
  const saved = f.storage.get("chisel.portal.recentDisplay.v1"), rows = JSON.parse(saved);
  assert.equal(rows.length, 60);
  assert.equal(rows[0].key, "litecoin:" + id(100));
  assert.doesNotMatch(saved, /senderWif|privateKey|never retain/);
});

test("a slow transaction read finishing after reset cannot repopulate the cleared stream", async () => {
  let release;
  const txid = id(88), path = "data/transactions/litecoin/" + txid + ".json";
  const f = fixture(url => new URL(url).pathname.endsWith("/tx-index") ?
    json({transactions: [{coin: "litecoin", txid, path, summary: {title: "Slow record", blockTime: 100}}]}) :
    new Promise(resolve => { release = resolve; }));
  Object.assign(f.portal.state.config, {backgroundHydrateTransactions: true, autoHydrateLocalTransactions: true});
  const rows = await f.portal.listLocalTransactions();
  const hydration = f.portal.hydrateLocalRowsInBackground(rows);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof release, "function");
  f.portal.clearPortalStream();
  release({ok: true, text: async () => JSON.stringify({txid, vin: [], vout: []})});
  const report = await hydration;
  assert.equal(report.cancelled, true);
  assert.equal(f.portal.state.portalRows.length, 0);
});

test("refresh is throttled on return, skips hidden/other-mode pages, and suppresses overlapping requests", async () => {
  let release;
  const f = fixture(() => new Promise(resolve => { release = resolve; }));
  f.document.hidden = true;
  await f.portal.refreshLiveLedger({force: true}); assert.equal(f.calls.length, 0);
  f.document.hidden = false; f.document.body.dataset.mode = "send";
  await f.portal.refreshLiveLedger({force: true}); assert.equal(f.calls.length, 0);
  f.document.body.dataset.mode = "portal";
  const loading = f.portal.refreshLiveLedger();
  await new Promise(resolve => setImmediate(resolve));
  await f.portal.refreshLiveLedger({force: true}); assert.equal(f.calls.length, 1);
  release(json({txs: [bc(1)]})); await loading;
  await f.portal.refreshLiveLedger(); assert.equal(f.calls.length, 1, "fresh return does not repeat a ledger read");
  Object.values(f.portal.state.liveLedgerHistories)[0].checkedAt -= 61000;
  const returning = f.portal.refreshLiveLedger();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 2); release(json({txs: [bc(1)]})); await returning;
});

test("a new confirmed ledger read retains reviewed media and supplies the sent row's final timestamp", async () => {
  const f = fixture(() => json({txs: [bc(1)]}));
  const publication = {coin: "litecoin", txid: id(1), index: f.entry, raw: {txid: id(1), vin: [], vout: []},
    summary: {title: "Reviewed title", blockTime: 0}, submittedAt: Date.now(), ledgerState: "awaiting-ledger"};
  const row = f.portal.presentPublication(publication);
  await f.portal.loadAddressIndex(f.entry, address, {background: true});
  publication.ledgerState = "seen";
  f.portal.presentPublication(publication);
  assert.equal(f.portal.state.portalRows.length, 1); assert.equal(row.summary.title, "Reviewed title");
  assert.equal(row.summary.blockTime, Date.parse(bc(1).confirmed) / 1000);
  assert.equal(f.portal.extractBlockTime(row.raw), row.summary.blockTime);
  assert.equal(row.publication, publication);
});
