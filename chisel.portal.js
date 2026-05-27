(function () {
  "use strict";

  const DEFAULT_DIGIBYTE_TXID = "d8eef1586bb88d192d3284726407c307f0c54b1c023b7ef343e401eb89ea098d";
  const DEFAULT_COLOR_PATH = "b57.json";
  const DEFAULT_THUNDERWORD_INDEX = "digibyteGeneral";
  const DEFAULT_SCALE = 10;
  const DEFAULT_SKIP_PREFIX = 2;
  const DEFAULT_SKIP_SUFFIX = 6;
  const CHECKSUM_LEN = 6;
  const CIDV0_RE = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
  const TXID_RE = /^[0-9a-fA-F]{64}$/;

  const fallbackColors = {
    M: [0, 0, 0], W: [0, 0, 255], B: [51, 51, 51], H: [128, 0, 128],
    "8": [0, 100, 0], E: [47, 79, 79], D: [72, 61, 139], N: [0, 128, 0],
    R: [255, 0, 0], A: [165, 42, 42], Q: [139, 69, 19], G: [199, 21, 133],
    U: [0, 128, 128], Y: [34, 139, 34], Z: [0, 139, 139], C: [153, 50, 204],
    P: [102, 102, 102], F: [255, 20, 147], T: [106, 90, 205], "9": [255, 69, 0],
    L: [70, 130, 180], V: [123, 104, 238], K: [112, 128, 144], X: [205, 92, 92],
    S: [210, 105, 30], J: [186, 85, 211], "7": [147, 112, 219], "5": [60, 179, 113],
    "6": [95, 158, 160], "4": [0, 191, 255], "3": [255, 99, 71], "2": [100, 149, 237],
    "1": [0, 206, 209], y: [153, 153, 153], n: [218, 112, 214], m: [255, 105, 180],
    o: [255, 140, 0], a: [250, 128, 114], e: [72, 209, 204], i: [255, 255, 255],
    p: [224, 224, 224], r: [192, 192, 192], u: [160, 160, 160], z: [255, 0, 255]
  };

  const state = {
    colorMap: null,
    rawJson: null,
    lines: [],
    outputs: [],
    semantics: [],
    currentIndex: null,
    currentTransactions: [],
    selectedTxid: ""
  };

  function $(selector) { return document.querySelector(selector); }

  function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = value == null ? "" : String(value);
  }

  function setStatus(message, isError) {
    const el = $("#portalStatus");
    if (!el) return;
    el.textContent = message || "";
    el.className = isError ? "error" : "muted";
  }

  function pretty(value) { return JSON.stringify(value, null, 2); }
  function safeArray(value) { return Array.isArray(value) ? value : []; }

  function shortTxid(txid) {
    const value = String(txid || "");
    return value.length > 20 ? value.slice(0, 10) + "…" + value.slice(-10) : value;
  }

  function stripChecksum(value) {
    const text = String(value || "");
    return text.length > CHECKSUM_LEN ? text.slice(0, -CHECKSUM_LEN) : text;
  }

  function getMacPayload(line) {
    const stripped = stripChecksum(line);
    return stripped.length >= 3 ? stripped.slice(3) : "";
  }

  function trimMacPadding(value) {
    return String(value || "").replace(/z+$/g, "");
  }

  function macGlyphsToText(value) {
    return trimMacPadding(value)
      .replace(/[xz]/g, " ")
      .replace(/v/g, ".")
      .replace(/w/g, ":")
      .replace(/y/g, "-")
      .replace(/i/g, "I")
      .replace(/o/g, "O")
      .replace(/c/g, "0")
      .replace(/\s+/g, " ")
      .trim();
  }

  function macPayloadToBase58Candidate(value) {
    return trimMacPadding(value).replace(/x/g, "");
  }

  function printableText(value) {
    const text = String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
    return text;
  }

  function truncateText(value, max) {
    const text = printableText(value);
    const limit = max || 96;
    return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
  }

  function isLikelyUrl(value) {
    return /^https?:\/\/\S+/i.test(String(value || "").trim());
  }

  function extractUrls(value) {
    const text = String(value || "");
    return (text.match(/https?:\/\/[^\s"'<>]+/gi) || []).map(function (url) {
      return url.replace(/[),.;]+$/g, "");
    });
  }

  function tryParseJsonText(value) {
    const text = String(value || "").trim();
    if (!text || !/^[\[{]/.test(text)) return null;
    try { return JSON.parse(text); } catch (error) { return null; }
  }

  function describeOpReturnText(text) {
    const clean = printableText(text);
    const parsed = tryParseJsonText(text);
    const urls = extractUrls(text);
    const out = {
      text: clean,
      urls: urls,
      parsedJson: parsed,
      title: ""
    };

    if (parsed && Array.isArray(parsed)) {
      const firstTitle = parsed.map(function (item) {
        if (!item || typeof item !== "object") return "";
        return item.title || item.subject || item.name || item.text || item.url || "";
      }).filter(Boolean)[0];
      out.title = firstTitle ? truncateText(firstTitle, 96) : "OP_RETURN JSON array (" + parsed.length + " items)";
    } else if (parsed && typeof parsed === "object") {
      out.title = truncateText(parsed.title || parsed.subject || parsed.name || parsed.text || parsed.url || "OP_RETURN JSON object", 96);
    } else if (urls.length) {
      out.title = truncateText(urls[0], 96);
    } else {
      out.title = truncateText(clean, 96);
    }

    return out;
  }

  function getOutputAddress(entry) {
    if (!entry) return "";
    if (entry.scriptpubkey_address) return entry.scriptpubkey_address;
    if (entry.scriptPubKey && entry.scriptPubKey.address) return entry.scriptPubKey.address;
    if (entry.scriptPubKey && Array.isArray(entry.scriptPubKey.addresses) && entry.scriptPubKey.addresses.length) {
      return entry.scriptPubKey.addresses[0];
    }
    return "";
  }

  function getOutputType(entry) {
    if (!entry) return "unknown";
    return entry.scriptpubkey_type || (entry.scriptPubKey && entry.scriptPubKey.type) || "unknown";
  }

  function getOutputValue(entry) {
    if (!entry) return undefined;
    if (typeof entry.value !== "undefined") return entry.value;
    if (typeof entry.valueSat !== "undefined") return entry.valueSat;
    if (typeof entry.satoshis !== "undefined") return entry.satoshis;
    return undefined;
  }

  function getOpReturnHex(entry) {
    if (!entry) return "";
    const asm = entry.scriptpubkey_asm || (entry.scriptPubKey && entry.scriptPubKey.asm) || "";
    const parts = String(asm).trim().split(/\s+/).filter(Boolean);
    if (parts[0] === "OP_RETURN" && parts.length) return parts[parts.length - 1];
    const hex = entry.scriptpubkey || (entry.scriptPubKey && entry.scriptPubKey.hex) || "";
    if (/^6a/i.test(hex)) return hex;
    return "";
  }

  function decodeOpReturnScriptHex(hex) {
    let clean = String(hex || "").replace(/\s+/g, "").toLowerCase();
    if (!/^[0-9a-f]*$/.test(clean) || clean.length < 2) return "";
    if (!clean.startsWith("6a")) return clean;
    clean = clean.slice(2);
    if (clean.length < 2) return "";

    const op = parseInt(clean.slice(0, 2), 16);
    if (op > 0 && op <= 75) return clean.slice(2, 2 + op * 2);
    if (op === 76 && clean.length >= 4) {
      const n = parseInt(clean.slice(2, 4), 16);
      return clean.slice(4, 4 + n * 2);
    }
    if (op === 77 && clean.length >= 6) {
      const n = parseInt(clean.slice(2, 6).match(/../g).reverse().join(""), 16);
      return clean.slice(6, 6 + n * 2);
    }
    return clean;
  }

  function hexToUtf8(hex) {
    let clean = String(hex || "").replace(/\s+/g, "");
    if (/^6a/i.test(clean)) clean = decodeOpReturnScriptHex(clean);
    if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2) return "";
    try {
      const pairs = clean.match(/../g) || [];
      const bytes = pairs.map(function (part) { return parseInt(part, 16); });
      return printableText(new TextDecoder().decode(new Uint8Array(bytes)));
    } catch (error) {
      return "";
    }
  }

  function extractTxid(value) {
    if (!value || typeof value !== "object") return "";
    return value.txid || value.hash || value.id || (value.tx && (value.tx.txid || value.tx.hash || value.tx.id)) || "";
  }

  function extractOutputs(value) {
    const tx = value && value.tx && Array.isArray(value.tx.vout) ? value.tx : value;
    return safeArray(tx && tx.vout).map(function (entry, index) {
      const address = getOutputAddress(entry);
      const type = getOutputType(entry);
      const opHex = getOpReturnHex(entry);
      return {
        n: typeof entry.n === "number" ? entry.n : index,
        address: address,
        type: type,
        value: getOutputValue(entry),
        opReturnHex: opHex,
        opReturnText: opHex ? hexToUtf8(opHex) : "",
        raw: entry
      };
    });
  }

  function looksLikeAddressLine(line) {
    return /^[1-9A-HJ-NP-Za-km-z]{26,80}$/.test(String(line || ""));
  }

  function classifyAddressLine(line, index) {
    const text = String(line || "");
    const marker = text.slice(0, 3);
    const first = text.charAt(0);
    const modifier = text.charAt(1);
    const spacer = text.charAt(2);
    const payload = getMacPayload(text);
    const record = {
      kind: "address",
      index: index,
      line: text,
      marker: marker,
      first: first,
      modifier: modifier,
      payload: payload,
      payloadText: macGlyphsToText(payload),
      payloadBase58Candidate: macPayloadToBase58Candidate(payload)
    };

    if ((first === "D" || first === "R") && modifier === "A" && spacer === "x") record.kind = "person";
    else if ((first === "D" || first === "R") && modifier === "B" && spacer === "x") record.kind = "transport";
    else if ((first === "D" || first === "R") && modifier === "C" && spacer === "x") record.kind = "subject";
    else if ((first === "D" || first === "R") && modifier === "D" && spacer === "x") record.kind = "ipfs-v0-first-half";
    else if ((first === "D" || first === "R") && modifier === "E" && spacer === "x") record.kind = "ipfs-v0-second-half";
    else if ((first === "D" || first === "R") && modifier === "D" && spacer !== "x") record.kind = "free-verse";
    else if (first === "S") record.kind = "image-chord-line";
    else if (/^(D+|R+)\w{6}$/.test(text)) record.kind = "thunderword-index";

    return record;
  }

  function pairIpfsRecords(records) {
    const out = [];
    let pending = null;

    records.forEach(function (record) {
      if (record.kind === "ipfs-v0-first-half") {
        pending = record;
        out.push(record);
        return;
      }

      if (record.kind === "ipfs-v0-second-half" && pending && pending.first === record.first) {
        const cid = pending.payloadBase58Candidate + record.payloadBase58Candidate;
        const textCid = pending.payloadText.replace(/\s+/g, "") + record.payloadText.replace(/\s+/g, "");
        out.push(record);
        out.push({
          kind: "ipfs-v0-cid",
          line: pending.line + " + " + record.line,
          firstIndex: pending.index,
          secondIndex: record.index,
          cid: cid,
          textCid: textCid,
          validCidV0Shape: CIDV0_RE.test(cid),
          ipfsUrl: "https://ipfs.io/ipfs/" + cid,
          localIpfsUrl: "http://127.0.0.1:8080/ipfs/" + cid,
          gatewayPath: "/ipfs/" + cid
        });
        pending = null;
        return;
      }

      out.push(record);
    });

    return out;
  }

  function buildSemantics(value, lines) {
    const outputs = extractOutputs(value);
    const lineRecords = lines.filter(looksLikeAddressLine).map(classifyAddressLine);
    const records = pairIpfsRecords(lineRecords);

    outputs.forEach(function (output) {
      if (output.opReturnHex) {
        const payload = describeOpReturnText(output.opReturnText);
        records.push({
          kind: "op-return",
          index: output.n,
          hex: output.opReturnHex,
          text: output.opReturnText,
          title: payload.title,
          urls: payload.urls,
          parsedJson: payload.parsedJson
        });

        payload.urls.forEach(function (url, urlIndex) {
          records.push({
            kind: "op-return-url",
            index: output.n,
            urlIndex: urlIndex,
            url: url
          });
        });

        if (payload.parsedJson) {
          records.push({
            kind: "op-return-json",
            index: output.n,
            value: payload.parsedJson
          });
        }
      }
    });

    return { outputs: outputs, records: records };
  }

  function titleFromSemantics(semantics, txid) {
    const records = semantics && semantics.records ? semantics.records : [];
    const subject = records.find(function (record) { return record.kind === "subject" && printableText(record.payloadText); });
    if (subject) return subject.payloadText;

    const op = records.find(function (record) { return record.kind === "op-return" && printableText(record.title || record.text); });
    if (op) return op.title || op.text;

    const person = records.find(function (record) { return record.kind === "person" && printableText(record.payloadText); });
    if (person) return person.payloadText;

    const cid = records.find(function (record) { return record.kind === "ipfs-v0-cid"; });
    if (cid) return "IPFS " + cid.cid;

    return txid ? "transaction " + shortTxid(txid) : "untitled transaction";
  }

  function primaryUrlFromSemantics(semantics) {
    const records = semantics && semantics.records ? semantics.records : [];
    const direct = records.find(function (record) { return record.kind === "op-return-url" && isLikelyUrl(record.url); });
    if (direct) return direct.url;

    const op = records.find(function (record) {
      return record.kind === "op-return" && record.urls && record.urls.length && isLikelyUrl(record.urls[0]);
    });
    return op ? op.urls[0] : "";
  }

  function renderTitleLink(container, title, url) {
    if (!container) return;
    container.innerHTML = "";
    const label = title || (url ? url : "No transaction selected");
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = label;
      container.appendChild(a);
      return;
    }
    container.textContent = label;
  }

  function collectAddressesFromVout(vout) {
    return safeArray(vout).map(getOutputAddress).filter(Boolean);
  }

  function extractLines(value) {
    if (Array.isArray(value)) return value.filter(function (line) { return typeof line === "string"; });
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value.lines)) return value.lines.filter(function (line) { return typeof line === "string"; });
    if (Array.isArray(value.chord)) return value.chord.filter(function (line) { return typeof line === "string"; });
    if (Array.isArray(value.tablet)) return value.tablet.filter(function (line) { return typeof line === "string"; });
    if (Array.isArray(value.addresses)) return value.addresses.filter(function (line) { return typeof line === "string"; });
    if (Array.isArray(value.vout)) return collectAddressesFromVout(value.vout);
    if (value.tx && Array.isArray(value.tx.vout)) return collectAddressesFromVout(value.tx.vout);
    return [];
  }

  function extractSummary(value, indexEntry) {
    const txid = extractTxid(value);
    const lines = extractLines(value);
    const semantics = buildSemantics(value, lines);
    const title = titleFromSemantics(semantics, txid);
    const imageLines = lines.filter(function (line) { return /^S/.test(line); }).length;
    const ipfsCount = semantics.records.filter(function (record) { return record.kind === "ipfs-v0-cid"; }).length;
    const opText = semantics.records.filter(function (record) { return record.kind === "op-return" && record.text; }).map(function (record) { return record.text; })[0] || "";
    const opUrls = semantics.records.filter(function (record) { return record.kind === "op-return-url"; }).map(function (record) { return record.url; });
    const primaryUrl = primaryUrlFromSemantics(semantics);

    return {
      txid: txid,
      title: title,
      primaryUrl: primaryUrl,
      lines: lines.length,
      imageLines: imageLines,
      ipfsCount: ipfsCount,
      opReturnText: opText,
      opReturnUrls: opUrls,
      blockHeight: value && value.status ? value.status.block_height : value.block_height,
      blockTime: value && value.status ? value.status.block_time : value.block_time,
      explorerUrl: indexEntry && txid && window.CHISEL_THUNDERWORDS ? window.CHISEL_THUNDERWORDS.getTxUrl(indexEntry, txid) : ""
    };
  }

  function renderSemantics(semantics) {
    const box = $("#portalSemanticList");
    const links = $("#portalSemanticLinks");
    const records = semantics && semantics.records ? semantics.records : [];

    if (box) box.textContent = records.length ? pretty(records) : "No Chisel semantic records detected.";

    if (links) {
      links.innerHTML = "";
      records.filter(function (record) { return record.kind === "op-return-url"; }).forEach(function (record) {
        const row = document.createElement("div");
        row.className = "portalLinkRow";

        const label = document.createElement("code");
        label.textContent = record.url;

        const a = document.createElement("a");
        a.className = "secondaryButton";
        a.href = record.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "open OP_RETURN URL";

        row.appendChild(label);
        row.appendChild(a);
        links.appendChild(row);
      });

      records.filter(function (record) { return record.kind === "ipfs-v0-cid"; }).forEach(function (record) {
        const row = document.createElement("div");
        row.className = "portalLinkRow";

        const label = document.createElement("code");
        label.textContent = record.cid + (record.validCidV0Shape ? "" : "  [shape warning]");

        const a = document.createElement("a");
        a.className = "secondaryButton";
        a.href = record.ipfsUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "IPFS gateway";

        const local = document.createElement("a");
        local.className = "secondaryButton";
        local.href = record.localIpfsUrl;
        local.target = "_blank";
        local.rel = "noopener noreferrer";
        local.textContent = "local gateway";

        row.appendChild(label);
        row.appendChild(a);
        row.appendChild(local);
        links.appendChild(row);
      });

      if (!links.childNodes.length) links.textContent = "No OP_RETURN URL or DDx/DEx/RDx/REx IPFS pair found in the selected transaction.";
    }
  }

  function parseRgb(value) {
    if (Array.isArray(value)) return value.map(function (n) { return Number(n); }).slice(0, 3);
    return String(value || "0,0,0").split(",").map(function (part) { return parseInt(part.trim(), 10) || 0; }).slice(0, 3);
  }

  async function loadColorMap(path) {
    const url = path || DEFAULT_COLOR_PATH;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      const map = {};
      if (Array.isArray(data)) {
        data.forEach(function (entry) { if (entry && entry.b57) map[entry.b57] = parseRgb(entry.rgb); });
      } else if (data && typeof data === "object") {
        Object.keys(data).forEach(function (key) { map[key] = parseRgb(data[key]); });
      }
      state.colorMap = Object.keys(map).length ? map : fallbackColors;
      return state.colorMap;
    } catch (error) {
      state.colorMap = fallbackColors;
      setStatus("Color map fetch failed; using built-in fallback colors. " + error.message, false);
      return state.colorMap;
    }
  }

  function bucketLines(lines) {
    const buckets = {};
    lines.forEach(function (line) {
      const key = String(line || "").charAt(0) || "?";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(line);
    });
    return buckets;
  }

  function getImageLines(lines) {
    const preferred = lines.filter(function (line) { return /^S/.test(line); });
    return preferred.length ? preferred : [];
  }

  function getPayload(line, skipPrefix, skipSuffix) {
    const value = String(line || "");
    const start = Math.max(0, Number(skipPrefix) || 0);
    const suffix = Math.max(0, Number(skipSuffix) || 0);
    const end = Math.max(start, value.length - suffix);
    return value.slice(start, end);
  }

  function getColor(ch) {
    const map = state.colorMap || fallbackColors;
    return map[ch] || [255, 0, 255];
  }

  function drawChord(lines) {
    const canvas = $("#portalCanvas");
    if (!canvas) return;
    const scale = Math.max(1, parseInt($("#portalScale").value, 10) || DEFAULT_SCALE);
    const skipPrefix = Math.max(0, parseInt($("#portalSkipPrefix").value, 10));
    const skipSuffix = Math.max(0, parseInt($("#portalSkipSuffix").value, 10));
    const imageLines = getImageLines(lines);
    const wrap = canvas.closest ? canvas.closest(".portalCanvasWrap") : null;
    if (!imageLines.length) {
      canvas.width = 1;
      canvas.height = 1;
      if (wrap) wrap.classList.add("isHidden");
      setText("#portalImageStats", "");
      return;
    }

    if (wrap) wrap.classList.remove("isHidden");
    const payloads = imageLines.map(function (line) { return getPayload(line, skipPrefix, skipSuffix); });
    const cols = payloads.reduce(function (max, row) { return Math.max(max, row.length); }, 0);
    const rows = payloads.length;
    const ctx = canvas.getContext("2d");

    canvas.width = Math.max(1, cols * scale);
    canvas.height = Math.max(1, rows * scale);
    ctx.fillStyle = "rgb(0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    payloads.forEach(function (row, y) {
      for (let x = 0; x < row.length; x += 1) {
        const rgb = getColor(row[x]);
        ctx.fillStyle = "rgb(" + rgb.join(",") + ")";
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    });

    setText("#portalImageStats", rows + " rows × " + cols + " cols, scale " + scale);
  }

  function decodeMacDougall(line) {
    return macGlyphsToText(getMacPayload(line));
  }

  function renderLineList(lines) {
    const list = $("#portalLineList");
    const decoded = $("#portalDecodedLines");
    if (list) list.textContent = lines.join("\n");
    if (decoded) decoded.textContent = lines.map(function (line) { return line + "    " + decodeMacDougall(line); }).join("\n");
  }

  function renderBuckets(lines) {
    const buckets = bucketLines(lines);
    const summary = Object.keys(buckets).sort().map(function (key) { return key + ": " + buckets[key].length; }).join("   ");
    setText("#portalBucketSummary", summary || "No address lines found.");
  }

  function setExplorerLink(selector, href, label) {
    const el = $(selector);
    if (!el) return;
    if (!href) {
      el.removeAttribute("href");
      el.textContent = "";
      el.style.display = "none";
      return;
    }
    el.style.display = "inline-flex";
    el.href = href;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
    el.textContent = label || href;
  }

  async function render(value, sourceLabel, indexEntry) {
    if (!state.colorMap) await loadColorMap($("#portalColorPath") ? $("#portalColorPath").value : DEFAULT_COLOR_PATH);

    state.rawJson = value;
    state.lines = extractLines(value);
    const semantic = buildSemantics(value, state.lines);
    const txid = extractTxid(value);
    const summary = extractSummary(value, indexEntry || state.currentIndex);

    state.outputs = semantic.outputs;
    state.semantics = semantic.records;
    state.selectedTxid = txid;

    renderTitleLink($("#portalSelectedTitle"), summary.title, summary.primaryUrl);
    setText("#portalSelectedTxid", txid || "no txid in loaded object");
    setText("#portalSelectedMeta", [
      summary.blockHeight ? "block " + summary.blockHeight : "",
      summary.lines ? summary.lines + " address lines" : "no address lines",
      summary.imageLines ? summary.imageLines + " image lines" : "",
      summary.ipfsCount ? summary.ipfsCount + " IPFS pair(s)" : ""
    ].filter(Boolean).join(" | "));
    setExplorerLink("#portalSelectedExplorerLink", summary.explorerUrl, "verify tx in explorer");

    renderSemantics(semantic);
    drawChord(state.lines);
    renderLineList(state.lines);
    renderBuckets(state.lines);
    setText("#portalRawJson", pretty(value));
    setStatus("Loaded " + sourceLabel + ": " + (summary.title || shortTxid(txid)) + ".", false);
  }

  async function loadDigibyteTx(txid) {
    const id = String(txid || "").trim();
    if (!TXID_RE.test(id)) throw new Error("Digibyte txid must be 64 hex characters.");
    const url = "https://digiexplorer.info/api/tx/" + encodeURIComponent(id);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Digiexplorer request failed with HTTP " + response.status);
    return response.json();
  }

  function getThunderwords() { return window.CHISEL_THUNDERWORDS || null; }

  function getSelectedIndex() {
    const api = getThunderwords();
    if (!api) throw new Error("CHISEL_THUNDERWORDS is not loaded.");
    const select = $("#portalThunderwordSelect");
    return api.getIndex(select && select.value ? select.value : DEFAULT_THUNDERWORD_INDEX);
  }

  function renderThunderwordOptions() {
    const api = getThunderwords();
    const select = $("#portalThunderwordSelect");
    if (!api || !select) return;

    const existing = select.value || DEFAULT_THUNDERWORD_INDEX;
    select.innerHTML = "";

    api.listIndexes().forEach(function (entry) {
      const option = document.createElement("option");
      option.value = entry.name;
      option.textContent = (entry.ticker || entry.coin || entry.name) + " default index";
      select.appendChild(option);
    });

    select.value = api.registry[existing] ? existing : DEFAULT_THUNDERWORD_INDEX;
    updateThunderwordInfo();
  }

  function updateThunderwordInfo() {
    const api = getThunderwords();
    const address = $("#portalThunderwordAddress");
    if (!api || !address) return;
    const entry = getSelectedIndex();
    state.currentIndex = entry;
    address.value = entry.address || "";
    setExplorerLink("#portalThunderwordExplorerLink", api.getAddressUrl(entry, address.value), "verify index address");
    setText("#portalIndexCaption", (entry.ticker || entry.coin || entry.name) + " index: " + address.value);
  }

  function renderEmptyTransactionList(message) {
    const list = $("#portalTransactionList");
    if (list) list.textContent = message || "No transactions loaded.";
  }

  function makeTransactionCard(result, tx, index) {
    const api = getThunderwords();
    const entry = result.index;
    const rawTx = tx.raw && tx.raw.vout ? tx.raw : null;
    const summary = rawTx ? extractSummary(rawTx, entry) : {
      txid: tx.txid,
      title: "transaction " + shortTxid(tx.txid),
      lines: 0,
      imageLines: 0,
      ipfsCount: 0,
      blockHeight: tx.blockHeight,
      blockTime: tx.blockTime,
      explorerUrl: api ? api.getTxUrl(entry, tx.txid) : ""
    };

    const card = document.createElement("article");
    card.className = "portalTransactionCard";
    card.dataset.txid = tx.txid;

    const h = document.createElement("h3");
    renderTitleLink(h, summary.title || "transaction " + shortTxid(tx.txid), summary.primaryUrl);

    const code = document.createElement("code");
    code.textContent = tx.txid;

    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = [
      summary.blockHeight ? "block " + summary.blockHeight : "unconfirmed/unknown block",
      summary.lines ? summary.lines + " address lines" : "",
      summary.imageLines ? summary.imageLines + " image lines" : "",
      summary.ipfsCount ? summary.ipfsCount + " IPFS pair(s)" : ""
    ].filter(Boolean).join(" | ");

    const actions = document.createElement("div");
    actions.className = "actions";

    const load = document.createElement("button");
    load.type = "button";
    load.className = "secondaryButton";
    load.textContent = rawTx ? "RENDER" : "FETCH + RENDER";
    load.onclick = async function () {
      try {
        setStatus("Loading transaction " + tx.txid + "...", false);
        let json = rawTx;
        if (!json) {
          const loaded = await api.fetchTransaction(entry, tx.txid);
          json = loaded.json;
        }
        await render(json, entry.ticker + " tx " + tx.txid, entry);
        Array.prototype.forEach.call(document.querySelectorAll(".portalTransactionCard"), function (el) {
          el.classList.toggle("isSelected", el.dataset.txid === tx.txid);
        });
      } catch (error) {
        setStatus(error.message || String(error), true);
      }
    };
    actions.appendChild(load);

    if (summary.explorerUrl) {
      const verify = document.createElement("a");
      verify.className = "secondaryButton";
      verify.href = summary.explorerUrl;
      verify.target = "_blank";
      verify.rel = "noopener noreferrer";
      verify.textContent = "verify";
      actions.appendChild(verify);
    }

    card.appendChild(h);
    card.appendChild(code);
    card.appendChild(meta);
    card.appendChild(actions);
    return card;
  }

  function renderThunderwordTxs(result) {
    const list = $("#portalTransactionList");
    if (!list) return;
    list.innerHTML = "";

    state.currentIndex = result.index;
    state.currentTransactions = result.transactions || [];

    if (!result || !result.transactions || !result.transactions.length) {
      renderEmptyTransactionList("No transactions returned for this index.");
      return;
    }

    result.transactions.forEach(function (tx, index) {
      list.appendChild(makeTransactionCard(result, tx, index));
    });
  }

  async function loadThunderwordIndex() {
    const api = getThunderwords();
    const entry = getSelectedIndex();
    const address = $("#portalThunderwordAddress") ? $("#portalThunderwordAddress").value.trim() : entry.address;
    setStatus("Loading " + (entry.ticker || entry.coin || entry.name) + " index...", false);
    const result = await api.fetchAddressTransactions(entry, address);
    renderThunderwordTxs(result);
    setText("#portalThunderwordRaw", pretty({ source: result.url, transactions: result.transactions }));
    setStatus("Loaded " + result.transactions.length + " transaction(s).", false);

    const firstRenderable = result.transactions.find(function (tx) { return tx.raw && tx.raw.vout; });
    if (firstRenderable) await render(firstRenderable.raw, entry.ticker + " tx " + firstRenderable.txid, entry);
  }

  function getPortalFirstCharacter() {
    const entry = state.currentIndex || (function () { try { return getSelectedIndex(); } catch (error) { return null; } })();
    if (entry && entry.address) return String(entry.address).charAt(0) || "D";
    return "D";
  }

  async function buildPortalMacDougall() {
    const second = $("#portalMacKind") ? $("#portalMacKind").value : "C";
    const phrase = $("#portalMacPhrase") ? $("#portalMacPhrase").value.trim() : "";
    const first = getPortalFirstCharacter();
    const prefix = first + second + "x";

    if (!phrase) throw new Error("Portal MacDougall phrase is required.");
    if (!window.CHISEL_UNSPENDABLE || typeof window.CHISEL_UNSPENDABLE.inspect !== "function") {
      throw new Error("chisel.unspendable.js is required before Portal can build MacDougall addresses.");
    }

    const row = await window.CHISEL_UNSPENDABLE.inspect(prefix, phrase);
    const readable = classifyAddressLine(row.address, 0);

    setText("#portalMacPrefix", row.prefix + row.encodedBody);
    setText("#portalMacAddress", row.address);
    setText("#portalMacReadable", readable.payloadText);

    return row;
  }

  async function usePortalMacAsIndex() {
    const row = await buildPortalMacDougall();
    const address = $("#portalThunderwordAddress");
    const api = getThunderwords();
    const entry = getSelectedIndex();
    if (address) address.value = row.address;
    state.currentIndex = Object.assign({}, entry, { address: row.address });
    if (api) setExplorerLink("#portalThunderwordExplorerLink", api.getAddressUrl(entry, row.address), "verify index address");
    setText("#portalIndexCaption", (entry.ticker || entry.coin || entry.name) + " custom index: " + row.address);
    setStatus("Using generated address as the current index address. It is only useful after transactions exist on that address.", false);
  }

  async function buildGeneratedThunderwordIndexes() {
    const api = getThunderwords();
    if (!api || typeof api.buildGeneratedIndexes !== "function") return;
    const rows = await api.buildGeneratedIndexes();
    renderThunderwordOptions();
    setText("#portalThunderwordRaw", pretty(rows));
    setStatus("Generated " + rows.length + " candidate indexes from installed coin prefixes.", false);
  }

  function bind() {
    const loadTx = $("#portalLoadTxButton");
    const redraw = $("#portalRedrawButton");
    const thunderSelect = $("#portalThunderwordSelect");
    const loadThunderword = $("#portalLoadThunderwordButton");
    const generateThunderwords = $("#portalGenerateThunderwordsButton");
    const buildMac = $("#portalBuildMacButton");
    const useMac = $("#portalUseMacAsIndexButton");

    if (!loadThunderword) return;

    if ($("#portalTxid")) $("#portalTxid").value = DEFAULT_DIGIBYTE_TXID;
    if ($("#portalColorPath")) $("#portalColorPath").value = DEFAULT_COLOR_PATH;
    if ($("#portalScale")) $("#portalScale").value = String(DEFAULT_SCALE);
    if ($("#portalSkipPrefix")) $("#portalSkipPrefix").value = String(DEFAULT_SKIP_PREFIX);
    if ($("#portalSkipSuffix")) $("#portalSkipSuffix").value = String(DEFAULT_SKIP_SUFFIX);

    renderThunderwordOptions();
    renderEmptyTransactionList("Select a currency index and load transactions.");

    if (loadTx) loadTx.onclick = async function () {
      try {
        const api = getThunderwords();
        const entry = api ? api.getIndex("digibyteGeneral") : state.currentIndex;
        setStatus("Loading Digibyte transaction from public explorer...", false);
        await render(await loadDigibyteTx($("#portalTxid").value), "Digibyte tx " + $("#portalTxid").value.trim(), entry);
      } catch (error) {
        setStatus(error.message || String(error), true);
      }
    };

    if (redraw) redraw.onclick = async function () {
      try {
        await loadColorMap($("#portalColorPath").value);
        await render(state.rawJson || { lines: state.lines }, "current transaction", state.currentIndex);
      } catch (error) {
        setStatus(error.message || String(error), true);
      }
    };

    if (thunderSelect) thunderSelect.onchange = updateThunderwordInfo;

    loadThunderword.onclick = async function () {
      try { await loadThunderwordIndex(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (generateThunderwords) generateThunderwords.onclick = async function () {
      try { await buildGeneratedThunderwordIndexes(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (buildMac) buildMac.onclick = async function () {
      try {
        const row = await buildPortalMacDougall();
        setStatus("Built " + row.address + ".", false);
      } catch (error) { setStatus(error.message || String(error), true); }
    };

    if (useMac) useMac.onclick = async function () {
      try { await usePortalMacAsIndex(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    loadColorMap(DEFAULT_COLOR_PATH).catch(function (error) {
      setStatus(error.message || String(error), true);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  window.CHISEL_PORTAL = {
    extractLines: extractLines,
    drawChord: drawChord,
    render: render,
    loadDigibyteTx: loadDigibyteTx,
    loadColorMap: loadColorMap,
    loadThunderwordIndex: loadThunderwordIndex,
    renderThunderwordOptions: renderThunderwordOptions,
    buildSemantics: buildSemantics,
    renderSemantics: renderSemantics,
    extractSummary: extractSummary,
    titleFromSemantics: titleFromSemantics,
    describeOpReturnText: describeOpReturnText,
    buildPortalMacDougall: buildPortalMacDougall,
    state: state
  };
})();
