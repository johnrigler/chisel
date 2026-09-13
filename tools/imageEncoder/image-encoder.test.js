"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

global.window = global;

eval(fs.readFileSync(path.join(root, "chisel.unspendable.js"), "utf8"));
eval(fs.readFileSync(path.join(root, "chisel.image.js"), "utf8"));

function validateBase58Check(address) {
  const decoded = Buffer.from(global.CHISEL_UNSPENDABLE.base58ToBytes(address));
  const payload = decoded.subarray(0, -4);
  const checksum = decoded.subarray(-4);
  const expected = crypto.createHash("sha256")
    .update(crypto.createHash("sha256").update(payload).digest())
    .digest()
    .subarray(0, 4);

  assert.equal(decoded.length, 25);
  assert.deepEqual(checksum, expected);
  assert.equal(payload[0], 63, "Digibyte P2SH version byte");
}

async function run() {
  const image = global.CHISEL_IMAGE;
  const palette = image.parsePalette(JSON.parse(fs.readFileSync(path.join(root, "b57.json"), "utf8")));
  const fixtureRow = "MMMBQXiiiiiisrrrriiXQBBMMM";
  const fixtureAddress = "SNMMMBQXiiiiiisrrrriiXQBBMMM12AD3f";
  const fixtureGenerated = await global.CHISEL_UNSPENDABLE.generateRawBase58("SN", fixtureRow);

  assert.equal(fixtureGenerated, fixtureAddress);

  const v1Crop = image.cropBounds(224, 224, {
    top: 44,
    bottom: 120,
    left: 150,
    right: 48
  });

  assert.deepEqual({ x: v1Crop.x, y: v1Crop.y, width: v1Crop.width, height: v1Crop.height }, {
    x: 150,
    y: 44,
    width: 26,
    height: 60
  });

  const louReedCrop = image.v1CropSetup("42,134,150,48", 300, 300);

  assert.deepEqual({
    x: louReedCrop.x,
    y: louReedCrop.y,
    width: louReedCrop.width,
    height: louReedCrop.height,
    rasterWidth: louReedCrop.rasterWidth,
    rasterHeight: louReedCrop.rasterHeight
  }, {
    x: 150,
    y: 42,
    width: 26,
    height: 48,
    rasterWidth: 224,
    rasterHeight: 224
  });

  const louReedRows = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/lou-reed-v1-rows.json"), "utf8"));

  assert.equal(louReedRows.length, 48);
  assert(louReedRows.every(function hasV1Width(row) {
    return row.length === image.COLUMNS;
  }));

  const louReedAddresses = await image.rowsToAddresses(louReedRows);
  const louReedPayload = image.buildEtchPayload(louReedAddresses);

  assert.equal(louReedAddresses.length, 48);
  assert.equal(louReedPayload.replaceRecipients, true);
  assert.deepEqual(image.addressesToRows(louReedAddresses), louReedRows);

  const mogwai = JSON.parse(fs.readFileSync(path.join(root, "mogwai.json"), "utf8"));
  const mogwaiAddresses = mogwai.vout.map(function getAddress(output) {
    return output.scriptpubkey_address;
  }).filter(function isImageAddress(address) {
    return address && address[0] === "S";
  });
  const mogwaiRows = mogwaiAddresses.map(image.addressToRow);
  const regeneratedMogwaiAddresses = await image.rowsToAddresses(mogwaiRows);

  assert.equal(mogwaiAddresses.length, 58);
  assert.deepEqual(regeneratedMogwaiAddresses, mogwaiAddresses);

  const solidRows = new Array(image.MAX_ROWS).fill("M".repeat(image.COLUMNS));
  const solidAddresses = await image.rowsToAddresses(solidRows);

  assert.equal(solidAddresses.length, image.MAX_ROWS);
  assert.equal(new Set(solidAddresses).size, image.MAX_ROWS);
  assert(solidAddresses.every(function roundTrips(address) {
    return image.addressToRow(address) === solidRows[0];
  }));
  solidAddresses.forEach(validateBase58Check);

  const blackPixels = new Uint8ClampedArray(image.COLUMNS * 4);
  for (let offset = 3; offset < blackPixels.length; offset += 4) blackPixels[offset] = 255;
  const quantized = image.quantizeImageData({ width: image.COLUMNS, height: 1, data: blackPixels }, palette);

  assert.equal(quantized[0], "M".repeat(image.COLUMNS));

  const payload = image.buildEtchPayload(solidAddresses);
  assert.equal(payload.currency, "digibyte");
  assert.equal(payload.replaceRecipients, true);
  assert.equal(payload.recipients.length, image.MAX_ROWS);
  assert(payload.recipients.every(function hasV1Amount(recipient) {
    return recipient.amount === image.DEFAULT_AMOUNT_DGB && recipient.outputType === "unspendable";
  }));

  console.log("PASS: Lou Reed V1 setup, all 58 Mogwai outputs, 100 repeated rows, Base58Check, palette, and Etch payload.");
}

run().catch(function onFailure(error) {
  console.error(error);
  process.exitCode = 1;
});
