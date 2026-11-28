import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
const portal = await readFile(new URL('../chisel.portal.js', import.meta.url), 'utf8');
const helper = portal.slice(portal.indexOf('  function compactPortalText('), portal.indexOf('  function renderPortalStreamItem('));
test('closed previews bound multiline and unbroken text without modifying the source', () => {
  const context = vm.createContext({});
  vm.runInContext(helper, context);
  const source = Array.from({length: 200}, (_, i) => 'line ' + i).join('\n');
  const preview = context.compactPortalText(source);
  assert.equal(preview.text.split('\n').length, 8);
  assert.ok(preview.truncated);
  assert.equal(context.compactPortalText('x'.repeat(10000)).text.length, 901);
  assert.equal(context.compactPortalText('Short note').text, 'Short note');
  assert.equal(context.compactPortalText('Short note').truncated, false);
  assert.equal(source.split('\n').length, 200);
});
test('bare and JSON-carried base64 raster images are recognized without a protocol marker', () => {
  const context = vm.createContext({canonicalCoinForRow: () => 'bsv', atob});
  vm.runInContext(portal.slice(portal.indexOf('  function bsvInlineImageForRow('), portal.indexOf('  function looksLikeAddressLine(')), context);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const row = text => ({summary: {opReturnText: text}});
  assert.equal(context.bsvInlineImageForRow(row(png)).mime, 'image/png');
  assert.equal(context.bsvInlineImageForRow(row(JSON.stringify({image: png}))).mime, 'image/png');
  assert.equal(context.bsvInlineImageForRow(row('ordinary prose')), null);
});

test('headings collapse whitespace and never exceed 120 characters', () => {
  const context = vm.createContext({});
  vm.runInContext(helper, context);
  assert.equal(context.compactPortalHeading('Short\n  title'), 'Short title');
  assert.equal(context.compactPortalHeading('x'.repeat(10000)).length, 120);
  assert.ok(context.compactPortalHeading('x'.repeat(10000)).endsWith('…'));
  assert.equal(context.compactPortalHeading(''), '');
});
