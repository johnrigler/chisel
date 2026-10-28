import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const [diagnostics, debug, staticData, portal] = await Promise.all([
  'chisel.data-diagnostics.js', 'chisel.debug.js', 'chisel.portal.static-data.js', 'chisel.portal.js'
].map(path => readFile(new URL('../' + path, import.meta.url), 'utf8')));
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const tick = () => new Promise(resolve => setImmediate(resolve));
const config = {
  fileProxyUrl: 'https://rigler.example/fileproxy',
  staticManifestPaths: ['data/manifest.json'],
  staticManifestMirrors: ['https://rigler.example/chisel-data/manifest.json']
};
const manifest = { version: 1, baseUrl: './data/', defaultIndex: 'index/portal.index.json', records: 151, generatedAt: '2026-07-22T23:01:23Z' };
const storage = {
  source: 'workspace-data', configured: '/var/www/html/chisel/data', resolved: '/var/www/html/chisel-data',
  exists: true, isDirectory: true, isSymlink: true,
  workspaceDataResolved: '/var/www/html/chisel-data', workspaceDataExists: true, workspaceDataMatches: true
};

function fixture(route, runtime) {
  const calls = [], listeners = {}, timers = new Map(), saved = new Map(), blobs = [], downloads = [], elements = new Map();
  let timerId = 0;
  class TestURL extends URL {}
  TestURL.createObjectURL = blob => { blobs.push(blob); return 'blob:fixture'; };
  TestURL.revokeObjectURL = () => {};
  function element() {
    return { children: [], dataset: {}, handlers: {}, textContent: '',
      append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); },
      replaceChildren() { this.children = []; }, setAttribute() {}, remove() {},
      addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); },
      click() { if (this.download) downloads.push(this.download); return Promise.all((this.handlers.click || []).map(handler => handler())); }
    };
  }
  const context = {
    URL: TestURL, URLSearchParams, Blob, AbortController, performance, console,
    location: new URL('https://reader.example/chisel/index.html'),
    screen: { width: 1200, height: 750 }, innerWidth: 1200, innerHeight: 750, devicePixelRatio: 1,
    navigator: { userAgent: 'test' },
    sessionStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id),
    addEventListener: () => {},
    fetch: async (url, options) => {
      url = new URL(url, context.location.href).href;
      calls.push({ url, options });
      return route(url, options);
    },
    document: {
      baseURI: 'https://reader.example/chisel/index.html', readyState: 'loading', scripts: [],
      documentElement: { clientWidth: 1200, scrollWidth: 1200 },
      body: { dataset: { mode: 'portal' }, appendChild: () => {} },
      getElementById: id => elements.get(id) || null, querySelector: () => null, querySelectorAll: () => [],
      addEventListener: (name, handler) => { (listeners[name] ||= []).push(handler); },
      createElement: element
    }
  };
  context.window = context;
  if (runtime) context.CHISEL_PORTAL = { getDiagnosticsConfig: () => runtime };
  vm.createContext(context);
  vm.runInContext(debug, context);
  vm.runInContext(diagnostics, context);
  const api = context.CHISEL_DATA_DIAGNOSTICS;
  return { context, api, calls, timers, saved, blobs, downloads, elements,
    menu() {
      for (const id of ['runDataChecks', 'downloadDebugJson', 'clearDebugJson', 'dataChecksPanel', 'dataCheckSummary', 'dataCheckResults']) elements.set(id, element());
      for (const handler of listeners.DOMContentLoaded || []) handler();
    },
    expire() { for (const [id, timer] of [...timers]) if (timer.ms === 6000) { timers.delete(id); timer.fn(); } },
    loadPortal() { vm.runInContext(staticData, context); vm.runInContext(portal, context); return context.CHISEL_PORTAL; }
  };
}

function routes(overrides = {}) {
  return (url, options) => {
    for (const [part, handler] of Object.entries(overrides)) if (url.includes(part)) return handler(url, options);
    if (url.endsWith('/chisel.portal.config.json')) return json(config);
    if (url.endsWith('/fileproxy/ping')) return json({ ok: true, service: 'chisel-fileproxy', storage });
    if (url.endsWith('/chisel_data/manifest.json')) return json({ error: 'missing' }, 404);
    if (url.endsWith('/manifest.json')) return json(manifest);
    if (url.endsWith('/portal.index.json')) return json({ transactions: [{ privateBody: 'never-export-this' }] });
    throw new Error('Unexpected request: ' + url);
  };
}

test('read-only checks capture FileProxy 503 and optional underscore 404 independently from working static data', async () => {
  const f = fixture(routes({ '/fileproxy/ping': () => new Response('<h1>Unavailable</h1>', { status: 503 }) }));
  const report = await f.api.run();
  const health = report.checks.find(check => check.label === 'FileProxy health');
  assert.equal(health.httpStatus, 503);
  assert.equal(health.outcome, 'failed');
  assert.match(health.message, /reverse proxy unavailable/);
  const alias = report.checks.find(check => check.label.includes('spelling'));
  assert.equal(alias.httpStatus, 404);
  assert.equal(alias.outcome, 'warning');
  assert.equal(report.checks.filter(check => check.label === 'Data index' && check.outcome === 'passed').length, 2);
  assert(report.checks.some(check => check.generatedAt === manifest.generatedAt && check.records === 151));
  assert.equal(f.timers.size, 0);
  assert(f.calls.every(call => !call.options.method || call.options.method === 'GET'));
  assert(f.calls.every(call => !/reindex|save|main-stream/.test(call.url)));
  assert(!JSON.stringify(f.api.snapshot()).includes('never-export-this'));
});

test('resolved storage roots distinguish broken paths and conflicting workspace links', async () => {
  const f = fixture(routes({ '/fileproxy/ping': () => json({ ok: true, service: 'chisel-fileproxy', storage: {
    ...storage, source: 'CHISEL_DATA_ROOT', configured: '/home/john/chisel_data', resolved: '/home/john/missing',
    exists: false, isDirectory: false, workspaceDataMatches: false
  } }) }));
  const report = await f.api.run();
  const dataRoot = report.checks.find(check => check.label === 'FileProxy data root');
  assert.equal(dataRoot.outcome, 'failed');
  assert.equal(dataRoot.storage.configured, '/home/[user]/chisel_data');
  assert.equal(dataRoot.storage.source, 'CHISEL_DATA_ROOT');
  assert(report.checks.some(check => check.label === 'FileProxy workspace data link' && check.outcome === 'warning'));
  assert(!JSON.stringify(report).includes('/home/john'));
});

test('older FileProxy pings remain usable and explicitly report missing storage diagnostics', async () => {
  const f = fixture(routes({ '/fileproxy/ping': () => json({ ok: true, service: 'chisel-fileproxy', data_root: '/var/www/chisel/data' }) }));
  const report = await f.api.run();
  assert.equal(report.checks.find(check => check.label === 'FileProxy health').outcome, 'passed');
  assert.equal(report.checks.find(check => check.label === 'FileProxy data root').outcome, 'warning');
});

test('HTTP 200 HTML and wrong-service JSON cannot become a healthy FileProxy', async () => {
  for (const response of [() => new Response('<html>Sign in</html>'), () => json({ ok: true, service: 'unrelated' })]) {
    const f = fixture(routes({ '/fileproxy/ping': response }));
    const report = await f.api.run();
    assert.equal(report.checks.find(check => check.label === 'FileProxy health').outcome, 'failed');
    const request = f.api.snapshot().requests.find(item => item.operation === 'FileProxy health');
    assert.equal(request.httpStatus, 200);
    assert(['json', 'service'].includes(request.reason));
  }
});

test('network and timeout failures keep their status unknown instead of inventing HTTP errors', async () => {
  const failing = fixture(routes({ '/fileproxy/ping': () => { throw new TypeError('Failed to fetch'); } }));
  await failing.api.run();
  assert.equal(failing.api.snapshot().requests.find(item => item.operation === 'FileProxy health').httpStatus, null);
  assert.equal(failing.api.snapshot().requests.find(item => item.operation === 'FileProxy health').reason, 'network');

  const stalled = fixture(routes({ '/fileproxy/ping': (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }) }));
  const pending = stalled.api.run();
  await tick();
  stalled.expire();
  const report = await pending;
  assert.match(report.checks.find(check => check.label === 'FileProxy health').message, /Timed out/);
  assert.equal(stalled.api.snapshot().requests.find(item => item.operation === 'FileProxy health').reason, 'timeout');
  assert.equal(stalled.timers.size, 0);
});

test('checks honor the currently selected LAN endpoint and do not replace it with the public service', async () => {
  const runtime = { ...config, fileProxyUrl: 'http://192.168.1.8:7799', staticManifestPaths: [], staticManifestMirrors: [] };
  const f = fixture(routes({ 'http://192.168.1.8:7799/ping': () => json({ ok: true, service: 'chisel-fileproxy', storage }) }), runtime);
  const report = await f.api.run();
  assert.equal(report.configurationSource, 'portal-runtime');
  assert(f.calls.some(call => call.url === 'http://192.168.1.8:7799/ping'));
  assert(!f.calls.some(call => call.url.includes('rigler.example')));
});

test('request exports strip URL queries, credentials, account paths and payloads, and retain bounded history', () => {
  const f = fixture(routes());
  for (let i = 0; i < 205; i++) f.api.request({ component: 'fileproxy', operation: '/tx',
    url: 'https://user:password@cache.example/transactions/' + 'a'.repeat(64) + '.json?token=hidden-token&txid=private-id#seed',
    status: 503, elapsedMs: 12, ok: false, reason: 'http', body: 'private-body', headers: { Authorization: 'secret' } });
  const snapshot = f.api.snapshot(), serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.requests.length, 200);
  for (const secret of ['hidden-token', 'private-id', 'password@', 'private-body', 'Authorization', 'a'.repeat(64)]) assert(!serialized.includes(secret), secret);
  snapshot.requests[0].endpoint = 'changed';
  assert.notEqual(f.api.snapshot().requests[0].endpoint, 'changed');
});

test('debug download runs fresh checks, shares an in-flight run, and clear removes both histories', async () => {
  const f = fixture(routes());
  const pending = f.api.run();
  assert.equal(f.api.run(), pending);
  await f.context.CHISEL_DIAGNOSTICS.download();
  const report = await pending;
  assert(report.finishedAt);
  assert.equal(f.calls.filter(call => call.url.endsWith('/fileproxy/ping')).length, 1);
  assert.equal(f.downloads.length, 1);
  const exported = JSON.parse(await f.blobs[0].text());
  assert.equal(exported.schema, 'chisel-debug-v3');
  assert(exported.dataDiagnostics.lastRun.finishedAt);
  assert(exported.dataDiagnostics.requests.length > 0);
  f.context.CHISEL_DIAGNOSTICS.clear();
  assert.equal(f.api.snapshot().requests.length, 0);
  assert.equal(f.api.snapshot().lastRun, null);
  assert.equal(f.context.CHISEL_DIAGNOSTICS.snapshot().events.length, 0);
  assert.equal(f.saved.size, 0);
});

test('passive Portal and static-transport logs capture HTTP/JSON failures and recover after successful reads', async () => {
  let unhealthy = true;
  const f = fixture((url) => unhealthy ? new Response('<h1>Unavailable</h1>', { status: 503 }) : json({ ok: true, coin: 'digibyte', json: { txid: 'b'.repeat(64) } }));
  const p = f.loadPortal();
  await assert.rejects(p.loadLocalTransaction('b'.repeat(64), 'digibyte'), /HTTP 503/);
  assert.equal(p.state.fileProxyAvailable, false);
  let logged = f.api.snapshot().requests.at(-1);
  assert.equal(logged.component, 'fileproxy');
  assert.equal(logged.operation, '/tx');
  assert.equal(logged.httpStatus, 503);
  assert(!logged.endpoint.includes('?'));
  unhealthy = false;
  await p.loadLocalTransaction('b'.repeat(64), 'digibyte');
  assert.equal(p.state.fileProxyAvailable, true);
  p.applyDiagnosticsProxyHealth('https://rigler.org/fileproxy', false, 503);
  assert.equal(p.state.fileProxyAvailable, false);
  p.applyDiagnosticsProxyHealth('https://rigler.org/fileproxy', true, 200);
  assert.equal(p.state.fileProxyAvailable, true);
  p.applyDiagnosticsProxyHealth('https://another.example', false, 503);
  assert.equal(p.state.fileProxyAvailable, true, 'a check for an old endpoint must not overwrite current health');

  const transport = f.context.CHISEL_PORTAL_STATIC_DATA.createTransport({
    fetch: async () => new Response('bad JSON'), onRequest: f.api.request
  });
  await assert.rejects(transport.fetchJsonNoStore('https://data.example/manifest.json'));
  logged = f.api.snapshot().requests.at(-1);
  assert.equal(logged.reason, 'json');
  assert.equal(logged.httpStatus, 200);
});

test('a broken Portal settings getter retains completed checks using file configuration', async () => {
  const f = fixture(routes());
  f.context.CHISEL_PORTAL = { getDiagnosticsConfig() { throw new Error('not ready'); } };
  const report = await f.api.run();
  assert.equal(report.configurationSource, 'file');
  assert(report.checks.some(check => check.label === 'Portal runtime configuration'));
  assert(report.finishedAt);
});

test('a plain portal configuration file is accepted without relying on FileProxy availability', async () => {
  const f = fixture(routes());
  const start = portal.indexOf('  async function loadPortalConfig(');
  const end = portal.indexOf('\n  function normalizeFileProxyUrl(', start);
  f.context.DEFAULT_CONFIG_PATH = 'chisel.portal.config.json';
  f.context.DEFAULT_FILE_PROXY_URL = config.fileProxyUrl;
  f.context.DEFAULT_PORTAL_CONFIG = { autoLoadStaticDataset: false };
  f.context.state = { config: {} };
  f.context.staticTransport = { fetchJsonNoStore: url => f.context.fetch(url).then(response => response.json()) };
  vm.runInContext(portal.slice(start, end), f.context);
  const loaded = await f.context.loadPortalConfig();
  assert.equal(loaded.fileProxyUrl, config.fileProxyUrl);
  assert.equal(f.calls.length, 1, 'a valid local config must not require a FileProxy fallback');
});

test('request metadata survives a reload with its original timestamps and a single bounded history', () => {
  const f = fixture(routes());
  f.api.request({ component: 'fileproxy', operation: '/ping', url: 'https://cache.example/ping?token=hidden', status: 503, ok: false, reason: 'http' });
  const original = f.api.snapshot().requests[0];
  vm.runInContext(diagnostics, f.context);
  const restored = f.context.CHISEL_DATA_DIAGNOSTICS.snapshot().requests;
  assert.equal(restored.length, 1);
  assert.equal(restored[0].at, original.at);
  assert.equal(restored[0].httpStatus, 503);
  assert(!JSON.stringify(restored).includes('hidden'));
});

test('menu controls show failure results, prevent overlapping clicks, export checks, and clear the visible report', async () => {
  const f = fixture(routes({ '/fileproxy/ping': () => new Response('Unavailable', { status: 503 }) }));
  f.menu();
  const pending = f.elements.get('runDataChecks').click();
  assert.equal(f.elements.get('runDataChecks').disabled, true);
  assert.equal(f.elements.get('downloadDebugJson').disabled, true);
  await pending;
  assert.equal(f.elements.get('runDataChecks').disabled, false);
  assert.equal(f.elements.get('dataChecksPanel').open, true);
  assert.match(f.elements.get('dataCheckSummary').textContent, /1 failed/);
  const rows = f.elements.get('dataCheckResults').children;
  assert(rows.some(row => row.dataset.status === 'failed' && /HTTP 503/.test(row.children[0].textContent)));
  assert(rows.some(row => row.dataset.status === 'warning' && /HTTP 404/.test(row.children[0].textContent)));
  await f.elements.get('downloadDebugJson').click();
  assert.equal(f.downloads.length, 1);
  const exported = JSON.parse(await f.blobs[0].text());
  assert.equal(exported.dataDiagnostics.lastRun.summary.failed, 1);
  await f.elements.get('clearDebugJson').click();
  assert.equal(f.elements.get('dataCheckResults').children.length, 0);
  assert.match(f.elements.get('dataCheckSummary').textContent, /not been checked/);
});
