/* Chisel static artifacts: portable off-ledger manifest and content-addressed reads.
 * No FileProxy API, wallet, Etherscan key, or Polygon RPC required.
 * Manifest checksums alone prove consistency, not on-chain provenance.
 */
(function (global) {
  "use strict";

  const FORMAT = "chisel-static-artifacts-v1";
  const extensions = Object.freeze({
    "image/svg+xml": ".svg",
    "application/octet-stream": ".bin",
    "text/plain": ".txt",
    "application/json": ".json"
  });
  const ID_RE = /^[a-z0-9][a-z0-9._-]{0,79}(?:\/[a-z0-9][a-z0-9._-]{0,79}){0,5}$/;
  const SHA_RE = /^[0-9a-f]{64}$/;
  const MAX_BYTES = 8 * 1024 * 1024;

  function validId(id) {
    if (typeof id !== "string" || !ID_RE.test(id) ||
        id.split("/").some(s => s === "." || s === "..")) throw Error("Invalid static artifact ID");
    return id;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }

  async function sha256Hex(bytes, subtle) {
    if (!subtle || typeof subtle.digest !== "function") throw Error("SHA-256 unavailable");
    return bytesToHex(new Uint8Array(await subtle.digest("SHA-256", bytes)));
  }

  function safeBase(url, fallback) {
    const parsed = new URL(url, fallback || (global.location && global.location.href) || undefined);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password ||
        parsed.search || parsed.hash) throw Error("Static manifest must be an HTTP(S) URL without credentials or query");
    return parsed;
  }

  function canonicalPath(entry) {
    if (!entry || typeof entry !== "object" || !SHA_RE.test(entry.sha256) ||
        !Object.prototype.hasOwnProperty.call(extensions, entry.mediaType)) {
      throw Error("Invalid static artifact entry");
    }
    const expected = "objects/sha256/" + entry.sha256.slice(0, 2) +
      "/" + entry.sha256 + extensions[entry.mediaType];
    if (entry.path !== expected || !Number.isSafeInteger(entry.bytes) ||
        entry.bytes < 1 || entry.bytes > MAX_BYTES) throw Error("Noncanonical static artifact path or length");
    return expected;
  }

  async function load({manifestUrl, id, fetchImpl, subtle, expectedSha256, baseUrl} = {}) {
    validId(id);
    const url = safeBase(manifestUrl, baseUrl);
    const get = fetchImpl || global.fetch && global.fetch.bind(global);
    const digest = subtle || global.crypto && global.crypto.subtle;
    if (!get) throw Error("fetch unavailable");
    const manifestResponse = await get(url.href, {cache: "no-store"});
    if (!manifestResponse.ok) throw Error("Static manifest unavailable: HTTP " + manifestResponse.status);
    const document = await manifestResponse.json();
    if (!document || document.format !== FORMAT ||
        !document.artifacts || typeof document.artifacts !== "object" ||
        Array.isArray(document.artifacts)) throw Error("Unexpected static artifact manifest");
    const entry = Object.prototype.hasOwnProperty.call(document.artifacts, id)
      ? document.artifacts[id] : null;
    if (!entry) throw Error("Static artifact not in manifest: " + id);
    const path = canonicalPath(entry);
    if (expectedSha256 && (!SHA_RE.test(expectedSha256) ||
        expectedSha256 !== entry.sha256)) throw Error("Static object differs from independently expected SHA-256");
    const objectUrl = new URL(path, url);
    if (objectUrl.origin !== url.origin || !objectUrl.pathname.startsWith(
      url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1))) throw Error("Object escapes manifest directory");
    const objectResponse = await get(objectUrl.href, {cache: "no-store"});
    if (!objectResponse.ok) throw Error("Static object unavailable: HTTP " + objectResponse.status);
    const bytes = new Uint8Array(await objectResponse.arrayBuffer());
    if (bytes.length !== entry.bytes) throw Error("Static artifact length mismatch");
    if (await sha256Hex(bytes, digest) !== entry.sha256) throw Error("Static artifact SHA-256 mismatch");
    return Object.freeze({
      id, bytes, mediaType: entry.mediaType, sha256: entry.sha256,
      sourceUrl: objectUrl.href,
      provenance: "unverified",
      sourceHint: typeof entry.sourceHint === "string" ? entry.sourceHint : ""
    });
  }

  global.ChiselStaticArtifactReader = Object.freeze({load, sha256Hex, validId});
})(typeof window !== "undefined" ? window : globalThis);
