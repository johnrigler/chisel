(function () {
  "use strict";

  if (!window.CHISEL) {
    throw new Error("CHISEL must be loaded before chisel.identity.js.");
  }

  if (!window.elliptic || !window.elliptic.ec) {
    throw new Error("elliptic dependency is required.");
  }

  const IDENTITY_PREFIX = "chisel:v1:";
  const FORMAT = "chisel-signed-v1";
  const ALGORITHM = "secp256k1-sha256";
  const DOMAIN = "CHISEL-SIGNED-V1";
  const ec = new window.elliptic.ec("secp256k1");

  function normalizePrivateKey(privateKeyHex) {
    const value = CHISEL.normalizeHex(String(privateKeyHex || ""));
    if (!/^[0-9a-f]{64}$/.test(value)) {
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

  function canonicalValue(value) {
    if (value === null) return "null";
    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Signed payload cannot contain non-finite numbers.");
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return "[" + value.map(function (item) {
        if (typeof item === "undefined" || typeof item === "function" || typeof item === "symbol") {
          throw new Error("Signed payload cannot contain undefined, functions, or symbols.");
        }
        return canonicalValue(item);
      }).join(",") + "]";
    }
    if (typeof value === "object") {
      const keys = Object.keys(value).sort();
      return "{" + keys.map(function (key) {
        const item = value[key];
        if (typeof item === "undefined" || typeof item === "function" || typeof item === "symbol") {
          throw new Error("Signed payload cannot contain undefined, functions, or symbols.");
        }
        return JSON.stringify(key) + ":" + canonicalValue(item);
      }).join(",") + "}";
    }
    throw new Error("Unsupported value in signed payload.");
  }

  CHISEL.canonicalize = function canonicalize(value) {
    return canonicalValue(value);
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

  CHISEL.signDigest = function signDigest(options) {
    const opts = options || {};
    const privateKeyHex = normalizePrivateKey(opts.privateKeyHex);
    const digest = String(opts.digest || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(digest)) {
      throw new Error("Expected a 32-byte digest.");
    }

    const signature = ec.keyFromPrivate(privateKeyHex).sign(digest, { canonical: true });
    return {
      identity: CHISEL.identityFromPrivateKey(privateKeyHex),
      algorithm: ALGORITHM,
      digest: digest,
      signature: signature.r.toString(16, 64) + signature.s.toString(16, 64)
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

    return CHISEL.verifyDigestSignature({
      identity: envelope.identity,
      digest: digest,
      signature: signatureHex
    });
  };

  CHISEL.signArtifact = async function signArtifact(options) {
    const opts = options || {};
    const privateKeyHex = normalizePrivateKey(opts.privateKeyHex);
    const type = String(opts.type || "").trim();
    const payload = opts.payload;
    const proof = CHISEL.signDigest({
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

    try {
      return ec.keyFromPublic(publicKeyHex, "hex").verify(digest, {
        r: signatureHex.slice(0, 64),
        s: signatureHex.slice(64)
      });
    } catch (error) {
      return false;
    }
  };

  CHISEL.SIGNED_ARTIFACT = Object.freeze({
    format: FORMAT,
    algorithm: ALGORITHM,
    domain: DOMAIN
  });
})();