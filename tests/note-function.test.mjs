import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const read = file => readFile(new URL("../" + file, import.meta.url), "utf8");
const first = JSON.parse(await read("tests/fixtures/portal-binary-opreturn.json"));
const continuation = JSON.parse(await read("tests/fixtures/portal-trapezoid-root.json"));
const note = JSON.parse(await read("data-bundled/annotations/litecoin/" + first.txid + ".json"));
const moduleSource = await read("chisel.portal.note-function.js"), payloadSource = await read("chisel.portal.payload.js");
const runnerSource = await read("tools/noteRunner/runner.js");
const pixelCount = 640 * 360 * 4;

class Element {
  constructor(tag, doc) { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.attributes = {}; this.textContent = ""; this.hidden = false;
    if (tag === "iframe") this.contentWindow = {messages: [], postMessage(data) { this.messages.push(data); }};
  }
  appendChild(child) { child.remove(); this.children.push(child); child.parentNode = this; return child; }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  contains(child) { return child === this || this.children.some(node => node.contains(child)); }
  setAttribute(key, value) { this.attributes[key] = value; }
  getContext() { return {putImageData: value => { this.imageData = value; }}; }
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
function fixture() {
  const handlers = new Map(), timers = new Map(); let timerId = 0;
  const doc = {createElement: tag => new Element(tag, doc)};
  const context = vm.createContext({TextDecoder, Uint8Array, Uint8ClampedArray, ArrayBuffer, URL, document: doc,
    location: {href: "https://example.org/chisel/?mode=portal"},
    ImageData: class { constructor(data, width, height) { Object.assign(this, {data, width, height}); } },
    addEventListener(type, fn) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(fn); },
    removeEventListener(type, fn) { handlers.get(type)?.delete(fn); },
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); }
  });
  context.window = context;
  vm.runInContext(payloadSource, context); vm.runInContext(moduleSource, context);
  return {api: context.CHISEL_NOTE_FUNCTION, doc, handlers, timers,
    message(source, data) { for (const fn of handlers.get("message") || []) fn({source, data}); }};
}

test("real trapezoid bytes reconstruct the documented function from binary and ASCII-hex roots", () => {
  const {api} = fixture(), proof = api.reconstruct(first, continuation, note.metadata);
  assert.equal(proof.source, note.metadata.canonicalJavaScript);
  assert.equal(proof.headBytes, 80); assert.equal(proof.tailBytes, 14); assert.equal(proof.bytes, 94);
  assert.equal(proof.previousLocator, "3172893:13"); assert.equal(proof.predecessor, first.txid);
  const asciiRoot = {txid: note.metadata.asciiHexRoot.txid, vout: [{scriptPubKey: {
    asm: "OP_RETURN " + Buffer.from("01306a1d0d92659594328e9163829163859190").toString("hex")}}]};
  assert.equal(api.reconstruct(first, asciiRoot, {...note.metadata, canonicalRoot: note.metadata.asciiHexRoot}).source, proof.source);
  assert.throws(() => api.reconstruct(first, {...continuation, txid: "00".repeat(32)}, note.metadata), /TXID/);
  assert.throws(() => api.reconstruct(first, continuation, {...note.metadata, locator: "1:1"}), /another predecessor/);
  assert.throws(() => api.reconstruct(first, {txid: continuation.txid, vout: [{scriptpubkey: "6a0101"}]}, note.metadata), /locator/);
  assert.throws(() => api.reconstruct({vout: [{scriptpubkey: "6a01ff"}]}, continuation, note.metadata), /Unknown McDougall token/);
  assert.throws(() => api.payload({vout: [{scriptpubkey: "6a02ff"}]}), /complete OP_RETURN/);
});

test("function descriptors and display formatting preserve executable source and strings", () => {
  const {api} = fixture();
  assert.equal(api.descriptor(note).entry, "a");
  for (const metadata of [{}, {...note.metadata, entry: "a();evil"}, {...note.metadata, runtime: "html"}, {canonicalJavaScript: "x".repeat(32001)}])
    assert.equal(api.descriptor({metadata}), null);
  const source = 'function a(b){const s=";{quoted}";b.fill(s);}';
  assert.match(api.pretty(source), /";\{quoted\}"/);
  assert.equal(api.pretty("function a(){return /x;/;}"), "function a(){return /x;/;}");
  assert.equal(api.pretty("function a(){return `x;`;}"), "function a(){return `x;`;}");
  const commands = [];
  const canvas = {width: 640, height: 360, getContext: () => Object.fromEntries(["beginPath", "moveTo", "lineTo", "closePath", "fill"].map(name => [name, (...args) => commands.push([name, ...args])]))};
  vm.runInNewContext(api.pretty(note.metadata.canonicalJavaScript) + ";a(canvas)", {canvas});
  assert.deepEqual(commands, [["beginPath"], ["moveTo", 128, 288], ["lineTo", 512, 288], ["lineTo", 416, 72], ["lineTo", 224, 72], ["closePath"], ["fill"]]);
});

test("note UI reconstructs without running, draws only after Run and restores completed output", async () => {
  const f = fixture(), row = {txid: first.txid, raw: first}, container = f.doc.createElement("div");
  const block = f.api.render(container, row, note, {loadTransaction: async txid => { assert.equal(txid, continuation.txid); return continuation; }});
  await new Promise(resolve => setImmediate(resolve));
  const nodes = descendants(block), frame = nodes.find(n => n.tagName === "iframe"), button = nodes.find(n => n.tagName === "button"), canvas = nodes.find(n => n.tagName === "canvas");
  assert.match(nodes.find(n => n.tagName === "pre").textContent, /function a\(b\)/);
  assert.ok(nodes.some(n => /80 \+ 14 = 94/.test(n.textContent)));
  assert.equal(frame.attributes.sandbox, "allow-scripts"); assert.equal(frame.contentWindow.messages.length, 0); assert.equal(canvas.hidden, true);
  f.message({}, {type: "chisel-note-function-ready"}); button.onclick();
  assert.equal(frame.contentWindow.messages.length, 0, "another window cannot activate the runner");
  f.message(frame.contentWindow, {type: "chisel-note-function-ready"});
  const sent = frame.contentWindow.messages[0]; assert.equal(sent.source, note.metadata.canonicalJavaScript); assert.equal(button.disabled, true);
  f.message({}, {type: "chisel-note-function-result", id: sent.id, ok: true, pixels: new ArrayBuffer(pixelCount)});
  assert.equal(canvas.hidden, true);
  f.message(frame.contentWindow, {type: "chisel-note-function-result", id: sent.id, ok: true, pixels: new ArrayBuffer(pixelCount)});
  assert.equal(canvas.hidden, false); assert.equal(canvas.imageData.data.byteLength, pixelCount); assert.equal(button.disabled, false);
  f.api.disposeWithin(container); assert.equal(f.handlers.get("message").size, 0); assert.equal(f.timers.size, 0);
  const refreshed = f.api.render(container, row, note);
  assert.equal(descendants(refreshed).find(n => n.tagName === "canvas").hidden, false);
  assert.equal(descendants(refreshed).find(n => n.tagName === "iframe").contentWindow.messages.length, 0, "restoring pixels does not execute code again");
  f.api.disposeWithin(container);
});

function runnerFixture() {
  const sent = [], blobs = [], workers = [], revoked = [], timers = new Map(); let handler, serial = 0;
  const parent = {postMessage: value => sent.push(value)};
  const context = vm.createContext({parent, ArrayBuffer,
    Blob: class { constructor(parts) { this.source = parts.join(""); } },
    URL: {createObjectURL(blob) { blobs.push(blob); return "blob:" + blobs.length; }, revokeObjectURL: url => revoked.push(url)},
    Worker: class { constructor(url) { this.url = url; workers.push(this); } postMessage(data) { this.data = data; } terminate() { this.terminated = true; } },
    addEventListener(type, fn) { assert.equal(type, "message"); handler = fn; },
    setTimeout(fn, delay) { assert.equal(delay, 3000); const id = ++serial; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(runnerSource, context);
  const input = id => ({type: "chisel-note-function-run", id, source: note.metadata.canonicalJavaScript, entry: "a", width: 640, height: 360});
  return {sent, workers, blobs, revoked, timers, input, receive: (data, source = parent) => handler({source, data})};
}

test("runner starts only for parent requests, bounds work and ignores late results from replaced jobs", () => {
  const f = runnerFixture();
  assert.equal(f.sent[0].type, "chisel-note-function-ready"); assert.equal(f.workers.length, 0);
  f.receive(f.input("spoof"), {}); f.receive({...f.input("bad"), entry: "a()"}); f.receive({...f.input("big"), width: 10000});
  assert.equal(f.workers.length, 0);
  f.receive(f.input("one")); const old = f.workers[0];
  f.receive(f.input("two")); assert.equal(old.terminated, true);
  old.onmessage({data: {ok: true, pixels: new ArrayBuffer(pixelCount)}}); assert.equal(f.workers[1].terminated, undefined);
  f.workers[1].onmessage({data: {ok: true, pixels: new ArrayBuffer(pixelCount)}});
  assert.equal(f.sent.at(-1).id, "two"); assert.equal(f.sent.at(-1).ok, true); assert.equal(f.timers.size, 0); assert.equal(f.revoked.length, 2);
  f.receive(f.input("timeout")); [...f.timers.values()][0]();
  assert.match(f.sent.at(-1).error, /3 second/); assert.equal(f.workers[2].terminated, true);
  f.receive(f.input("badPixels")); f.workers[3].onmessage({data: {ok: true, pixels: new ArrayBuffer(4)}});
  assert.equal(f.sent.at(-1).ok, false); assert.match(f.sent.at(-1).error, /Invalid canvas/);
});

test("actual worker executes the reconstructed trapezoid and returns canvas pixels or a function error", async () => {
  const f = runnerFixture(); f.receive(f.input("draw"));
  const commands = [], sent = [], pixels = new Uint8ClampedArray(pixelCount);
  const drawing = Object.fromEntries(["beginPath", "moveTo", "lineTo", "closePath", "fill"].map(name => [name, (...args) => commands.push([name, ...args])]));
  drawing.getImageData = () => ({data: pixels});
  const self = {postMessage: value => sent.push(value)};
  vm.runInNewContext(f.blobs[0].source, {self, OffscreenCanvas: class { constructor(width, height) { Object.assign(this, {width, height}); } getContext() { return drawing; } }});
  await self.onmessage({data: f.workers[0].data});
  assert.equal(sent[0].ok, true); assert.equal(sent[0].pixels.byteLength, pixelCount);
  assert.deepEqual(commands, [["beginPath"], ["moveTo", 128, 288], ["lineTo", 512, 288], ["lineTo", 416, 72], ["lineTo", 224, 72], ["closePath"], ["fill"]]);
  await self.onmessage({data: {...f.workers[0].data, source: 'function a(){throw new Error("example error");}'}});
  assert.equal(sent[1].ok, false); assert.equal(sent[1].error, "example error");
});
