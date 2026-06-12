(function () {
  "use strict";

  const DEFAULT_DIGIBYTE_TXID = "d8eef1586bb88d192d3284726407c307f0c54b1c023b7ef343e401eb89ea098d";
  const DEFAULT_COLOR_PATH = "b57.json";
  const DEFAULT_THUNDERWORD_INDEX = "digibyteGeneral";
  const DEFAULT_FILE_PROXY_URL = "http://127.0.0.1:7799";
  const DEFAULT_SCALE = 10;
  const DEFAULT_SKIP_PREFIX = 2;
  const DEFAULT_SKIP_SUFFIX = 6;
  const CHECKSUM_LEN = 6;
  const CIDV0_RE = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
  const TXID_RE = /^[0-9a-fA-F]{64}$/;
  const DEFAULT_CONFIG_PATH = "chisel.portal.config.json";
  const DEFAULT_PORTAL_CONFIG = {
    fileProxyUrl: DEFAULT_FILE_PROXY_URL,
    autoSaveFetchedTransactions: true,
    localFirstTransactions: true,
    autoLoadLocalTransactions: true,
    pollLocalTransactionsMs: 5000,
    autoSelectNewest: true,
    saveDiscoveredLinks: true,
    rabbitTrailSenders: true,
    maxRabbitTrails: 24,
    maxTransactionsPerStream: 80
  };

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
    selectedTxid: "",
    currentSavedPath: "",
    localTransactions: [],
    localAssetPaths: [],
    portalRows: [],
    portalRowKeys: Object.create(null),
    selectedRowKey: "",
    config: Object.assign({}, DEFAULT_PORTAL_CONFIG),
    localPollTimer: null
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

  const MACDOUGALL_TEXT_OVERRIDES = {
    "LET-S DANCE": "Let's Dance",
    "EYES OF THE WORLD": "Eyes of the World",
    "YOuTUBE.COM": "YouTube.com",
    "YOUTUBE.COM": "YouTube.com"
  };

  function titleCaseMacDougallText(value) {
    const smallWords = {
      A: true, AN: true, AND: true, AS: true, AT: true, BUT: true, BY: true, FOR: true,
      FROM: true, IN: true, INTO: true, NOR: true, OF: true, ON: true, OR: true, THE: true,
      TO: true, VIA: true, VS: true, WITH: true
    };
    const words = String(value || "").split(/(\s+)/);
    let wordIndex = 0;
    const wordTotal = words.filter(function (part) { return /\S/.test(part); }).length;
    return words.map(function (part) {
      if (!/\S/.test(part)) return part;
      wordIndex += 1;
      if (/^(IPFS|DGB|RVN|LTC|BTC|ETH|EVM|SHA256|URL|URI|JSON)$/i.test(part)) return part.toUpperCase();
      if (wordIndex > 1 && wordIndex < wordTotal && smallWords[part.toUpperCase()]) return part.toLowerCase();
      return part.split(/(-)/).map(function (chunk) {
        if (chunk === "-") return chunk;
        if (!chunk) return chunk;
        const lower = chunk.toLowerCase();
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }).join("");
    }).join("");
  }

  function normalizeMacDougallText(value) {
    let text = printableText(value);
    if (!text) return "";
    text = text.replace(/\bLET-S\b/gi, "Let's")
      .replace(/\bI-M\b/gi, "I'm")
      .replace(/\bCAN-T\b/gi, "Can't")
      .replace(/\bDON-T\b/gi, "Don't")
      .replace(/\bWON-T\b/gi, "Won't")
      .replace(/\bWE-RE\b/gi, "We're")
      .replace(/\bYOU-RE\b/gi, "You're")
      .replace(/\bTHEY-RE\b/gi, "They're")
      .replace(/\bIT-S\b/gi, "It's");
    const upperKey = text.toUpperCase();
    if (MACDOUGALL_TEXT_OVERRIDES[upperKey]) return MACDOUGALL_TEXT_OVERRIDES[upperKey];
    if (/^[A-Z0-9 .:'\-]+$/.test(text) && /[A-Z]/.test(text) && !/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(text)) {
      text = titleCaseMacDougallText(text);
    }
    return text;
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
    const urls = (text.match(/https?:\/\/[^\s"'<>]+/gi) || []).map(function (url) {
      return url.replace(/[),.;]+$/g, "");
    });
    const spotify = text.match(/spotify:track:([A-Za-z0-9]+)/i);
    if (spotify) urls.push("https://open.spotify.com/track/" + spotify[1]);
    const youtubeId = text.match(/youtube:(?:video:)?([A-Za-z0-9_-]{6,})/i);
    if (youtubeId) urls.push("https://www.youtube.com/watch?v=" + youtubeId[1]);
    return urls;
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
    } else if (/spotify:track:/i.test(clean)) {
      out.title = "Spotify track " + clean.replace(/^.*spotify:track:/i, "");
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

  function isMacDougallFirst(value) {
    return /^[1-9A-HJ-NP-Za-km-z]$/.test(String(value || ""));
  }

  function isRepeatedThunderword(value) {
    const text = String(value || "");
    if (!/^[1-9A-HJ-NP-Za-km-z]{30,40}$/.test(text)) return false;
    const first = text.charAt(0);
    if (!isMacDougallFirst(first) || first === "S") return false;
    let run = 0;
    while (text.charAt(run) === first) run += 1;
    return run >= 16 && text.length - run <= CHECKSUM_LEN + 2;
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
      displayText: normalizeMacDougallText(macGlyphsToText(payload)),
      payloadBase58Candidate: macPayloadToBase58Candidate(payload)
    };

    if (first === "S") record.kind = "image-chord-line";
    else if (isMacDougallFirst(first) && modifier === "A" && spacer === "x") record.kind = "person";
    else if (isMacDougallFirst(first) && modifier === "B" && spacer === "x") record.kind = "transport";
    else if (isMacDougallFirst(first) && modifier === "C" && spacer === "x") record.kind = "subject";
    else if (isMacDougallFirst(first) && modifier === "D" && spacer === "x") record.kind = "ipfs-v0-first-half";
    else if (isMacDougallFirst(first) && modifier === "E" && spacer === "x") record.kind = "ipfs-v0-second-half";
    else if (isMacDougallFirst(first) && modifier === "D" && spacer !== "x") record.kind = "free-verse";
    else if (isRepeatedThunderword(text)) record.kind = "thunderword-index";

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
          displayText: cid,
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
    const subject = records.find(function (record) { return record.kind === "subject" && printableText(record.displayText || record.payloadText); });
    if (subject) return subject.displayText || subject.payloadText;

    const op = records.find(function (record) { return record.kind === "op-return" && printableText(record.title || record.text); });
    if (op) return op.title || op.text;

    const person = records.find(function (record) { return record.kind === "person" && printableText(record.displayText || record.payloadText); });
    if (person) return person.displayText || person.payloadText;

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

  function getInputAddress(input) {
    if (!input || typeof input !== "object") return "";
    if (input.prevout && input.prevout.scriptpubkey_address) return input.prevout.scriptpubkey_address;
    if (input.prevOut && input.prevOut.addr) return input.prevOut.addr;
    if (input.addr) return input.addr;
    if (input.address) return input.address;
    if (input.scriptSig && input.scriptSig.address) return input.scriptSig.address;
    return "";
  }

  function extractInputAddresses(value) {
    const tx = value && value.tx && Array.isArray(value.tx.vin) ? value.tx : value;
    const seen = new Set();
    const out = [];
    safeArray(tx && tx.vin).forEach(function (input) {
      const address = getInputAddress(input);
      if (!address || seen.has(address)) return;
      seen.add(address);
      out.push(address);
    });
    return out;
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
      imageChordLines: lines.filter(function (line) { return /^S/.test(line); }),
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
    const currentEntry = state.currentIndex;

    if (box) box.textContent = records.length ? pretty(records) : "No Chisel semantic records detected.";

    if (!links) return;
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
      a.textContent = record.url.indexOf("spotify.com") >= 0 ? "open Spotify" : (record.url.indexOf("youtu") >= 0 ? "open YouTube" : "open URL");

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

    records.filter(function (record) {
      return record.line && looksLikeAddressLine(record.line) && record.kind !== "image-chord-line";
    }).forEach(function (record) {
      const row = document.createElement("div");
      row.className = "portalLinkRow";

      const label = document.createElement("code");
      const decoded = printableText(record.displayText || record.payloadText || "");
      const rawDecoded = printableText(record.payloadText || "");
      label.textContent = record.kind + ": " + record.line + (decoded ? "  =>  " + decoded : "") + (rawDecoded && rawDecoded !== decoded ? "  [raw: " + rawDecoded + "]" : "");

      const targetEntry = inferIndexForAddress(record.line, currentEntry);
      row.appendChild(label);
      row.appendChild(makeDrillButton(record.line, targetEntry, decoded || record.line));
      row.appendChild(makeAddressExplorerLink(record.line, targetEntry));
      links.appendChild(row);
    });

    if (!links.childNodes.length) {
      links.textContent = "No OP_RETURN URL, IPFS pair, or non-image address target found in the selected transaction.";
    }
  }


  function buildDiscoveredLinkPacket(txid, semantics, indexEntry) {
    const records = semantics && semantics.records ? semantics.records : [];
    const displayTitle = titleFromSemantics({ records: records }, txid);
    const urls = uniqueBy(records.filter(function (record) { return record.kind === "op-return-url"; }), function (record) { return record.url; });
    const ipfsRecords = uniqueBy(records.filter(function (record) { return record.kind === "ipfs-v0-cid"; }), function (record) { return record.cid; });
    const addressRecords = uniqueBy(records.filter(function (record) { return record.line && looksLikeAddressLine(record.line) && record.kind !== "image-chord-line"; }), function (record) { return record.line; });
    return {
      txid: txid || "",
      coin: (indexEntry && (indexEntry.coin || indexEntry.ticker || indexEntry.name)) || "unknown",
      generatedAt: new Date().toISOString(),
      displayTitle: displayTitle,
      urls: urls.map(function (record) { return record.url; }),
      targets: urls.map(function (record) {
        return { type: "url", url: record.url, label: displayTitle || record.url, source: "op_return" };
      }).concat(ipfsRecords.map(function (record) {
        return { type: "ipfs", cid: record.cid, url: record.ipfsUrl, local: record.localIpfsUrl, label: displayTitle || record.cid, valid: record.validCidV0Shape };
      })),
      ipfs: ipfsRecords.map(function (record) { return { cid: record.cid, valid: record.validCidV0Shape, gateway: record.ipfsUrl, local: record.localIpfsUrl, label: displayTitle || record.cid }; }),
      addresses: addressRecords.map(function (record) {
        const targetEntry = inferIndexForAddress(record.line, indexEntry);
        return {
          kind: record.kind,
          address: record.line,
          coin: coinLabel(targetEntry),
          marker: record.marker,
          decoded: record.displayText || record.payloadText || "",
          rawDecoded: record.payloadText || ""
        };
      })
    };
  }

  async function saveDiscoveredLinksMaybe(txid, semantics, indexEntry) {
    if (!configBool("saveDiscoveredLinks", true)) return null;
    if (!TXID_RE.test(String(txid || ""))) return null;
    const packet = buildDiscoveredLinkPacket(txid, semantics, indexEntry);
    if (!packet.urls.length && !packet.ipfs.length && !packet.addresses.length) return null;
    try {
      return await fileProxyPostJson("/save-links", {
        txid: txid,
        coin: packet.coin,
        json: packet
      });
    } catch (error) {
      console.warn("Portal link save skipped:", error);
      return null;
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

  function paintChordCanvas(canvas, lines, opts) {
    if (!canvas) return { rows: 0, cols: 0, scale: 0 };
    const options = opts || {};
    const scale = Math.max(1, Number(options.scale) || 2);
    const skipPrefix = Math.max(0, Number(options.skipPrefix == null ? DEFAULT_SKIP_PREFIX : options.skipPrefix) || 0);
    const skipSuffix = Math.max(0, Number(options.skipSuffix == null ? DEFAULT_SKIP_SUFFIX : options.skipSuffix) || 0);
    const imageLines = getImageLines(lines || []);
    if (!imageLines.length) {
      canvas.width = 1;
      canvas.height = 1;
      return { rows: 0, cols: 0, scale: scale };
    }

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

    return { rows: rows, cols: cols, scale: scale };
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
    const stats = paintChordCanvas(canvas, imageLines, { scale: scale, skipPrefix: skipPrefix, skipSuffix: skipSuffix });
    setText("#portalImageStats", stats.rows + " rows × " + stats.cols + " cols, scale " + stats.scale);
  }

  function imageChordLinesFromRow(row) {
    const summary = row && row.summary ? row.summary : {};
    if (Array.isArray(summary.imageChordLines) && summary.imageChordLines.length) return summary.imageChordLines;
    if (row && row.raw) return getImageLines(extractLines(row.raw));
    return [];
  }

  function appendRowThumbnail(cell, row) {
    const lines = imageChordLinesFromRow(row);
    if (!lines.length) {
      cell.className += " isEmpty";
      cell.textContent = "";
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.className = "portalStreamThumbCanvas";
    canvas.title = "Base57 image carried by this transaction";
    paintChordCanvas(canvas, lines, { scale: 2, skipPrefix: DEFAULT_SKIP_PREFIX, skipSuffix: DEFAULT_SKIP_SUFFIX });
    cell.appendChild(canvas);
  }

  function decodeMacDougall(line) {
    const raw = macGlyphsToText(getMacPayload(line));
    const display = normalizeMacDougallText(raw);
    return display && display !== raw ? display + "    [raw: " + raw + "]" : raw;
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

  function cloneIndexForAddress(entry, address, label) {
    const base = entry || getSelectedIndex();
    return Object.assign({}, base, {
      address: String(address || "").trim(),
      label: label || ((base && (base.ticker || base.coin || base.name)) || "coin") + " address stream"
    });
  }

  function loadAddressStream(address, entry, label) {
    const clean = String(address || "").trim();
    if (!clean) return Promise.reject(new Error("Address is required."));
    const cloned = cloneIndexForAddress(entry || getSelectedIndex(), clean, label || clean);
    state.currentIndex = cloned;
    if ($("#portalThunderwordAddress")) $("#portalThunderwordAddress").value = clean;
    setExplorerLink("#portalThunderwordExplorerLink", getThunderwords() ? getThunderwords().getAddressUrl(cloned, clean) : "", "verify address");
    setText("#portalIndexCaption", (cloned.ticker || cloned.coin || cloned.name || "coin") + " stream: " + clean);
    return loadAddressIndex(cloned, clean);
  }

  function makeDrillButton(address, entry, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondaryButton";
    button.textContent = "drill";
    button.title = "Load this address as a rabbit-trail stream";
    button.onclick = function () {
      loadAddressStream(address, entry || state.currentIndex, label || address).catch(function (error) {
        setStatus(error.message || String(error), true);
      });
    };
    return button;
  }

  function inferIndexForAddress(address, fallbackEntry) {
    const api = getThunderwords();
    const text = String(address || "").trim();
    if (!api || !text) return fallbackEntry || state.currentIndex;

    const indexes = api.listIndexes();
    const first = text.charAt(0);
    const lower = text.toLowerCase();

    const exact = indexes.find(function (entry) {
      return String(entry.address || "").toLowerCase() === lower;
    });
    if (exact) return exact;

    const byRoot = indexes.find(function (entry) {
      const root = String(entry.address || "").charAt(0);
      return root && root === first;
    });
    if (byRoot) return byRoot;

    if (/^0x[0-9a-fA-F]{40}$/.test(text)) {
      const evm = indexes.find(function (entry) { return /polygon|matic|evm/i.test([entry.coin, entry.ticker, entry.name, entry.label].join(" ")); });
      if (evm) return evm;
    }

    return fallbackEntry || state.currentIndex;
  }

  function makeAddressExplorerLink(address, entry) {
    const api = getThunderwords();
    const inferred = inferIndexForAddress(address, entry);
    const url = api && inferred ? api.getAddressUrl(inferred, address) : "";
    if (!url) return document.createTextNode("");
    const a = document.createElement("a");
    a.className = "secondaryButton";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "explorer";
    a.title = "Explorer profile: " + coinLabel(inferred);
    return a;
  }

  function uniqueBy(items, keyFn) {
    const seen = new Set();
    const out = [];
    safeArray(items).forEach(function (item) {
      const key = String(keyFn(item) || "");
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out;
  }



  function configValue(name, fallback) {
    return Object.prototype.hasOwnProperty.call(state.config || {}, name) ? state.config[name] : fallback;
  }

  function configBool(name, fallback) {
    const value = configValue(name, fallback);
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return !/^(false|0|no|off)$/i.test(value);
    return !!value;
  }

  async function loadPortalConfig() {
    const directUrls = [DEFAULT_CONFIG_PATH];
    const proxyBase = String((state.config && state.config.fileProxyUrl) || DEFAULT_FILE_PROXY_URL).replace(/\/+$/, "");
    directUrls.unshift(proxyBase + "/config?path=" + encodeURIComponent(DEFAULT_CONFIG_PATH));

    for (let i = 0; i < directUrls.length; i += 1) {
      try {
        const response = await fetch(directUrls[i], { cache: "no-store" });
        if (!response.ok) continue;
        const json = await response.json();
        if (json && json.ok && json.config) return Object.assign({}, DEFAULT_PORTAL_CONFIG, json.config);
        if (json && !json.ok) continue;
        return Object.assign({}, DEFAULT_PORTAL_CONFIG, json);
      } catch (error) {}
    }

    return Object.assign({}, DEFAULT_PORTAL_CONFIG);
  }

  function applyPortalConfig(config) {
    state.config = Object.assign({}, DEFAULT_PORTAL_CONFIG, config || {});
    const proxy = $("#portalFileProxyUrl");
    if (proxy && state.config.fileProxyUrl) proxy.value = String(state.config.fileProxyUrl);
    const auto = $("#portalAutoSaveFetchedTxs");
    if (auto) auto.checked = configBool("autoSaveFetchedTransactions", true);
  }

  function getFileProxyUrl() {
    const input = $("#portalFileProxyUrl");
    return String((input && input.value) || configValue("fileProxyUrl", DEFAULT_FILE_PROXY_URL) || DEFAULT_FILE_PROXY_URL).replace(/\/+$/, "");
  }

  function getLocalCoin() {
    const input = $("#portalLocalCoin");
    return String((input && input.value) || "").trim();
  }

  async function fileProxyJson(path, params) {
    const query = new URLSearchParams(params || {});
    const url = getFileProxyUrl() + path + (String(query) ? "?" + String(query) : "");
    const response = await fetch(url, { cache: "no-store" });
    const json = await response.json().catch(function () { return null; });
    if (!response.ok || !json || json.ok === false) {
      throw new Error((json && json.error) || (url + " failed with HTTP " + response.status));
    }
    return json;
  }

  async function fileProxyPostJson(path, body) {
    const url = getFileProxyUrl() + path;
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const json = await response.json().catch(function () { return null; });
    if (!response.ok || !json || json.ok === false) {
      throw new Error((json && json.error) || (url + " failed with HTTP " + response.status));
    }
    return json;
  }

  function getCurrentCoinName(indexEntry) {
    const entry = indexEntry || state.currentIndex || (function () {
      try { return getSelectedIndex(); } catch (error) { return null; }
    })();
    return String((entry && (entry.coin || entry.ticker || entry.name)) || getLocalCoin() || "unknown").toLowerCase();
  }

  async function saveTransactionToFileProxy(tx, txid, indexEntry) {
    const raw = tx || state.rawJson;
    const id = String(txid || extractTxid(raw) || state.selectedTxid || "").trim();
    if (!raw) throw new Error("No transaction JSON is loaded in Portal.");
    if (!TXID_RE.test(id)) throw new Error("Cannot save: loaded transaction does not expose a 64-character txid.");
    const coin = getCurrentCoinName(indexEntry);
    const saved = await fileProxyPostJson("/save-tx", {
      txid: id,
      coin: coin,
      json: raw,
      filenameMode: "base58"
    });
    state.currentSavedPath = saved.path || "";
    setText("#portalSaveTxResult", saved.path ? "saved " + saved.path : pretty(saved));
    setStatus("Saved local jq-format transaction JSON: " + (saved.path || saved.filename || id) + ".", false);
    return saved;
  }

  async function saveCurrentTransaction() {
    return saveTransactionToFileProxy(state.rawJson, state.selectedTxid, state.currentIndex);
  }

  function shouldAutoSaveFetchedTxs() {
    const el = $("#portalAutoSaveFetchedTxs");
    if (el) return !!el.checked;
    return configBool("autoSaveFetchedTransactions", true);
  }

  async function autoSaveTransactionMaybe(tx, txid, indexEntry) {
    if (!shouldAutoSaveFetchedTxs()) return null;
    if (!tx || !tx.vout) return null;

    try {
        return await saveTransactionToFileProxy(tx, txid || extractTxid(tx), indexEntry);
    } catch (error) {
        console.warn("Portal auto-save failed:", error);
        setStatus("Auto-save failed: " + (error.message || String(error)), true);
        return null;
    }
}



  function getCoinIndexByCoinName(coin) {
    const api = getThunderwords();
    const clean = String(coin || "").toLowerCase();
    if (!api || !clean) return state.currentIndex;
    const found = api.listIndexes().find(function (entry) {
      return String(entry.coin || "").toLowerCase() === clean || String(entry.ticker || "").toLowerCase() === clean;
    });
    return found || state.currentIndex;
  }

  async function loadLocalTransaction(txid, coin) {
    const json = await fileProxyJson("/tx", { txid: txid, coin: coin || "" });
    const tx = json.json || tryParseJsonText(json.text) || { text: json.text, txid: txid };
    return { txid: txid, coin: coin || json.coin || "", path: json.path, raw: tx };
  }

  function coinLabel(entryOrCoin) {
    if (!entryOrCoin) return "?";
    if (typeof entryOrCoin === "string") return entryOrCoin || "?";
    return entryOrCoin.ticker || entryOrCoin.coin || entryOrCoin.name || "?";
  }

  function rowKey(row) {
    return String((row.index && (row.index.coin || row.index.name)) || row.coin || "unknown").toLowerCase() + ":" + String(row.txid || "").toLowerCase();
  }

  function rowTime(row) {
    const summary = row.summary || {};
    return Number(summary.blockTime || row.blockTime || row.modified || 0) || 0;
  }

  function formatRowTime(row) {
    const t = rowTime(row);
    if (!t) return "unknown";
    const d = new Date(t * 1000);
    if (Number.isNaN(d.getTime())) return "unknown";
    return d.toISOString().slice(0, 16).replace("T", " ");
  }

  function rowExplorerUrl(row) {
    const api = getThunderwords();
    if (row.summary && row.summary.explorerUrl) return row.summary.explorerUrl;
    if (api && row.index && row.txid) return api.getTxUrl(row.index, row.txid);
    return "";
  }

  function rowFlags(row) {
    const s = row.summary || {};
    const flags = [];
    if (s.opReturnUrls && s.opReturnUrls.length) flags.push("url");
    if (s.primaryUrl) flags.push("media");
    if (s.ipfsCount) flags.push("ipfs:" + s.ipfsCount);
    if (s.imageLines) flags.push("img:" + s.imageLines);
    if (s.lines) flags.push("addr:" + s.lines);
    if (row.localPath) flags.push("local");
    if (!row.raw) flags.push("txid-only");
    return flags.join(" ");
  }

  function makeBasicSummary(txid, tx, entry) {
    return {
      txid: txid,
      title: "transaction " + shortTxid(txid),
      lines: 0,
      imageLines: 0,
      ipfsCount: 0,
      blockHeight: tx && tx.blockHeight,
      blockTime: tx && tx.blockTime,
      explorerUrl: entry && getThunderwords() ? getThunderwords().getTxUrl(entry, txid) : ""
    };
  }

  function sortPortalRows() {
    state.portalRows.sort(function (a, b) {
      const at = rowTime(a);
      const bt = rowTime(b);
      if (at !== bt) return bt - at;
      const ah = Number(a.summary && a.summary.blockHeight) || 0;
      const bh = Number(b.summary && b.summary.blockHeight) || 0;
      if (ah !== bh) return bh - ah;
      return String(b.txid || "").localeCompare(String(a.txid || ""));
    });
  }

  function upsertPortalRow(row, opts) {
    if (!row || !TXID_RE.test(String(row.txid || ""))) return null;
    const key = rowKey(row);
    const existing = state.portalRowKeys[key];
    const merged = existing ? Object.assign(existing, row, {
      summary: Object.assign({}, existing.summary || {}, row.summary || {}),
      raw: row.raw || existing.raw,
      index: row.index || existing.index,
      coin: row.coin || existing.coin,
      localPath: row.localPath || existing.localPath
    }) : Object.assign({}, row, { key: key });

    if (!existing) {
      state.portalRowKeys[key] = merged;
      state.portalRows.push(merged);
    }

    sortPortalRows();
    renderPortalRows();

    if ((opts && opts.select) || (!state.selectedRowKey && configBool("autoSelectNewest", true))) {
      selectPortalRow(key).catch(function (error) { setStatus(error.message || String(error), true); });
    }

    return merged;
  }

  function renderPortalRows() {
    const list = $("#portalTransactionList");
    if (!list) return;
    list.innerHTML = "";
    list.classList.remove("muted");

    if (!state.portalRows.length) {
      list.classList.add("muted");
      list.textContent = "No transactions loaded. Start fileProxy or load a Thunderword index.";
      setText("#portalExplorerCount", "No transactions loaded.");
      return;
    }

    setText("#portalExplorerCount", state.portalRows.length + " transaction(s), newest first. Use mouse or ↑/↓ to change the rendered transaction.");

    state.portalRows.forEach(function (row) {
      const primaryUrl = row.summary && row.summary.primaryUrl && isLikelyUrl(row.summary.primaryUrl) ? row.summary.primaryUrl : "";
      const button = document.createElement("div");
      button.setAttribute("role", "button");
      button.tabIndex = 0;
      button.className = "portalStreamRow" + (row.key === state.selectedRowKey ? " isSelected" : "") + (primaryUrl ? " hasDirectTarget" : "");
      button.dataset.key = row.key;
      button.dataset.txid = row.txid;
      button.onclick = function () {
        if (primaryUrl) {
          window.open(primaryUrl, "_blank", "noopener,noreferrer");
          return;
        }
        selectPortalRow(row.key).catch(function (error) { setStatus(error.message || String(error), true); });
      };
      button.onkeydown = function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          button.click();
        }
      };

      const thumb = document.createElement("span");
      thumb.className = "portalStreamThumb";
      appendRowThumbnail(thumb, row);

      const time = document.createElement("span");
      time.className = "portalStreamTime";
      time.textContent = formatRowTime(row);

      const coin = document.createElement("span");
      coin.className = "portalStreamCoin";
      coin.textContent = coinLabel(row.index || row.coin).toUpperCase();

      const title = document.createElement("span");
      title.className = "portalStreamTitle";
      title.textContent = (row.summary && row.summary.title) || ("transaction " + shortTxid(row.txid));
      title.title = primaryUrl || title.textContent;
      if (primaryUrl) title.className += " isDirectLink";

      const meta = document.createElement("span");
      meta.className = "portalStreamMeta";
      meta.textContent = [
        row.streamLabel || row.localPath || "local/live",
        row.summary && row.summary.blockHeight ? "block " + row.summary.blockHeight : "unknown block"
      ].filter(Boolean).join(" | ");
      meta.title = meta.textContent;

      const flags = document.createElement("span");
      flags.className = "portalStreamFlags";
      flags.textContent = rowFlags(row) || "plain";
      flags.title = flags.textContent;

      const verify = document.createElement("span");
      const inspect = document.createElement("a");
      inspect.className = "portalStreamVerify";
      inspect.href = "#";
      inspect.textContent = primaryUrl ? "inspect" : "select";
      inspect.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        selectPortalRow(row.key).catch(function (error) { setStatus(error.message || String(error), true); });
      };
      verify.appendChild(inspect);
      const url = rowExplorerUrl(row);
      if (url) {
        const a = document.createElement("a");
        a.className = "portalStreamVerify";
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "verify";
        a.onclick = function (event) { event.stopPropagation(); };
        verify.appendChild(a);
      } else if (!primaryUrl) {
        const tx = document.createElement("span");
        tx.textContent = shortTxid(row.txid);
        verify.appendChild(tx);
      }

      button.appendChild(thumb);
      button.appendChild(time);
      button.appendChild(coin);
      button.appendChild(title);
      button.appendChild(meta);
      button.appendChild(flags);
      button.appendChild(verify);
      list.appendChild(button);
    });
  }

  async function loadTransactionLocalFirst(indexEntry, txid, coin) {
    const id = String(txid || "").trim();
    if (!TXID_RE.test(id)) throw new Error("Transaction id must be 64 hex characters.");

    if (configBool("localFirstTransactions", true)) {
      try {
        const local = await loadLocalTransaction(id, coin || (indexEntry && indexEntry.coin) || "");
        if (local && local.raw) return { json: local.raw, source: "local", path: local.path, coin: local.coin };
      } catch (error) {}
    }

    const api = getThunderwords();
    if (!api || !indexEntry || !indexCanFetch(indexEntry)) throw new Error("No local transaction and no live tx fetcher configured.");
    const loaded = await api.fetchTransaction(indexEntry, id);
    await autoSaveTransactionMaybe(loaded.json, id, indexEntry);
    return { json: loaded.json, source: "live", url: loaded.url, coin: indexEntry.coin || indexEntry.ticker || "" };
  }

  async function selectPortalRow(key) {
    const row = state.portalRowKeys[key];
    if (!row) return;
    state.selectedRowKey = key;
    state.selectedTxid = row.txid;
    renderPortalRows();
    if ($("#portalTxid")) $("#portalTxid").value = row.txid;
    if ($("#portalLocalCoin") && row.coin) $("#portalLocalCoin").value = row.coin;

    let raw = row.raw;
    if (!raw) {
      const loaded = await loadTransactionLocalFirst(row.index, row.txid, row.coin);
      raw = loaded.json;
      row.raw = raw;
      row.localPath = loaded.path || row.localPath;
      row.summary = extractSummary(raw, row.index || getCoinIndexByCoinName(row.coin));
      upsertPortalRow(row);
    }

    await render(raw, (coinLabel(row.index || row.coin) + " tx " + row.txid), row.index || getCoinIndexByCoinName(row.coin));
  }

  function selectRelativePortalRow(delta) {
    if (!state.portalRows.length) return;
    let index = state.portalRows.findIndex(function (row) { return row.key === state.selectedRowKey; });
    if (index < 0) index = 0;
    index = Math.max(0, Math.min(state.portalRows.length - 1, index + delta));
    selectPortalRow(state.portalRows[index].key).catch(function (error) { setStatus(error.message || String(error), true); });
  }

  async function listLocalTransactions() {
    const coin = getLocalCoin();
    let json = null;
    let rows = [];
    let usedIndex = false;

    if (configBool("preferLocalIndex", true)) {
      try {
        json = await fileProxyJson("/tx-index", { coin: coin });
        rows = json.transactions || [];
        usedIndex = true;
      } catch (error) {
        json = null;
      }
    }

    if (!json) {
      json = await fileProxyJson("/txids", { coin: coin });
      rows = json.transactions || [];
    }

    state.localTransactions = rows;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const entry = getCoinIndexByCoinName(row.coin || coin);
      let raw = null;
      let summary = row.summary || makeBasicSummary(row.txid, row, entry);

      if (!usedIndex) {
        try {
          const loaded = await loadLocalTransaction(row.txid, row.coin || coin);
          raw = loaded.raw;
          summary = extractSummary(raw, entry);
        } catch (error) {}
      }

      upsertPortalRow({
        index: entry,
        coin: row.coin || coin || (entry && entry.coin) || "unknown",
        txid: row.txid,
        raw: raw,
        summary: summary,
        streamLabel: usedIndex ? "local index" : "local filesystem",
        localPath: row.path,
        modified: row.modified
      });
    }

    setText("#portalThunderwordRaw", pretty(json));
    setStatus("Loaded " + rows.length + " local txid fixture(s) from fileProxy " + (usedIndex ? "index" : "scan") + " into the merged stream.", false);
  }

  async function loadSelectedLocalTransaction() {
    const txid = String((state.selectedTxid || ($("#portalTxid") && $("#portalTxid").value) || "")).trim();
    if (!TXID_RE.test(txid)) throw new Error("Select or enter a 64-character txid first.");
    const coin = getLocalCoin();
    const loaded = await loadLocalTransaction(txid, coin);
    const entry = getCoinIndexByCoinName(loaded.coin || coin);
    const row = upsertPortalRow({
      index: entry,
      coin: loaded.coin || coin || (entry && entry.coin) || "unknown",
      txid: loaded.txid,
      raw: loaded.raw,
      summary: extractSummary(loaded.raw, entry),
      streamLabel: "local filesystem",
      localPath: loaded.path
    }, { select: true });
    if (row) await selectPortalRow(row.key);
  }

  function renderLocalTransactionList(rows) {
    renderPortalRows();
  }

  function startLocalTransactionPolling() {
    const ms = Number(configValue("pollLocalTransactionsMs", 0)) || 0;
    if (state.localPollTimer) {
      window.clearInterval(state.localPollTimer);
      state.localPollTimer = null;
    }
    if (ms < 1000) return;
    state.localPollTimer = window.setInterval(function () {
      listLocalTransactions().catch(function () {});
    }, ms);
  }

  async function discoverLocalAssets(txid, semantics) {
    const box = $("#portalLocalAssets");
    if (!box) return;
    box.innerHTML = "";
    state.localAssetPaths = [];
    const cids = (semantics && semantics.records ? semantics.records : []).filter(function (record) {
      return record.kind === "ipfs-v0-cid" && record.cid;
    }).map(function (record) { return record.cid; });

    const assets = [];
    try {
      const direct = await fileProxyJson("/find-assets", { txid: txid || "" });
      assets.push.apply(assets, direct.assets || []);
    } catch (error) {
      box.textContent = "fileProxy image lookup skipped: " + (error.message || String(error));
      return;
    }

    for (let i = 0; i < cids.length; i += 1) {
      try {
        const found = await fileProxyJson("/find-assets", { cid: cids[i] });
        assets.push.apply(assets, found.assets || []);
      } catch (error) {}
    }

    const seen = new Set();
    const unique = assets.filter(function (asset) {
      if (!asset || !asset.path || seen.has(asset.path)) return false;
      seen.add(asset.path);
      return true;
    });
    state.localAssetPaths = unique.map(function (asset) { return asset.path; });

    if (!unique.length) {
      box.textContent = "No local base57/image files found for this txid or its IPFS CIDs.";
      return;
    }

    const title = document.createElement("p");
    title.className = "muted";
    title.textContent = "Local image assets from fileProxy:";
    box.appendChild(title);

    unique.forEach(function (asset) {
      const img = document.createElement("img");
      img.src = getFileProxyUrl() + asset.url;
      img.alt = asset.path;
      img.title = asset.path;
      img.style.display = "block";
      img.style.width = "100%";
      img.style.maxHeight = "420px";
      img.style.objectFit = "contain";
      img.style.marginTop = "10px";
      box.appendChild(img);
    });
  }


  function toggleImageDetails(imageLineCount) {
    const controls = $("#portalImageDrawer");
    const canvasWrap = $("#portalImageCanvasWrap");
    const count = Number(imageLineCount) || 0;
    const hasImages = count > 0;
    if (controls && configBool("showImageToolsOnlyWhenImages", true)) {
      controls.style.display = hasImages ? "block" : "none";
      if (hasImages) controls.open = false;
    }
    if (canvasWrap && !hasImages) canvasWrap.classList.add("isHidden");
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
    state.currentSavedPath = "";
    setText("#portalSaveTxResult", "");

    toggleImageDetails(summary.imageLines);
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
    saveDiscoveredLinksMaybe(txid, semantic, indexEntry || state.currentIndex).catch(function () {});
    await discoverLocalAssets(txid, semantic);
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
      option.textContent = (entry.ticker || entry.coin || entry.name) + " explorer profile";
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
    setExplorerLink("#portalThunderwordExplorerLink", api.getAddressUrl(entry, address.value), "verify address");
    setText("#portalIndexCaption", (entry.ticker || entry.coin || entry.name) + " address stream: " + address.value);
  }

  function renderEmptyTransactionList(message) {
    if (!state.portalRows.length) {
      const list = $("#portalTransactionList");
      if (list) {
        list.classList.add("muted");
        list.textContent = message || "No transactions loaded.";
      }
      setText("#portalExplorerCount", message || "No transactions loaded.");
    }
  }

  function renderThunderwordTxs(result) {
    state.currentIndex = result.index;
    state.currentTransactions = result.transactions || [];

    if (!result || !result.transactions || !result.transactions.length) {
      renderEmptyTransactionList("No transactions returned for this index.");
      return;
    }

    result.transactions.forEach(function (tx) {
      const rawTx = tx.raw && tx.raw.vout ? tx.raw : null;
      const summary = rawTx ? extractSummary(rawTx, result.index) : makeBasicSummary(tx.txid, tx, result.index);
      upsertPortalRow({
        index: result.index,
        coin: result.index.coin || result.index.ticker || result.index.name,
        txid: tx.txid,
        raw: rawTx,
        summary: summary,
        blockTime: tx.blockTime,
        streamLabel: result.index.label || result.index.address
      });
    });
  }

  async function loadAddressIndex(entryOverride, addressOverride) {
    const api = getThunderwords();
    const entry = entryOverride || getSelectedIndex();
    const address = String(addressOverride || ($("#portalThunderwordAddress") ? $("#portalThunderwordAddress").value.trim() : entry.address) || "").trim();
    const activeEntry = cloneIndexForAddress(entry, address, entry.label || entry.address || address);
    state.currentIndex = activeEntry;
    setStatus("Loading " + (activeEntry.ticker || activeEntry.coin || activeEntry.name) + " address stream...", false);
    const result = await api.fetchAddressTransactions(activeEntry, address);
    renderThunderwordTxs(result);
    setText("#portalThunderwordRaw", pretty({ source: result.url, transactions: result.transactions }));
    setStatus("Discovered " + result.transactions.length + " txid(s); resolving local-first transaction JSON...", false);

    for (let i = 0; i < result.transactions.length; i += 1) {
      const tx = result.transactions[i];
      try {
        const loaded = await loadTransactionLocalFirst(activeEntry, tx.txid, activeEntry.coin);
        tx.raw = loaded.json;
        const summary = extractSummary(loaded.json, activeEntry);
        const row = upsertPortalRow({
          index: activeEntry,
          coin: activeEntry.coin || activeEntry.ticker || activeEntry.name,
          txid: tx.txid,
          raw: loaded.json,
          summary: summary,
          blockTime: tx.blockTime || summary.blockTime,
          streamLabel: loaded.source === "local" ? "local cache + " + (activeEntry.label || activeEntry.address) : activeEntry.label || activeEntry.address,
          localPath: loaded.path || ""
        }, { select: i === 0 && !state.selectedRowKey });
        if (i === 0 && row && configBool("autoSelectNewest", true)) await selectPortalRow(row.key);
      } catch (error) {
        console.warn("Portal tx resolve failed:", tx.txid, error);
      }
    }

    setStatus("Loaded " + result.transactions.length + " transaction(s) into the merged stream.", false);
  }

  async function loadThunderwordIndex() {
    return loadAddressIndex();
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
    setStatus("Using generated unspendable/index address as the current address stream. It is useful after transactions exist on that address.", false);
  }

  async function buildGeneratedThunderwordIndexes() {
    const api = getThunderwords();
    if (!api || typeof api.buildGeneratedIndexes !== "function") return;
    const rows = await api.buildGeneratedIndexes();
    renderThunderwordOptions();
    setText("#portalThunderwordRaw", pretty(rows));
    setStatus("Generated " + rows.length + " candidate indexes from installed coin prefixes.", false);
  }



  function indexCanFetch(entry) {
    return entry && entry.canFetchAddress && entry.canFetchTx;
  }

  function cloneIndexWithAddress(entry, address, labelSuffix) {
    return Object.assign({}, entry, {
      address: String(address || entry.address || "").trim(),
      label: entry.label + (labelSuffix ? " / " + labelSuffix : "")
    });
  }

  async function ensureGeneratedGeneralIndexes() {
    const api = getThunderwords();
    if (!api || typeof api.buildGeneratedIndexes !== "function") return [];
    const existing = api.listIndexes().filter(function (entry) { return entry.generated; });
    if (existing.length) return existing;
    try { return await api.buildGeneratedIndexes(); }
    catch (error) {
      setStatus("Generated index scan failed: " + (error.message || String(error)), true);
      return [];
    }
  }

  function getGeneralConversationIndexes() {
    const api = getThunderwords();
    if (!api) return [];
    return api.listIndexes().filter(function (entry) {
      return entry.group === "general" || /general thunderword|generated general index/i.test(entry.label || "");
    });
  }

  function compareStreamItems(a, b) {
    const at = Number(a.summary && a.summary.blockTime) || 0;
    const bt = Number(b.summary && b.summary.blockTime) || 0;
    if (at !== bt) return bt - at;
    const ah = Number(a.summary && a.summary.blockHeight) || 0;
    const bh = Number(b.summary && b.summary.blockHeight) || 0;
    if (ah !== bh) return bh - ah;
    return String(b.txid).localeCompare(String(a.txid));
  }

  function txHasAddressLine(txJson, address) {
    const needle = String(address || "").trim();
    if (!needle) return false;
    return extractLines(txJson).indexOf(needle) !== -1;
  }

  function findRabbitTrailTargets(txJson, sourceIndex) {
    const sourceAddress = sourceIndex && sourceIndex.address;
    const lines = extractLines(txJson);
    const semantics = buildSemantics(txJson, lines);
    const targets = [];
    const hasSource = txHasAddressLine(txJson, sourceAddress);

    if (!hasSource) return targets;

    semantics.records.forEach(function (record) {
      if (["subject", "transport", "person", "address", "thunderword-index", "free-verse"].indexOf(record.kind) < 0) return;
      if (!record.line || record.line === sourceAddress || record.kind === "image-chord-line") return;
      if (String(record.line).charAt(0) === "S") return;
      targets.push({
        address: record.line,
        title: record.payloadText || record.line,
        kind: record.kind,
        marker: record.marker,
        sourceTxid: extractTxid(txJson)
      });
    });

    if (configBool("rabbitTrailSenders", true)) {
      extractInputAddresses(txJson).forEach(function (address) {
        if (!address || address === sourceAddress) return;
        targets.push({
          address: address,
          title: "sender " + address,
          kind: "sender",
          marker: "VIN",
          sourceTxid: extractTxid(txJson)
        });
      });
    }

    return targets.slice(0, Number(configValue("maxRabbitTrails", 24)) || 24);
  }

  function renderConversationStatus(rows, trails) {
    const box = $("#portalConversationStatus");
    if (!box) return;
    box.innerHTML = "";

    const summary = document.createElement("p");
    summary.className = "muted";
    summary.textContent = "Merged " + rows.length + " transaction(s)" + (trails.length ? " with " + trails.length + " rabbit trail(s)." : ".");
    box.appendChild(summary);

    if (trails.length) {
      const pre = document.createElement("pre");
      pre.className = "json";
      pre.textContent = pretty(trails.map(function (trail) {
        return {
          coin: trail.index && trail.index.ticker,
          kind: trail.kind,
          title: trail.title,
          address: trail.address,
          sourceTxid: trail.sourceTxid,
          fetchable: trail.fetchable
        };
      }));
      box.appendChild(pre);
    }
  }

  function renderConversationRows(rows) {
    rows.forEach(function (row) { upsertPortalRow(row); });
  }

  async function fetchIndexRows(entry, streamLabel) {
    const api = getThunderwords();
    const rows = [];
    const result = await api.fetchAddressTransactions(entry, entry.address);
    const txs = result.transactions || [];

    for (let i = 0; i < txs.length; i += 1) {
      const tx = txs[i];
      const stub = {
        index: entry,
        coin: entry.coin || entry.ticker || entry.name,
        txid: tx.txid,
        raw: tx.raw && tx.raw.vout ? tx.raw : null,
        summary: tx.raw && tx.raw.vout ? extractSummary(tx.raw, entry) : makeBasicSummary(tx.txid, tx, entry),
        blockTime: tx.blockTime,
        streamLabel: streamLabel || entry.address
      };
      upsertPortalRow(stub);

      try {
        const loaded = stub.raw ? { json: stub.raw, source: "inline" } : await loadTransactionLocalFirst(entry, tx.txid, entry.coin);
        const summary = extractSummary(loaded.json, entry);
        const row = Object.assign(stub, {
          raw: loaded.json,
          summary: summary,
          blockTime: tx.blockTime || summary.blockTime,
          localPath: loaded.path || stub.localPath || "",
          streamLabel: loaded.source === "local" ? "local cache + " + (streamLabel || entry.address) : (streamLabel || entry.address)
        });
        upsertPortalRow(row);
        rows.push(row);
      } catch (error) {
        console.warn("Portal stream tx resolve failed:", tx.txid, error);
      }
    }

    return rows;
  }

  async function loadConversationStreams() {
    const api = getThunderwords();
    if (!api) throw new Error("chisel.thunderwords.js is required for conversation streams.");

    await ensureGeneratedGeneralIndexes();

    const roots = getGeneralConversationIndexes();
    const allRows = [];
    const trails = [];
    const seenTx = new Set();
    const seenTrail = new Set();
    const rawReport = [];

    setStatus("Loading all default Thunderword streams across installed coins...", false);

    for (let i = 0; i < roots.length; i += 1) {
      const root = roots[i];
      const rootReport = { index: root.label, address: root.address, coin: root.ticker || root.coin, fetched: false, error: "" };
      rawReport.push(rootReport);

      if (!indexCanFetch(root)) {
        rootReport.error = "No browser-readable address/tx API configured.";
        continue;
      }

      try {
        const rows = await fetchIndexRows(root, "root index");
        rootReport.fetched = true;
        rootReport.transactions = rows.length;

        rows.forEach(function (row) {
          const key = (root.coin || root.name) + ":" + row.txid;
          if (!seenTx.has(key)) {
            seenTx.add(key);
            allRows.push(row);
          }

          findRabbitTrailTargets(row.raw, root).forEach(function (trail) {
            const targetIndex = inferIndexForAddress(trail.address, root);
            const trailKey = ((targetIndex && (targetIndex.coin || targetIndex.name)) || root.coin || root.name) + ":" + trail.address;
            if (seenTrail.has(trailKey)) return;
            seenTrail.add(trailKey);
            trails.push(Object.assign(trail, { index: targetIndex, fetchable: indexCanFetch(targetIndex) }));
          });
        });
      } catch (error) {
        rootReport.error = error.message || String(error);
      }
    }

    for (let j = 0; j < trails.length; j += 1) {
      const trail = trails[j];
      if (!trail.fetchable) continue;
      const child = cloneIndexWithAddress(trail.index, trail.address, trail.title);
      try {
        const childRows = await fetchIndexRows(child, "rabbit trail: " + trail.title);
        trail.transactions = childRows.length;
        childRows.forEach(function (row) {
          const key = (child.coin || child.name) + ":" + row.txid;
          if (!seenTx.has(key)) {
            seenTx.add(key);
            allRows.push(row);
          }
        });
      } catch (error) {
        trail.error = error.message || String(error);
      }
    }

    allRows.sort(compareStreamItems);
    state.conversationRows = allRows;
    state.rabbitTrails = trails;
    renderConversationRows(allRows);
    renderConversationStatus(allRows, trails);
    setText("#portalThunderwordRaw", pretty({ roots: rawReport, rabbitTrails: trails, merged: allRows.map(function (row) { return { coin: row.index.ticker || row.index.coin, txid: row.txid, title: row.summary.title, primaryUrl: row.summary.primaryUrl, stream: row.streamLabel, blockTime: row.summary.blockTime, blockHeight: row.summary.blockHeight }; }) }));
    setStatus("Loaded Babel stream: " + allRows.length + " transaction(s), " + trails.length + " rabbit trail(s).", false);

    if (allRows.length) {
      const key = rowKey(allRows[0]);
      if (state.portalRowKeys[key]) await selectPortalRow(key);
    }
  }

  function bind() {
    const loadTx = $("#portalLoadTxButton");
    const redraw = $("#portalRedrawButton");
    const thunderSelect = $("#portalThunderwordSelect");
    const loadThunderword = $("#portalLoadThunderwordButton");
    const generateThunderwords = $("#portalGenerateThunderwordsButton");
    const buildMac = $("#portalBuildMacButton");
    const useMac = $("#portalUseMacAsIndexButton");
    const useSpendable = $("#portalUseSpendableAsIndexButton");
    const loadConversation = $("#portalLoadConversationButton");
    const loadLocalTxids = $("#portalLoadLocalTxidsButton");
    const loadSelectedLocal = $("#portalLoadSelectedLocalButton");
    const saveCurrentTx = $("#portalSaveCurrentTxButton");

    if (!loadThunderword) return;

    if ($("#portalTxid")) $("#portalTxid").value = DEFAULT_DIGIBYTE_TXID;
    if ($("#portalColorPath")) $("#portalColorPath").value = DEFAULT_COLOR_PATH;
    if ($("#portalFileProxyUrl") && !$("#portalFileProxyUrl").value) $("#portalFileProxyUrl").value = DEFAULT_FILE_PROXY_URL;
    if ($("#portalScale")) $("#portalScale").value = String(DEFAULT_SCALE);
    if ($("#portalSkipPrefix")) $("#portalSkipPrefix").value = String(DEFAULT_SKIP_PREFIX);
    if ($("#portalSkipSuffix")) $("#portalSkipSuffix").value = String(DEFAULT_SKIP_SUFFIX);

    renderThunderwordOptions();
    renderEmptyTransactionList("Select a currency profile and load an address stream, or let local transactions populate the explorer.");

    if (loadTx) loadTx.onclick = async function () {
      try {
        const entry = state.currentIndex || getSelectedIndex();
        const txid = $("#portalTxid").value.trim();
        setStatus("Loading selected-coin transaction local-first...", false);
        const loaded = await loadTransactionLocalFirst(entry, txid, entry && entry.coin);
        const row = upsertPortalRow({
          index: entry,
          coin: (entry && (entry.coin || entry.ticker || entry.name)) || loaded.coin || "unknown",
          txid: txid,
          raw: loaded.json,
          summary: extractSummary(loaded.json, entry),
          streamLabel: loaded.source === "local" ? "direct txid from local cache" : "direct txid live fetch",
          localPath: loaded.path || ""
        }, { select: true });
        if (row) await selectPortalRow(row.key);
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
        setStatus("Built unspendable/index address " + row.address + ".", false);
      } catch (error) { setStatus(error.message || String(error), true); }
    };

    if (useMac) useMac.onclick = async function () {
      try { await usePortalMacAsIndex(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (useSpendable) useSpendable.onclick = async function () {
      try {
        const address = $("#portalSpendableAddress") ? $("#portalSpendableAddress").value.trim() : "";
        const note = $("#portalSpendableNote") ? $("#portalSpendableNote").value.trim() : "";
        await loadAddressStream(address, getSelectedIndex(), note || address);
      } catch (error) { setStatus(error.message || String(error), true); }
    };

    if (loadConversation) loadConversation.onclick = async function () {
      try { await loadConversationStreams(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (loadLocalTxids) loadLocalTxids.onclick = async function () {
      try { await listLocalTransactions(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (loadSelectedLocal) loadSelectedLocal.onclick = async function () {
      try { await loadSelectedLocalTransaction(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (saveCurrentTx) saveCurrentTx.onclick = async function () {
      try { await saveCurrentTransaction(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    const streamList = $("#portalTransactionList");
    if (streamList) streamList.onkeydown = function (event) {
      if (event.key === "ArrowDown") { event.preventDefault(); selectRelativePortalRow(1); }
      if (event.key === "ArrowUp") { event.preventDefault(); selectRelativePortalRow(-1); }
    };

    loadColorMap(DEFAULT_COLOR_PATH).catch(function (error) {
      setStatus(error.message || String(error), true);
    });

    loadPortalConfig().then(function (config) {
      applyPortalConfig(config);
      if (configBool("autoLoadLocalTransactions", true)) {
        listLocalTransactions().catch(function (error) {
          setStatus("Local fileProxy load skipped: " + (error.message || String(error)), true);
        });
      }
      startLocalTransactionPolling();
    }).catch(function (error) {
      applyPortalConfig(DEFAULT_PORTAL_CONFIG);
      setStatus("Portal config skipped: " + (error.message || String(error)), true);
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
    loadAddressIndex: loadAddressIndex,
    loadAddressStream: loadAddressStream,
    renderThunderwordOptions: renderThunderwordOptions,
    buildSemantics: buildSemantics,
    renderSemantics: renderSemantics,
    extractSummary: extractSummary,
    titleFromSemantics: titleFromSemantics,
    describeOpReturnText: describeOpReturnText,
    buildPortalMacDougall: buildPortalMacDougall,
    loadConversationStreams: loadConversationStreams,
    listLocalTransactions: listLocalTransactions,
    loadLocalTransaction: loadLocalTransaction,
    saveCurrentTransaction: saveCurrentTransaction,
    saveTransactionToFileProxy: saveTransactionToFileProxy,
    saveDiscoveredLinksMaybe: saveDiscoveredLinksMaybe,
    discoverLocalAssets: discoverLocalAssets,
    findRabbitTrailTargets: findRabbitTrailTargets,
    inferIndexForAddress: inferIndexForAddress,
    state: state
  };
})();
