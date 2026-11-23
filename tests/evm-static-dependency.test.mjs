import assert from "node:assert/strict";
import {access, readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = name => readFile(new URL("../" + name, import.meta.url), "utf8");

test("Polygon workbench uses a bundled ethers UMD script", async () => {
  const evm = await source("evm.html");
  await access(new URL("../vendor/ethers-6.6.0.umd.min.js", import.meta.url));
  assert.match(evm, /<script src="vendor\/ethers-6\.6\.0\.umd\.min\.js"><\/script>/);
  assert.doesNotMatch(evm, /<script[^>]+src="https?:\/\/[^"]+ethers[^"]*"/i);
  assert.ok(evm.indexOf('src="vendor/ethers-6.6.0.umd.min.js"') <
    evm.indexOf('src="chisel.evm.contracts.js'), "load ethers before EVM consumers");
});

test("main Send navigation retains the Polygon workbench", async () => {
  const main = await source("index.html");
  const app = await source("app.js");
  assert.match(main, /<option value="polygon">Polygon<\/option>/);
  assert.match(main, /data-mode-panel="polygon"/);
  assert.match(main, /<iframe class="polygonWorkbenchFrame" src="evm\.html\?rev=[^"]+"/);
  assert.match(app, /setGuiMode\("polygon"\)/);
});

test("an explicit Gomez Portal record opens Portal while a bare EVM link opens the workbench", async () => {
  const app = await source('app.js');
  const start = app.indexOf('  function bindGuiModeShell() {');
  const end = app.indexOf('\n  //\n  // Console tools', start);
  const bind = app.slice(start, end);
  for (const [query, expected] of [
    ['?mode=portal&coin=evm&txid=' + 'a'.repeat(64) + '&chain=137', 'portal'],
    ['?coin=evm', 'polygon'], ['?mode=polygon&coin=evm', 'polygon'], ['', 'portal']
  ]) {
    let selected;
    vm.runInNewContext(bind + '\nbindGuiModeShell();', {URL,
      window: {location: {href: 'https://chisel.example/' + query}},
      document: {querySelectorAll() { return []; }}, setGuiMode(value) { selected = value; }});
    assert.equal(selected, expected);
  }
});
