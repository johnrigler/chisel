import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
async function load(path) {
  const window = {};
  vm.runInNewContext(await readFile(new URL("../"+path,import.meta.url),"utf8"), {window,TextEncoder,TextDecoder,URL,URLSearchParams,Uint8Array,BigInt});
  return window;
}
const word = n => BigInt(n).toString(16).padStart(64,"0");
test("short Polygon share contains exact UTF-8 bytes and only public text", async () => {
  const api = (await load("chisel.evm.share.js")).CHISEL_EVM_SHARE;
  assert.equal(api.encodeText("é").hex,"0xc3a9");
  assert.equal(api.encodeText("x".repeat(80)).byteLength,80);
  assert.throws(()=>api.encodeText("é".repeat(41)),/80/);
  const value="https://youtu.be/abcdefghijk";
  const url=new URL(api.workbenchUrl("https://example.org/chisel/?mode=send",value));
  assert.equal(url.pathname,"/chisel/evm.html");
  assert.equal(api.sharedText(url.hash),value);
  assert.equal(url.search,"");
});
test("decode Chisel logRecord calldata and reject truncation", async () => {
  const api=(await load("chisel.evm.decode.js")).CHISEL_EVM_DECODE;
  const data="0x5d9c3e43"+word(0)+word(64)+word(3)+"616263".padEnd(64,"0");
  assert.equal(api.decode(data).text,"abc");
  assert.equal(api.decode(data).logData,"0x616263");
  assert.throws(()=>api.decode(data.slice(0, -64)),/Truncated/);
});
test("decode execute with one payment plus log",async()=>{
  const api=(await load("chisel.evm.decode.js")).CHISEL_EVM_DECODE;
  const address="12".repeat(20);
  const data="0x3becb236"+word(160)+word(192)+word(224)+word(0)+word(320)+word(0)+word(0)+word(1)+address.padStart(64,"0")+word(7)+word(3)+"616263".padEnd(64,"0");
  const result=api.decode(data);
  assert.equal(result.text,"abc");
  assert.equal(result.receivers[0],"0x"+address);
  assert.equal(result.amounts[0],"7");
});

test("MetaMask route retains only public draft and wallet preference", async () => {
  const api = (await load("chisel.evm.share.js")).CHISEL_EVM_SHARE;
  const base = "https://example.org/chisel/?mode=send&private=discard";
  const value = "https://youtu.be/abcdefghijk";
  const local = new URL(api.metamaskUrl(base, value, true, true));
  assert.equal(local.search, "");
  assert.equal(api.sharedText(local.hash), value);
  assert.equal(new URLSearchParams(local.hash.slice(1)).get("wallet"), "metamask");
  const mobile = new URL(api.metamaskUrl(base, value, true, false));
  assert.equal(mobile.origin, "https://link.metamask.io");
  const nested = new URL("https://" + decodeURIComponent(mobile.pathname.slice("/dapp/".length)));
  assert.equal(api.sharedText(nested.hash), value);
  assert.equal(nested.search, "");
  assert.equal(api.sharedText(new URL(api.metamaskUrl(base, "", false, false)).hash), null);
  assert.throws(() => api.metamaskUrl(base, "x".repeat(81), false, false), /80/);
});
