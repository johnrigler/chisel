import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

await import('../tools/m64Artifact/m64.js');
await import('../tools/m64Artifact/m64.artifact.js');
await import('../tools/m64Artifact/m64.javascript.js');
await import('../tools/m64Artifact/m64.dictionary.js');
await import('../tools/m64Artifact/m64.v3.js');

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

function artifactV3(overrides = {}) {
  const payload = M.encode64(Uint8Array.of(0xc0, 11), ALPHABET); // dictionary index 75
  return {
    kind: 'chisel-m64-artifact',
    version: 3,
    language: 'javascript',
    languageVersion: 'es2026',
    codec: 'm64-dict-v1',
    canonicalizer: 'js-canonical-v1',
    dictionary: {
      kind: 'ledger-dictionary',
      ref: 'eip155:137:0x0000000000000000000000000000000000000001',
      version: 1,
      language: 'javascript',
    },
    runtime: 'CHISEL-PURE1',
    entry: 'a',
    payload,
    canonicalBytes: 42,
    sha256: '00'.repeat(32),
    ...overrides,
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

test('legacy artifact validation preserves the v2 workbench boundary', () => {
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
    () => M.validateArtifact(artifactV3()),
    /Unsupported artifact package/,
  );
});

test('M64 v3 validator accepts the external dictionary artifact contract', () => {
  const artifact = artifactV3();
  assert.equal(M.M64_V3_CODEC.id, 'm64-dict-v1');
  assert.equal(M.M64_V3_CODEC.alphabet, ALPHABET);
  assert.equal(M.validateArtifactV3(artifact), artifact);
});

test('M64 v3 validator requires dictionary language to match artifact language', () => {
  const artifact = artifactV3({
    dictionary: {
      kind: 'ledger-dictionary',
      ref: 'eip155:137:0x0000000000000000000000000000000000000001',
      version: 1,
      language: 'rust',
    },
  });
  assert.throws(() => M.validateArtifactV3(artifact), /dictionary language mismatch/);
});

test('M64 v3 validator rejects malformed integrity and payload fields', () => {
  assert.throws(
    () => M.validateArtifactV3(artifactV3({ sha256: 'xyz' })),
    /Bad M64 v3 sha256/,
  );

  const reservedPayload = M.encode64(Uint8Array.of(0xc1), ALPHABET);
  assert.throws(
    () => M.validateArtifactV3(artifactV3({ payload: reservedPayload })),
    /Reserved M64 byte/,
  );
});

test('js-canonical-v1 accepts ordinary division and canonicalizes through the compatibility codec', () => {
  const source = 'function half(x){ return x / 2; }';
  const expected = M.canonicalize(source, 'half=a');
  assert.equal(M.JS_CANONICAL_V1.id, 'js-canonical-v1');
  assert.equal(M.canonicalizeJavascriptV1(source, 'half=a'), expected);
});

test('js-canonical-v1 rejects template literals instead of silently rewriting them', () => {
  assert.throws(
    () => M.canonicalizeJavascriptV1('function f(name){return `hello ${name}`}', 'f=a'),
    /rejects template literals/,
  );
});

test('js-canonical-v1 rejects regular-expression literals in expression positions', () => {
  assert.throws(
    () => M.canonicalizeJavascriptV1('function f(s){const r=/a+/g;return r.test(s)}', 'f=a'),
    /regular-expression literals or ambiguous '\/' syntax/,
  );
  assert.throws(
    () => M.canonicalizeJavascriptV1('function f(x,s){if(x) /a/.test(s);return s}', 'f=a'),
    /regular-expression literals or ambiguous '\/' syntax/,
  );
});

test('js-canonical-v1 accepts the current Dark Star staging source', async () => {
  const source = await readFile(new URL('../tools/m64Artifact/examples/darkstar-core.js', import.meta.url), 'utf8');
  const canonical = M.canonicalizeJavascriptV1(source, 'darkStar=a\nmod=m\nputPixel=q\ndrawLine=l');
  assert.ok(canonical.startsWith('function a('));
  assert.ok(canonical.length > 100);
});

test('memory dictionary resolver keeps stable append-only ids', async () => {
  const resolver = M.createMemoryDictionary({
    ref: 'memory:test-dictionary',
    language: 'javascript',
    terms: ['function', 'return'],
  });

  assert.equal(await resolver.idForTerm('function'), 0);
  assert.equal(await resolver.termForId(1), 'return');
  assert.equal(await resolver.ensureTerm('const'), 2);
  assert.equal(await resolver.ensureTerm('const'), 2);
  assert.deepEqual(resolver.snapshotTerms(), ['function', 'return', 'const']);
  assert.deepEqual(resolver.describe(), {
    kind: 'ledger-dictionary',
    ref: 'memory:test-dictionary',
    version: 1,
    language: 'javascript',
  });
});

test('M64 v3 publishes and hydrates JavaScript through a resolver without embedding dictionary terms', async () => {
  const resolver = M.createMemoryDictionary({ ref: 'memory:v3-e2e', language: 'javascript' });
  const source = 'function main(input){const n=input.value/2;return n+1}';
  const built = await M.buildJavascriptArtifactV3(source, {
    resolver,
    entry: 'main',
    identifierMap: 'main=a',
    languageVersion: 'es2026',
    input: { value: 8 },
  });

  assert.equal(built.artifact.version, 3);
  assert.equal(built.artifact.entry, 'a');
  assert.equal(built.artifact.dictionary.ref, 'memory:v3-e2e');
  assert.equal(Object.prototype.hasOwnProperty.call(built.artifact, 'profile'), false);
  assert.ok(resolver.snapshotTerms().length > 0);

  const hydrated = await M.hydrateArtifactV3(built.artifact, resolver);
  assert.equal(hydrated.canonical, built.canonical);
  assert.equal(hydrated.canonicalBytes, built.artifact.canonicalBytes);
  assert.equal(hydrated.sha256, built.artifact.sha256);
});

test('M64 v3 hydration rejects the wrong dictionary and tampered integrity metadata', async () => {
  const resolver = M.createMemoryDictionary({ ref: 'memory:v3-right', language: 'javascript' });
  const built = await M.buildJavascriptArtifactV3('function main(x){return x+1}', {
    resolver,
    entry: 'main',
    identifierMap: 'main=a',
  });

  const wrong = M.createMemoryDictionary({ ref: 'memory:v3-wrong', language: 'javascript', terms: resolver.snapshotTerms() });
  await assert.rejects(
    () => M.hydrateArtifactV3(built.artifact, wrong),
    /resolver does not match artifact dictionary reference/,
  );

  const tampered = { ...built.artifact, sha256: '11'.repeat(32) };
  await assert.rejects(
    () => M.hydrateArtifactV3(tampered, resolver),
    /canonical SHA-256 mismatch/,
  );
});

test('Dark Star completes the M64 v3 canonicalize-resolve-hydrate integrity loop', async () => {
  const source = await readFile(new URL('../tools/m64Artifact/examples/darkstar-core.js', import.meta.url), 'utf8');
  const resolver = M.createMemoryDictionary({ ref: 'memory:darkstar-v3', language: 'javascript' });
  const built = await M.buildJavascriptArtifactV3(source, {
    resolver,
    entry: 'darkStar',
    identifierMap: 'darkStar=a\nmod=m\nputPixel=q\ndrawLine=l',
  });
  const hydrated = await M.hydrateArtifactV3(built.artifact, resolver);

  assert.equal(hydrated.canonical, built.canonical);
  assert.equal(hydrated.sha256, built.artifact.sha256);
  assert.ok(built.artifact.payload.length > 100);
});
