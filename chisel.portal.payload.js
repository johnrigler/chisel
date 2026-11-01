(function (root) {
  "use strict";

  function base64(bytes) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let text = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      text += alphabet[(n >>> 18) & 63] + alphabet[(n >>> 12) & 63] +
        (i + 1 < bytes.length ? alphabet[(n >>> 6) & 63] : "=") +
        (i + 2 < bytes.length ? alphabet[n & 63] : "=");
    }
    return text;
  }

  function describe(hex) {
    const clean = String(hex || "").toLowerCase();
    if (!/^(?:[0-9a-f]{2})*$/.test(clean)) throw new Error("Invalid payload HEX.");
    const bytes = Uint8Array.from(clean.match(/../g) || [], function (pair) { return parseInt(pair, 16); });
    let text = "", kind = "binary";
    try {
      const decoded = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(bytes);
      if (!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(decoded)) {
        text = decoded;
        kind = bytes.every(function (byte) { return byte < 128; }) ? "ascii" : "utf8";
      }
    } catch (_) {}
    return {hex: clean, bytes: bytes.length, kind: kind, text: text, base64: base64(bytes),
      label: kind === "binary" ? "Binary OP_RETURN · " + bytes.length + " bytes" :
        (kind === "ascii" ? "ASCII" : "UTF-8") + " · " + bytes.length + " bytes"};
  }

  function fromScript(script) {
    const clean = String(script || "").toLowerCase();
    if (!/^6a(?:[0-9a-f]{2})*$/.test(clean)) throw new Error("Invalid OP_RETURN script HEX.");
    const bytes = Uint8Array.from(clean.match(/../g), function (pair) { return parseInt(pair, 16); });
    let offset = 1, hex = "";
    while (offset < bytes.length) {
      const op = bytes[offset++];
      let length = op;
      if (op >= 76 && op <= 78) {
        const width = 1 << (op - 76);
        if (offset + width > bytes.length) throw new Error("Truncated OP_RETURN push length.");
        length = 0;
        for (let i = 0; i < width; i += 1) length += bytes[offset++] * Math.pow(256, i);
      } else if (op > 75) throw new Error("Non-push opcode in OP_RETURN.");
      if (offset + length > bytes.length) throw new Error("Truncated OP_RETURN payload.");
      hex += clean.slice(offset * 2, (offset + length) * 2);
      offset += length;
    }
    return Object.assign(describe(hex), {scriptHex: clean});
  }

  function fromOutput(output) {
    const entry = output || {}, scriptPubKey = entry.scriptPubKey || {};
    const script = String(entry.script || entry.scriptpubkey || scriptPubKey.hex || "");
    const asm = String(entry.scriptpubkey_asm || scriptPubKey.asm || "").trim();
    if (!/^6a/i.test(script) && !/^OP_RETURN(?:\s|$)/i.test(asm)) return null;
    try {
      if (/^6a/i.test(script)) return fromScript(script);
      const parts = asm.split(/\s+/).slice(1).filter(function (part) { return !/^OP_/i.test(part); });
      return Object.assign(describe(parts.map(function (part) { return part.replace(/^0x/i, ""); }).join("")), {scriptHex: ""});
    } catch (error) {
      return {hex: "", scriptHex: script, bytes: null, kind: "invalid", text: "", base64: "",
        label: "Malformed OP_RETURN script", error: error.message};
    }
  }

  root.CHISEL_PORTAL_PAYLOAD = {describe: describe, fromScript: fromScript, fromOutput: fromOutput};
})(window);
