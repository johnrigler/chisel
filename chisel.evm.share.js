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
  // Only public short-record text crosses into the wallet browser.
  function metamaskUrl(base, value, mobile, hasMetaMask) {
    const text = String(value || "");
    const url = text.trim() ? new URL(workbenchUrl(base, text)) : new URL("evm.html", base);
    const fields = new URLSearchParams(url.hash.slice(1));
    fields.set("wallet", "metamask");
    url.hash = fields.toString();
    if (!mobile || hasMetaMask) return url.href;
    if (url.protocol !== "https:") throw new Error("Open the HTTPS Chisel site to use MetaMask mobile.");
    // Encode the nested fragment as part of the dapp path, not the outer URL fragment.
    return "https://link.metamask.io/dapp/" + url.host + url.pathname + encodeURIComponent(url.search + url.hash);
  }
  function openMetaMask(value) {
    const mobile = /Android|iPhone|iPad|iPod/i.test(root.navigator.userAgent || "");
    const provider = root.ethereum;
    const available = !!(provider && (provider.isMetaMask || (provider.providers || []).some(p => p.isMetaMask)));
    root.location.href = metamaskUrl(root.location.href, value, mobile, available);
  }
  function sharedText(hash) {
    const fields = new URLSearchParams(String(hash || "").replace(/^#/, ""));
    return fields.has("chiselText") ? fields.get("chiselText") : null;
  }
  root.CHISEL_EVM_SHARE = Object.freeze({MAX_BYTES, encodeText, workbenchUrl, sharedText, metamaskUrl, openMetaMask});
})(typeof window !== "undefined" ? window : globalThis);
