import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {webcrypto} from "node:crypto";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({URL, Uint8Array, AbortController, setTimeout, clearTimeout, addEventListener() {},
  document: {readyState: "loading", addEventListener() {}}});
context.window = context;
vm.runInContext(await readFile(new URL("../chisel.portal.static-data.js", import.meta.url), "utf8"), context);
const S = context.CHISEL_PORTAL_STATIC_DATA;
const root = "https://records.example/chisel-data/", directory = root + "transactions/litecoin/";
const id = "a".repeat(64), other = "b".repeat(64);
const response = (json, status = 200) => ({ok: status === 200, status, json: async () => json,
  text: async () => typeof json === "string" ? json : JSON.stringify(json)});

test("the exact currency directory is an HTTP source with FileProxy paths mapped to ordinary URLs", async () => {
  const calls = [], source = directory;
  const transport = S.createTransport({fetch: async url => {
    calls.push(url);
    if (url === root + "index/transactions.index.json") return response({transactions: [
      {coin: "litecoin", txid: id, path: "data-root:transactions/litecoin/" + id + ".json"},
      {coin: "dogecoin", txid: other, path: "transactions/dogecoin/" + other + ".json"}]});
    if (url === directory) return response("<a href='" + id + ".json'>record</a>");
    if (url === directory + id + ".json") return response({txid: id, vout: []});
    throw new Error("Unexpected dependency: " + url);
  }});
  const loaded = await transport.loadCatalog(source);
  assert.equal(source, directory); assert.equal(loaded.source, directory);
  assert.equal(loaded.baseUrl, root); assert.equal(loaded.index.transactions.length, 1);
  const normalizer = S.createNormalizer();
  const row = normalizer.normalizeStaticDatasetRows(loaded.index, {baseUrl: loaded.baseUrl})[0];
  assert.equal(row.staticRawPath, "transactions/litecoin/" + id + ".json");
  assert.equal((await transport.fetchStaticRawFromRow(row)).json.txid, id);
  assert.ok(calls.every(url => !url.includes("/fileproxy/")));
  assert.equal(S.joinDataPath(root, "data/transactions/litecoin/file.json"), directory + "file.json");
});

test("directory listings add files omitted by an older portable index", async () => {
  const transport = S.createTransport({fetch: async url => {
    if (url.endsWith("index/transactions.index.json")) return response({}, 404);
    if (url.endsWith("index/portal.index.json")) return response({transactions: [{coin: "litecoin", txid: id}]});
    if (url === directory) return response('<a href="' + id + '.json">one</a><a href="' + other + '.json">two</a>');
    throw new Error(url);
  }});
  const loaded = await transport.loadCatalog(directory);
  assert.deepEqual(Array.from(loaded.index.transactions, row => row.txid), [id, other]);
});

test("a directory alone is sufficient, including Chisel Base58 transaction filenames", async () => {
  const filename = "GZnWx9aVLcMkbCU8mF21mUK9KheXiwi6nXTo91cA4L6z-e7455af74bdf.json";
  const expected = "e7455af74bdfd068d39403de0f8074ed1ae570521091e40588cfb6ebd0dc29ef";
  assert.equal(S.txidFromFilename(filename), expected);
  const html = '<a href="' + filename + '">saved</a><a href="../' + id + '.json">parent</a>' +
    '<a href="https://other.example/' + other + '.json">external</a><a href="javascript:alert(1)">bad</a>' +
    '<a href="' + filename + '">duplicate</a><a href="unknown.json">unrecognized</a>';
  const transport = S.createTransport({fetch: async url => url === directory ? response(html) : response({}, 404)});
  const loaded = await transport.loadCatalog(directory);
  assert.equal(loaded.index.transactions.length, 1);
  assert.equal(loaded.index.transactions[0].txid, expected);
  assert.equal(loaded.index.transactions[0].rawUrl, directory + filename);
  assert.equal(S.txidFromFilename(filename.replace("e7455af74bdf", "ffffffffffff")), "");
});

test("relative manifest bases stay under their HTTP/IPFS origin, with a fallback for legacy manifests", async () => {
  const base = "https://gateway.example/ipfs/bafyFixture/data/", calls = [];
  const transport = S.createTransport({baseUrl: "https://app.example/chisel/", fetch: async url => {
    calls.push(url);
    if (url === base + "manifest.json") return response({baseUrl: "./data/", defaultIndex: "index/portal.index.json"});
    if (url === base + "index/portal.index.json") return response({transactions: []});
    return response({}, 404);
  }});
  const loaded = await transport.loadManifest(base + "manifest.json");
  assert.equal(loaded.baseUrl, base);
  assert.equal(loaded.indexUrl, base + "index/portal.index.json");
  assert.ok(calls.every(url => url.startsWith(base)));
});

test("hash validation uses the same manifest-relative paths", async () => {
  const bytes = new TextEncoder().encode("saved index"), base = "https://gateway.example/ipfs/bafyFixture/";
  const hash = Buffer.from(await webcrypto.subtle.digest("SHA-256", bytes)).toString("hex");
  const transport = S.createTransport({crypto: webcrypto, fetch: async url => {
    if (url === base + "manifest.json") return response({baseUrl: "./data/", hashes: {"index/portal.index.json": "sha256-" + hash}});
    return {ok: url === base + "index/portal.index.json", status: url === base + "index/portal.index.json" ? 200 : 404,
      arrayBuffer: async () => bytes.buffer};
  }});
  const reports = await transport.validateStaticDataset([base + "manifest.json"]);
  assert.equal(reports[0].ok, true); assert.equal(reports[0].checks[0].actual, hash);
});

test("wrong transaction data is rejected while another static source can supply the correct JSON", async () => {
  const transport = S.createTransport({fetch: async url => response({txid: url.startsWith("https://bad.example/") ? other : id})});
  const row = {txid: id, staticRawPath: "record.json", staticBaseUrl: "https://bad.example/", staticRemoteBaseUrls: [root]};
  const loaded = await transport.fetchStaticRawFromRow(row);
  assert.equal(loaded.json.txid, id); assert.equal(loaded.url, root + "record.json");
});

test("a hung reader cannot hold fallback open even if fetch ignores abort", async () => {
  let expire, signal;
  const transport = S.createTransport({fetch: async (_, options) => { signal = options.signal; return new Promise(() => {}); },
    setTimeout(callback) { expire = callback; return 1; }, clearTimeout() {}});
  const pending = transport.request("https://proxy.example/tx", {}, response => response.json(), 2000);
  await Promise.resolve(); expire();
  await assert.rejects(pending, /timed out after 2000 ms/);
  assert.equal(signal.aborted, true);
});
