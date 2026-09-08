(function (root) {
  'use strict';

  function requireBoundary() {
    if (!root.ChiselSecp256k1 || typeof root.ChiselSecp256k1.createBoundary !== 'function') {
      throw new Error('Load chisel.secp256k1.js before the Noble adapter.');
    }

    return root.ChiselSecp256k1;
  }

  function requireNoble(noble) {
    if (!noble || typeof noble !== 'object') {
      throw new TypeError('A @noble/secp256k1 module object is required.');
    }

    ['getPublicKey', 'signAsync', 'verify'].forEach(function (name) {
      if (typeof noble[name] !== 'function') {
        throw new TypeError('@noble/secp256k1 must provide ' + name + '().');
      }
    });

    return noble;
  }

  function createBackend(nobleModule) {
    const noble = requireNoble(nobleModule);
    const secp = requireBoundary();

    return secp.createBoundary({
      name: '@noble/secp256k1',
      getPublicKey: function getPublicKey(privateKey, compressed) {
        return noble.getPublicKey(privateKey, compressed);
      },
      signDigest: function signDigest(digest, privateKey) {
        return noble.signAsync(digest, privateKey, {
          prehash: false,
          lowS: true,
          format: 'compact'
        });
      },
      verifyDigest: function verifyDigest(digest, signature, publicKey) {
        return noble.verify(signature, digest, publicKey, {
          prehash: false,
          lowS: true,
          format: 'compact'
        });
      }
    });
  }

  function install(nobleModule, chisel) {
    const secp = requireBoundary();
    const backend = createBackend(nobleModule);
    const target = chisel || root.CHISEL;

    if (!target) {
      throw new Error('CHISEL is not loaded.');
    }

    secp.install(target, backend);
    return backend;
  }

  root.ChiselNobleSecp256k1 = Object.freeze({
    version: 1,
    createBackend: createBackend,
    install: install
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
