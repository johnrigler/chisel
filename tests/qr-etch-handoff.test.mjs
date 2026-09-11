import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [qrScanner, app, portal, index] = await Promise.all([
  readFile(new URL("../qrScan.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../chisel.portal.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8")
]);

test("normal scanner start requests the rear camera instead of camera zero", () => {
  const startCameraBlock = qrScanner.slice(
    qrScanner.indexOf("async function startCamera()"),
    qrScanner.indexOf("async function stopCamera(options)")
  );

  assert.match(qrScanner, /facingMode:\s*\{\s*exact:\s*"environment"\s*\}/);
  assert.match(startCameraBlock, /await startCameraByIndex\(\);/);
  assert.doesNotMatch(startCameraBlock, /startCameraByIndex\(activeCameraIndex\)/);
});

test("scanner handoff carries the public address and returns to Etch", () => {
  assert.match(qrScanner, /address:\s*result\.address/);
  assert.match(qrScanner, /address:\s*lastPayload\.address/);
  assert.match(qrScanner, /index\.html\?mode=etch&loadScannedWif=1/);
  assert.match(app, /address:\s*data\.address/);

  const loadBlock = app.slice(
    app.indexOf("function loadPendingQrPayload(payload, sourceLabel)"),
    app.indexOf("function loadPendingQrPayloadFromStorage()")
  );
  assert.ok(loadBlock.indexOf("clearOutputs();") < loadBlock.indexOf("setSenderWifValue(payload.wif);"));
  assert.match(loadBlock, /setInputValue\(elems\.senderAddress, String\(payload\.address\)\.trim\(\)\)/);
});

test("Etch exposes the derived address and an explicit thunderword search", () => {
  const addressPosition = index.indexOf('id="senderAddress"');
  const advancedPosition = index.indexOf("Advanced / derived values");

  assert.ok(addressPosition >= 0 && addressPosition < advancedPosition);
  assert.equal(index.match(/id="senderAddress"/g)?.length, 1);
  assert.match(index, /id="searchSenderAddressButton"[^>]*>SEARCH ADDRESS AS THUNDERWORD</);
  assert.match(app, /explicitSearch:\s*true/);
  assert.match(portal, /noReloadIfCurrent:\s*!explicitSearch/);
});

test("Etch renders the public address as a phone-scannable QR without exposing the WIF", () => {
  assert.match(index, /id="showSenderAddressQrButton"[^>]*>SHOW ADDRESS QR</);
  assert.match(index, /<dialog id="senderAddressQrDialog"/);
  assert.match(index, /vendor\/qrcode\.min\.js\?rev=20260911b/);

  const qrBlock = app.slice(
    app.indexOf("function showSenderAddressQr()"),
    app.indexOf("function searchSenderAddressAsThunderword()")
  );

  assert.match(qrBlock, /new window\.QRCode/);
  assert.match(qrBlock, /text:\s*address/);
  assert.match(qrBlock, /CorrectLevel\.M/);
  assert.doesNotMatch(qrBlock, /senderWif|privateKey|\bwif\b/i);
  assert.match(index, /This QR contains only the public address\. It does not contain the sender WIF\./);
});
