(function (root) {
  "use strict";

  // Existing Solidity interfaces, not a new wire format. Offsets and lengths
  // are bytes relative to the ABI arguments after the four-byte selector.
  const GOMEZ = "3740071f"; // tell(string,address,uint256,address,uint256,address,uint256,address,uint256)
  const JETHRO = "16fb242a"; // mapArtifact(string,string)
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  function base64(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const n = bytes[i] * 65536 + (bytes[i + 1] || 0) * 256 + (bytes[i + 2] || 0);
      out += alphabet[n >>> 18] + alphabet[(n >>> 12) & 63] +
        (i + 1 < bytes.length ? alphabet[(n >>> 6) & 63] : "=") +
        (i + 2 < bytes.length ? alphabet[n & 63] : "=");
    }
    return out;
  }

  function image(bytes) {
    const prefix = Array.from(bytes.slice(0, 12), function (n) { return n.toString(16).padStart(2, "0"); }).join("");
    const mime = prefix.startsWith("89504e470d0a1a0a") ? "image/png" :
      prefix.startsWith("ffd8ff") ? "image/jpeg" : /^474946383[79]61/.test(prefix) ? "image/gif" :
      /^52494646[0-9a-f]{8}57454250/.test(prefix) ? "image/webp" : "";
    return mime ? {mime: mime, bytes: bytes.length, src: "data:" + mime + ";base64," + base64(bytes)} : null;
  }

  function text(bytes) {
    try { return new TextDecoder("utf-8", {fatal: true}).decode(bytes); }
    catch (_) { return ""; }
  }

  function addressWord(address) {
    const hex = address.slice(2).replace(/^(?:00)+|(?:00)+$/g, "");
    if (!hex) return "";
    const bytes = hex.match(/../g).map(function (part) { return parseInt(part, 16); });
    return bytes.every(function (n) { return n >= 32 && n <= 126; }) ? String.fromCharCode.apply(null, bytes).trim() : "";
  }

  function decode(input) {
    const hex = String(input || "").replace(/^0x/i, "").toLowerCase();
    const selector = hex.slice(0, 8);
    if (selector !== GOMEZ && selector !== JETHRO) return null;
    if (!/^[0-9a-f]+$/.test(hex) || hex.length % 2) throw new Error("Malformed EVM input hex.");
    const args = hex.slice(8), size = args.length / 2, head = selector === GOMEZ ? 288 : 64;
    function word(offset) {
      if (offset < 0 || offset + 32 > size) throw new Error("Truncated ABI word.");
      return args.slice(offset * 2, (offset + 32) * 2);
    }
    function length(offset) {
      const n = BigInt("0x" + word(offset));
      if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("ABI offset or length exceeds the available input.");
      return Number(n);
    }
    function stringBytes(slot) {
      const offset = length(slot * 32);
      if (offset < head || offset % 32) throw new Error("Invalid ABI string offset.");
      const count = length(offset), start = offset + 32;
      if (count > size - start) throw new Error("Truncated ABI string.");
      return Uint8Array.from((args.slice(start * 2, (start + count) * 2).match(/../g) || []), function (part) { return parseInt(part, 16); });
    }
    if (size < head) throw new Error("Truncated ABI argument head.");
    const bytes = stringBytes(0), message = text(bytes);
    if (selector === JETHRO) return {kind: "jethro.mapArtifact", methodId: "0x" + selector,
      artifact: message, body: text(stringBytes(1))};

    const receivers = [], amounts = [];
    for (let i = 0; i < 4; i += 1) {
      const address = word((1 + i * 2) * 32);
      if (!/^0{24}/.test(address)) throw new Error("Invalid ABI address padding.");
      receivers.push("0x" + address.slice(24));
      amounts.push(BigInt("0x" + word((2 + i * 2) * 32)).toString());
    }
    let picture = image(bytes), imageEncoding = picture ? "bytes" : "";
    // Historical Gomez images stored each image byte as a Unicode character,
    // then UTF-8 encoded the string (C2/C3 pairs). Repair only recognized images.
    if (!picture && message && Array.from(message).every(function (c) { return c.codePointAt(0) <= 255; })) {
      picture = image(Uint8Array.from(message, function (c) { return c.charCodeAt(0); }));
      if (picture) imageEncoding = "legacy-latin1-utf8";
    }
    return {kind: "gomez.tell", methodId: "0x" + selector, receivers: receivers, amounts: amounts,
      words: Array.from(new Set(receivers.map(addressWord).filter(Boolean))),
      message: picture ? "" : message, payloadBytes: bytes.length, image: picture, imageEncoding: imageEncoding};
  }

  root.CHISEL_EVM_DECODE = {decode: decode, addressWord: addressWord};
})(typeof window !== "undefined" ? window : globalThis);
