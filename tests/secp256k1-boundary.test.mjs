import test from 'node:test';
import assert from 'node:assert/strict';

await import('../chisel.secp256k1.js');

const S = globalThis.ChiselSecp256k1;

function compact(rByte, sByte) {
  return Uint8Array.from([
    ...new Uint8Array(32).fill(rByte),
    ...new Uint8Array(32).fill(sByte),
  ]);
}

test('DER round-trip preserves a compact 64-byte signature', () => {
  const signature = compact(0x11, 0x22);
  const der = S.compactToDer(signature);

  assert.equal(der[0], 0x30);
  assert.deepEqual([...S.derToCompact(der)], [...signature]);
});

test('DER encoder adds a positive sign byte when scalar high bit is set', () => {
  const signature = compact(0x80, 0x01);
  const der = S.compactToDer(signature);

  assert.equal(der[2], 0x02);
  assert.equal(der[3], 33);
  assert.equal(der[4], 0x00);
  assert.equal(der[5], 0x80);
  assert.deepEqual([...S.derToCompact(der)], [...signature]);
});

test('DER encoder removes redundant scalar leading zeros', () => {
  const signature = new Uint8Array(64);
  signature[31] = 1;
  signature[63] = 2;
  const der = S.compactToDer(signature);

  assert.equal(der[3], 1);
  assert.equal(der[4], 1);
  assert.deepEqual([...S.derToCompact(der)], [...signature]);
});

test('DER decoder rejects non-minimal integers and trailing bytes', () => {
  assert.throws(
    () => S.derToCompact(Uint8Array.from([0x30, 0x07, 0x02, 0x02, 0x00, 0x01, 0x02, 0x01, 0x01])),
    /redundant leading zero/,
  );

  const der = S.compactToDer(compact(0x11, 0x22));
  const withTrailing = Uint8Array.from([...der, 0x00]);
  assert.throws(() => S.derToCompact(withTrailing), /sequence length/);
});

test('backend boundary enforces 32-byte private keys and digests', () => {
  const backend = S.createBoundary({
    name: 'test',
    getPublicKey(privateKey, compressed) {
      return Uint8Array.of(compressed ? 2 : 4, privateKey[31]);
    },
    signDigest(digest, privateKey) {
      return Uint8Array.of(digest[31], privateKey[31]);
    },
    verifyDigest() {
      return true;
    },
  });

  assert.equal(backend.name, 'test');
  assert.deepEqual([...backend.getPublicKey(new Uint8Array(32).fill(1), true)], [2, 1]);
  assert.throws(() => backend.signDigest(new Uint8Array(31), new Uint8Array(32)), /32 bytes/);
  assert.throws(() => backend.signDigest(new Uint8Array(32), new Uint8Array(31)), /32 bytes/);
});
