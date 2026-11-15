import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = async path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('one canonical release value is shared by Chisel pages', async () => {
  const release = await source('chisel.version.js');
  const main = await source('index.html');
  const app = await source('app.js');
  const qr = await source('qrScan.html');

  const title = { textContent: '', getAttribute: () => 'QR WIF Loader' };
  const context = {
    window: {},
    document: { querySelector: selector => selector === 'title[data-chisel-release-title]' ? title : null }
  };
  vm.runInNewContext(release, context, { filename: 'chisel.version.js' });
  const version = context.window.CHISEL_RELEASE.version;
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(title.textContent, 'Chisel ' + version + ' QR WIF Loader');

  assert.match(app, /const APP_VERSION = window\.CHISEL_RELEASE && window\.CHISEL_RELEASE\.version;/);
  assert.doesNotMatch(app, /const APP_VERSION\s*=\s*["']\d/);
  assert.match(main, /<script src="chisel\.version\.js\?rev=[^"]+"><\/script>/);
  assert.match(qr, /<script src="chisel\.version\.js\?rev=[^"]+"><\/script>/);
  assert.match(qr, /<title data-chisel-release-title="QR WIF Loader">/);
  assert.ok(main.indexOf('chisel.version.js?rev=') < main.indexOf('app.js?rev='), 'load release before app');
  assert.ok(qr.indexOf('chisel.version.js?rev=') < qr.indexOf('vendor/html5-qrcode.min.js'), 'load release before QR runtime');
  assert.match(main, /<script src="app\.js\?rev=[^"]+"><\/script>/);
});
