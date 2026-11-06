/* Chisel thunder attestation wire helpers.
   This module formats claims, not signatures and not verdicts of truth.
   The carrier's sender must be linked to an identity separately. */
(function (root) {
  "use strict";

  const BROADCAST = "0x" + "1".repeat(40);
  const AVOID = "0x" + "2".repeat(40);
  const FORMAT = "CT1";
  const HEX256 = /^[0-9a-f]{64}$/;
  const WIRE = /^CT1\|([+-])\|H\|([0-9a-f]{64})$/;

  function normalizeDigest(value) {
    const hash = String(value || "").trim().replace(/^sha256:/i, "").toLowerCase();
    if (!HEX256.test(hash)) throw new Error("Expected SHA-256 as exactly 64 hexadecimal characters");
    return hash;
  }

  function normalizeClaim(value) {
    if (value === "+" || value === "endorse" || value === "broadcast") return "+";
    if (value === "-" || value === "warn" || value === "avoid") return "-";
    throw new Error("Claim must be endorse (+) or warn (-)");
  }

  function create({ claim, digest } = {}) {
    const action = normalizeClaim(claim);
    const hex = normalizeDigest(digest);
    const ascii = FORMAT + "|" + action + "|H|" + hex;
    if (new TextEncoder().encode(ascii).length !== 72)
      throw new Error("Invalid compact attestation wire length");
    return ascii;
  }

  function parse(text) {
    const value = String(text || "").trim();
    const match = WIRE.exec(value);
    if (!match) throw new Error("Expected CT1|+|H|SHA256 or CT1|-|H|SHA256 (72 ASCII bytes)");
    return Object.freeze({
      protocol: FORMAT,
      claim: match[1] === "+" ? "endorse" : "warn",
      marker: match[1] === "+" ? BROADCAST : AVOID,
      digestScope: "caller-declared-sha256-subject",
      digest: match[2],
      ascii: value,
      bytes: 72
    });
  }

  function markerAddress(claim) {
    return normalizeClaim(claim) === "+" ? BROADCAST : AVOID;
  }

  function classifyMarker(address) {
    const a = String(address || "").toLowerCase();
    if (a === BROADCAST) return "broadcast";
    if (a === AVOID) return "avoid";
    return null;
  }

  root.ChiselThunderAttest = Object.freeze({
    version: 1,
    BROADCAST, AVOID, normalizeDigest, markerAddress, classifyMarker,
    create, parse
  });
})(typeof window === "object" ? window : globalThis);
