import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
function handler(name) {
  const start = source.indexOf("  function " + name + "(");
  assert.ok(start >= 0);
  const end = source.indexOf("\n  function ", start + 1);
  assert.ok(end > start);
  return source.slice(start, end);
}
function fixture(href, preview = null) {
  const calls = {events: [], modes: [], statuses: []};
  const elems = {
    opReturnAscii: {value: "previous text", dispatchEvent(event) { calls.events.push(event.type); }, focus() { calls.focus = true; }, scrollIntoView() { calls.scrolled = true; }},
    opReturnHex: {value: "abcd", dispatchEvent(event) { calls.events.push(event.type); }},
    recipientRows: {innerHTML: "existing recipient rows"}
  };
  Object.defineProperty(elems, "senderWif", {get() { assert.fail("Share loader accessed a private key"); }});
  const window = {location: {href}, history: {replaceState(_, __, value) { window.location.href = value; }}};
  if (preview) window.CHISEL_RECORD_PREVIEW = preview;
  const context = vm.createContext({window, elems, URL, URLSearchParams, TextEncoder, Event: class {constructor(type) {this.type = type;}},
    setCurrencyValue() { assert.fail("Share loader changed currency"); },
    addRecipientRow() { assert.fail("Share loader added a recipient"); },
    setSuggestedFeeValue() {},
    setGuiMode(mode) { calls.modes.push(mode); const url = new URL(window.location.href); url.searchParams.set("mode", mode); window.location.href = url.href; },
    setStatusMessage(message, bad) { calls.statuses.push({message, bad}); }
  });
  vm.runInContext(handler("loadArtifactPayload") + handler("loadSharedOpReturnFromUrl"), context);
  return {context, elems, calls, window};
}

test("a shared video fills ASCII, clears conflicting hex, and opens Send without accessing keys or recipients", () => {
  const video = "https://youtu.be/jNQXAC9IVRw?t=90";
  const f = fixture("https://chisel.example/?mode=portal&currency=untrusted&wif=untrusted#keep=here&opreturn=" + encodeURIComponent(video));
  assert.equal(f.context.loadSharedOpReturnFromUrl(), true);
  assert.equal(f.elems.opReturnAscii.value, video);
  assert.equal(f.elems.opReturnHex.value, "");
  assert.equal(f.elems.recipientRows.innerHTML, "existing recipient rows");
  assert.deepEqual(f.calls.events, ["input"]);
  assert.deepEqual(f.calls.modes, ["send"]);
  assert.equal(f.calls.focus, true); assert.equal(f.calls.scrolled, true);
  const consumed = new URL(f.window.location.href);
  assert.equal(consumed.searchParams.get("mode"), "send");
  assert.equal(consumed.hash, "#keep=here");
  assert.equal(f.context.loadSharedOpReturnFromUrl(), false, "consumed handoff must not overwrite a later edit");
});

test("query-based URL openers preserve complete URL text including ampersands and fragments", () => {
  const value = "https://example.test/watch?v=one&list=two#part";
  const f = fixture("http://localhost:8000/index.html?opreturn=" + encodeURIComponent(value));
  assert.equal(f.context.loadSharedOpReturnFromUrl(), true);
  assert.equal(f.elems.opReturnAscii.value, value);
  assert.equal(new URL(f.window.location.href).searchParams.has("opreturn"), false);
});

test("missing, empty, and oversized handoffs leave the previous draft untouched", () => {
  for (const text of [null, " ", "é".repeat(2049)]) {
    const f = fixture("https://chisel.example/" + (text === null ? "" : "#opreturn=" + encodeURIComponent(text)));
    assert.equal(f.context.loadSharedOpReturnFromUrl(), false);
    assert.equal(f.elems.opReturnAscii.value, "previous text");
    assert.equal(f.elems.opReturnHex.value, "abcd");
    assert.equal(f.calls.modes.length, 0);
    assert.equal(f.calls.statuses.length, text === null ? 0 : 1);
  }
});

test("a rich handoff goes to the preview only, preserves the text-only draft boundary, and is consumed once", () => {
  const text = "https://youtu.be/jNQXAC9IVRw?t=90";
  const record = JSON.stringify({schema: "chisel-shared-record-v1", opReturnText: text, currency: "untrusted", recipients: [{address: "untrusted"}]});
  const received = [];
  const f = fixture("https://chisel.example/?record=old#keep=here&opreturn=" + encodeURIComponent(text) + "&record=" + encodeURIComponent(record), {
    receive(raw, content) { received.push({raw, content}); return ""; }
  });
  assert.equal(f.context.loadSharedOpReturnFromUrl(), true);
  assert.deepEqual(received, [{raw: record, content: text}]);
  assert.equal(f.elems.opReturnAscii.value, text);
  assert.equal(f.elems.recipientRows.innerHTML, "existing recipient rows");
  assert.equal(new URL(f.window.location.href).hash, "#keep=here");
  assert.equal(new URL(f.window.location.href).searchParams.has("record"), false);
  assert.equal(f.context.loadSharedOpReturnFromUrl(), false);
  assert.equal(received.length, 1);
});

test("invalid rich metadata leaves the shared text usable and reports the preview error", () => {
  const f = fixture("https://chisel.example/#opreturn=Hello&record=malformed", {receive() { return "Shared metadata was not loaded: invalid record."; }});
  assert.equal(f.context.loadSharedOpReturnFromUrl(), true);
  assert.equal(f.elems.opReturnAscii.value, "Hello");
  assert.equal(f.calls.statuses.at(-1).bad, true);
  assert.match(f.calls.statuses.at(-1).message, /OP_RETURN text was loaded/);
});
