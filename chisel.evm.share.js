/* Public-text-only bridge; no credentials, wallet calls, or transaction submission. */
(function(root) {
  "use strict";
  const MAX_BYTES = 80;
  function encodeText(value) {
    if (typeof value !== "string" || !value.trim()) throw new Error("Enter public text to publish.");
    const bytes = new TextEncoder().encode(value);
    if (bytes.length > MAX_BYTES) throw new Error("Text is " + bytes.length + " UTF-8 bytes; the short-record profile allows 80.");
    return {hex:"0x" + Array.from(bytes, b => b.toString(16).padStart(2,"0")).join(""), byteLength:bytes.length};
  }
  function workbenchUrl(base, value) {
    encodeText(value);
    const url = new URL("evm.html", base);
    url.hash = new URLSearchParams({chiselText:value}).toString();
    return url.href;
  }
  function sharedText(hash) {
    const fields = new URLSearchParams(String(hash || "").replace(/^#/, ""));
    return fields.has("chiselText") ? fields.get("chiselText") : null;
  }
  root.CHISEL_EVM_SHARE = Object.freeze({MAX_BYTES, encodeText, workbenchUrl, sharedText});
})(typeof window !== "undefined" ? window : globalThis);
