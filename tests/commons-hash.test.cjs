/* node --test tests/commons-hash.test.cjs */
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const code = fs.readFileSync("tools/commons/core.js", "utf8");
const context = {globalThis:{}};
vm.runInNewContext(code, context);
const C = context.globalThis.ChiselCommons;
test("Commons SHA-256 handoff preserves complete hash and correct transport", () => {
 const h = "a".repeat(64);
 const p = C.payload(h, "0.00001000");
 assert.equal(p.opReturnAscii, "sha256:" + h);
 assert.equal(Buffer.byteLength(p.opReturnAscii), 71);
 assert.equal(p.currency,"litecoin");
 assert.equal(p.replaceRecipients,true);
 assert.equal(p.recipients.length,2);
 assert.equal(p.recipients[0].address, C.ROOT);
 assert.equal(p.recipients[1].address, "LMxCoMMoNSzzzzzzzzzzzzzzzzzzZU8MFW");
 assert.equal(p.recipients[1].outputType,"unspendable");
 assert.equal(p.recipients[0].amount,"0.00001000");
});
test("input normalization and invalid data rejection", () => {
 assert.equal(C.digest("  " + "ABCDEF".repeat(10) + "ABCD  "), "abcdef".repeat(10) + "abcd");
 for (const h of ["", "f".repeat(63), "g".repeat(64), "sha256:"+"f".repeat(64)])
   assert.throws(() => C.payload(h,"0.00001000"));
 for (const amount of ["0.0", "0.00000001", "0.01000000", "1.00000000", "-1.00000000"])
   assert.throws(() => C.payload("f".repeat(64),amount));
 assert.equal(C.amountUnits("0.00000547"),547n);
});
