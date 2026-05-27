(function () {
  "use strict";

  const DEFAULT_JSON_PATH = "mogwai.json";
  const DEFAULT_DIGIBYTE_TXID = "d8eef1586bb88d192d3284726407c307f0c54b1c023b7ef343e401eb89ea098d";
  const DEFAULT_COLOR_PATH = "b57.json";
  const DEFAULT_SCALE = 10;
  const DEFAULT_SKIP_PREFIX = 2;
  const DEFAULT_SKIP_SUFFIX = 6;

  const SAMPLE_LINES = [
    "SNMMMBQXiiiiiisrrrriiXQBBMMM12AD3f",
    "SNMMBQXiiiippuuuuurriiiQQBMM91PT7E",
    "SNMMBPXippppppuppuppppiXXQMM9bcs4i",
    "SNMBQPypppppppppppppyppPiXBM2d38iF",
    "SNBQPPPypppppKppppppppyyyiQM461EjA",
    "SNBPPKyyypppKypppppyyyyyyPQM5fp9wh",
    "SNBPPyyyypyyyyyypppyyyyypyPB7StFoW",
    "SNBPPYYY55yyyyyyyyyyyyyyyyyB2mHTLZ"
  ];

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
    lines: []
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = value;
  }

  function setStatus(message, isError) {
    const el = $("#portalStatus");
    if (!el) return;
    el.textContent = message || "";
    el.className = isError ? "error" : "muted";
  }

  function pretty(value) {
    return JSON.stringify(value, null, 2);
  }

  function parseRgb(value) {
    if (Array.isArray(value)) {
      return value.map(function (n) { return Number(n); }).slice(0, 3);
    }
    return String(value || "0,0,0").split(",").map(function (part) {
      return parseInt(part.trim(), 10) || 0;
    }).slice(0, 3);
  }

  async function loadColorMap(path) {
    const url = path || DEFAULT_COLOR_PATH;

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      const map = {};

      if (Array.isArray(data)) {
        data.forEach(function (entry) {
          if (entry && entry.b57) map[entry.b57] = parseRgb(entry.rgb);
        });
      } else if (data && typeof data === "object") {
        Object.keys(data).forEach(function (key) {
          map[key] = parseRgb(data[key]);
        });
      }

      state.colorMap = Object.keys(map).length ? map : fallbackColors;
      return state.colorMap;
    } catch (error) {
      state.colorMap = fallbackColors;
      setStatus("Color map fetch failed; using built-in fallback colors. " + error.message, false);
      return state.colorMap;
    }
  }

  function collectAddressesFromVout(vout) {
    const out = [];
    (vout || []).forEach(function (entry) {
      if (!entry) return;
      if (entry.scriptpubkey_address) out.push(entry.scriptpubkey_address);
      if (entry.scriptPubKey && entry.scriptPubKey.address) out.push(entry.scriptPubKey.address);
      if (entry.scriptPubKey && Array.isArray(entry.scriptPubKey.addresses)) {
        entry.scriptPubKey.addresses.forEach(function (addr) { out.push(addr); });
      }
    });
    return out;
  }

  function extractLines(value) {
    if (Array.isArray(value)) {
      return value.filter(function (line) { return typeof line === "string"; });
    }

    if (!value || typeof value !== "object") return [];

    if (Array.isArray(value.lines)) return value.lines.filter(function (line) { return typeof line === "string"; });
    if (Array.isArray(value.chord)) return value.chord.filter(function (line) { return typeof line === "string"; });
    if (Array.isArray(value.tablet)) return value.tablet.filter(function (line) { return typeof line === "string"; });
    if (Array.isArray(value.addresses)) return value.addresses.filter(function (line) { return typeof line === "string"; });
    if (Array.isArray(value.vout)) return collectAddressesFromVout(value.vout);
    if (value.tx && Array.isArray(value.tx.vout)) return collectAddressesFromVout(value.tx.vout);

    return [];
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
    return preferred.length ? preferred : lines;
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

    setText("#portalImageStats", rows + " rows × " + cols + " cols, scale " + scale + ", " + imageLines.length + " rendered lines");
  }

  function decodeMacDougall(line) {
    return String(line || "")
      .slice(2, -6)
      .replace(/[xz]/g, " ")
      .replace(/v/g, ".")
      .replace(/w/g, ":")
      .replace(/y/g, "-")
      .replace(/i/g, "I")
      .replace(/o/g, "O")
      .replace(/c/g, "0")
      .trim();
  }

  function renderLineList(lines) {
    const list = $("#portalLineList");
    const decoded = $("#portalDecodedLines");
    if (!list || !decoded) return;

    list.textContent = lines.join("\n");
    decoded.textContent = lines.map(function (line) {
      return line + "    " + decodeMacDougall(line);
    }).join("\n");
  }

  function renderBuckets(lines) {
    const buckets = bucketLines(lines);
    const summary = Object.keys(buckets).sort().map(function (key) {
      return key + ": " + buckets[key].length;
    }).join("   ");
    setText("#portalBucketSummary", summary || "No address lines found.");
  }

  async function render(value, sourceLabel) {
    if (!state.colorMap) await loadColorMap($("#portalColorPath") ? $("#portalColorPath").value : DEFAULT_COLOR_PATH);

    state.rawJson = value;
    state.lines = extractLines(value);

    if (!state.lines.length) {
      setStatus("Loaded " + sourceLabel + ", but found no renderable address/chord lines.", true);
      renderLineList([]);
      renderBuckets([]);
      drawChord([]);
      setText("#portalRawJson", pretty(value));
      return;
    }

    drawChord(state.lines);
    renderLineList(state.lines);
    renderBuckets(state.lines);
    setText("#portalRawJson", pretty(value));
    setStatus("Loaded " + sourceLabel + ": " + state.lines.length + " address/chord lines.", false);
  }

  async function loadJsonPath(path) {
    const url = path || DEFAULT_JSON_PATH;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(url + " failed with HTTP " + response.status);
    return response.json();
  }

  async function loadDigibyteTx(txid) {
    const id = String(txid || "").trim();
    if (!/^[0-9a-fA-F]{64}$/.test(id)) throw new Error("Digibyte txid must be 64 hex characters.");
    const url = "https://digiexplorer.info/api/tx/" + encodeURIComponent(id);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("Digiexplorer request failed with HTTP " + response.status);
    return response.json();
  }

  function getPastedJson() {
    const box = $("#portalJsonPaste");
    const text = box ? box.value.trim() : "";
    if (!text) throw new Error("Paste JSON first, or load mogwai.json.");
    return JSON.parse(text);
  }

  function bind() {
    const loadFile = $("#portalLoadFileButton");
    const loadPasted = $("#portalLoadPasteButton");
    const loadSample = $("#portalLoadSampleButton");
    const loadTx = $("#portalLoadTxButton");
    const redraw = $("#portalRedrawButton");

    if (!loadFile) return;

    $("#portalJsonPath").value = DEFAULT_JSON_PATH;
    $("#portalTxid").value = DEFAULT_DIGIBYTE_TXID;
    $("#portalColorPath").value = DEFAULT_COLOR_PATH;
    $("#portalScale").value = String(DEFAULT_SCALE);
    $("#portalSkipPrefix").value = String(DEFAULT_SKIP_PREFIX);
    $("#portalSkipSuffix").value = String(DEFAULT_SKIP_SUFFIX);

    loadFile.onclick = async function () {
      try {
        setStatus("Loading JSON file...", false);
        await render(await loadJsonPath($("#portalJsonPath").value), $("#portalJsonPath").value || DEFAULT_JSON_PATH);
      } catch (error) {
        setStatus(error.message || String(error), true);
      }
    };

    loadPasted.onclick = async function () {
      try {
        await render(getPastedJson(), "pasted JSON");
      } catch (error) {
        setStatus(error.message || String(error), true);
      }
    };

    loadSample.onclick = async function () {
      await render({ lines: SAMPLE_LINES }, "built-in sample lines");
    };

    loadTx.onclick = async function () {
      try {
        setStatus("Loading Digibyte transaction from public explorer...", false);
        await render(await loadDigibyteTx($("#portalTxid").value), "Digibyte tx " + $("#portalTxid").value.trim());
      } catch (error) {
        setStatus(error.message || String(error), true);
      }
    };

    redraw.onclick = async function () {
      try {
        await loadColorMap($("#portalColorPath").value);
        await render(state.rawJson || { lines: state.lines.length ? state.lines : SAMPLE_LINES }, "current data");
      } catch (error) {
        setStatus(error.message || String(error), true);
      }
    };

    loadColorMap(DEFAULT_COLOR_PATH).then(function () {
      return render({ lines: SAMPLE_LINES }, "built-in sample lines");
    }).catch(function (error) {
      setStatus(error.message || String(error), true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

  window.CHISEL_PORTAL = {
    extractLines: extractLines,
    drawChord: drawChord,
    render: render,
    loadDigibyteTx: loadDigibyteTx,
    loadColorMap: loadColorMap
  };
})();
