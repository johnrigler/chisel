(function (root) {
  "use strict";
  const PROTOCOL = "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut";
  const decoder = new TextDecoder();
  function pushes(hex) {
    const bytes = scriptBytes(hex);
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
  function bFiles(output, index) {
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

  // The byte parser is shared by B://, MAP and ordinal envelope readers.
  function scriptBytes(hex) {
    const prefix = /^[a-f0-9]*/i.exec(String(hex || ""))[0];
    const result = new Uint8Array(Math.floor(prefix.length / 2));
    for (let i = 0; i < result.length; i++) result[i] = parseInt(prefix.slice(i*2,i*2+2),16);
    return result;
  }
  function token(bytes, pos) {
    if (pos >= bytes.length) return null;
    const op = bytes[pos++]; let length = op;
    if (op >= 76 && op <= 78) {
      const count = 1 << (op-76);
      if (pos+count > bytes.length) return null;
      length = 0;
      for (let i=0;i<count;i++) length += bytes[pos++] * 256**i;
    } else if (op > 75) return {op:op,next:pos,complete:true};
    const data = bytes.subarray(pos,Math.min(pos+length,bytes.length));
    return {op:op,data:data,bytes:length,complete:data.length===length,next:pos+length};
  }
  function glbMetadata(data, declaredBytes) {
    if (data.length < 20 || decoder.decode(data.subarray(0,4)) !== "glTF") return null;
    const view = new DataView(data.buffer,data.byteOffset,data.byteLength);
    const version = view.getUint32(4,true), length = view.getUint32(8,true), jsonLength = view.getUint32(12,true);
    if (version !== 2 || length !== declaredBytes || jsonLength > length-20 ||
        jsonLength % 4 || view.getUint32(16,true) !== 0x4e4f534a ||
        jsonLength > 1024*1024 || 20+jsonLength > data.length) return null;
    try {
      const json = JSON.parse(decoder.decode(data.subarray(20,20+jsonLength)));
      if (!json || typeof json !== "object") return null;
      const extras = json.asset && json.asset.extras || {};
      const short = v => typeof v === "string" ? v.slice(0,200) : "";
      const traits = Array.isArray(extras.attributes) ? extras.attributes.slice(0,100).filter(a=>a && typeof a.trait_type==="string").map(a=>({trait:short(a.trait_type),value:typeof a.value==="number"?a.value:short(a.value)})) : [];
      return {format:"GLB",version:version,declaredBytes:length,name:short(extras.name),collection:short(extras.collection),
        meshCount:Array.isArray(json.meshes)?json.meshes.length:0,
        requiredExtensions:Array.isArray(json.extensionsRequired)?json.extensionsRequired.slice(0,40).map(short):[],
        traits:traits};
    } catch (_) { return null; }
  }
  function ordinalFiles(output,index) {
    const script = output && (output.scriptPubKey || output.script) || {};
    const bytes = scriptBytes(typeof script === "string" ? script : script.hex);
    // First supported forms: envelope at script start or after standard P2PKH.
    const p2pkh = bytes[0]===0x76 && bytes[1]===0xa9 && bytes[2]===20 && bytes[23]===0x88 && bytes[24]===0xac;
    let p = p2pkh?25:0;
    if (bytes[p++]!==0 || bytes[p++]!==0x63) return [];
    const marker = token(bytes,p);
    if (!marker || !marker.complete || !marker.data || decoder.decode(marker.data)!=="ord") return [];
    p=marker.next;
    let mime="", body=null;
    for (let i=0;i<64;i++) {
      const field=token(bytes,p);
      if (!field || !field.complete) return [];
      p=field.next;
      if (field.op===0) { body=token(bytes,p); break; }
      const value=token(bytes,p);
      if (!value || !value.complete || !value.data) return [];
      p=value.next;
      if (field.op===0x51 || field.data && field.data.length===1 && field.data[0]===1)
        mime=decoder.decode(value.data).trim().toLowerCase();
    }
    if (!body || !body.data || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime)) return [];
    const closed=body.complete && bytes[body.next]===0x68;
    // A provider-truncated push is a preview, not a valid complete inscription.
    if (!closed && !script.isTruncated && body.complete) return [];
    if (!closed && !script.isTruncated && !body.complete) return [];
    const meta=mime==="model/gltf-binary"?glbMetadata(body.data,body.bytes):null;
    return [{protocol:"1Sat Ordinals",output:output.n==null?index:output.n,part:0,mime:mime,mimeSource:"declared",
      bytes:body.bytes,availableBytes:body.data.length,complete:closed,data:body.data,
      name:meta?meta.name:"",encoding:"",metadata:meta}];
  }
  function mapMetadata(output,index) {
    const script=output && (output.scriptPubKey || output.script) || {};
    const parts=pushes(typeof script==="string"?script:script.hex);
    if (parts.length<2 || !parts[0].complete || !parts[1].complete ||
      decoder.decode(parts[0].data)!=="1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5" ||
      decoder.decode(parts[1].data)!=="SET") return [];
    const fields=[];
    for(let i=2;i+1<parts.length;i+=2) {
      if(!parts[i].complete || !parts[i+1].complete || decoder.decode(parts[i].data)==="|") break;
      fields.push({key:decoder.decode(parts[i].data).slice(0,200),value:decoder.decode(parts[i+1].data).slice(0,1000)});
    }
    return [{protocol:"MAP",output:output.n==null?index:output.n,action:"SET",fields:fields}];
  }
  const registry=Object.freeze([
    {id:"B",files:bFiles},
    {id:"1sat",files:ordinalFiles},
    {id:"map",metadata:mapMetadata}
  ].map(Object.freeze));
  function fromOutput(output,index) {
    return registry.flatMap(entry=>entry.files?entry.files(output,index):[]);
  }
  function metadata(raw) {
    const tx=raw && (raw.tx || raw), outputs=tx && (tx.vout || tx.outputs);
    return Array.isArray(outputs)?outputs.flatMap((output,index)=>registry.flatMap(entry=>entry.metadata?entry.metadata(output,index):[])):[];
  }

  function files(raw) {
    const tx = raw && (raw.tx || raw), outputs = tx && (tx.vout || tx.outputs);
    return Array.isArray(outputs) ? outputs.flatMap(fromOutput) : [];
  }
  function parentInputs(raw) {
    const tx=raw && (raw.tx || raw), inputs=tx && (tx.vin || tx.inputs);
    return Array.isArray(inputs) ? inputs.filter(i=>i && typeof i.txid==="string" && /^[a-f0-9]{64}$/i.test(i.txid) && Number.isInteger(i.vout) && i.vout>=0 && i.vout<=0xffffffff).map(i=>({txid:i.txid.toLowerCase(),vout:i.vout})) : [];
  }
  function summarize(raw) {
    return {files: files(raw).map(function (file) {
      const value = Object.assign({}, file); delete value.data; return value;
    }), metadata: metadata(raw), parentInputs: parentInputs(raw)};
  }
  // External sites are optional protocol-specific navigation targets.
  // The outpoint identifies this inscription output, not verified current ownership.
  function externalLinks(coin, txid, file, metadataRecords) {
    if (coin !== "bsv" || typeof txid !== "string" || !/^[0-9a-f]{64}$/i.test(txid) ||
        !file || file.protocol !== "1Sat Ordinals" || !Number.isInteger(file.output) ||
        file.output < 0 || file.output > 0xffffffff) return [];
    const outpoint = txid.toLowerCase() + "_" + file.output;
    const links = [{label:"View on 1Sat Market",url:"https://1sat.market/outpoint/" + outpoint + "/timeline"}];
    const records = Array.isArray(metadataRecords) ? metadataRecords : [];
    if (records.some(record => record && record.protocol === "MAP" && Array.isArray(record.fields) &&
        record.fields.some(field => field && field.key === "app" && /^(?:zoide|zoidenft)$/i.test(field.value)) &&
        record.fields.some(field => field && field.key === "type" && field.value === "ordinal_mint"))) {
      links.push({label:"View on Zoide",url:"https://zoide.io/market/inscription/" + outpoint});
    }
    return links;
  }
  async function loadFile(coin, txid, file, fetcher, signal) {
    if (!/^(?:bsv|bsvTestnet)$/.test(coin) || !/^[0-9a-f]{64}$/i.test(txid) || !Number.isSafeInteger(file.output) || file.output < 0) throw new Error("Invalid BSV file identity.");
    const url = "https://api.whatsonchain.com/v1/bsv/" + (coin === "bsvTestnet" ? "test" : "main") + "/tx/" + txid + "/out/" + file.output + "/hex";
    const response = await fetcher(url, {signal: signal});
    if (!response.ok) throw new Error("BSV provider HTTP " + response.status);
    let hex = (await response.text()).trim();
    if (hex[0] === '"') hex = JSON.parse(hex);
    if (typeof hex !== "string" || !hex.length || hex.length % 2 || !/^[0-9a-f]+$/i.test(hex)) throw new Error("Provider returned an incomplete output script.");
    const result = fromOutput({n: file.output, scriptPubKey: {hex: hex}}, file.output).find(function (entry) { return entry.part === file.part && entry.protocol === file.protocol; });
    if (!result || !result.complete || result.bytes !== file.bytes || result.mime !== file.mime) throw new Error("Provider file does not match the saved record.");
    if (file.data && !file.data.every(function (byte, i) { return result.data[i] === byte; })) throw new Error("Provider file differs from the saved preview.");
    return result;
  }
  root.CHISEL_BSV_MEDIA = {pushes: pushes, sniff: sniff, fromOutput: fromOutput, files: files, summarize: summarize, loadFile: loadFile, registry: registry, metadata: metadata, glbMetadata: glbMetadata, externalLinks: externalLinks, parentInputs: parentInputs};
})(window);
