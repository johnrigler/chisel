import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {webcrypto} from "node:crypto";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({URL, TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto, console, setTimeout, clearTimeout,
  fetch() { assert.fail("publication tests must not call a real node or broadcast"); }});
context.window = context;
vm.runInContext(await readFile(new URL("../chisel.js", import.meta.url), "utf8"), context);
vm.runInContext(await readFile(new URL("../chisel.sign.js", import.meta.url), "utf8"), context);
const C = context.CHISEL;
for (const [name, prefix, ticker] of [["litecoin", 48, "LTC"], ["litecoinTestnet", 111, "tLTC"], ["digibyte", 30, "DGB"], ["ravencoin", 60, "RVN"]]) {
  C.installCoin(name, {NAME: name, P2PKH_PREFIX: prefix, TICKER: ticker, BASE_UNITS: 100000000,
    DISPLAY_NAME: name, DEFAULT_EXPLORER_URL: "https://explorer.example/" + name + "/tx/"});
}
context.CHISEL_PORTAL = {extractSummary(raw) {
  const op = raw.vout.find(output => output.scriptPubKey.type === "op_return");
  const hex = C.readOpReturnPushHex(op?.scriptPubKey.hex || "6a00");
  return {txid: raw.txid, title: "transaction " + raw.txid, opReturnText: Buffer.from(hex, "hex").toString(), blockTime: 0};
}, presentPublication() { assert.fail("use an isolated test tracker"); }};
vm.runInContext(await readFile(new URL("../chisel.portal.publication.js", import.meta.url), "utf8"), context);
const P = context.CHISEL_PUBLICATION;
const text = "https://youtu.be/jNQXAC9IVRw";
const payload = Buffer.from(text).toString("hex");
const opScript = C.buildOpReturnScript(payload);
const addressScript = "76a914" + "34".repeat(20) + "88ac";
// Synthetic serialization only. It has no real UTXO and is never submitted.
const raw = "0100000001" + "12".repeat(32) + "000000000100ffffffff02" +
  C.uint64LEHex(50000) + "19" + addressScript + C.uint64LEHex(0) + C.varInt(opScript.length / 2) + opScript + "00000000";
const options = {coin: "litecoin", signedHex: raw, feeUnits: 1000,
  display: {opReturnHex: payload, summary: {title: "Reviewed video", primaryUrl: text,
    mediaCards: [{kind: "youtube", title: "Reviewed video", thumbnailUrl: "https://images.example/picture.jpg"}]},
    metadata: {authorName: "Synthetic channel"}}};
const key = "litecoin:" + await C.transactionId(raw);

function harness(storage = new Map()) {
  let serial = 0;
  const timers = new Map(), events = [];
  const tracker = P.createTracker({
    storage: {getItem: name => storage.get(name), setItem: (name, value) => storage.set(name, value)},
    emit(record, reveal) { events.push({state: record.ledgerState, reveal, record}); },
    setTimeout(callback, ms) { const id = ++serial; timers.set(id, {callback, ms}); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  return {tracker, timers, events, storage};
}

test("public receipt is reconstructed from the sent bytes and keeps only matching reviewed metadata", async () => {
  const input = {...options, account: "do not retain", senderWif: "do not retain", recipients: [{address: "do not trust"}]};
  const record = await P.prepare(input);
  assert.equal(record.txid, await C.transactionId(raw));
  assert.equal(record.ledgerState, "awaiting-ledger"); assert.equal(record.seenAt, null);
  assert.equal(record.raw.vout[0].value, 0.0005); assert.equal(record.raw.fees, 1000);
  assert.equal(record.summary.title, "Reviewed video");
  assert.equal(record.metadata.authorName, "Synthetic channel");
  assert.doesNotMatch(JSON.stringify(record), /senderWif|do not retain|do not trust/);
  const changed = await P.prepare({...options, display: {...options.display, opReturnHex: "abcd"}});
  assert.notEqual(changed.summary.title, "Reviewed video");
  assert.equal(Object.keys(changed.metadata).length, 0);
});

test("broadcast immediately emits a pending record before any ledger read and duplicate acceptance reuses its TXID", async () => {
  const h = harness(); let reads = 0;
  const reader = async () => { reads++; return raw; };
  const record = await h.tracker.publish(options, reader);
  assert.equal(reads, 0); assert.equal(h.events.length, 1);
  assert.equal(h.events[0].state, "awaiting-ledger"); assert.equal(h.events[0].reveal, true);
  assert.equal([...h.timers.values()][0].ms, 0);
  assert.equal(await h.tracker.publish(options, reader), record);
  assert.equal(h.timers.size, 1, "duplicate acceptance must not create another watcher");
});

test("not-found, mismatched bytes and a TXID-only response stay pending and schedule another live read", async () => {
  for (const result of [new Error("not in mempool yet"), raw.slice(0, -8) + "01000000", {txid: key.slice(9)}]) {
    const h = harness();
    const record = await h.tracker.publish(options, async () => { if (result instanceof Error) throw result; return result; });
    assert.equal(await h.tracker.check(key), false);
    assert.equal(record.ledgerState, "awaiting-ledger"); assert.equal(record.seenAt, null);
    assert.ok(record.error);
    assert.ok([...h.timers.values()].some(timer => timer.ms > 0));
    assert.equal(h.events.at(-1).reveal, false);
  }
});

test("an independent exact byte read changes the existing record to seen, without claiming a block confirmation", async () => {
  const h = harness(); let reads = 0;
  const record = await h.tracker.publish(options, async txid => { reads++; assert.equal(txid, await C.transactionId(raw)); return raw.toUpperCase(); });
  assert.equal(await h.tracker.check(key), true);
  assert.equal(record.ledgerState, "seen"); assert.ok(record.seenAt);
  assert.equal(record.error, ""); assert.equal(record.confirmed, undefined);
  assert.equal(h.events.length, 2); assert.equal(h.events[0].record, h.events[1].record);
  assert.equal(h.timers.size, 0);
  assert.equal(await h.tracker.check(key), false); assert.equal(reads, 1);
});

test("overlapping retries never launch a second read for the same transaction", async () => {
  const h = harness(); let finish, reads = 0;
  await h.tracker.publish(options, () => { reads++; return new Promise(resolve => { finish = resolve; }); });
  const first = h.tracker.check(key);
  assert.equal(await h.tracker.check(key), false);
  finish(raw);
  assert.equal(await first, true); assert.equal(reads, 1);
});

test("a timeout retains the in-flight reader so a retry cannot multiply hanging network requests", async () => {
  const h = harness(); let finish, reads = 0;
  await h.tracker.publish(options, () => { reads++; return new Promise(resolve => { finish = resolve; }); });
  const first = h.tracker.check(key);
  await Promise.resolve();
  [...h.timers.values()].find(timer => timer.ms === 45000).callback();
  assert.equal(await first, false);
  const retry = h.tracker.check(key);
  await Promise.resolve();
  assert.equal(reads, 1);
  finish(raw); assert.equal(await retry, true);
});

test("reload restores the public receipt as pending and ignores a persisted seen claim", async () => {
  const first = harness(); await first.tracker.publish(options, async () => raw); await first.tracker.check(key);
  const [storageKey, saved] = [...first.storage.entries()][0];
  const stored = JSON.parse(saved); stored[0].ledgerState = "seen"; stored[0].account = "not retained";
  const second = harness(new Map([[storageKey, JSON.stringify(stored)]]));
  let coin;
  await second.tracker.restore(name => { coin = name; return async () => raw; });
  assert.equal(coin, "litecoin"); assert.equal(second.events[0].state, "awaiting-ledger");
  assert.equal(second.events[0].reveal, false, "restoring a receipt must not navigate away from the current mode");
  assert.doesNotMatch([...second.storage.values()][0], /account|senderWif|not retained|ledgerState/);
  assert.equal(await second.tracker.check(key), true);
});

test("mainnet and testnet receipts never share the same chain key or output address prefix", async () => {
  const main = await P.prepare(options), testnet = await P.prepare({...options, coin: "litecoinTestnet"});
  assert.equal(main.txid, testnet.txid);
  assert.notEqual(main.coin, testnet.coin);
  assert.notEqual(main.raw.vout[0].scriptPubKey.addresses[0], testnet.raw.vout[0].scriptPubKey.addresses[0]);
  assert.match(testnet.summary.explorerUrl || testnet.index.txUrlTemplate, /litecoinTestnet/);
});
