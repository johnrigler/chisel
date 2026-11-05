import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../evm.html", import.meta.url), "utf8");
const portal = readFileSync(new URL("../chisel.portal.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sandbox = {};
sandbox.window = sandbox;
vm.runInNewContext(readFileSync(new URL("../chisel.portal.store.js", import.meta.url), "utf8"), sandbox);
const store = sandbox.CHISEL_PORTAL_STORE;

const ones = "0x1111111111111111111111111111111111111111";

test("EVM workbench registers the all-ones recipient on Polygon 137, not Ethereum 1", () => {
  assert.match(html, /thunderword:\s*\{[\s\S]*?name: "polygon-main-thunderword",[\s\S]*?chainId: "137",[\s\S]*?address: EVM_THUNDERWORD/);
  assert.ok(html.includes('const EVM_THUNDERWORD = "' + ones + '"'));
  assert.match(html, /function setContractProfile\(key\)\s*\{[\s\S]*?el\("chainId"\)\.value = profile\.chainId;/);
  assert.match(html, /checkThunderwordBtn"[\s\S]*?checkProfileForNewTransactions\("thunderword"\)/);
  assert.match(html, /async function checkProfileForNewTransactions\(key\)[\s\S]*?await saveSplitTransactionsToFileProxy\(\)/);
});

test("Portal makes the saved Polygon stream selectable and preserves record identity", () => {
  assert.ok(index.includes('id="portalIncludeEvmPolygonThunderword"'));
  assert.ok(index.includes('id="portalFilterEvmPolygonThunderword"'));
  assert.ok(portal.includes('id: "polygonThunderword"'));
  assert.ok(portal.includes('contractName: "polygon-main-thunderword"'));
  assert.equal(store.sourceIdForRow({
    coin: "evm",
    index: {chainId:"137",contractName:"polygon-main-thunderword",contractAddress:ones},
    summary: {}
  }), "evmPolygonThunderword");
  assert.equal(store.sourceIdForRow({
    coin: "evm",
    index: {chainId:"1",contractAddress:ones},
    summary: {}
  }), "other");
});

test("This change leaves Bitcoin support optional and untouched", () => {
  assert.ok(index.includes('id="portalFilterBitcoin"'));
  assert.ok(portal.includes('"bitcoin"'));
});
