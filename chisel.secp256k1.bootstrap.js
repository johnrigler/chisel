(function (root) {
  'use strict';

  if (!root.CHISEL) {
    throw new Error('CHISEL must be loaded before chisel.secp256k1.bootstrap.js.');
  }

  if (!root.nobleSecp256k1) {
    throw new Error('Vendored @noble/secp256k1 3.2.0 browser bundle is not loaded.');
  }

  if (!root.ChiselNobleSecp256k1 || typeof root.ChiselNobleSecp256k1.install !== 'function') {
    throw new Error('Load chisel.secp256k1.noble.js before chisel.secp256k1.bootstrap.js.');
  }

  root.ChiselNobleSecp256k1.install(root.nobleSecp256k1, root.CHISEL);
})(typeof globalThis !== 'undefined' ? globalThis : this);
