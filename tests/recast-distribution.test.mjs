import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const root = new URL('../tools/recast/', import.meta.url);
test('hosted Recast files match the recorded Mogwai distribution', async () => {
  const record = JSON.parse(await readFile(new URL('SOURCE.json', root), 'utf8'));
  assert.equal(record.repository,'johnrigler/mogwai');
  assert.match(record.commit,/^[0-9a-f]{40}$/);
  const modified = new Set(record.derivative?.modified || []);
  for (const [file, sha] of Object.entries(record.files)) {
    const actual = createHash('sha256').update(await readFile(new URL(file, root))).digest('hex');
    if (modified.has(file)) assert.notEqual(actual, sha, file + ' should be identified as modified');
    else assert.equal(actual, sha, file);
  }
  for (const file of record.derivative?.added || []) assert((await readFile(new URL(file, root))).length > 0);
});
test('Recast runtime assets are self-contained and the tool is linked from Chisel', async () => {
  const html = await readFile(new URL('index.html', root),'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^\"]*)?)"/g)].map(m=>m[1]);
  assert.equal(refs.length,7);
  for(const file of refs){assert(!file.includes('://'));const url=new URL(file,root);url.search='';assert((await readFile(url)).length>0);}
  assert(refs.some(file=>file.startsWith('timing.js?')));
  assert(refs.some(file=>file.startsWith('storage.js?')));
  assert(refs.some(file=>file.startsWith('transcript.js?')));
  const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert(index.includes('href="tools/recast/"'));
});
