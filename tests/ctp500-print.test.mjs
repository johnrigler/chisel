import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const files = await Promise.all(['ctp500-ble.js', 'ctp500-print.js'].map(name => readFile(new URL('../' + name, import.meta.url), 'utf8')));
const code = files.map(text => text.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')).join('\n');

function fixture({ failAt = 0 } = {}) {
  let clock = 0, active = 0;
  const state = { pickers: 0, opens: 0, closes: 0, releases: 0, chunks: [], starts: [], maxActive: 0 };
  const write = async part => {
    state.maxActive = Math.max(state.maxActive, ++active);
    state.starts.push(clock);
    state.chunks.push(Uint8Array.from(part));
    await Promise.resolve(); clock += 2; active--;
    if (state.chunks.length === failAt) throw new Error('Injected transport failure');
  };
  const characteristic = { properties: { write: true, writeWithoutResponse: true }, writeValueWithResponse: write, writeValueWithoutResponse: write };
  const device = { name: 'Teal Printer', gatt: {
    connected: false,
    async connect() { this.connected = true; return this; },
    async getPrimaryService() { return { getCharacteristic: async () => characteristic }; },
    disconnect() { this.connected = false; },
  } };
  const port = {
    writable: null,
    async open({ baudRate }) {
      assert.equal(baudRate, 9600); state.opens++;
      this.writable = { getWriter: () => ({ write, releaseLock: () => state.releases++ }) };
    },
    async close() { state.closes++; this.writable = null; },
  };
  const context = vm.createContext({ Uint8Array, isSecureContext: true,
    navigator: {
      bluetooth: { requestDevice: async () => { state.pickers++; return device; } },
      serial: { requestPort: async () => { state.pickers++; return port; } },
    },
    performance: { now: () => clock },
    setTimeout(fn, ms) { clock += ms; queueMicrotask(fn); },
  });
  vm.runInContext(code, context);
  return { state, context, connect: transport => vm.runInContext('ctp500ConnectPrinter({transport:' + JSON.stringify(transport) + '})', context) };
}

test('BLE connection is reused for successive jobs with the verified packet pacing', async () => {
  const f = fixture();
  const printer = await f.connect('ble');
  assert(printer.connected);
  const first = Uint8Array.from({ length: 65 }, (_, i) => i);
  const second = Uint8Array.from({ length: 41 }, (_, i) => 100 + i);
  await printer.write(first, () => {}, { mode: 'fast' });
  await printer.write(second, () => {}, { mode: 'fast' });
  assert.equal(f.state.pickers, 1);
  assert.equal(f.state.maxActive, 1);
  assert(f.state.chunks.every(part => part.length <= 20));
  assert.deepEqual(Buffer.concat(f.state.chunks.map(part => Buffer.from(part))), Buffer.concat([first, second]));
  assert(f.state.starts.slice(1).every((value, i) => value - f.state.starts[i] >= 25));
  printer.disconnect();
  assert.equal(printer.connected, false);
  await assert.rejects(printer.write(first), /disconnected/);
});

test('Serial chooser is reused and each job releases its writer and port', async () => {
  const f = fixture();
  const printer = await f.connect('serial');
  assert.equal(f.state.opens, 0);
  const bytes = new Uint8Array(1100).fill(7);
  for (let i = 0; i < 2; i++) {
    const stats = await printer.write(bytes);
    assert.equal(stats.bytes, 1100);
    assert.equal(stats.packets, 3);
  }
  assert.equal(f.state.pickers, 1);
  assert.equal(f.state.opens, 2);
  assert.equal(f.state.closes, 2);
  assert.equal(f.state.releases, 2);
  assert.deepEqual(f.state.chunks.map(part => part.length), [512, 512, 76, 512, 512, 76]);
  assert.equal(f.state.maxActive, 1);
  await printer.disconnect();
  assert.equal(printer.connected, false);
  await assert.rejects(printer.write(bytes), /again/);
});

test('Serial failure reports accepted bytes, closes cleanly, and never retries', async () => {
  const f = fixture({ failAt: 2 });
  const printer = await f.connect('serial');
  await assert.rejects(printer.write(new Uint8Array(1100)), error => {
    assert.equal(error.transferStats.bytes, 512);
    assert.match(error.message, /Injected/);
    return true;
  });
  assert.equal(f.state.chunks.length, 2);
  assert.equal(f.state.closes, 1);
  assert.equal(f.state.releases, 1);
});

test('overlapping Serial jobs are rejected without opening another writer', async () => {
  const f = fixture();
  const printer = await f.connect('serial');
  const pending = printer.write(new Uint8Array(1100));
  await assert.rejects(printer.write(new Uint8Array(1)), /already running/);
  await pending;
  assert.equal(f.state.opens, 1);
});

function eventSurface() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    fire(type, event = {}) { for (const fn of listeners.get(type) || []) fn(event); },
    listenerCount(type) { return listeners.get(type)?.size || 0; },
  };
}

function printSession(request) {
  const f = fixture();
  const doc = Object.assign(eventSurface(), { visibilityState: 'visible' });
  const env = Object.assign(eventSurface(), { document: doc, navigator: { wakeLock: { request } } });
  f.context.sessionEnv = env;
  const finish = vm.runInContext('ctp500BeginPrintSession(sessionEnv)', f.context);
  return { env, doc, finish };
}

test('a print session keeps the visible screen awake and removes its leave guard when finished', async () => {
  let releases = 0;
  const lock = Object.assign(eventSurface(), { released: false, async release() { releases++; this.released = true; this.fire('release'); } });
  const f = printSession(async type => { assert.equal(type, 'screen'); return lock; });
  await Promise.resolve();
  let prevented = false;
  const event = { preventDefault() { prevented = true; } };
  f.env.fire('beforeunload', event);
  assert(prevented);
  assert.equal(event.returnValue, '');
  await f.finish();
  assert.equal(releases, 1);
  assert.equal(f.env.listenerCount('beforeunload'), 0);
  assert.equal(f.doc.listenerCount('visibilitychange'), 0);
});

test('a wake lock arriving after a print finishes is released instead of leaking', async () => {
  let resolveRequest, releases = 0;
  const f = printSession(() => new Promise(resolve => { resolveRequest = resolve; }));
  await f.finish();
  resolveRequest({ async release() { releases++; } });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(releases, 1);
});

test('wake-lock denial does not reject the print session', async () => {
  const f = printSession(async () => { throw new Error('Battery policy denied wake lock'); });
  await Promise.resolve(); await Promise.resolve();
  await f.finish();
  assert.equal(f.env.listenerCount('beforeunload'), 0);
});
