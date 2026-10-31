import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const sources = await Promise.all(["chisel.js", "chisel.thunderwords.js", "chisel.portal.static-data.js", "chisel.portal.js"].map(async file =>
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
  Object.assign(portal.state.config, {persistMainThunderwords: false, backgroundHydrateTransactions: false});
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
