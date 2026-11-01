import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {webcrypto} from "node:crypto";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({crypto: webcrypto, Uint8Array, TextEncoder, TextDecoder, URL, URLSearchParams, console});
context.window = context;
for (const file of ["chisel.js", "chisel.sign.js", "vendor/noble-secp256k1-3.2.0.browser.js", "chisel.secp256k1.js", "chisel.secp256k1.noble.js", "chisel.sign.backend.js", "chisel.identity.js", "chisel.portal.view.js", "chisel.interactions.js", "chisel.interactions.ui.js"]) {
  vm.runInContext(await readFile(new URL("../" + file, import.meta.url), "utf8"), context, {filename: file});
}
const A = context.CHISEL_INTERACTIONS, C = context.CHISEL;
const key = JSON.parse(await readFile(new URL("fixtures/security-known-values.json", import.meta.url), "utf8")).privateKeyHex;
const id = n => n.toString(16).padStart(32, "0"), flush = () => new Promise(resolve => setImmediate(resolve));
const subject = {coin: "litecoin", txid: "ab".repeat(32), sourceId: "", chainId: "", dataUrl: "https://records.example/a.json"};
const record = {subject, title: "A video to revisit", synopsis: "What this record explains.", url: "https://youtu.be/jNQXAC9IVRw?t=90"};
const json = value => JSON.parse(JSON.stringify(value));

function service() {
  let sequence = 0;
  const entries = [], calls = [];
  return {entries, calls, async request(base, path, options = {}) {
    calls.push({base, path, options});
    if (options.method === "POST") {
      const document = JSON.parse(options.body), old = entries.find(item => item.document.payload.id === document.payload.id);
      if (old) { assert.deepEqual(old.document, document); return {ok: true, duplicate: true, entry: old}; }
      const entry = {seq: ++sequence, receivedAt: "2026-11-01T13:00:00.000Z", document}; entries.unshift(entry);
      return {ok: true, duplicate: false, entry};
    }
    const params = new URL(path, base).searchParams, limit = Number(params.get("limit") || 20);
    const rows = entries.filter(entry => (!params.has("before") || entry.seq < Number(params.get("before"))) &&
      (!params.has("after") || entry.seq > Number(params.get("after"))) &&
      (!params.has("subject") || A.subjectKey(entry.document.payload.subject) === params.get("subject")) &&
      (!params.has("kind") || entry.document.payload.kind === params.get("kind")));
    return {ok: true, entries: rows.slice(0, limit), hasMore: rows.length > limit, before: rows[Math.min(rows.length, limit) - 1]?.seq ?? null};
  }};
}
function fixture(options = {}) {
  const server = options.server || service(), storage = options.storage || new Map(); let counter = options.start || 0, endpoint = "https://api.example/fileproxy";
  const client = A.createClient({crypto: C, baseUrl: () => endpoint, now: () => "2026-11-01T12:00:00.000Z", randomId: () => id(++counter),
    readStorage: name => storage.get(name) || null, writeStorage: options.writeStorage || ((name, value) => storage.set(name, value)),
    request: options.request || server.request, signer: options.signer});
  return {client, storage, server, endpoint(value) { endpoint = value; }};
}

test("arrival, selection, engagement and comment are separate dated documents in reverse server order", async () => {
  const f = fixture();
  await f.client.record("visit", null, {mode: "portal", action: "arrive"});
  await f.client.record("select", record, {action: "expand"});
  await f.client.record("engage", record, {action: "open_media"});
  await f.client.record("comment", record, {comment: "I want to revisit this video."});
  await f.client.flush(); await flush(); await f.client.refresh({}, false, true);
  assert.deepEqual(f.server.entries.map(item => item.document.payload.kind), ["comment", "engage", "select", "visit"]);
  assert.equal(f.server.entries.length, 4); assert.equal(f.client.state.outbox.length, 0);
  for (const entry of f.server.entries) { assert.equal(entry.document.payload.at, "2026-11-01T12:00:00.000Z"); assert.equal(entry.receivedAt, "2026-11-01T13:00:00.000Z"); }
  assert.equal(f.server.entries[1].document.payload.url, record.url);
  assert.equal(new Set(f.server.entries.map(entry => entry.document.payload.id)).size, 4);
});

test("an unavailable API retains an exportable outbox across reload and never fabricates server confirmation", async () => {
  const f = fixture({request: async () => { throw new Error("HTTP 404"); }});
  await f.client.record("comment", record, {comment: "Retain this offline comment"}); await f.client.flush();
  assert.equal(f.client.state.online, false); assert.equal(f.client.state.outbox.length, 1);
  assert.equal(f.client.feed({}).items[0].seq, null);
  const next = fixture({storage: f.storage, start: 100});
  assert.equal(next.client.state.outbox[0].document.payload.comment, "Retain this offline comment");
  await next.client.flush(true);
  assert.equal(next.server.entries.length, 1); assert.equal(next.client.state.outbox.length, 0);
  assert.equal(next.server.entries[0].document.payload.session, f.client.session);
});

test("retry after a lost write response reuses the same ID and creates no duplicate comment", async () => {
  const server = service(); let loseResponse = true;
  const f = fixture({server, request: async (...args) => { const response = await server.request(...args); if (loseResponse) { loseResponse = false; throw new Error("response lost"); } return response; }});
  await f.client.record("comment", record, {comment: "One comment"}); await f.client.flush();
  assert.equal(server.entries.length, 1); assert.equal(f.client.state.outbox.length, 1);
  await f.client.flush(true);
  assert.equal(server.entries.length, 1); assert.equal(f.client.state.outbox.length, 0);
});

test("a busy shared history pages backward while preserving older entries when newer activity arrives", async () => {
  const server = service(), writer = fixture({server});
  for (let i = 0; i < 47; i++) await writer.client.record("select", {...record, title: "Record " + i});
  await writer.client.flush(); await flush();
  const reader = fixture({server, start: 1000});
  await reader.client.refresh({}, false, true); const first = reader.client.feed({});
  assert.equal(first.items.length, 20); assert.equal(first.items[0].seq, 47); assert.equal(first.hasMore, true);
  await reader.client.refresh({}, true, true); assert.equal(first.items.length, 40);
  await writer.client.record("engage", record, {action: "open_media"}); await writer.client.flush();
  await reader.client.refresh({}, false, true);
  assert.equal(first.items[0].seq, 48); assert.equal(first.items.at(-1).seq, 8);
  await reader.client.refresh({}, true, true); assert.equal(first.items.length, 48); assert.equal(first.hasMore, false);
});

test("catching up more than one page of new visitors does not skip the gap between the old and new heads", async () => {
  const server = service(), writer = fixture({server}), reader = fixture({server, start: 1000});
  await writer.client.record("select", record); await writer.client.flush(); await reader.client.refresh({}, false, true);
  for (let i = 0; i < 45; i++) await writer.client.record("engage", record, {action: "open_media"});
  await writer.client.flush(); await flush();
  for (let i = 0; i < 3; i++) await reader.client.refresh({}, false, true);
  assert.deepEqual(Array.from(reader.client.feed({}).items, entry => entry.seq), Array.from({length: 46}, (_, i) => 46 - i));
});

test("comments are scoped by currency, transaction, EVM source and chain", async () => {
  const f = fixture(), evm = {...subject, coin: "evm", sourceId: "evmGomez", chainId: "137"};
  await f.client.record("comment", record, {comment: "Litecoin comment"});
  await f.client.record("comment", {...record, subject: evm}, {comment: "Polygon comment"}); await f.client.flush(); await flush();
  await f.client.refresh({subject: A.subjectKey(subject), kind: "comment"}, false, true);
  assert.equal(f.client.feed({subject: A.subjectKey(subject), kind: "comment"}).items.length, 1);
  assert.notEqual(A.subjectKey(evm), A.subjectKey({...evm, chainId: "1"}));
  assert.notEqual(A.subjectKey(evm), A.subjectKey({...evm, sourceId: "evmJethro"}));
});

test("an authenticated comment signs its exact text, date and record, and binds the signature to a Litecoin identity", async () => {
  const signer = A.createCommentSigner({privateKey: () => key, crypto: C}), f = fixture({signer: () => signer});
  const document = await f.client.record("comment", record, {comment: "A dated comment. Ω 🧪"}); await f.client.flush();
  assert.equal(document.type, "chisel-comment-v1"); assert.equal(document.proof.algorithm, "secp256k1-sha256");
  assert.equal((await A.verifyDocument(document)).status, "verified");
  assert.equal(document.payload.author.coin, "litecoin");
  const serialized = JSON.stringify(f.client.exportData()); assert.equal(serialized.includes(key), false); assert.doesNotMatch(serialized, /privateKeyHex|senderWif/);
  for (const mutate of [d => { d.payload.comment += " changed"; }, d => { d.payload.at = "2020-01-01T00:00:00.000Z"; }, d => { d.payload.subject.txid = "cd".repeat(32); }, d => { d.payload.author.address = "L".repeat(34); }]) {
    const changed = json(document); mutate(changed); assert.equal((await A.verifyDocument(changed)).status, "invalid");
  }
  const highS = json(document), order = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  highS.proof.signature = highS.proof.signature.slice(0, 64) + (order - BigInt("0x" + highS.proof.signature.slice(64))).toString(16).padStart(64, "0");
  assert.equal((await A.verifyDocument(highS)).status, "invalid");
});

test("an available identity cannot silently fall back to an unsigned comment if signing fails", async () => {
  const f = fixture({signer: () => ({available: () => true, sign() { throw new Error("signing unavailable"); }})});
  await assert.rejects(f.client.record("comment", record, {comment: "Keep this draft"}), /signing unavailable/);
  assert.equal(f.client.state.outbox.length, 0); assert.equal(f.server.calls.length, 0);
  const anonymous = fixture(); const document = await anonymous.client.record("comment", record, {comment: "Open comment"});
  assert.equal(document.payload.author, null); assert.equal(document.proof, undefined);
});

test("the scoped signer refuses non-comment payloads and a changed identity during signing", async () => {
  let active = key;
  const signer = A.createCommentSigner({privateKey: () => active, crypto: C}), f = fixture({signer: () => signer});
  const visit = await f.client.record("visit", null); await assert.rejects(signer.sign(visit.payload), /Only a new comment/);
  const unsigned = await fixture().client.record("comment", record, {comment: "Snapshot"});
  const pending = signer.sign(unsigned.payload); active = "";
  await assert.rejects(pending, /Identity changed/);
  assert.equal(signer.available(), false);
});

test("pausing activity still allows explicit comments and clearing local data erases unsent entries", async () => {
  const f = fixture({request: async () => { throw new Error("offline"); }});
  f.client.setEnabled(false); assert.equal(await f.client.record("select", record), null);
  await f.client.record("comment", record, {comment: "Explicit comment while activity logging is paused"}); await f.client.flush();
  assert.equal(f.client.state.outbox.length, 1); f.client.clearLocal();
  assert.equal(f.client.state.entries.length, 0); assert.equal(f.client.state.outbox.length, 0);
  const restored = fixture({storage: f.storage}); assert.equal(restored.client.state.enabled, false); assert.equal(restored.client.state.outbox.length, 0);
});

test("changing API endpoints never sends a previous endpoint's pending history to the new server", async () => {
  const f = fixture({request: async () => { throw new Error("offline"); }});
  await f.client.record("select", record); await f.client.flush();
  f.endpoint("https://other.example/fileproxy"); await f.client.flush(true);
  assert.equal(f.client.feed({}).items.length, 0); assert.equal(f.client.state.outbox.length, 1);
});

test("history schema excludes arbitrary fields and private or credential-bearing record sources", async () => {
  const f = fixture(); const document = await f.client.record("select", record);
  for (const url of ["http://127.0.0.1/private.json", "https://user:password@example.org/a.json", "https://records.example/a.json?token=secret"]) {
    assert.throws(() => A.subjectKey({...subject, dataUrl: url}));
  }
  assert.throws(() => A.normalizePayload({...document.payload, senderWif: "must never be read"}));
  await assert.rejects(f.client.record("comment", record, {comment: "x".repeat(4001)}));
});

class Node {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.nodeType = tag === "#text" ? 3 : 1; this.ownerDocument = doc; this.nodes = []; this.attributes = {}; this.dataset = {}; this.style = {}; this.className = ""; this.value = ""; this.scrollTop = 0; this.ownText = ""; }
  get childNodes() { return this.nodes; }
  get children() { return this.nodes.filter(node => node.nodeType === 1); }
  get firstChild() { return this.nodes[0] || null; }
  get lastChild() { return this.nodes.at(-1) || null; }
  get textContent() { return this.ownText + this.nodes.map(node => node.textContent).join(""); }
  set textContent(value) { this.replaceChildren(); if (this.nodeType === 3) this.ownText = String(value); else if (String(value)) { const node = new Node("#text", this.ownerDocument); node.ownText = String(value); this.appendChild(node); } }
  get nodeValue() { return this.nodeType === 3 ? this.ownText : null; }
  set nodeValue(value) { this.ownText = String(value); }
  appendChild(node) { return this.insertBefore(node, null); }
  insertBefore(node, before) { if (node === before) return node; node.parentNode?.removeChild(node); const at = before ? this.nodes.indexOf(before) : this.nodes.length; assert.ok(at >= 0); this.nodes.splice(at, 0, node); node.parentNode = this; return node; }
  removeChild(node) { const at = this.nodes.indexOf(node); assert.ok(at >= 0); this.nodes.splice(at, 1); node.parentNode = null; return node; }
  replaceChild(node, previous) { this.insertBefore(node, previous); this.removeChild(previous); return previous; }
  replaceChildren(...nodes) { for (const node of this.nodes) node.parentNode = null; this.nodes = []; this.ownText = ""; for (const node of nodes) this.appendChild(node); }
  contains(node) { for (; node; node = node.parentNode) if (node === this) return true; return false; }
  get isConnected() { return this.ownerDocument.body.contains(this); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener() {}
  focus() { this.ownerDocument.activeElement = this; }
  click() { if (this.tagName === "A" && this.download) this.ownerDocument.downloads.push({filename: this.download, href: this.href}); this.onclick?.({preventDefault() {}, stopPropagation() {}}); }
  querySelector(selector) { return walk(this).slice(1).find(node => node.tagName === selector.toUpperCase()) || null; }
  get classList() { return {contains: value => this.className.split(/\s+/).includes(value), add: value => { if (!this.classList.contains(value)) this.className += " " + value; }, remove: value => { this.className = this.className.split(/\s+/).filter(name => name !== value).join(" "); }}; }
}
const walk = node => [node, ...node.childNodes.flatMap(walk)];
const findClass = (node, name) => walk(node).find(child => child.classList.contains(name));
function uiFixture(options = {}) {
  const f = fixture(options), nodes = new Map(), intervals = new Map(), opens = [];
  const doc = {hidden: false, downloads: [], createElement: tag => new Node(tag, doc), getElementById: name => nodes.get(name) || null, addEventListener() {}};
  doc.body = doc.createElement("body"); doc.body.dataset.mode = "portal";
  for (const name of ["portalViewingNow", "portalInteractionHistory", "portalInteractionStatus", "portalInteractionEnabled", "portalInteractionRefresh", "portalInteractionExport", "portalInteractionClear"]) {
    const node = doc.createElement(name.includes("Enabled") ? "input" : "div"); node.id = name; nodes.set(name, node); doc.body.appendChild(node);
  }
  context.setInterval = callback => { const id = intervals.size + 1; intervals.set(id, callback); return id; };
  context.clearInterval = id => intervals.delete(id);
  context.setTimeout = () => 1; context.addEventListener = () => {}; context.Blob = Blob;
  const view = context.CHISEL_INTERACTIONS_UI.create({client: f.client, document: doc, open: value => opens.push(json(value))});
  view.start();
  const comments = doc.createElement("div"); doc.body.appendChild(comments); view.comments(comments, record);
  return {...f, view, doc, nodes, intervals, opens, comments};
}

test("Viewing now links its dated synopsis back to the selected record and polls the shared API", async () => {
  const f = uiFixture(); await f.client.record("select", record, {action: "expand"}); await f.client.flush(); await flush();
  const history = f.nodes.get("portalInteractionHistory"), open = findClass(history, "portalHistoryRecord");
  assert.match(history.textContent, /A video to revisit/); assert.match(history.textContent, /What this record explains/);
  assert.ok(walk(history).some(node => node.tagName === "TIME" && node.dateTime));
  open.click(); assert.deepEqual(f.opens, [subject]); assert.equal(f.intervals.size, 1);
  await [...f.intervals.values()][0]();
  assert.ok(f.server.calls.some(call => call.path.startsWith("/interactions?")));
});

test("background interaction updates preserve a comment draft, focus and caret", async () => {
  const f = uiFixture(); await flush();
  const field = walk(f.comments).find(node => node.tagName === "TEXTAREA");
  field.value = "Keep this unsent comment"; field.focus(); field.selectionStart = 5; field.selectionEnd = 9;
  await f.client.record("engage", record, {action: "open_media"}); await f.client.flush(); await flush();
  assert.equal(walk(f.comments).find(node => node.tagName === "TEXTAREA"), field);
  assert.equal(field.value, "Keep this unsent comment"); assert.equal(f.doc.activeElement, field); assert.equal(field.selectionStart, 5); assert.equal(field.selectionEnd, 9);
});

test("posting two comments appends both texts and dates instead of replacing the first comment or record note", async () => {
  const f = uiFixture(), form = findClass(f.comments, "portalCommentForm"), field = walk(form).find(node => node.tagName === "TEXTAREA");
  for (const text of ["First comment", "A later comment"]) { field.value = text; await form.onsubmit({preventDefault() {}}); await f.client.flush(); }
  await flush();
  const rows = walk(f.comments).filter(node => node.classList.contains("portalHistoryEntry"));
  assert.equal(rows.length, 2); assert.match(rows[0].textContent, /A later comment/); assert.match(rows[1].textContent, /First comment/);
  assert.ok(rows.every(row => walk(row).some(node => node.tagName === "TIME" && node.dateTime)));
  assert.equal(f.server.entries.filter(entry => entry.document.payload.kind === "comment").length, 2);
  assert.equal(f.server.calls.some(call => call.path === "/save"), false);
});

test("unsigned comments render literal text and a failed signer leaves the comment draft intact", async () => {
  const f = uiFixture(), form = findClass(f.comments, "portalCommentForm"), field = walk(form).find(node => node.tagName === "TEXTAREA");
  field.value = '<script>not executable</script> <img src=x onerror=bad()>';
  await form.onsubmit({preventDefault() {}}); await f.client.flush(); await flush();
  assert.match(f.comments.textContent, /<script>not executable<\/script>/); assert.match(f.comments.textContent, /unsigned/);
  assert.equal(walk(f.comments).some(node => node.tagName === "SCRIPT" || node.tagName === "IMG"), false);
  const bad = uiFixture({signer: () => ({available: () => true, sign() { throw new Error("Signing failed"); }})});
  const badForm = findClass(bad.comments, "portalCommentForm"), badField = walk(badForm).find(node => node.tagName === "TEXTAREA");
  badField.value = "Retain after failure"; await badForm.onsubmit({preventDefault() {}});
  assert.equal(badField.value, "Retain after failure"); assert.match(bad.comments.textContent, /Signing failed/);
});

test("a verified signed comment shows its Litecoin author and exports the exact signature footer", async () => {
  const signer = A.createCommentSigner({privateKey: () => key, crypto: C}), f = uiFixture({signer: () => signer});
  const form = findClass(f.comments, "portalCommentForm"), field = walk(form).find(node => node.tagName === "TEXTAREA");
  field.value = "Signed in this browser"; await form.onsubmit({preventDefault() {}}); await f.client.flush(); await flush();
  for (let i = 0; i < 50 && !f.comments.textContent.includes("signature verified"); i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.match(f.comments.textContent, /signature verified/); assert.ok(findClass(f.comments, "portalCommentProof"));
  findClass(f.comments, "portalHistoryExport").click();
  const saved = f.doc.downloads[0], exported = await (await fetch(saved.href)).json(); URL.revokeObjectURL(saved.href);
  assert.equal(exported.type, "chisel-comment-v1"); assert.equal(Object.keys(exported).at(-1), "proof");
  assert.equal((await A.verifyDocument(exported)).status, "verified");
});

test("an unavailable API keeps a posted comment locally, marks it pending, and reports the missing shared service", async () => {
  const f = uiFixture({request: async () => { throw new Error("History API HTTP 404"); }});
  const form = findClass(f.comments, "portalCommentForm"), field = walk(form).find(node => node.tagName === "TEXTAREA");
  field.value = "Pending until FileProxy is updated"; await form.onsubmit({preventDefault() {}}); await f.client.flush(); await flush();
  assert.match(f.comments.textContent, /Pending until FileProxy is updated/); assert.match(f.comments.textContent, /pending/);
  assert.match(f.nodes.get("portalInteractionStatus").textContent, /FileProxy history API unavailable/);
  assert.equal(f.client.state.outbox.some(item => item.document.payload.kind === "comment"), true);
});

test("an unavailable comment API is not presented as an empty confirmed comment history", async () => {
  const f = uiFixture({request: async () => { throw new Error("History API HTTP 404"); }});
  await f.client.flush(); await flush();
  assert.match(f.comments.textContent, /Shared comments are unavailable/);
  assert.doesNotMatch(f.comments.textContent, /No comments yet/);
  const older = walk(f.comments).find(node => node.tagName === "BUTTON" && node.textContent === "OLDER COMMENTS");
  assert.equal(older.disabled, true);
});

test("the published synthetic signed-comment vector verifies with the production Noble backend", async () => {
  const vector = JSON.parse(await readFile(new URL("fixtures/signed-comment-v1.json", import.meta.url), "utf8"));
  assert.equal((await A.verifyDocument(vector)).status, "verified");
});

const portalSource = await readFile(new URL("../chisel.portal.js", import.meta.url), "utf8");
const descriptorSource = portalSource.slice(portalSource.indexOf("  function describeInteractionRecord("), portalSource.indexOf("  function recordPortalInteraction("));
function descriptor(annotation, read) {
  const scope = vm.createContext({canonicalCoinForRow: row => row.coin, safeArray: value => Array.isArray(value) ? value : [],
    annotationReads: new Map([["key", read]]), portalAnnotationKey: () => "key", getPortalAnnotation: () => annotation,
    printableText: value => String(value || ""), shortTxid: value => value.slice(0, 12), sourceIdForRow: () => "other",
    recordDataUrl: () => "", publicInteractionUrl: value => value, opReturnTextForRow: () => "Binary OP_RETURN · 80 bytes"});
  vm.runInContext(descriptorSource, scope); return scope.describeInteractionRecord;
}

test("the actual Portal history descriptor uses lossless binary text and includes only demonstrably shared notes", () => {
  const row = {coin: "litecoin", txid: "ab".repeat(32), summary: {title: "Binary program", opReturnText: "\ufffdgarbled legacy summary", cleanText: "\ufffdlegacy bytes"}};
  const browserNote = {note: "PRIVATE BROWSER NOTE", metadata: {title: "PRIVATE TITLE"}, updatedAt: 200};
  const local = descriptor(browserNote, {source: "browser", remoteUpdatedAt: 200})(row);
  assert.equal(local.synopsis, "Binary OP_RETURN · 80 bytes"); assert.doesNotMatch(JSON.stringify(local), /PRIVATE|\ufffd/);
  const newerLocal = descriptor(browserNote, {source: "FileProxy", remoteUpdatedAt: 100})(row);
  assert.doesNotMatch(JSON.stringify(newerLocal), /PRIVATE/);
  const shared = descriptor({note: "A program that draws a trapezoid.", metadata: {title: "Trapezoid"}, updatedAt: 100}, {source: "FileProxy", remoteUpdatedAt: 100})(row);
  assert.equal(shared.title, "Trapezoid"); assert.equal(shared.synopsis, "A program that draws a trapezoid.");
});
