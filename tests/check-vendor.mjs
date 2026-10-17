import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url), manifest = JSON.parse(await readFile(new URL('vendor/checksums.json', root), 'utf8'));
assert.deepEqual((await readdir(new URL('vendor/', root))).filter(name => name.endsWith('.js')).sort(), Object.keys(manifest).sort());
for (const [name, expected] of Object.entries(manifest)) {
  const bytes = await readFile(new URL('vendor/' + name, root));
  assert.equal(bytes.length, expected.bytes, name + ' size');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256, name + ' checksum');
  assert(!/^\s*(?:<!doctype|<html)/i.test(bytes.toString('utf8')), name + ' must be JavaScript');
}
const core = await readFile(new URL('chisel.js', root), 'utf8');
const embedded = core.split('\n').find(line => line.startsWith('!function(e)'));
assert.equal(embedded, (await readFile(new URL('vendor/elliptic-6-6-1.min.js', root), 'utf8')).trim(), 'legacy embedded copy');
console.log('Vendor checksums and embedded legacy copy verified.');
