import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const core = await readFile(new URL('../chisel.js', import.meta.url), 'utf8');
const portal = await readFile(new URL('../chisel.portal.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function source(name) {
  const start = portal.indexOf('  function ' + name + '('), next = portal.indexOf('\n  function ', start + 3);
  return portal.slice(start, next);
}
function fixture() {
  const context = { URL, window: { location: { href: 'https://chisel.example/index.html' } } };
  context.window.window = context.window;
  vm.createContext(context); vm.runInContext(core, context); context.CHISEL = context.window.CHISEL;
  // The helpers below are the actual portal rendering boundary.
  context.decodeHtmlEntities = value => value; context.youtubeIdFromUrl = () => ''; context.youtubeStartFromUrl = () => '';
  vm.runInContext(source('setSafeHref') + source('normalizeMediaUrl'), context);
  return context;
}
test('portal rejects executable links at rendering time and removes stale hrefs', () => {
  const f = fixture(), element = { href: 'https://old.example/', removeAttribute(name) { assert.equal(name, 'href'); delete this.href; } };
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/a', 'java\tscript:x']) {
    assert.equal(f.normalizeMediaUrl(url), ''); assert.equal(f.setSafeHref(element, url), ''); assert.equal('href' in element, false);
  }
  assert.equal(f.setSafeHref(element, 'https://example.com/a'), 'https://example.com/a'); assert.equal(element.href, 'https://example.com/a');
  assert.equal(f.normalizeMediaUrl('https://open.spotify.com/embed/track/abc'), 'https://open.spotify.com/track/abc');
});
test('portal anchor writes use checked links or a locally generated download Blob', () => {
  const assignments = portal.split('\n').filter(line => /\.href\s*=/.test(line));
  assert.deepEqual(assignments.map(line => line.trim()), ['if (safe) element.href = safe;', 'a.href = objectUrl;']);
  const download = source('downloadPageMetadata');
  assert.match(download, /const objectUrl = URL\.createObjectURL\(blob\);/);
  assert.match(download, /a\.href = objectUrl;/);
  assert.match(download, /URL\.revokeObjectURL\(objectUrl\)/);
  assert(!portal.includes('normalizedUrl || String(card.url'));
});
test('CSP authorizes the exact inline scripts and limits script and object execution', () => {
  const policy = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(index)?.[1]; assert(policy);
  assert.match(policy, /script-src 'self'/); assert.match(policy, /object-src 'none'/);
  const scriptPolicy = policy.split(';').find(s => s.trim().startsWith('script-src'));
  assert(!scriptPolicy.includes("'unsafe-inline'")); assert(!scriptPolicy.includes("'unsafe-eval'"));
  for (const match of index.matchAll(/<script\s*>([\s\S]*?)<\/script>/g)) assert(scriptPolicy.includes("'sha256-" + createHash('sha256').update(match[1]).digest('base64') + "'"));
});
test('main page script assets exist and load Noble before identity and Send', async () => {
  const paths = [...index.matchAll(/<script\b[^>]*src="([^"?]+)[^"]*"/g)].map(match => match[1]);
  for (const path of paths) assert((await readFile(new URL('../' + path, import.meta.url))).length > 0, path);
  assert(paths.indexOf('chisel.sign.backend.js') < paths.indexOf('chisel.identity.js'));
  assert(paths.indexOf('chisel.safety.js') < paths.indexOf('app.js'));
});

test('vendored QR libraries initialize with dynamic string compilation disabled', async () => {
  const context = { console, navigator: { userAgent: '' }, document: { documentElement: { tagName: 'html' } } }; context.window = context;
  vm.createContext(context, { codeGeneration: { strings: false, wasm: false } });
  for (const file of ['vendor/qrcode.min.js', 'vendor/html5-qrcode.min.js']) vm.runInContext(await readFile(new URL('../' + file, import.meta.url), 'utf8'), context);
  assert.equal(typeof context.QRCode, 'function'); assert.equal(typeof context.Html5Qrcode, 'function');
});
