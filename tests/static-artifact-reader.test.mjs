import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {webcrypto} from "node:crypto";
import test from "node:test";
import vm from "node:vm";

const ctx = vm.createContext({URL, Uint8Array, crypto: webcrypto, location: {href: "https://chisel.example/tools/"}});
ctx.window = ctx;
vm.runInContext(await readFile(new URL("../tools/m64Artifact/static-artifact-reader.js", import.meta.url), "utf8"), ctx);
const reader = ctx.ChiselStaticArtifactReader;
const id = "polygon/137/icon/home";
const manifestUrl = "https://rigler.example/chisel-artifacts/manifest.json";
const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const digest = Buffer.from(await webcrypto.subtle.digest("SHA-256", bytes)).toString("hex");
const path = "objects/sha256/" + digest.slice(0, 2) + "/" + digest + ".svg";
const entry = {path, sha256: digest, bytes: bytes.length, mediaType: "image/svg+xml", provenance: "unverified"};
const manifest = {format: "chisel-static-artifacts-v1", artifacts: {[id]: entry}};

function response(value, status = 200) {
  return {ok: status === 200, status, json: async () => value,
    arrayBuffer: async () => Uint8Array.from(value).buffer};
}
function mock(map) {
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    if (!Object.prototype.hasOwnProperty.call(map, url)) return response({}, 404);
    return map[url];
  };
  return {calls, fetchImpl};
}

test("a static Apache mirror is enough; no FileProxy or Polygon request", async () => {
  const objUrl = "https://rigler.example/chisel-artifacts/" + path;
  const {calls, fetchImpl} = mock({[manifestUrl]: response(manifest), [objUrl]: response(bytes)});
  const result = await reader.load({manifestUrl, id, fetchImpl, subtle: webcrypto.subtle, expectedSha256: digest});
  assert.equal(result.sha256, digest);
  assert.equal(result.sourceUrl, objUrl);
  assert.equal(result.provenance, "unverified");
  assert.equal(Buffer.from(result.bytes).toString(), Buffer.from(bytes).toString());
  assert.deepEqual(calls, [manifestUrl, objUrl]);
  assert.ok(calls.every(url => !url.includes("/fileproxy/")));
});

test("tampering with bytes, size or a pinned digest fails closed", async () => {
  const objUrl = "https://rigler.example/chisel-artifacts/" + path;
  const bad = new Uint8Array(bytes);
  bad[4] ^= 3;
  let {fetchImpl} = mock({[manifestUrl]: response(manifest), [objUrl]: response(bad)});
  await assert.rejects(reader.load({manifestUrl, id, fetchImpl, subtle: webcrypto.subtle}), /SHA-256 mismatch/);
  ({fetchImpl} = mock({[manifestUrl]: response(manifest), [objUrl]: response(bytes)}));
  await assert.rejects(reader.load({manifestUrl, id, fetchImpl, subtle: webcrypto.subtle,
    expectedSha256: "0".repeat(64)}), /independently expected/);
});

test("relative traversal, wrong media type and unsafe manifest URLs are rejected", async () => {
  const changed = JSON.parse(JSON.stringify(manifest));
  changed.artifacts[id].path = "../private.svg";
  let {fetchImpl} = mock({[manifestUrl]: response(changed)});
  await assert.rejects(reader.load({manifestUrl, id, fetchImpl, subtle: webcrypto.subtle}), /Noncanonical/);
  changed.artifacts[id].path = path;
  changed.artifacts[id].mediaType = "text/html";
  ({fetchImpl} = mock({[manifestUrl]: response(changed)}));
  await assert.rejects(reader.load({manifestUrl, id, fetchImpl, subtle: webcrypto.subtle}), /Invalid static artifact entry/);
  await assert.rejects(reader.load({manifestUrl: "https://user:pass@rigler.example/manifest.json",
    id, fetchImpl, subtle: webcrypto.subtle}), /credentials or query/);
  await assert.rejects(reader.load({manifestUrl, id: "../secret", fetchImpl, subtle: webcrypto.subtle}), /Invalid static artifact ID/);
});

test("missing static material can be handled by caller without claiming Polygon provenance", async () => {
  const {fetchImpl} = mock({[manifestUrl]: response({}, 404)});
  await assert.rejects(reader.load({manifestUrl, id, fetchImpl, subtle: webcrypto.subtle}), /unavailable/);
});
