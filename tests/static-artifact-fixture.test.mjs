import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import test from "node:test";

test("bundled static home icon exactly matches the canonical Chisel SVG fixture", async () => {
  const seed = await readFile(new URL("../tools/m64Artifact/seeds/svg-icons-v1.js", import.meta.url), "utf8");
  const list = seed.match(/const rawIconHex=(\[[\s\S]*?\]);/);
  assert.ok(list, "SVG seed fixture missing");
  const icon = Buffer.from(JSON.parse(list[1])[0], "hex").toString("utf8");
  assert.match(icon, /id="icon-home"/);
  const expected = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" color="#27384b"><defs>' +
    icon + '</defs><use href="#icon-home" width="24" height="24"/></svg>';
  const manifest = JSON.parse(await readFile(new URL("../chisel-artifacts/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.format, "chisel-static-artifacts-v1");
  const entry = manifest.artifacts["polygon/137/icon/home"];
  assert.equal(entry.provenance, "unverified");
  const raw = await readFile(new URL("../chisel-artifacts/" + entry.path, import.meta.url));
  assert.equal(raw.toString("utf8"), expected);
  assert.equal(raw.length, entry.bytes);
  assert.equal(createHash("sha256").update(raw).digest("hex"), entry.sha256);
});
