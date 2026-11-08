import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const root = new URL("../tools/m64Artifact/seeds/", import.meta.url);
const context = vm.createContext({Uint8Array});
vm.runInContext(readFileSync(new URL("svg-icons-v1.js", root), "utf8"), context);
const seed = context.ChiselM64Native6SvgIconsSeed;
const plan = JSON.parse(readFileSync(new URL("svg-icons-v1.deployment-plan.json", root), "utf8"));

test("SVG icon seed and plan match exactly", () => {
  assert.equal(seed.primaryHex.length, 62);
  assert.equal(seed.rawIconHex.length, 64);
  assert.deepEqual(Array.from(seed.primaryHex, x => "0x"+x), plan.constructorArguments[5]);
  assert.deepEqual(Array.from(seed.rawIconHex, x => "0x"+x), plan.afterDeployment.batches.flat());
  assert.deepEqual(plan.afterDeployment.batches.map(x => x.length), Array(8).fill(8));
  assert.deepEqual(plan.constructorArguments.slice(0,5), [
    "M64 SVG Icons v1","M64SVG","svg","image/svg+xml",
    "Reusable SVG icon definitions for deterministic lossless reconstruction"
  ]);
  assert.deepEqual(plan.constructorArguments.slice(6), [[],[]]);
  assert.equal(seed.create(false).secondary.length, 0);
  assert.equal(seed.create(true).secondary.length, 64);
  assert.ok(seed.create(true).secondary.every(e => e.kind === 1 && e.symbolCount === 0 && e.data.length > 0 && e.data.length <= 4096));
});

test("EVM factory exposes the SVG preset and after-deployment warning", () => {
  const html = readFileSync(new URL("../tools/evmFactory/index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../tools/evmFactory/app.js", import.meta.url), "utf8");
  assert.match(html, /id="loadSvgSeed"/);
  assert.match(html, /seeds\/svg-icons-v1\.js/);
  assert.match(app, /addRawBatch\(bytes\[\]\)/);
  assert.match(app, /svg\.primaryHex\.map/);
});
