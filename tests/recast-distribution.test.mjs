import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const root = new URL('../tools/recast/', import.meta.url);
test('hosted Recast files match the recorded Mogwai distribution', async () => {
  const record = JSON.parse(await readFile(new URL('SOURCE.json', root), 'utf8'));
  assert.equal(record.repository,'johnrigler/mogwai');
  assert.match(record.commit,/^[0-9a-f]{40}$/);
  for (const [file, sha] of Object.entries(record.files)) assert.equal(createHash('sha256').update(await readFile(new URL(file, root))).digest('hex'),sha,file);
});
test('Recast runtime assets are self-contained and the tool is linked from Chisel', async () => {
  const html = await readFile(new URL('index.html', root),'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^\"]*)?)"/g)].map(m=>m[1]);
  assert.equal(refs.length,5);
  for(const file of refs){assert(!file.includes('://'));const url=new URL(file,root);url.search='';assert((await readFile(url)).length>0);}
  assert(refs.some(file=>file.startsWith('timing.js?')));
  const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert(index.includes('href="tools/recast/"'));
});
