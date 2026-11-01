import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({TextDecoder, Uint8Array});
context.window = context;
vm.runInContext(await readFile(new URL("../chisel.portal.payload.js", import.meta.url), "utf8"), context);
const P = context.CHISEL_PORTAL_PAYLOAD;
const screenshotTx = JSON.parse(await readFile(new URL("fixtures/portal-binary-opreturn.json", import.meta.url), "utf8"));

test("the screenshot transaction is 80 binary bytes, preserved exactly as HEX and Base64", () => {
  const output = screenshotTx.vout.find(output => output.scriptpubkey.startsWith("6a"));
  const payload = P.fromOutput(output);
  assert.equal(payload.kind, "binary"); assert.equal(payload.bytes, 80); assert.equal(payload.text, "");
  assert.equal(payload.hex, output.scriptpubkey.slice(6));
  assert.equal(Buffer.from(payload.base64, "base64").toString("hex"), payload.hex);
  assert.equal(payload.scriptHex, output.scriptpubkey);
  assert.equal(payload.label, "Binary OP_RETURN · 80 bytes");
});

test("ASCII, Unicode and Base64 text retain their literal bytes and text", () => {
  for (const text of ["Testing, testing.", "joke", "café ✓\nsecond line", "VGVzdGluZw=="]) {
    const hex = Buffer.from(text).toString("hex"), script = "6a" + (hex.length / 2).toString(16).padStart(2, "0") + hex;
    const payload = P.fromOutput({scriptPubKey: {hex: script, asm: "OP_RETURN " + hex}});
    assert.equal(payload.text, text);
    assert.equal(payload.kind, text.includes("✓") ? "utf8" : "ascii");
    assert.equal(payload.base64, Buffer.from(text).toString("base64"));
    assert.equal(P.fromOutput({scriptPubKey: {asm: "OP_RETURN " + hex}}).text, text);
  }
});

test("control bytes and invalid UTF-8 never become replacement-character text", () => {
  for (const hex of ["ff", "00", "80", "c328", "7f", "c285"]) {
    const payload = P.describe(hex);
    assert.equal(payload.kind, "binary"); assert.equal(payload.text, "");
    assert.equal(Buffer.from(payload.base64, "base64").toString("hex"), hex);
  }
});

test("push lengths, multiple pushes and truncated scripts preserve boundaries without inventing data", () => {
  assert.equal(P.fromScript("6a01410142").text, "AB");
  assert.equal(P.fromScript("6a4c024142").text, "AB");
  assert.equal(P.fromScript("6a4d02004142").text, "AB");
  assert.equal(P.fromScript("6a4e020000004142").text, "AB");
  assert.equal(P.fromScript("6a00").bytes, 0);
  for (const script of ["6a0541", "6a4c", "6a4d02", "6a4e020000", "6a76", "6a0"]) {
    const result = P.fromOutput({scriptpubkey: script});
    assert.equal(result.kind, "invalid"); assert.equal(result.text, ""); assert.equal(result.scriptHex, script);
  }
  assert.equal(P.fromOutput({scriptpubkey: "76a914"}), null);
});

test("Base64 conversion round-trips every byte value without browser or Node-specific encoders", () => {
  for (let length = 0; length <= 256; length += 1) {
    const bytes = Buffer.from(Array.from({length}, (_, i) => i));
    assert.equal(P.describe(bytes.toString("hex")).base64, bytes.toString("base64"));
  }
});
