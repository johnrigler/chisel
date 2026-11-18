import assert from "node:assert/strict";
import {access, readFile} from "node:fs/promises";
import test from "node:test";

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
