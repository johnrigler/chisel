#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const cli = path.resolve(__dirname, "chisel-cli.js");
const root = process.env.CHISEL_TEST_ROOT;

if (!root) {
  process.stderr.write("Set CHISEL_TEST_ROOT to a Chisel checkout before running this test.\n");
  process.exit(2);
}

function run(args, input) {
  const result = spawnSync(process.execPath, [cli, "--root", root].concat(args), {
    encoding: "utf8",
    input: input || ""
  });

  assert.equal(
    result.status,
    0,
    "command failed: " + args.join(" ") + "\n" + result.stderr
  );

  return result.stdout;
}

const check = JSON.parse(run(["check"]));
assert.equal(check.ok, true);
assert.equal(check.smoke.ripemd160_abc, "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc");
assert.equal(check.smoke.validLitecoinReadablePrefix, true);

const address = run(["un", "LKx", "DOWNTON ABBEY"]).trim();
assert.equal(address, "LKxDoWNToNxABBEYzzzzzzzzzzzzXa6kiD");

const inspection = JSON.parse(run(["uninspect", "LKx", "DOWNTON ABBEY"]));
assert.equal(inspection.address, address);
assert.equal(inspection.stem28, "LKxDoWNToNxABBEYzzzzzzzzzzzz");

const opReturn = JSON.parse(run(["opreturn", "hello"]));
assert.equal(opReturn.payloadHex, "68656c6c6f");
assert.equal(opReturn.scriptHex, "6a0568656c6c6f");

assert.equal(
  run(["hash", "ripemd160", "616263"]).trim(),
  "8eb208f7e05d987a9b044a8e98c6b087f15a0bfc"
);

const rawTransaction = "0100000001" +
  "00".repeat(32) +
  "00000000" +
  "00" +
  "ffffffff" +
  "01" +
  "e803000000000000" +
  "00" +
  "00000000";
const decoded = JSON.parse(run(["tx", "decode", rawTransaction]));
assert.equal(decoded.version, 1);
assert.equal(decoded.vin.length, 1);
assert.equal(decoded.vout.length, 1);
assert.equal(decoded.vout[0].valueSats, 1000);

process.stdout.write("chisel-cli test: ok\n");
