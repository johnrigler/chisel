import test from 'node:test';
import assert from 'node:assert/strict';

await import('../tools/m64Artifact/m64.js');

const M = globalThis.ChiselM64;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function profile(tokens = []) {
  return {
    kind: 'm64-profile',
    version: 2,
    alphabet: ALPHABET,
    tokens: [...tokens],
  };
}

test('M64 byte transport round-trips arbitrary bytes', () => {
  const input = Uint8Array.from([0, 1, 2, 63, 64, 127, 128, 191, 192, 254, 255]);
  const encoded = M.encode64(input, ALPHABET);
  const decoded = M.decode64(encoded, ALPHABET);
  assert.deepEqual([...decoded], [...input]);
});

test('M64 stage hydrates exactly to canonical source', () => {
  const source = `// comment\nfunction main(input) { const value = input.value + 1; return value; }`;
  const seed = profile(['function', 'const', 'return', 'input', 'value', '(', ')', '{', '}', ';', '=', '+']);
  const staged = M.stage(source, 'main=a', seed);

  assert.equal(staged.hydrated, staged.canonical);
  assert.ok(staged.payload.length > 0);
  assert.ok(staged.abstract.length > 0);
});

test('dictionary references above index 63 use the extended path and hydrate', () => {
  const tokens = Array.from({ length: 70 }, (_, i) => `term${i}`);
  const source = 'term64|term69|term0';
  const abstract = M.tokenize(source, tokens);

  assert.deepEqual(M.dictionaryIndexes(abstract), [64, 69, 0]);
  assert.equal(M.hydrateBytes(abstract, profile(tokens)), source);
});

test('external dictionary lookup can hydrate extended dictionary ids', async () => {
  const termToIndex = new Map([
    ['alpha', 0],
    ['omega', 75],
  ]);
  const indexToTerm = new Map([
    [0, 'alpha'],
    [75, 'omega'],
  ]);

  const abstract = M.tokenizeResolved('alpha+omega', termToIndex);
  const payload = M.encode64(abstract, ALPHABET);
  const hydrated = await M.hydrateLookup(payload, ALPHABET, async id => indexToTerm.get(id));

  assert.equal(hydrated, 'alpha+omega');
  assert.deepEqual(M.dictionaryIndexes(abstract), [0, 75]);
});

test('reserved and truncated dictionary encodings are rejected', () => {
  assert.throws(
    () => M.hydrateBytes(Uint8Array.of(0xc1), profile()),
    /Reserved M64 byte/,
  );
  assert.throws(
    () => M.hydrateBytes(Uint8Array.of(0xc0), profile()),
    /Truncated M64 dictionary index/,
  );
});

test('artifact validation preserves the current v2 boundary', () => {
  const artifact = {
    kind: 'chisel-m64-artifact',
    version: 2,
    type: 'javascript',
    runtime: 'CHISEL-PURE1',
    entry: 'a',
    profile: profile(['function']),
    payload: '',
  };

  assert.equal(M.validateArtifact(artifact), artifact);
  assert.throws(
    () => M.validateArtifact({ ...artifact, version: 3 }),
    /Unsupported artifact package/,
  );
});
