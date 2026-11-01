import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [source, index] = await Promise.all(["chisel.activity-monitor.js", "index.html"]
  .map(file => readFile(new URL("../" + file, import.meta.url), "utf8")));
const start = index.indexOf("    const observer = new MutationObserver(function () {");
const end = index.indexOf('    const sendStatus = document.getElementById("status");', start);
assert.ok(start >= 0 && end > start);
const bridgeSource = index.slice(start, end);

function fixture() {
  let now = 1700000000000;
  const intervals = [], trace = [], nodes = new Map();
  function element(textContent = "") {
    const node = {textContent, dataset: {}, className: "", addEventListener() {}};
    node.classList = {contains: name => node.className.split(" ").includes(name),
      add(name) { node.className += " " + name; }, remove(name) { node.className = node.className.split(" ").filter(value => value !== name).join(" "); }};
    return node;
  }
  for (const id of ["chiselActivityMonitor", "activityClock", "activityPulse", "activityStream", "activityRecords",
    "activityProxyState", "activityCurrent", "portalIndexCaption", "portalStatus", "portalExplorerCount", "portalFileProxyHealth"]) nodes.set(id, element());
  nodes.get("portalIndexCaption").textContent = "LTC main thunderword: LTEST";
  nodes.get("portalExplorerCount").textContent = "20 shown · 747 loaded";
  nodes.get("portalFileProxyHealth").textContent = "FileProxy: connected";
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const context = vm.createContext({Date: ClockDate, document: {body: {dataset: {mode: "portal"}}, getElementById: id => nodes.get(id)},
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe() {} },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval(callback) { intervals.push(callback); },
    chiselActivity(...args) { trace.push(args); }, CHISEL_DIAGNOSTICS: {clean: value => String(value)}});
  context.window = context;
  vm.runInContext(source, context);
  const observer = vm.runInContext(bridgeSource + "\nobserver;", context);
  return {nodes, trace, update(message, isError = false) {
    nodes.get("portalStatus").textContent = message;
    nodes.get("portalStatus").className = isError ? "error" : "muted";
    observer.callback();
  }, idle() { now += 13000; intervals.forEach(callback => callback()); }};
}

test("Portal status travels through the existing observer to the top panel as actual text", () => {
  const f = fixture(), message = "Live ledger search merged 27 candidate transaction(s). Static/preloaded rows were not cleared.";
  f.update(message);
  assert.equal(f.nodes.get("activityCurrent").textContent, "Portal: " + message);
  assert.equal(f.nodes.get("activityCurrent").dataset.level, "info");
  assert.equal(f.nodes.get("activityStream").textContent, "LTC main thunderword");
  assert.equal(f.nodes.get("activityRecords").textContent, "20 shown · 747 loaded");
  assert.equal(f.trace.at(-1)[3], message, "full text remains available in the activity log");
});

test("idle changes the activity badge while keeping the last meaningful Portal message", () => {
  const f = fixture();
  f.update("Ledger history updated. 50 transaction(s) checked.");
  const message = f.nodes.get("activityCurrent").textContent;
  f.idle();
  assert.equal(f.nodes.get("activityPulse").textContent, "IDLE");
  assert.equal(f.nodes.get("activityCurrent").textContent, message);
});

test("Portal errors display their actual reason and background status respects a latched error", () => {
  const f = fixture(), message = "Ledger refresh failed with HTTP 429; cached transactions remain available.";
  f.update(message, true);
  const current = f.nodes.get("activityCurrent");
  assert.equal(current.textContent, "Portal: " + message);
  assert.equal(current.dataset.level, "error");
  assert.equal(f.nodes.get("activityPulse").textContent, "ERROR");
  current.dataset.latched = "error";
  current.textContent = "Send: Signing failed";
  f.update("Ledger history updated. 50 transaction(s) checked.");
  assert.equal(current.textContent, "Send: Signing failed");
});
