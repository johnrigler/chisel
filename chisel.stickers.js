(function (root) {
  "use strict";
  const PUBLIC_IDS = "chisel.publicStickerIds.v1";
  const BASE = "https://johnrigler.github.io/chisel/";

  function normalize(value) {
    const id = String(value || "").trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();
    return /^[0-9a-f]{16}$/.test(id) ? id : "";
  }
  function parse(value) {
    const raw = String(value || "").trim();
    const plain = normalize(raw);
    if (plain) return plain;
    try {
      const link = new URL(raw);
      if (!["http:", "https:"].includes(link.protocol) || link.username || link.password) return "";
      const values = [...link.searchParams.getAll("sticker"), ...new URLSearchParams(link.hash.slice(1)).getAll("sticker")];
      return values.length === 1 ? normalize(values[0]) : "";
    } catch { return ""; }
  }
  function url(value) {
    const id = normalize(value);
    if (!id) throw new Error("A sticker must contain exactly eight bytes (16 hex characters).");
    // Keep a possible key part in the fragment, out of requests to the host.
    return BASE + "#sticker=" + id.toUpperCase();
  }
  function publicIds() {
    try {
      const saved = JSON.parse(root.localStorage.getItem(PUBLIC_IDS) || "[]");
      return new Set(Array.isArray(saved) ? saved.map(normalize).filter(Boolean) : []);
    } catch { return new Set(); }
  }
  function markPublic(value) {
    const id = normalize(value);
    if (!id) throw new Error("Invalid public sticker ID.");
    const ids = publicIds();
    ids.add(id);
    try { root.localStorage.setItem(PUBLIC_IDS, JSON.stringify([...ids])); }
    catch { throw new Error("Cannot remember public sticker use in this browser. Enable site storage before choosing public use."); }
  }
  function assertPrivate(value) {
    const hex = String(value || "").toLowerCase();
    const ids = publicIds();
    for (let offset = 0; offset + 16 <= hex.length; offset += 16) {
      if (ids.has(hex.slice(offset, offset + 16))) throw new Error("This sticker was used publicly in this browser. Use a different sticker for the private key.");
    }
  }
  root.ChiselSticker = Object.freeze({parse, url, markPublic, assertPrivate});

  if (root.document?.currentScript?.hasAttribute("data-sticker-entry")) {
    const source = new URL(root.location.href);
    const hash = new URLSearchParams(source.hash.slice(1));
    if (hash.has("sticker") || source.searchParams.has("sticker")) {
      const target = new URL("sticker.html", source);
      target.hash = new URLSearchParams({sticker: parse(source.href)}).toString();
      const currency = source.searchParams.get("currency");
      if (currency) target.searchParams.set("currency", currency);
      root.location.replace(target.href);
    }
  }
})(typeof window === "object" ? window : globalThis);
