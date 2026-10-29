import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

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
});

test("Etch loads its local QR library before the app, regardless of cache revision", async () => {
  assert.match(index, /id="showSenderAddressQrButton"[^>]*>SHOW ADDRESS QR</);
  assert.match(index, /<dialog id="senderAddressQrDialog"/);
  const base = new URL("https://chisel.example/");
  const scripts = [...index.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match => new URL(match[1], base));
  const qrScripts = scripts.filter(url => url.pathname === "/vendor/qrcode.min.js");
  assert.equal(qrScripts.length, 1, "the public-address QR library must be loaded once");
  assert.equal(qrScripts[0].origin, base.origin, "QR rendering must use the vendored library");
  const appPosition = scripts.findIndex(url => url.pathname === "/app.js");
  assert.ok(appPosition > scripts.indexOf(qrScripts[0]), "load QRCode before app.js");
  assert.ok((await readFile(new URL(".." + qrScripts[0].pathname, import.meta.url))).length > 0);
  assert.match(index, /This QR contains only the public address\. It does not contain the sender WIF\./);
});

// Execute the production handlers with transport/UI boundaries stubbed. This
// tests their effects without adding a browser dependency or exposing app internals.
function functionSource(source, name) {
  const declaration = new RegExp("^  (?:async )?function " + name + "\\(", "m").exec(source);
  assert.ok(declaration, "missing production handler: " + name);
  const rest = source.slice(declaration.index + declaration[0].length);
  const next = /\n  (?:async )?function [A-Za-z]/.exec(rest);
  assert.ok(next, "missing function boundary after " + name);
  return source.slice(declaration.index, declaration.index + declaration[0].length + next.index);
}

function portalFixture({ failLoad = false } = {}) {
  const address = "LfixturePublicAddress", entry = { name: "litecoin", coin: "litecoin", ticker: "LTC" };
  const state = { currentIndex: entry, mainThunderword: { key: address }, personalStreamReturnView: null, portalPage: 4 };
  const calls = { loads: [], promotions: [], saved: [], statuses: [], renders: 0 }, search = { value: "old filter" };
  const context = vm.createContext({
    state,
    $: selector => selector === "#portalEvmWordSearch" ? search : null,
    savePersonalAccount: account => { calls.saved.push(account); return account; },
    restorePersonalTxCache: () => {},
    mergePersonalAccountIndex: async () => {},
    populatePersonalAccountFields: account => ({ account, entry }),
    capturePortalView: () => ({ selected: "previous stream" }),
    setPersonalStreamBackVisible: () => {},
    normalizeAddressForEntry: value => value.trim(),
    getSelectedIndex: () => entry,
    cloneIndexForAddress: value => value,
    mainThunderwordKey: () => address,
    getThunderwords: () => ({ getAddressUrl: () => "https://explorer.example/address/" + address }),
    setExplorerLink: () => {}, setText: () => {},
    promoteMainThunderword: async (index, value, label, source, options) => {
      calls.promotions.push({ source, updateUrl: options.updateUrl }); return state.mainThunderword;
    },
    loadAddressIndex: async (index, value, options) => {
      calls.loads.push({ address: value, stream: options.mainThunderword });
      if (failLoad) throw new Error("fixture explorer unavailable");
      return { transactions: [] };
    },
    requestPortalRender: () => { calls.renders++; },
    setStatus: (message, bad) => calls.statuses.push({ message, bad }),
  });
  vm.runInContext(["loadAddressStream", "loadPersonalAccountStream", "receiveMainThunderwordAccount"].map(name => functionSource(portal, name)).join("\n"), context);
  return { context, address, entry, state, calls, search };
}

for (const explicitSearch of [false, true]) {
  test((explicitSearch ? "manual search" : "scanner handoff") + " refreshes an already-current personal stream", async () => {
    const f = portalFixture();
    f.context.receiveMainThunderwordAccount({ detail: { address: " " + f.address + " ", coin: "litecoin", ticker: "LTC", explicitSearch, wif: "must-not-be-saved" } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.loads.length, 1, "an explicit account handoff must fetch even if the stream is already current");
    assert.equal(f.calls.loads[0].address, f.address);
    assert.equal(f.calls.loads[0].stream, f.state.mainThunderword);
    assert.deepEqual(f.calls.promotions, [{ source: explicitSearch ? "manual" : "scanner", updateUrl: explicitSearch }]);
    assert.equal(f.search.value, f.address); assert.equal(f.state.portalPage, 1); assert.equal(f.calls.renders, 1);
    assert.equal(f.state.personalStreamReturnView.selected, "previous stream");
    assert.equal(JSON.stringify(f.calls.saved).includes("must-not-be-saved"), false);
    assert.equal(f.calls.statuses.length, 0);
  });
}

test("restoring the same personal stream can skip a redundant network load", async () => {
  const f = portalFixture();
  await f.context.loadPersonalAccountStream({ address: f.address, label: "Saved account" });
  assert.equal(f.calls.loads.length, 0);
  assert.equal(f.search.value, f.address);
});

test("empty handoffs do nothing and explorer failures reach the status message", async () => {
  const f = portalFixture({ failLoad: true });
  f.context.receiveMainThunderwordAccount({ detail: { address: "  " } });
  assert.equal(f.calls.saved.length, 0); assert.equal(f.calls.loads.length, 0);
  f.context.receiveMainThunderwordAccount({ detail: { address: f.address } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls.statuses, [{ message: "fixture explorer unavailable", bad: true }]);
});

function addressQrFixture({ address = " LfixturePublicAddress ", failRender = false } = {}) {
  const calls = [], statuses = [];
  function QRCode(holder, options) {
    if (failRender) throw new Error("fixture QR failed");
    calls.push({ holder, options });
  }
  QRCode.CorrectLevel = { M: 0 };
  const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const elems = { senderAddress: { value: address }, senderAddressQrDialog: dialog, senderAddressQrCode: { textContent: "previous QR" }, senderAddressQrTitle: {}, senderAddressQrValue: {}, currency: { value: "litecoin" } };
  Object.defineProperty(elems, "senderWif", { get() { assert.fail("public QR accessed the private key"); } });
  const context = vm.createContext({ elems, window: { QRCode }, CURRENCY_DEFINITIONS: { litecoin: { label: "Litecoin" } }, setStatusMessage: (message, bad) => statuses.push({ message, bad }) });
  vm.runInContext(functionSource(app, "showSenderAddressQr"), context);
  return { context, calls, statuses, elems, dialog };
}

test("public QR renders only the receiving address, with phone-sized dimensions and medium correction", () => {
  const f = addressQrFixture(); f.context.showSenderAddressQr();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].holder, f.elems.senderAddressQrCode);
  assert.equal(f.calls[0].options.text, "LfixturePublicAddress");
  assert.equal(f.calls[0].options.width, 320); assert.equal(f.calls[0].options.height, 320); assert.equal(f.calls[0].options.correctLevel, 0);
  assert.equal(f.elems.senderAddressQrCode.textContent, "");
  assert.equal(f.elems.senderAddressQrValue.textContent, "LfixturePublicAddress");
  assert.equal(f.dialog.open, true); assert.equal(f.statuses.length, 0);
});

test("an empty address or QR rendering failure reports an error without leaving a blank dialog open", () => {
  const empty = addressQrFixture({ address: " " }); empty.context.showSenderAddressQr();
  assert.equal(empty.calls.length, 0); assert.equal(empty.dialog.open, false); assert.equal(empty.statuses[0].bad, true);
  const broken = addressQrFixture({ failRender: true }); broken.context.showSenderAddressQr();
  assert.equal(broken.dialog.open, false); assert.match(broken.statuses[0].message, /fixture QR failed/); assert.equal(broken.statuses[0].bad, true);
});
