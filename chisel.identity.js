(function () {
  "use strict";

  if (!window.CHISEL) {
    throw new Error("CHISEL must be loaded before chisel.identity.js.");
  }

  if (!CHISEL.secp256k1 || typeof CHISEL.secp256k1.signDigest !== "function") {
    throw new Error("Load the Chisel secp256k1 backend before identity signing.");
  }

  const IDENTITY_PREFIX = "chisel:v1:";
  const FORMAT = "chisel-signed-v1";
  const ALGORITHM = "secp256k1-sha256";
  const DOMAIN = "CHISEL-SIGNED-V1";
  const ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

  function normalizePrivateKey(privateKeyHex) {
    const value = CHISEL.normalizeHex(String(privateKeyHex || ""));
    if (!/^[0-9a-f]{64}$/.test(value) || BigInt("0x" + value) === 0n || BigInt("0x" + value) >= ORDER) {
      throw new Error("Expected a 32-byte private key.");
    }
    return value;
  }

  function identityPublicKey(identity) {
    const value = String(identity || "").trim().toLowerCase();
    const match = value.match(/^chisel:v1:([0-9a-f]{66})$/);
    if (!match) throw new Error("Invalid Chisel identity.");
    return match[1];
  }

  CHISEL.identityFromPrivateKey = function identityFromPrivateKey(privateKeyHex) {
    const key = normalizePrivateKey(privateKeyHex);
    const publicKeyHex = CHISEL.privateKeyHexToPublicKeyHex(key, true).toLowerCase();
    return IDENTITY_PREFIX + publicKeyHex;
  };

  CHISEL.shortIdentity = function shortIdentity(identity) {
    const value = String(identity || "").trim();
    const match = value.match(/^chisel:v1:([0-9a-fA-F]{66})$/);
    if (!match) return value;
    const key = match[1].toLowerCase();
    return key.slice(0, 8) + "…" + key.slice(-8);
  };

  function canonicalValue(value, ancestors) {
    if (value === null) return "null";
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Signed payload cannot contain non-finite numbers.");
      return JSON.stringify(value);
    }
    if (typeof value !== "object") throw new Error("Signed payload must contain only plain JSON values.");
    if (ancestors.has(value)) throw new Error("Signed payload cannot contain cycles.");
    if (ancestors.size > 100) throw new Error("Signed payload is nested too deeply.");
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    // Cross-realm ordinary objects are allowed; class instances and built-ins are not.
    const constructor = proto && Object.getOwnPropertyDescriptor(proto, "constructor");
    const plain = proto === null || (Object.getPrototypeOf(proto) === null && constructor && typeof constructor.value === "function" && Function.prototype.toString.call(constructor.value) === Function.prototype.toString.call(Object));
    if (!array && !plain) throw new Error("Signed payload must contain only plain objects and arrays.");
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.some(function (key) { return typeof key === "symbol" || descriptors[key].get || descriptors[key].set; })) throw new Error("Signed payload cannot contain symbols or accessors.");
    ancestors.add(value);
    try {
      if (array) {
        if (keys.length !== value.length + 1) throw new Error("Signed arrays must be dense and have no extra properties.");
        const parts = [];
        for (let i = 0; i < value.length; i++) {
          if (!Object.prototype.hasOwnProperty.call(descriptors, i)) throw new Error("Signed arrays must be dense.");
          parts.push(canonicalValue(descriptors[i].value, ancestors));
        }
        return "[" + parts.join(",") + "]";
      }
      if (keys.some(function (key) { return !descriptors[key].enumerable; })) throw new Error("Signed objects cannot contain hidden properties.");
      return "{" + keys.sort().map(function (key) { return JSON.stringify(key) + ":" + canonicalValue(descriptors[key].value, ancestors); }).join(",") + "}";
    } finally { ancestors.delete(value); }
  }

  CHISEL.canonicalize = function canonicalize(value) {
    return canonicalValue(value, new Set());
  };

  CHISEL.artifactSigningText = function artifactSigningText(type, payload) {
    const normalizedType = String(type || "").trim();
    if (!normalizedType) throw new Error("Signed artifact type is required.");
    if (/\r|\n/.test(normalizedType)) throw new Error("Signed artifact type cannot contain newlines.");
    return DOMAIN + "\n" + normalizedType + "\n" + CHISEL.canonicalize(payload);
  };

  async function digestText(text) {
    const bytes = new TextEncoder().encode(text);
    return CHISEL.sha256Hex(CHISEL.bytesToHex(bytes));
  }

  CHISEL.artifactDigest = async function artifactDigest(type, payload) {
    return digestText(CHISEL.artifactSigningText(type, payload));
  };

  CHISEL.signDigest = async function signDigest(options) {
    const opts = options || {};
    const privateKeyHex = normalizePrivateKey(opts.privateKeyHex);
    const digest = String(opts.digest || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest)) {
      throw new Error("Expected a 32-byte digest.");
    }

    const signature = await CHISEL.secp256k1.signDigest(CHISEL.hexToUint8Array(digest), CHISEL.hexToUint8Array(privateKeyHex));
    return {
      identity: CHISEL.identityFromPrivateKey(privateKeyHex),
      algorithm: ALGORITHM,
      digest: digest,
      signature: CHISEL.bytesToHex(signature)
    };
  };

  CHISEL.verifyDigestSignature = function verifyDigestSignature(options) {
    const opts = options || {};
    let publicKeyHex;
    try {
      publicKeyHex = identityPublicKey(opts.identity);
    } catch (error) {
      return false;
    }

    const digest = String(opts.digest || "").trim().toLowerCase();
    const signatureHex = String(opts.signature || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest) || !/^[0-9a-f]{128}$/.test(signatureHex)) {
      return false;
    }

    try {
      const r = BigInt("0x" + signatureHex.slice(0, 64)), scalarS = BigInt("0x" + signatureHex.slice(64));
      if (r <= 0n || r >= ORDER || scalarS <= 0n || scalarS > ORDER / 2n) return false;
      return CHISEL.secp256k1.verifyDigest(CHISEL.hexToUint8Array(digest), CHISEL.hexToUint8Array(signatureHex), CHISEL.hexToUint8Array(publicKeyHex));
    } catch (error) {
      return false;
    }
  };

  CHISEL.signArtifact = async function signArtifact(options) {
    const opts = options || {};
    const privateKeyHex = normalizePrivateKey(opts.privateKeyHex);
    const type = String(opts.type || "").trim();
    CHISEL.canonicalize(opts.payload); // Reject non-JSON values before taking the snapshot.
    const payload = JSON.parse(JSON.stringify(opts.payload));
    const proof = await CHISEL.signDigest({
      privateKeyHex: privateKeyHex,
      digest: await CHISEL.artifactDigest(type, payload)
    });

    return {
      format: FORMAT,
      type: type,
      identity: proof.identity,
      payload: payload,
      proof: {
        algorithm: proof.algorithm,
        digest: proof.digest,
        signature: proof.signature
      }
    };
  };

  CHISEL.verifyArtifact = async function verifyArtifact(envelope) {
    if (!envelope || typeof envelope !== "object") return false;
    if (envelope.format !== FORMAT) return false;
    if (!envelope.proof || envelope.proof.algorithm !== ALGORITHM) return false;

    let publicKeyHex;
    try {
      publicKeyHex = identityPublicKey(envelope.identity);
    } catch (error) {
      return false;
    }

    const signatureHex = String(envelope.proof.signature || "").toLowerCase();
    if (!/^[0-9a-f]{128}$/.test(signatureHex)) return false;

    let digest;
    try {
      digest = await CHISEL.artifactDigest(envelope.type, envelope.payload);
    } catch (error) {
      return false;
    }

    if (digest !== String(envelope.proof.digest || "").toLowerCase()) return false;

    return CHISEL.verifyDigestSignature({
      identity: envelope.identity,
      digest: digest,
      signature: signatureHex
    });
  };

  CHISEL.SIGNED_ARTIFACT = Object.freeze({
    format: FORMAT,
    algorithm: ALGORITHM,
    domain: DOMAIN
  });
})();