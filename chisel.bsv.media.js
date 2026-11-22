(function (root) {
  "use strict";
  const PROTOCOL = "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut";
  const decoder = new TextDecoder();
  function pushes(hex) {
    const value = String(hex || ""), prefix = /^(?:[a-f0-9]{2})*/i.exec(value)[0];
    const bytes = Uint8Array.from(prefix.match(/../g) || [], function (part) { return parseInt(part, 16); });
    let pos = bytes[0] === 0 && bytes[1] === 106 ? 2 : bytes[0] === 106 ? 1 : -1;
    if (pos < 0) return [];
    const result = [];
    while (pos < bytes.length) {
      const op = bytes[pos++];
      let length = op;
      if (op >= 76 && op <= 78) {
        const count = 1 << (op - 76);
        if (pos + count > bytes.length) break;
        length = 0;
        for (let i = 0; i < count; i += 1) length += bytes[pos++] * Math.pow(256, i);
      } else if (op > 75) break;
      const data = bytes.slice(pos, Math.min(pos + length, bytes.length));
      result.push({data: data, bytes: length, complete: data.length === length});
      pos += length;
    }
    return result;
  }
  function sniff(data) {
    const starts = function (signature) { return signature.every(function (v, i) { return data[i] === v; }); };
    if (starts([255, 216, 255])) return "image/jpeg";
    if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return "image/png";
    if (/^GIF8[79]a/.test(decoder.decode(data.slice(0, 6)))) return "image/gif";
    if (decoder.decode(data.slice(0, 4)) === "RIFF" && decoder.decode(data.slice(8, 12)) === "WEBP") return "image/webp";
    return "";
  }
  function fromOutput(output, index) {
    const script = output && (output.scriptPubKey || output.script) || {};
    const parts = pushes(typeof script === "string" ? script : script.hex), files = [];
    parts.forEach(function (part, i) {
      if (!part.complete || decoder.decode(part.data) !== PROTOCOL || !parts[i + 1]) return;
      const payload = parts[i + 1], declared = parts[i + 2] && parts[i + 2].complete ? decoder.decode(parts[i + 2].data).trim().toLowerCase() : "";
      const mime = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(declared) ? declared : sniff(payload.data);
      if (!mime) return;
      files.push({protocol: "B", output: output.n == null ? index : output.n, part: i + 1,
        mime: mime, mimeSource: declared === mime ? "declared" : "signature", bytes: payload.bytes,
        availableBytes: payload.data.length, complete: payload.complete,
        encoding: parts[i + 3] && parts[i + 3].complete ? decoder.decode(parts[i + 3].data).slice(0, 40) : "",
        name: parts[i + 4] && parts[i + 4].complete ? decoder.decode(parts[i + 4].data).slice(0, 200) : "",
        data: payload.data});
    });
    return files;
  }
  function files(raw) {
    const tx = raw && (raw.tx || raw), outputs = tx && (tx.vout || tx.outputs);
    return Array.isArray(outputs) ? outputs.flatMap(fromOutput) : [];
  }
  function summarize(raw) {
    return {files: files(raw).map(function (file) {
      const value = Object.assign({}, file); delete value.data; return value;
    })};
  }
  async function loadFile(coin, txid, file, fetcher, signal) {
    if (!/^(?:bsv|bsvTestnet)$/.test(coin) || !/^[0-9a-f]{64}$/i.test(txid) || !Number.isSafeInteger(file.output) || file.output < 0) throw new Error("Invalid BSV file identity.");
    const url = "https://api.whatsonchain.com/v1/bsv/" + (coin === "bsvTestnet" ? "test" : "main") + "/tx/" + txid + "/out/" + file.output + "/hex";
    const response = await fetcher(url, {signal: signal});
    if (!response.ok) throw new Error("Image provider HTTP " + response.status);
    let hex = (await response.text()).trim();
    if (hex[0] === '"') hex = JSON.parse(hex);
    if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error("Provider returned an incomplete output script.");
    const result = fromOutput({n: file.output, scriptPubKey: {hex: hex}}, file.output).find(function (entry) { return entry.part === file.part; });
    if (!result || !result.complete || result.bytes !== file.bytes || result.mime !== file.mime) throw new Error("Provider file does not match the saved record.");
    if (file.data && !file.data.every(function (byte, i) { return result.data[i] === byte; })) throw new Error("Provider file differs from the saved preview.");
    return result;
  }
  root.CHISEL_BSV_MEDIA = {pushes: pushes, sniff: sniff, fromOutput: fromOutput, files: files, summarize: summarize, loadFile: loadFile};
})(window);
