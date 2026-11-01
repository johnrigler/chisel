import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({TextEncoder}); context.window = context;
for (const file of ["chisel.portal.store.js", "chisel.portal.notes.js"]) vm.runInContext(await readFile(new URL("../" + file, import.meta.url), "utf8"), context);
const N = context.CHISEL_PORTAL_NOTES, txid = "ab".repeat(32), row = {coin: "litecoin", txid};

test("legacy category, note and fix migrate into one blob without losing text or duplicating it", () => {
  const migrated = N.normalize({category: "old tool", note: "The original context", fix: "Find the continuation", updatedAt: 100});
  assert.equal(migrated.note, "Category: old tool\n\nThe original context\n\nFollow-up:\nFind the continuation");
  assert.equal(N.normalize(migrated).note, migrated.note); assert.equal(migrated.updatedAt, 100);
  assert.equal(N.hasContent(migrated), true); assert.equal(migrated.category, undefined); assert.equal(migrated.fix, undefined);
});

test("metadata is an optional bounded JSON object and supports notes without text", () => {
  assert.equal(N.normalize({}).note, "");
  assert.equal(N.hasContent({metadata: {title: "Trapezoid"}}), true);
  assert.equal(N.metadata('{"media":{"title":"Netflix","image":"https://example.org/image"}}').media.title, "Netflix");
  for (const value of ["broken", "null", "[]", "false", "42"]) assert.throws(() => N.metadata(value));
  assert.throws(() => N.normalize({note: "x".repeat(N.MAX_NOTE + 1)}));
  assert.throws(() => N.metadata({data: "é".repeat(40000)}));
});

test("note files use chain/TXID identity and separate EVM source views and networks", () => {
  assert.equal(N.path({...row, coin: "ltc"}), "annotations/litecoin/" + txid + ".json");
  const evm = {coin: "evm", sourceId: "evmGomez", txid, index: {chainId: "137"}};
  assert.equal(N.path(evm), "annotations/evm/137/evmGomez/" + txid + ".json");
  assert.notEqual(N.path(evm), N.path({...evm, index: {chainId: "1"}}));
  assert.notEqual(N.path(evm), N.path({...evm, sourceId: "evmJethro"}));
  assert.throws(() => N.path({coin: "litecoin", txid: "../escape"}));
});

test("a note from another transaction or format cannot attach to this record", () => {
  const document = N.documentFor(row, {note: "A context blob", metadata: {title: "Trapezoid"}, updatedAt: 100});
  assert.equal(N.parseDocument(row, document).metadata.title, "Trapezoid");
  for (const bad of [{...document, coin: "bitcoin"}, {...document, txid: "cd".repeat(32)}, {...document, schema: "unknown"}]) assert.throws(() => N.parseDocument(row, bad));
});

test("the published trapezoid note identifies the real first chunk and both continuation records", async () => {
  const txid = "99d2afeed6dc496e4e0f13d1cd304db9cd6adb1d0f90b02dc1e7641cf7bc022b";
  const document = JSON.parse(await readFile(new URL("../data-bundled/annotations/litecoin/" + txid + ".json", import.meta.url), "utf8"));
  const checked = N.parseDocument({coin: "litecoin", txid}, document);
  assert.equal(checked.metadata.locator, "3172893:13"); assert.equal(checked.metadata.canonicalRoot.locator, "3172942:28");
  assert.equal(checked.metadata.reconstructedBytes, 94); assert.match(checked.note, /38 ASCII hex/);
});
