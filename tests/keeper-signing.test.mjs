import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
import { publicKeyHexFromPrivateKeyHex, signTextWithPrivateKeyHex, verifyTextSignature } from '../tools/keeperBun/keeper-crypto.js';
const f = JSON.parse(await readFile(new URL('fixtures/security-known-values.json', import.meta.url), 'utf8'));
test('Keeper uses local Noble while preserving the known DER signature and public key', async () => {
  assert.equal(await publicKeyHexFromPrivateKeyHex(f.privateKeyHex), f.keeper.publicKeyHex);
  assert.deepEqual(await signTextWithPrivateKeyHex(f.keeper.text, f.privateKeyHex), { digestHex: f.keeper.digestHex, signatureHex: f.keeper.signatureHex });
  assert.equal(await verifyTextSignature(f.keeper.text, f.keeper.publicKeyHex, f.keeper.signatureHex), true);
  assert.equal(await verifyTextSignature(f.keeper.text + ' changed', f.keeper.publicKeyHex, f.keeper.signatureHex), false);
  assert.equal(await verifyTextSignature(f.keeper.text, f.keeper.publicKeyHex, 'deadbeef'), false);
});
