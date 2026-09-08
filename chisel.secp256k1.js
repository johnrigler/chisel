(function (root) {
  'use strict';

  function toBytes(value, name) {
    const label = name || 'value';

    if (value instanceof Uint8Array) {
      return new Uint8Array(value);
    }

    if (value instanceof ArrayBuffer) {
      return new Uint8Array(value.slice(0));
    }

    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
    }

    if (Array.isArray(value)) {
      return Uint8Array.from(value);
    }

    throw new TypeError(label + ' must be byte-like.');
  }

  function requireLength(bytes, length, name) {
    if (bytes.length !== length) {
      throw new RangeError((name || 'value') + ' must be exactly ' + length + ' bytes.');
    }

    return bytes;
  }

  function concatBytes() {
    let total = 0;
    const parts = Array.prototype.map.call(arguments, function (part) {
      const bytes = toBytes(part, 'DER part');
      total += bytes.length;
      return bytes;
    });
    const output = new Uint8Array(total);
    let offset = 0;

    parts.forEach(function (bytes) {
      output.set(bytes, offset);
      offset += bytes.length;
    });

    return output;
  }

  function derInteger(integerBytes) {
    const bytes = toBytes(integerBytes, 'integer');

    if (bytes.length === 0) {
      throw new RangeError('DER integer cannot be empty.');
    }

    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) {
      start += 1;
    }

    let body = bytes.slice(start);

    if ((body[0] & 0x80) !== 0) {
      body = concatBytes(Uint8Array.of(0), body);
    }

    if (body.length > 127) {
      throw new RangeError('DER integer is unexpectedly large.');
    }

    return concatBytes(Uint8Array.of(0x02, body.length), body);
  }

  function compactToDer(compactSignature) {
    const compact = requireLength(toBytes(compactSignature, 'compact signature'), 64, 'compact signature');
    const r = derInteger(compact.slice(0, 32));
    const s = derInteger(compact.slice(32, 64));
    const body = concatBytes(r, s);

    if (body.length > 127) {
      throw new RangeError('DER signature is unexpectedly large.');
    }

    return concatBytes(Uint8Array.of(0x30, body.length), body);
  }

  function readDerInteger(bytes, offset, label) {
    if (offset + 2 > bytes.length || bytes[offset] !== 0x02) {
      throw new Error('Invalid DER ' + label + ' integer tag.');
    }

    const length = bytes[offset + 1];
    const start = offset + 2;
    const end = start + length;

    if (length === 0 || end > bytes.length) {
      throw new Error('Invalid DER ' + label + ' integer length.');
    }

    const body = bytes.slice(start, end);

    if ((body[0] & 0x80) !== 0) {
      throw new Error('DER ' + label + ' integer must be positive.');
    }

    if (body.length > 1 && body[0] === 0 && (body[1] & 0x80) === 0) {
      throw new Error('DER ' + label + ' integer has redundant leading zero.');
    }

    let unsigned = body;
    if (unsigned[0] === 0) {
      unsigned = unsigned.slice(1);
    }

    if (unsigned.length > 32) {
      throw new Error('DER ' + label + ' integer exceeds secp256k1 scalar width.');
    }

    const scalar = new Uint8Array(32);
    scalar.set(unsigned, 32 - unsigned.length);

    return {
      scalar: scalar,
      nextOffset: end
    };
  }

  function derToCompact(derSignature) {
    const der = toBytes(derSignature, 'DER signature');

    if (der.length < 8 || der[0] !== 0x30) {
      throw new Error('Invalid DER signature sequence.');
    }

    const sequenceLength = der[1];
    if (sequenceLength !== der.length - 2) {
      throw new Error('Invalid DER signature sequence length.');
    }

    const r = readDerInteger(der, 2, 'r');
    const s = readDerInteger(der, r.nextOffset, 's');

    if (s.nextOffset !== der.length) {
      throw new Error('DER signature has trailing bytes.');
    }

    return concatBytes(r.scalar, s.scalar);
  }

  function createBoundary(backend) {
    if (!backend || typeof backend !== 'object') {
      throw new TypeError('secp256k1 backend is required.');
    }

    ['getPublicKey', 'signDigest', 'verifyDigest'].forEach(function (name) {
      if (typeof backend[name] !== 'function') {
        throw new TypeError('secp256k1 backend must implement ' + name + '().');
      }
    });

    return Object.freeze({
      name: String(backend.name || 'unknown'),
      getPublicKey: function getPublicKey(privateKey, compressed) {
        return backend.getPublicKey(
          requireLength(toBytes(privateKey, 'private key'), 32, 'private key'),
          compressed !== false
        );
      },
      signDigest: function signDigest(digest, privateKey) {
        return backend.signDigest(
          requireLength(toBytes(digest, 'digest'), 32, 'digest'),
          requireLength(toBytes(privateKey, 'private key'), 32, 'private key')
        );
      },
      verifyDigest: function verifyDigest(digest, signature, publicKey) {
        return backend.verifyDigest(
          requireLength(toBytes(digest, 'digest'), 32, 'digest'),
          toBytes(signature, 'signature'),
          toBytes(publicKey, 'public key')
        );
      }
    });
  }

  function install(chisel, boundary) {
    if (!chisel || (typeof chisel !== 'function' && typeof chisel !== 'object')) {
      throw new TypeError('CHISEL target is required.');
    }

    chisel.secp256k1 = boundary || api;
    return chisel.secp256k1;
  }

  const api = Object.freeze({
    version: 1,
    toBytes: toBytes,
    compactToDer: compactToDer,
    derToCompact: derToCompact,
    createBoundary: createBoundary,
    install: install
  });

  root.ChiselSecp256k1 = api;

  if (root.CHISEL) {
    install(root.CHISEL, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
