(function (root) {
  'use strict';

  if (!root.CHISEL) {
    throw new Error('CHISEL must be loaded before chisel.sign.backend.js.');
  }

  if (!root.ChiselSecp256k1) {
    throw new Error('Load chisel.secp256k1.js before chisel.sign.backend.js.');
  }

  const CHISEL = root.CHISEL;
  const TOOLS = root.ChiselSecp256k1;
  const LEGACY_PUBLIC_KEY = CHISEL.privateKeyHexToPublicKeyHex;
  const LEGACY_SIGN_RAW = CHISEL.signRawTransaction;
  let selectedBackend = 'elliptic';

  if (typeof LEGACY_PUBLIC_KEY !== 'function' || typeof LEGACY_SIGN_RAW !== 'function') {
    throw new Error('Load chisel.sign.js before chisel.sign.backend.js.');
  }

  function requireNobleBackend() {
    const backend = CHISEL.secp256k1;

    if (!backend || typeof backend.getPublicKey !== 'function' || typeof backend.signDigest !== 'function') {
      throw new Error('Noble secp256k1 backend is not installed.');
    }

    return backend;
  }

  function normalizeBackendName(name) {
    const normalized = String(name || '').trim().toLowerCase();

    if (normalized === 'elliptic' || normalized === 'legacy') {
      return 'elliptic';
    }

    if (normalized === 'noble' || normalized === '@noble/secp256k1') {
      return 'noble';
    }

    throw new Error('Unknown Chisel signing backend: ' + name);
  }

  CHISEL.setSigningBackend = function setSigningBackend(name) {
    const normalized = normalizeBackendName(name);

    if (normalized === 'noble') {
      requireNobleBackend();
    }

    selectedBackend = normalized;
    return selectedBackend;
  };

  CHISEL.getSigningBackend = function getSigningBackend() {
    return selectedBackend;
  };

  CHISEL.getSigningBackendInfo = function getSigningBackendInfo() {
    const noble = CHISEL.secp256k1;

    return {
      selected: selectedBackend,
      ellipticAvailable: true,
      nobleAvailable: Boolean(
        noble &&
        typeof noble.getPublicKey === 'function' &&
        typeof noble.signDigest === 'function' &&
        typeof noble.verifyDigest === 'function'
      ),
      nobleName: noble && noble.name ? String(noble.name) : '',
      lastParity: CHISEL.lastSignerParity || null
    };
  };

  function noblePublicKeyHex(privateKeyHex, compressed) {
    const backend = requireNobleBackend();
    const privateKey = CHISEL.hexToUint8Array(CHISEL.normalizeHex(privateKeyHex));
    const publicKey = backend.getPublicKey(privateKey, Boolean(compressed));

    return CHISEL.bytesToHex(publicKey);
  }

  CHISEL.privateKeyHexToPublicKeyHex = function privateKeyHexToPublicKeyHex(privateKeyHex, compressed) {
    if (selectedBackend !== 'noble') {
      return LEGACY_PUBLIC_KEY(privateKeyHex, compressed);
    }

    const nobleHex = noblePublicKeyHex(privateKeyHex, compressed);
    const legacyHex = LEGACY_PUBLIC_KEY(privateKeyHex, compressed).toLowerCase();

    if (nobleHex.toLowerCase() !== legacyHex) {
      throw new Error('Noble/elliptic public-key parity mismatch.');
    }

    return nobleHex;
  };

  async function signRawTransactionWithNoble(rawTxHex, signingInputs) {
    const backend = requireNobleBackend();
    const parsed = CHISEL.parseRawTransaction(rawTxHex);

    if (signingInputs.length !== parsed.vins.length) {
      throw new Error('Signing input count must match input count.');
    }

    for (let i = 0; i < parsed.vins.length; i += 1) {
      const signingInput = typeof signingInputs[i] === 'string'
        ? {
            privateKeyHex: signingInputs[i],
            compressed: true
          }
        : signingInputs[i];

      const privateKeyHex = CHISEL.normalizeHex(signingInput.privateKeyHex);
      const compressed = Boolean(signingInput.compressed);
      const privateKey = CHISEL.hexToUint8Array(privateKeyHex);
      const publicKey = backend.getPublicKey(privateKey, compressed);
      const publicKeyHex = CHISEL.bytesToHex(publicKey);
      const lockScriptHex = await CHISEL.buildP2pkhLockScript(privateKeyHex, compressed);

      let preimage = parsed.version + CHISEL.varInt(parsed.vins.length);

      parsed.vins.forEach(function appendInput(vin, index) {
        preimage += vin.txidLE + vin.vout;

        if (index === i) {
          preimage += CHISEL.varInt(lockScriptHex.length / 2) + lockScriptHex;
        } else {
          preimage += '00';
        }

        preimage += vin.seq;
      });

      preimage += parsed.outputsAndLock + '01000000';

      const digestHex = await CHISEL.doubleSha256Hex(preimage);
      const digest = CHISEL.hexToUint8Array(digestHex);
      const compactSignature = await backend.signDigest(digest, privateKey);

      if (!backend.verifyDigest(digest, compactSignature, publicKey)) {
        throw new Error('Noble produced a signature that did not verify locally.');
      }

      const derSignatureHex = CHISEL.bytesToHex(TOOLS.compactToDer(compactSignature)) + '01';

      parsed.vins[i].scriptSig =
        CHISEL.varInt(derSignatureHex.length / 2) +
        derSignatureHex +
        CHISEL.varInt(publicKeyHex.length / 2) +
        publicKeyHex;
    }

    let finalHex = parsed.version + CHISEL.varInt(parsed.vins.length);

    parsed.vins.forEach(function appendSignedInput(vin) {
      finalHex += vin.txidLE + vin.vout;
      finalHex += CHISEL.varInt(vin.scriptSig.length / 2) + vin.scriptSig;
      finalHex += vin.seq;
    });

    finalHex += parsed.outputsAndLock;
    return finalHex.toLowerCase();
  }

  CHISEL.signRawTransactionWithNoble = signRawTransactionWithNoble;
  CHISEL.signRawTransactionWithElliptic = LEGACY_SIGN_RAW;

  CHISEL.signRawTransaction = async function signRawTransaction(rawTxHex, signingInputs) {
    if (selectedBackend !== 'noble') {
      CHISEL.lastSignerParity = {
        backend: 'elliptic',
        compared: false,
        ok: null
      };
      return LEGACY_SIGN_RAW(rawTxHex, signingInputs);
    }

    const nobleHex = await signRawTransactionWithNoble(rawTxHex, signingInputs);
    const legacyHex = await LEGACY_SIGN_RAW(rawTxHex, signingInputs);
    const parityOk = nobleHex === legacyHex;

    CHISEL.lastSignerParity = {
      backend: 'noble',
      compared: true,
      ok: parityOk,
      signedBytes: nobleHex.length / 2
    };

    if (!parityOk) {
      throw new Error('Noble/elliptic signed-transaction parity mismatch. Refusing to return the Noble transaction.');
    }

    return nobleHex;
  };

  CHISEL.prototype.signRawTransaction = async function signRawTransaction(rawTxHex, signingInputs) {
    return CHISEL.signRawTransaction(rawTxHex, signingInputs);
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
