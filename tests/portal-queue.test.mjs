import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

// The scheduler has no DOM, fetch, storage or timers.
const context = vm.createContext({}); context.window = context;
vm.runInContext(await readFile(new URL("../chisel.portal.queue.js", import.meta.url), "utf8"), context);
const createQueue = context.CHISEL_PORTAL_QUEUE.createQueue;
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; }

test("one read budget bounds transactions and notes while reserving a slot for an opened record", async () => {
  const queue = createQueue({concurrency: 6, reserved: 1, groupLimits: {notes: 2}});
  const reads = [], pending = [], finished = [];
  function add(key, group, priority = 20) {
    const read = deferred(); reads.push(read);
    const result = queue.enqueue({key, group, priority, run() { pending.push(key); return read.promise; }});
    finished.push(result); return read;
  }
  for (let i = 0; i < 3; i++) add("tx" + i, "transaction");
  for (let i = 0; i < 4; i++) add("note" + i, "notes", 21);
  await flush();
  assert.deepEqual(pending, ["tx0", "tx1", "tx2", "note0", "note1"]);
  assert.equal(queue.snapshot().active, 5);
  add("openedNote", "notes", 0); await flush();
  assert.equal(pending.at(-1), "openedNote"); assert.equal(queue.snapshot().active, 6);
  reads.forEach(read => read.resolve("done"));
  await Promise.all(finished); await flush();
  assert.equal(queue.snapshot().active, 0); assert.equal(queue.snapshot().waiting, 0);
});

test("a second consumer promotes and shares the queued transaction instead of starting another read", async () => {
  const queue = createQueue({concurrency: 1}), owner = {}, release = deferred(), seen = [];
  const running = queue.enqueue({key: "running", run: () => release.promise}); await flush();
  const background = queue.enqueue({key: "wanted", owner, priority: 20, run() { seen.push("wanted"); return "payload"; }});
  const visible = queue.enqueue({key: "visible", priority: 10, run() { seen.push("visible"); }});
  const opened = queue.enqueue({key: "wanted", owner, priority: 0, run() { assert.fail("duplicate loader ran"); }});
  assert.equal(opened, background);
  release.resolve(); await Promise.all([running, background, visible]);
  assert.deepEqual(seen, ["wanted", "visible"]); assert.equal(await opened, "payload");
});

test("visible work precedes history and newer history precedes older records", async () => {
  const queue = createQueue({concurrency: 1}), gate = deferred(), seen = [];
  const jobs = [queue.enqueue({key: "gate", priority: 0, run: () => gate.promise})]; await flush();
  for (const [key, priority, order] of [["old", 20, 1], ["recent", 20, 20], ["visible", 10, 0], ["sameDate", 20, 20]])
    jobs.push(queue.enqueue({key, priority, order, run() { seen.push(key); }}));
  gate.resolve(); await Promise.all(jobs);
  assert.deepEqual(seen, ["visible", "recent", "sameDate", "old"]);
});

test("changing pages reprioritizes pending owners without recreating their requests", async () => {
  const queue = createQueue({concurrency: 1}), gate = deferred(), seen = [], oldPage = {visible: true}, newPage = {visible: false};
  const jobs = [queue.enqueue({key: "gate", priority: 0, run: () => gate.promise})]; await flush();
  jobs.push(queue.enqueue({key: "oldPage", owner: oldPage, priority: 10, run() { seen.push("oldPage"); }}));
  jobs.push(queue.enqueue({key: "newPage", owner: newPage, priority: 20, run() { seen.push("newPage"); }}));
  oldPage.visible = false; newPage.visible = true;
  queue.reprioritize(owner => owner && owner.visible ? 10 : 20);
  gate.resolve(); await Promise.all(jobs);
  assert.deepEqual(seen, ["newPage", "oldPage"]);
});

test("reset cancels obsolete callers and their queued work without freeing active network slots early", async () => {
  const queue = createQueue({concurrency: 2, reserved: 1}), oldRead = deferred(), newRead = deferred();
  const old = queue.enqueue({key: "tx", owner: {}, run: () => oldRead.promise});
  const neverStarted = queue.enqueue({key: "queued", run() { assert.fail("obsolete request ran"); }});
  await flush(); assert.equal(queue.snapshot().active, 1);
  queue.reset(); assert.equal(await old, null); assert.equal(await neverStarted, null);
  assert.equal(queue.snapshot().active, 1, "unfinished reads still count against the budget");
  const owner = {}, fresh = queue.enqueue({key: "tx", owner, priority: 0, run: () => newRead.promise});
  await flush(); assert.equal(queue.snapshot().active, 2);
  oldRead.reject(new Error("late obsolete failure")); await flush();
  assert.equal(queue.enqueue({key: "tx", owner, priority: 0, run() { assert.fail("late cleanup deleted the new read"); }}), fresh);
  newRead.resolve("fresh payload"); assert.equal(await fresh, "fresh payload"); await flush();
  assert.equal(queue.snapshot().active, 0);
});

test("replaced row owners cannot inherit or complete one another's request", async () => {
  const queue = createQueue({concurrency: 2}), gate = deferred(), next = deferred();
  const old = queue.enqueue({key: "same-id", owner: {}, run: () => gate.promise}); await flush();
  const owner = {}, fresh = queue.enqueue({key: "same-id", owner, run: () => next.promise});
  assert.equal(await old, null); await flush(); gate.resolve("obsolete"); await flush();
  assert.equal(queue.enqueue({key: "same-id", owner, run() { assert.fail("duplicate"); }}), fresh);
  next.resolve("new row"); assert.equal(await fresh, "new row");
});

test("a failed read releases its slot and permits an explicit retry of the same key", async () => {
  const queue = createQueue({concurrency: 1});
  const failed = queue.enqueue({key: "retry", run() { throw new Error("reader failed"); }});
  await assert.rejects(failed, /reader failed/);
  assert.equal(await queue.enqueue({key: "retry", run: () => "recovered"}), "recovered");
});
