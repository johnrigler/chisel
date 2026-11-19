(function (root) {
  "use strict";
  const BASE = "https://johnrigler.github.io/";

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
      const fragment = normalize(link.hash.slice(1));
      const values = [...(fragment ? [fragment] : []), ...link.searchParams.getAll("sticker"), ...new URLSearchParams(link.hash.slice(1)).getAll("sticker")];
      return values.length === 1 ? normalize(values[0]) : "";
    } catch { return ""; }
  }
  function url(value) {
    const id = normalize(value);
    if (!id) throw new Error("A sticker must contain exactly eight bytes (16 hex characters).");
    return BASE + "#" + id.toUpperCase();
  }
  root.ChiselSticker = Object.freeze({parse, url});
})(typeof window === "object" ? window : globalThis);
