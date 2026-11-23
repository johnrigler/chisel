import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import test from "node:test";
import vm from "node:vm";

const ethers = createRequire(import.meta.url)("../vendor/ethers-6.6.0.umd.min.js");
const context = vm.createContext({TextDecoder, Uint8Array}, {codeGeneration: {strings: false, wasm: false}});
vm.runInContext(await readFile(new URL("../chisel.evm.decode.js", import.meta.url), "utf8"), context);
const D = context.CHISEL_EVM_DECODE;
const fixture = async name => JSON.parse(await readFile(new URL("fixtures/gomez-tell-" + name + ".json", import.meta.url), "utf8"));
const tell = new ethers.Interface(["function tell(string,address,uint256,address,uint256,address,uint256,address,uint256)"]);
const zero = "0x" + "00".repeat(20);
const encode = (message, address = zero, amount = 0n) => tell.encodeFunctionData("tell", [message,address,amount,zero,0,zero,0,zero,0]);

test("original Gomez transaction inputs recover ASCII and HTML despite generic saved metadata", async () => {
  const ascii = await fixture("ascii"), html = await fixture("html");
  assert.equal(ascii.summary.title, "GOMEZ transaction");
  assert.equal(D.decode(ascii.tx.input).message, "test");
  const decoded = D.decode(html.tx.input);
  assert.equal(decoded.kind, "gomez.tell");
  assert.equal(decoded.message, "<a href=https://brainfall.com/quizzes/which-hogwarts-house-would-you-be-in/result/09z5o6/>DBxHUFFLEPUFFzzzzzzzzzzzzzzzWj6uW9</a>");
  assert.equal(decoded.receivers.length, 4); assert.equal(decoded.amounts.length, 4);
  assert.equal(html.decoded.kind, "evm", "the saved packet is not rewritten by interpretation");
});

test("legacy Gomez UTF-8 image repairs to the original 300 by 164 PNG bytes", async () => {
  const packet = await fixture("legacy-image"), decoded = D.decode(packet.tx.input);
  const png = Buffer.from(decoded.image.src.split(",")[1], "base64");
  assert.equal(decoded.imageEncoding, "legacy-latin1-utf8");
  assert.equal(decoded.image.mime, "image/png"); assert.equal(decoded.image.bytes, 36853);
  assert.equal(png.readUInt32BE(16), 300); assert.equal(png.readUInt32BE(20), 164);
  assert.equal(createHash("sha256").update(png).digest("hex"), "a99fb82b104883d5379585fc35ef2481fe849b330cd9267052688b4fd00c12a6");
  assert.equal(decoded.message, "");
});

test("receiver word padding, Unicode and uint256 amounts are preserved without numeric rounding", () => {
  const address = "0x" + Buffer.from("HELLO").toString("hex").padEnd(40, "0"), amount = (1n << 255n) + 123n;
  const decoded = D.decode(encode("café ✓", address, amount));
  assert.equal(decoded.message, "café ✓"); assert.deepEqual(Array.from(decoded.words), ["HELLO"]);
  assert.equal(decoded.receivers[0], address); assert.equal(decoded.amounts[0], amount.toString());
});

test("known selectors validate dynamic offsets, lengths and address padding; unknown inputs stay unknown", () => {
  const input = encode("hello"), head = input.slice(0,10);
  for (const offset of [1n, 32n, 1n << 255n]) {
    const malformed = head + offset.toString(16).padStart(64,"0") + input.slice(74);
    assert.throws(() => D.decode(malformed), /ABI/);
  }
  assert.throws(() => D.decode(input.slice(0, -64)), /Truncated/);
  assert.throws(() => D.decode(input.slice(0, -1)), /hex/);
  assert.throws(() => D.decode(head + input.slice(10,74) + "1" + input.slice(75)), /padding/);
  assert.equal(D.decode("0xdeadbeef"), null); assert.equal(D.decode("0x"), null);
});

test("the existing Jethro two-string ABI also decodes without a wallet library in the reader", () => {
  const iface = new ethers.Interface(["function mapArtifact(string,string)"]);
  const decoded = D.decode(iface.encodeFunctionData("mapArtifact", ["subject", "<p>Artifact body</p>"]));
  assert.equal(decoded.kind, "jethro.mapArtifact"); assert.equal(decoded.artifact, "subject");
  assert.equal(decoded.body, "<p>Artifact body</p>");
});
