(function () {
  "use strict";

  const DEFAULT_DIGIBYTE_TXID = "d8eef1586bb88d192d3284726407c307f0c54b1c023b7ef343e401eb89ea098d";
  const DEFAULT_COLOR_PATH = "b57.json";
  const DEFAULT_THUNDERWORD_INDEX = "digibyteGeneral";
  const DEFAULT_FILE_PROXY_URL = "https://rigler.org/fileproxy";
  const DEFAULT_SCALE = 10;
  const DEFAULT_SKIP_PREFIX = 2;
  const DEFAULT_SKIP_SUFFIX = 6;
  const CHECKSUM_LEN = 6;
  const CIDV0_RE = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
  const TXID_RE = /^[0-9a-fA-F]{64}$/;
  const DEFAULT_CONFIG_PATH = "chisel.portal.config.json";
  const DEFAULT_STATIC_MANIFEST_PATH = "data/manifest.json";
  const DEFAULT_BUNDLED_MANIFEST_PATH = "data-bundled/manifest.json";
  const DEFAULT_REMOTE_MANIFEST_URL = "https://rigler.org/chisel-data/manifest.json";
  const DEFAULT_STATIC_DATA_URL = "https://rigler.org/chisel-data/";
  const PORTAL_ANNOTATIONS_STORAGE_KEY = "chisel.portal.annotations.v1";
  const PORTAL_PERSONAL_ACCOUNT_STORAGE_KEY = "chisel.portal.personalAccount.v1";
  const DEFAULT_PORTAL_CONFIG = {
    fileProxyUrl: DEFAULT_FILE_PROXY_URL,
    fileProxyReadTimeoutMs: 2000,
    staticDataSources: [DEFAULT_STATIC_DATA_URL],
    autoLoadTransactionNotes: true,
    annotationFilePrefix: "data/",
    autoSaveFetchedTransactions: true,
    cacheFetchedTransactionsWithFileProxy: true,
    persistMainThunderwords: true,
    autoLoadMainThunderwordFromUrl: true,
    mainThunderwordReindexDelayMs: 900,
    localFirstTransactions: true,
    autoLoadLocalTransactions: false,
    autoHydrateLocalTransactions: false,
    pollLocalTransactionsMs: 0,
    liveLedgerRefresh: true,
    liveLedgerRefreshMs: 120000,
    liveLedgerRefreshOnFocus: true,
    liveLedgerRefreshFocusStaleMs: 60000,
    autoSelectNewest: false,
    autoLoadConversationStreams: true,
    autoLoadStaticDataset: true,
    autoSearchLedgersAfterStatic: true,
    staticManifestPaths: [DEFAULT_STATIC_MANIFEST_PATH, DEFAULT_BUNDLED_MANIFEST_PATH],
    staticManifestMirrors: [DEFAULT_REMOTE_MANIFEST_URL],
    backgroundHydrateTransactions: false,
    autoFetchVisibleTransactionDates: true,
    maxVisibleDateLookups: 20,
    visibleDateLookupConcurrency: 3,
    saveDiscoveredLinks: false,
    rabbitTrailSenders: false,
    autoFetchRabbitTrails: false,
    maxRabbitTrails: 24,
    maxTransactionsPerStream: 80,
    portalPageSize: 20,
    inlineImageScale: 4,
    inlineImageThumbScale: 2,
    inlineImageExpandedScale: 12,
    includeEvmGomez: false,
    includeEvmJethro: false,
    autoLoadEvmCatalog: false,
    portalFilterDigibyte: true,
    portalFilterRavencoin: true,
    portalFilterLitecoin: true,
    portalFilterBitcoin: true,
    portalFilterDogecoin: true,
    portalFilterEcash: true,
    portalFilterEvmGomez: true,
    portalFilterEvmJethro: true,
    portalFilterOther: true
  };

  const EVM_PROFILES = [
    {
      id: "gomez",
      label: "Gomez",
      coin: "evm",
      ticker: "EVM",
      chainId: "137",
      chainName: "Polygon Mainnet",
      contractName: "gomez",
      contractAddress: "0x5a2220d56f56db9C9F5B0cb83ff35b42746503a2"
    },
    {
      id: "jethro",
      label: "Jethro",
      coin: "evm",
      ticker: "EVM",
      chainId: "137",
      chainName: "Polygon Mainnet",
      contractName: "jethro",
      contractAddress: "0x0076416C84c7151CaEfA74C3e09d6eBF2f296BA0"
    }
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
    lines: [],
    outputs: [],
    semantics: [],
    currentIndex: null,
    currentTransactions: [],
    selectedTxid: "",
    currentSavedPath: "",
    localTransactions: [],
    localHydrationReport: null,
    localAssetPaths: [],
    portalRows: [],
    portalRowKeys: Object.create(null),
    selectedRowKey: "",
    portalPage: 1,
    portalPageSize: 20,
    expandedRowKeys: Object.create(null),
    pendingHydration: Object.create(null),
    pendingDateLookup: Object.create(null),
    attemptedDateLookup: Object.create(null),
    attemptedFinanceLookup: Object.create(null),
    visibleFinanceLookupScheduled: false,
    visibleDateLookupScheduled: false,
    visibleDateLookupToken: "",
    fileProxyAvailable: null,
    portalBatchDepth: 0,
    portalRenderQueued: false,
    portalRenderScheduled: false,
    portalRenderHandle: null,
    portalRenderViaAnimationFrame: false,
    portalSortPending: false,
    visiblePortalRowKeys: Object.create(null),
    portalLoadGeneration: 0,
    conversationAutoLoaded: false,
    config: Object.assign({}, DEFAULT_PORTAL_CONFIG),
    localPollTimer: null,
    liveLedgerTimer: null,
    liveLedgerHistories: Object.create(null),
    mainThunderword: null,
    mainThunderwordReindexTimer: null,
    mainThunderwordReindexPending: false,
    urlMainThunderwordRequest: null,
    evmCatalogLoaded: Object.create(null),
    staticDatasetLoaded: false,
    staticDatasetReports: [],
    staticManifest: null,
    staticRawByTxid: Object.create(null),
    portalSourceFilters: Object.create(null),
    portalAnnotations: Object.create(null),
    personalAccount: null,
    personalStreamReturnView: null,
    discoveryKickPending: false
  };

  const portalRowDerivedCache = new WeakMap();

  const storeApi = window.CHISEL_PORTAL_STORE;
  if (!storeApi) throw new Error("Load chisel.portal.store.js before chisel.portal.js.");
  const normalizeCoinName = storeApi.normalizeCoinName;
  const tickerForCoin = storeApi.tickerForCoin;
  const canonicalCoinForRow = storeApi.canonicalCoinForRow;
  const sourceIdForRow = storeApi.sourceIdForRow;
  const rowKey = storeApi.rowKey;
  const normalizeUnixTime = storeApi.normalizeUnixTime;
  const transactionStore = storeApi.createStore({
    records: state,
    extractBlockTime: extractBlockTime,
    normalizeMediaUrl: normalizeMediaUrl,
    readStorage: function (key) { return window.localStorage.getItem(key); },
    writeStorage: function (key, value) { window.localStorage.setItem(key, value); },
    onStorageError: function (error) { console.warn("Recent Portal display cache could not be saved:", error); }
  });

  const staticData = window.CHISEL_PORTAL_STATIC_DATA;
  if (!staticData) throw new Error("Load chisel.portal.static-data.js before chisel.portal.js.");
  const payloadData = window.CHISEL_PORTAL_PAYLOAD;
  if (!payloadData) throw new Error("Load chisel.portal.payload.js before chisel.portal.js.");
  const notesData = window.CHISEL_PORTAL_NOTES;
  if (!notesData) throw new Error("Load chisel.portal.notes.js before chisel.portal.js.");
  const noteFunction = window.CHISEL_NOTE_FUNCTION;
  if (!noteFunction) throw new Error("Load chisel.portal.note-function.js before chisel.portal.js.");
  const queueApi = window.CHISEL_PORTAL_QUEUE;
  if (!queueApi) throw new Error("Load chisel.portal.queue.js before chisel.portal.js.");
  const loadingQueue = queueApi.createQueue({concurrency: 6, reserved: 1, groupLimits: {notes: 2}});
  const viewApi = window.CHISEL_PORTAL_VIEW;
  if (!viewApi) throw new Error("Load chisel.portal.view.js before chisel.portal.js.");
  const streamViews = new WeakMap(), detailViews = new WeakMap(), annotationViews = new WeakMap();
  const streamList = viewApi.createList({key: rowKey,
    create: function (row) { return renderPortalStreamItem(document.createElement("div"), row); },
    update: function (node, row) { renderPortalStreamItem(null, row, {item: node}); },
    dispose: function (node) { noteFunction.disposeWithin(node); }
  });
  let recordView = null;
  const annotationReads = new Map();
  let visibleAnnotationsLoading = false;
  const staticNormalizer = staticData.createNormalizer({
    normalizeCoinName: normalizeCoinName,
    tickerForCoin: tickerForCoin,
    getCoinIndexByCoinName: getCoinIndexByCoinName,
    shortTxid: shortTxid,
    txidRe: TXID_RE
  });
  const staticTransport = staticData.createTransport({ fetch: fetch, crypto: window.crypto, baseUrl: window.location.href });
  let staticHttpLoad = null;
  let staticHttpGeneration = -1;
  let staticHttpSourceKey = "";
  let fileProxyRetryAfter = 0;
  let failedFileProxyBase = "";

  function $(selector) { return document.querySelector(selector); }

  function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = value == null ? "" : String(value);
  }

  function setStatus(message, isError) {
    if (isError) recordPortalError("portal.status", message);
    const el = $("#portalStatus");
    if (!el) return;
    el.textContent = message || "";
    el.className = isError ? "error" : "muted";
  }

  function pretty(value) { return JSON.stringify(value, null, 2); }

  async function copyPortalText(text, button) {
    const value = String(text == null ? "" : text);
    let copied = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        copied = true;
      } catch (error) {}
    }

    if (!copied) {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      area.style.top = "0";
      document.body.appendChild(area);
      area.focus();
      area.select();
      try { copied = document.execCommand("copy"); }
      finally { document.body.removeChild(area); }
    }

    if (!copied) throw new Error("Clipboard copy is not available in this browser context.");

    if (button) {
      const label = button.textContent;
      button.textContent = "COPIED";
      window.setTimeout(function () { button.textContent = label; }, 1200);
    }
    return true;
  }

  function safeArray(value) { return Array.isArray(value) ? value : []; }
  function yieldPortalThread() {
    return new Promise(function (resolve) { window.setTimeout(resolve, 0); });
  }

  function portalRowCacheFor(row) {
    if (!row || typeof row !== "object") return null;
    let cache = portalRowDerivedCache.get(row);
    if (!cache) {
      cache = Object.create(null);
      portalRowDerivedCache.set(row, cache);
    }
    return cache;
  }

  function portalReadPriority(row, group) {
    const key = row && (row.key || rowKey(row));
    if (key && (state.expandedRowKeys[key] || state.selectedRowKey === key ||
        recordView && recordView.currentRow() === row)) return 0;
    return (isVisiblePortalRow(row) ? 10 : 20) + (group === "notes" ? 1 : 0);
  }

  function queuePortalRead(key, row, group, run) {
    return loadingQueue.enqueue({key: key, owner: row, group: group,
      priority: portalReadPriority(row, group), order: rowTime(row), run: run});
  }

  function invalidatePortalRowCache(row) {
    if (row && typeof row === "object") portalRowDerivedCache.delete(row);
  }

  function normalizePortalAnnotation(value) { return notesData.normalize(value); }

  function portalAnnotationHasContent(annotation) { return notesData.hasContent(annotation); }

  function loadPortalAnnotations() {
    const next = Object.create(null);
    try {
      const raw = window.localStorage ? window.localStorage.getItem(PORTAL_ANNOTATIONS_STORAGE_KEY) : "";
      const parsed = raw ? JSON.parse(raw) : {};
      Object.keys(parsed || {}).forEach(function (key) {
        const annotation = normalizePortalAnnotation(parsed[key]);
        if (portalAnnotationHasContent(annotation) || annotation.updatedAt) next[key] = annotation;
      });
    } catch (error) {
      setStatus("Local annotation store could not be read: " + (error.message || String(error)), true);
    }
    state.portalAnnotations = next;
  }

  function savePortalAnnotations() {
    try {
      if (!window.localStorage) throw new Error("localStorage is not available");
      window.localStorage.setItem(PORTAL_ANNOTATIONS_STORAGE_KEY, JSON.stringify(state.portalAnnotations));
      return true;
    } catch (error) {
      setStatus("Local annotation store could not be saved: " + (error.message || String(error)), true);
      return false;
    }
  }

  function portalAnnotationKey(row) {
    if (!row) return "";
    return row.key || rowKey(row);
  }

  function getPortalAnnotation(row) {
    const key = portalAnnotationKey(row);
    return normalizePortalAnnotation(key ? state.portalAnnotations[key] : null);
  }

  function setPortalAnnotation(row, annotation) {
    const key = portalAnnotationKey(row);
    if (!key) return false;
    const clean = normalizePortalAnnotation(Object.assign({}, annotation, { updatedAt: Date.now() }));
    state.portalAnnotations[key] = clean;
    invalidatePortalRowCache(row);
    row.annotationRevision = (row.annotationRevision || 0) + 1;
    return savePortalAnnotations();
  }

  function clearPortalAnnotation(row) {
    const key = portalAnnotationKey(row);
    if (!key) return false;
    delete state.portalAnnotations[key];
    invalidatePortalRowCache(row);
    row.annotationRevision = (row.annotationRevision || 0) + 1;
    return savePortalAnnotations();
  }

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

  function humanUrlTitle(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (youtubeIdFromUrl(url)) return "YouTube";
    if (tiktokUrlFromUrl(url)) return "TikTok";
    if (/open\.spotify\.com/i.test(url)) return "Spotify";
    if (/\/ipfs\//i.test(url)) return "IPFS";
    try {
      return new URL(url, window.location.href).hostname.replace(/^www\./i, "") || "link";
    } catch (error) {
      return "link";
    }
  }

  function looksLikeEncodedPortalTitle(value) {
    const text = printableText(value);
    const compact = text.replace(/\s+/g, "");
    if (compact.length < 20 || text.split(/\s+/).length > 3) return false;
    if (!/^[A-Za-z0-9]+$/.test(compact)) return false;
    if (/^[0-9a-f]{32,}$/i.test(compact)) return true;
    if (/([A-Za-z0-9])\1{5,}/.test(compact)) return true;
    if (!/[a-z]/.test(compact) || !/[A-Z0-9]/.test(compact)) return false;
    const noisy = (compact.match(/[A-Z0-9]/g) || []).length;
    return noisy / compact.length > 0.28;
  }

  function isPlainAddressDerivedTitle(row, value) {
    const title = printableText(value);
    if (!title || !row || !row.raw) return false;
    const lines = extractLines(row.raw);
    const records = buildSemantics(row.raw, lines).records || [];
    return records.some(function (record) {
      if (record.kind !== "address") return false;
      return printableText(record.displayText || record.payloadText) === title;
    });
  }

  function recordTargetUrlForRow(row) {
    const cache = portalRowCacheFor(row);
    if (cache && Object.prototype.hasOwnProperty.call(cache, "targetUrl")) return cache.targetUrl;
    const summary = row && row.summary ? row.summary : {};
    const candidates = [summary.primaryUrl, row && row.primaryUrl, summary.title, row && row.title];
    for (let i = 0; i < candidates.length; i += 1) {
      const urls = htmlAttributeUrls(candidates[i]);
      if (urls.length) {
        const target = normalizeMediaUrl(urls[0]);
        if (cache) cache.targetUrl = target;
        return target;
      }
    }
    if (cache) cache.targetUrl = "";
    return "";
  }

  function displayTitleForRow(row) {
    const notedTitle = getPortalAnnotation(row).metadata.title;
    if (typeof notedTitle === "string" && notedTitle.trim()) return truncateText(notedTitle, 96);
    const target = recordTargetUrlForRow(row);
    const captured = target ? readPageMetadata(target) : null;
    if (captured && captured.title) return truncateText(captured.title, 96);
    const cache = portalRowCacheFor(row);
    if (cache && Object.prototype.hasOwnProperty.call(cache, "displayTitle")) return cache.displayTitle;
    const summary = row && row.summary ? row.summary : {};
    const primaryUrl = recordTargetUrlForRow(row);
    const behaviorTitle = portalBehaviorTitleForRow(row);
    if (behaviorTitle) {
      if (cache) cache.displayTitle = behaviorTitle;
      return behaviorTitle;
    }
    const rawTitle = summary.title || (row && row.title) || "";
    const anchorTitle = anchorTextsFromHtml(rawTitle)[0] || "";
    let title = isRawHtmlTitle(rawTitle) ? compactMediaTitle(anchorTitle || rawTitle) : printableText(rawTitle);
    if (title.includes("\ufffd")) title = "";

    if (isLikelyUrl(title) || isPlainAddressDerivedTitle(row, title) || looksLikeEncodedPortalTitle(title)) title = "";
    if (/^untitled transaction$/i.test(title) || /^(?:evm )?transaction(?:\s+[0-9a-f]{6,}(?:…[0-9a-f]{4,})?)?$/i.test(title)) title = "";
    if (!title) {
      const media = collectEvmMediaCards(row).map(mediaCardPresentation).find(function (card) { return card.title; });
      if (media) title = media.title;
    }
    const display = title ? truncateText(title, 96) : (primaryUrl ? humanUrlTitle(primaryUrl) : "transaction " + shortTxid(row && row.txid));
    if (cache) cache.displayTitle = display;
    return display;
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
    if (Array.isArray(entry.addresses) && entry.addresses.length) return entry.addresses[0];
    if (entry.addr) return entry.addr;
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

  function cleanTxid(value) {
    const text = String(value || "").trim();
    const stripped = text.replace(/^0x/i, "").toLowerCase();
    return /^[0-9a-f]{64}$/.test(stripped) ? stripped : text;
  }

  function extractTxid(value) {
    if (!value || typeof value !== "object") return "";
    return cleanTxid(value.txid || value.hash || value.id || (value.tx && (value.tx.txid || value.tx.hash || value.tx.id)) || "");
  }

  function firstValue(values) {
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] !== undefined && values[i] !== null && values[i] !== "") return values[i];
    }
    return undefined;
  }

  function txObject(value) {
    return value && value.tx && typeof value.tx === "object" ? value.tx : value;
  }

  function extractBlockTime(value) {
    const tx = txObject(value);
    const status = tx && tx.status && typeof tx.status === "object" ? tx.status : {};
    const summary = value && value.summary && typeof value.summary === "object" ? value.summary : {};
    return normalizeUnixTime(firstValue([
      summary.blockTime, summary.timeStamp, summary.timestamp,
      status.block_time, status.blockTime, status.time, status.timestamp,
      tx && tx.block_time, tx && tx.blockTime, tx && tx.blocktime, tx && tx.time, tx && tx.timestamp, tx && tx.received_time,
      tx && tx.timeStamp, tx && typeof tx.confirmed === "string" ? tx.confirmed : undefined
    ]));
  }

  function extractBlockHeight(value) {
    const tx = txObject(value);
    const status = tx && tx.status && typeof tx.status === "object" ? tx.status : {};
    const summary = value && value.summary && typeof value.summary === "object" ? value.summary : {};
    const height = Number(firstValue([
      summary.blockHeight, summary.blockNumber,
      status.block_height, status.blockHeight,
      tx && tx.block_height, tx && tx.blockHeight, tx && tx.blockheight, tx && tx.height, tx && tx.blockNumber
    ]));
    return Number.isFinite(height) && height > 0 ? height : undefined;
  }


  const UTXO_BLOCK_TIME_CHECKPOINTS = {
    dogecoin: [[0, 1386325540], [1000000, 1449583300], [2000000, 1510419600], [3000000, 1578902400], [4000000, 1642779000], [5000000, 1706100000], [6000000, 1769500000]],
    ravencoin: [[0, 1514999494], [1000000, 1575400000], [2000000, 1635850000], [3000000, 1696400000], [4000000, 1757000000]],
    digibyte: [[0, 1389388390], [5000000, 1460200000], [10000000, 1525300000], [15000000, 1590400000], [20000000, 1655600000], [25000000, 1720800000]],
    litecoin: [[0, 1317972665], [1000000, 1452400000], [2000000, 1590300000], [3000000, 1728000000]],
    bitcoin: [[0, 1231006505], [300000, 1399700000], [600000, 1573500000], [900000, 1749000000]]
  };

  function estimateUtxoBlockTime(coin, height) {
    const clean = normalizeCoinName(coin || "");
    const h = Number(height);
    const points = UTXO_BLOCK_TIME_CHECKPOINTS[clean] || [];
    if (!Number.isFinite(h) || h <= 0 || points.length < 2) return 0;
    let a = points[0];
    let b = points[points.length - 1];
    if (h <= points[0][0]) {
      a = points[0];
      b = points[1];
    } else if (h >= points[points.length - 1][0]) {
      a = points[points.length - 2];
      b = points[points.length - 1];
    } else {
      for (let i = 0; i < points.length - 1; i += 1) {
        if (points[i][0] <= h && h <= points[i + 1][0]) {
          a = points[i];
          b = points[i + 1];
          break;
        }
      }
    }
    if (b[0] === a[0]) return Math.floor(a[1]);
    return Math.floor(a[1] + ((h - a[0]) * (b[1] - a[1]) / (b[0] - a[0])));
  }

  function blockTimeForRowValue(value, rowCoin) {
    const exact = extractBlockTime(value);
    if (exact) return exact;
    return estimateUtxoBlockTime(rowCoin || (value && (value.coin || value.ticker || value.chain)), extractBlockHeight(value));
  }

  // Ledger amounts are exact integer satoshis. RPC's decimal LTC values
  // and Esplora's integer-satoshi values must never be interpreted alike.
  function satoshiInteger(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : null;
  }

  function ltcCoinsToSatoshis(value) {
    if (value === null || value === undefined || value === "") return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    const sat = Math.round(amount * 100000000);
    return Number.isSafeInteger(sat) && Math.abs((amount * 100000000) - sat) < 0.001 ? sat : null;
  }

  function portalOutputSatoshis(output) {
    if (!output || typeof output !== "object") return null;
    const sat = firstValue([output.valueSat, output.value_sat, output.satoshis]);
    if (sat !== undefined) return satoshiInteger(sat);
    if (output.value === undefined) return null;
    // Insight normalizer adds scriptpubkey_* aliases to Bitcoin Core outputs,
    // but leaves their decimal LTC value unchanged. Original scriptPubKey wins.
    if (output.scriptPubKey && typeof output.scriptPubKey === "object") {
      return ltcCoinsToSatoshis(output.value);
    }
    // BlockCypher "outputs" and Esplora "vout" both use integer satoshis.
    const sats = output.scriptpubkey !== undefined ||
      output.scriptpubkey_type !== undefined || output.scriptpubkey_address !== undefined ||
      Array.isArray(output.addresses) || output.script !== undefined;
    return sats ? satoshiInteger(output.value) : null;
  }

  function portalFinanceAddress(row) {
    const personal = normalizePersonalAccount(state.personalAccount);
    if (personal && personal.coin === "litecoin") return personal.address;
    // The transaction stream's search box can be an exact Litecoin address.
    // Preserve its original case; Bitcoin-family base58 is case-sensitive.
    const box = $("#portalEvmWordSearch");
    const searched = String(box && box.value || "").trim();
    if (/^[LM3][1-9A-HJ-NP-Za-km-z]{25,40}$/.test(searched)) return searched;
    return row && row.index && row.index.address ? row.index.address : "";
  }

  function portalInputSatoshis(input) {
    const prevout = input && (input.prevout || input.prevOut);
    if (prevout) return portalOutputSatoshis(prevout);
    // BlockCypher inputs report the previously spent UTXO as output_value.
    if (input && input.output_value !== undefined) return satoshiInteger(input.output_value);
    return null;
  }

  function portalFinanceForRow(row) {
    if (!row || canonicalCoinForRow(row) !== "litecoin") return null;
    const selectedAddress = portalFinanceAddress(row);
    const canonicalAddress = String(selectedAddress || "").trim();
    if (!row.raw) {
      // The personal-account cache stores summaries rather than complete txs.
      const cached = row.summary && row.summary.ledgerFinance;
      if (!cached || !cached.outputTotalSat && cached.outputTotalSat !== 0) return null;
      return Object.assign({}, cached, {
        selectedAddress: selectedAddress,
        netSat: canonicalAddress &&
          canonicalAddress === String(cached.selectedAddress || "").trim()
          ? cached.netSat : null,
        inputs: [], outputs: []
      });
    }
    const tx = txObject(row.raw);
    const vout = tx && (tx.vout || tx.outputs);
    if (!Array.isArray(vout)) return null;
    const vin = Array.isArray(tx.vin) ? tx.vin : (Array.isArray(tx.inputs) ? tx.inputs : []);
    const sameAddress = function (address) {
      const candidate = String(address || "").trim();
      if (!canonicalAddress || !candidate) return false;
      return /^(ltc1|tltc1)/i.test(canonicalAddress)
        ? candidate.toLowerCase() === canonicalAddress.toLowerCase()
        : candidate === canonicalAddress;
    };

    let outputTotalSat = 0, outputComplete = true, receivedSat = 0;
    const outputs = vout.map(function (entry, i) {
      const valueSat = portalOutputSatoshis(entry);
      const address = getOutputAddress(entry);
      if (valueSat === null) outputComplete = false;
      else {
        outputTotalSat += valueSat;
        if (sameAddress(address)) receivedSat += valueSat;
      }
      return { n: typeof entry.n === "number" ? entry.n : i, address: address,
        valueSat: valueSat, type: getOutputType(entry) };
    });
    if (!Number.isSafeInteger(outputTotalSat)) outputComplete = false;

    let inputTotalSat = 0, inputComplete = vin.length > 0;
    let spentSat = 0, trackedInputsComplete = true, addressesComplete = vin.length > 0;
    const inputs = vin.map(function (entry, i) {
      const valueSat = portalInputSatoshis(entry);
      const address = getInputAddress(entry);
      if (valueSat === null) inputComplete = false;
      else {
        inputTotalSat += valueSat;
        if (sameAddress(address)) spentSat += valueSat;
      }
      if (!address) addressesComplete = false;
      if (sameAddress(address) && valueSat === null) trackedInputsComplete = false;
      return { n: i, address: address, valueSat: valueSat };
    });
    if (!Number.isSafeInteger(inputTotalSat)) inputComplete = false;

    const feeFromSat = firstValue([tx.feeSat, tx.fee_sat, tx.fee_sats, tx.fees]);
    const esplora = vout.some(function (entry) {
      return entry && (entry.scriptpubkey !== undefined ||
        entry.scriptpubkey_type !== undefined || entry.scriptpubkey_address !== undefined);
    });
    let feeSat = feeFromSat !== undefined ? satoshiInteger(feeFromSat) : null;
    if (feeSat === null && tx.fee !== undefined) {
      feeSat = esplora ? satoshiInteger(tx.fee) : ltcCoinsToSatoshis(tx.fee);
    }
    if (feeSat === null && inputComplete && outputComplete) {
      feeSat = satoshiInteger(inputTotalSat - outputTotalSat);
    }
    // A missing input address could belong to the selected identity; do not
    // claim a net change until all input addresses and applicable values exist.
    const netSat = canonicalAddress && addressesComplete && trackedInputsComplete &&
      outputComplete ? receivedSat - spentSat : null;
    return {
      selectedAddress: selectedAddress, netSat: netSat,
      outputTotalSat: outputComplete ? outputTotalSat : null,
      inputTotalSat: inputComplete ? inputTotalSat : null,
      feeSat: feeSat, inputs: inputs, outputs: outputs
    };
  }

  function formatPortalSatoshis(value) {
    if (!Number.isSafeInteger(value)) return "";
    return (value > 0 ? "+" : "") + value.toLocaleString("en-US") + " sat";
  }

  function formatPortalLitecoin(value, signed) {
    if (!Number.isSafeInteger(value)) return "";
    return (signed && value > 0 ? "+" : "") +
      (value / 100000000).toFixed(8) + " LTC";
  }

  function compactPortalFinanceSummary(finance) {
    if (!finance) return null;
    return {
      selectedAddress: finance.selectedAddress || "",
      netSat: finance.netSat,
      outputTotalSat: finance.outputTotalSat,
      inputTotalSat: finance.inputTotalSat,
      feeSat: finance.feeSat
    };
  }

  // Litecoin transaction details follow the familiar explorer structure:
  // every spent UTXO on the left, every created output on the right.
  // Zero-value scripts are shown, not silently dropped.
  function portalLedgerTarget(raw, parsed, direction) {
    if (parsed && parsed.address) return {
      label: parsed.address, address: parsed.address, kind: "address", subtitle: ""
    };
    const isCoinbase = direction === "input" && raw && (
      raw.coinbase != null || raw.is_coinbase === true ||
      raw.output_index === -1 || raw.tx_output_n === -1);
    if (isCoinbase) return { label: "Coinbase", address: "", kind: "coinbase", subtitle: "Newly mined coins" };
    const asm = String(raw && (raw.scriptpubkey_asm || (raw.scriptPubKey && raw.scriptPubKey.asm)) || "");
    const script = String(raw && (raw.script || raw.scriptpubkey ||
      (raw.scriptPubKey && raw.scriptPubKey.hex)) || "");
    if (direction === "output" && (/^OP_RETURN(?:\s|$)/i.test(asm) || /^6a/i.test(script))) {
      const payload = payloadData.fromOutput(raw);
      return { label: "OP_RETURN", address: "", kind: "data",
        subtitle: payload && (payload.text || payload.label) || "Data output", rawScript: script || asm };
    }
    return { label: script ? "Script output" : "Address unavailable", address: "",
      kind: "script", subtitle: script ? script.slice(0, 40) + (script.length > 40 ? "…" : "") : "",
      rawScript: script || asm };
  }

  function appendPortalFinanceDetails(container, row) {
    const finance = portalFinanceForRow(row);
    if (!finance || !row.raw) return null;
    const tx = txObject(row.raw);
    const sources = Array.isArray(tx && tx.vin) ? tx.vin :
      (Array.isArray(tx && tx.inputs) ? tx.inputs : []);
    const destinations = Array.isArray(tx && tx.vout) ? tx.vout :
      (Array.isArray(tx && tx.outputs) ? tx.outputs : []);

    const block = document.createElement("section");
    block.className = "portalFinanceDetails portalLedgerPanel";
    const heading = document.createElement("h5");
    heading.textContent = "Transaction flow";
    block.appendChild(heading);

    const overview = document.createElement("div");
    overview.className = "portalFinanceOverview";
    const values = [];
    if (finance.netSat !== null) values.push("Selected address: " + formatPortalLitecoin(finance.netSat, true));
    if (finance.inputTotalSat !== null) values.push("Inputs: " + formatPortalLitecoin(finance.inputTotalSat));
    if (finance.outputTotalSat !== null) values.push("Outputs: " + formatPortalLitecoin(finance.outputTotalSat));
    if (finance.feeSat !== null) values.push("Fee: " + formatPortalLitecoin(finance.feeSat));
    overview.textContent = values.join("  ·  ") || "Values are not available from this provider.";
    block.appendChild(overview);

    const columns = document.createElement("div");
    columns.className = "portalLedgerSides";

    function appendSide(label, entries, parsed, direction) {
      const side = document.createElement("section");
      side.className = "portalLedgerSide";
      const title = document.createElement("h6");
      title.textContent = label + " (" + entries.length + ")";
      side.appendChild(title);
      const table = document.createElement("table");
      table.className = "portalLedgerTable";
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      ["Address / script", "Amount"].forEach(function (label) {
        const cell = document.createElement("th");
        cell.textContent = label;
        headRow.appendChild(cell);
      });
      head.appendChild(headRow);
      table.appendChild(head);
      const body = document.createElement("tbody");
      entries.forEach(function (raw, index) {
        const value = parsed[index] || {};
        const target = portalLedgerTarget(raw, value, direction);
        const tr = document.createElement("tr");
        const targetCell = document.createElement("td");
        const line = document.createElement("div");
        line.className = "portalLedgerTarget";
        const ordinal = document.createElement("span");
        ordinal.className = "portalLedgerOrdinal";
        ordinal.textContent = "#" + (typeof value.n === "number" ? value.n : index);
        line.appendChild(ordinal);
        const name = document.createElement(target.address ? "a" : "span");
        name.className = "portalLedgerAddress";
        name.textContent = target.label;
        if (target.address) {
          const api = getThunderwords();
          const entry = rowIndexEntry(row);
          const url = api && entry ? api.getAddressUrl(entry, target.address) : "";
          if (url) {
            setSafeHref(name, url);
            name.target = "_blank";
            name.rel = "noopener noreferrer";
            name.title = "Open address in explorer: " + target.address;
          } else {
            name.removeAttribute("href");
          }
        } else if (target.rawScript) {
          name.title = target.rawScript;
        }
        line.appendChild(name);
        if (target.subtitle) {
          const subtitle = document.createElement("small");
          subtitle.className = "portalLedgerSubtitle";
          subtitle.textContent = target.subtitle;
          if (target.rawScript) subtitle.title = target.rawScript;
          line.appendChild(subtitle);
        }
        targetCell.appendChild(line);
        const amountCell = document.createElement("td");
        amountCell.className = "portalLedgerAmount " + (direction === "input" ? "isInput" : "isOutput");
        if (Number.isSafeInteger(value.valueSat)) {
          const amount = direction === "input" ? "−" : "+";
          amountCell.textContent = amount + formatPortalLitecoin(value.valueSat, false);
          amountCell.title = value.valueSat.toLocaleString("en-US") + " satoshis";
        } else {
          amountCell.textContent = target.kind === "coinbase" ? "new coins" : "unknown";
          amountCell.title = target.kind === "coinbase"
            ? "Coinbase transactions have no spent inputs."
            : "Input/output value not provided";
        }
        tr.appendChild(targetCell);
        tr.appendChild(amountCell);
        body.appendChild(tr);
      });
      if (!entries.length) {
        const empty = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 2;
        cell.textContent = "No " + label.toLowerCase() + " recorded.";
        empty.appendChild(cell);
        body.appendChild(empty);
      }
      table.appendChild(body);
      side.appendChild(table);
      columns.appendChild(side);
    }

    appendSide("Inputs", sources, finance.inputs, "input");
    appendSide("Outputs", destinations, finance.outputs, "output");
    block.appendChild(columns);
    container.appendChild(block);
    return block;
  }

  function extractOutputs(value) {
    const tx = value && value.tx && (Array.isArray(value.tx.vout) || Array.isArray(value.tx.outputs)) ? value.tx : value;
    return safeArray(tx && (tx.vout || tx.outputs)).map(function (entry, index) {
      const address = getOutputAddress(entry);
      const type = getOutputType(entry);
      const payload = payloadData.fromOutput(entry);
      return {
        n: typeof entry.n === "number" ? entry.n : index,
        address: address,
        type: type,
        value: getOutputValue(entry),
        opReturnHex: payload && payload.hex || "",
        opReturnText: payload && payload.text || "",
        opReturnPayload: payload,
        raw: entry
      };
    });
  }

  function opReturnTextForRow(row) {
    // Read the same output scripts used by the expanded transaction flow.
    // Older cached summaries may have only a generic title or no OP_RETURN.
    const payloads = extractOutputs(row && row.raw).map(function (output) { return output.opReturnPayload; }).filter(Boolean);
    if (payloads.length) return payloads.map(function (payload) { return payload.text || payload.label; }).join("\n");
    const text = String(row && row.summary && row.summary.opReturnText ||
      row && row.draftRecord && row.draftRecord.ledger.opReturnText || "").trim();
    return text.includes("\ufffd") ? "OP_RETURN data · open record to inspect bytes" : text;
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

    const artifactBody = trimMacPadding(payload);
    // Sticker/index records use LLx followed by exactly 16 hexadecimal digits.
    // Base58 cannot carry the character "0", so McDougall's "c" is accepted
    // as the on-ledger representation of zero.
    const artifactId = (
      isMacDougallFirst(first) &&
      first === "L" &&
      modifier === "L" &&
      spacer === "x" &&
      /^[1-9A-Fc]{16}$/.test(artifactBody)
    )
      ? artifactBody.replace(/c/g, "0").toUpperCase()
      : "";

    if (artifactId) {
      record.kind = "artifact-index";
      record.artifactId = artifactId;
      record.displayText = "Sticker " + artifactId;
    }
    else if (first === "S") record.kind = "image-chord-line";
    else if (isMacDougallFirst(first) && modifier === "A" && spacer === "x") record.kind = "person";
    else if (isMacDougallFirst(first) && modifier === "B" && spacer === "x") record.kind = "transport";
    else if (isMacDougallFirst(first) && modifier === "C" && spacer === "x") record.kind = "subject";
    else if (isMacDougallFirst(first) && modifier === "D" && spacer === "x") record.kind = "ipfs-v0-first-half";
    else if (isMacDougallFirst(first) && modifier === "E" && spacer === "x") record.kind = "ipfs-v0-second-half";
    else if (isMacDougallFirst(first) && modifier === "D" && spacer !== "x") record.kind = "free-verse";
    else if (isRepeatedThunderword(text)) record.kind = "thunderword-index";

    // CIDv0 is encoded as two fixed-width 23-character chunks. Do not use the
    // normal MacDougall padding trimmer here: a valid CID chunk may itself end
    // in "z", and each address also has two trailing padding characters.
    if (record.kind === "ipfs-v0-first-half" || record.kind === "ipfs-v0-second-half") {
      record.payloadBase58Candidate = payload.slice(0, 23);
    }

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
      if (output.opReturnPayload) {
        const payload = describeOpReturnText(output.opReturnText);
        records.push({
          kind: "op-return",
          index: output.n,
          hex: output.opReturnHex,
          text: output.opReturnText,
          title: payload.title || output.opReturnPayload.label,
          encoding: output.opReturnPayload.kind,
          bytes: output.opReturnPayload.bytes,
          base64: output.opReturnPayload.base64,
          scriptHex: output.opReturnPayload.scriptHex,
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
    const artifact = records.find(function (record) { return record.kind === "artifact-index" && record.artifactId; });
    if (artifact) return "Sticker " + artifact.artifactId;

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
      setSafeHref(a, url);
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
    if (input.prevout && getOutputAddress(input.prevout)) return getOutputAddress(input.prevout);
    if (input.prevOut && input.prevOut.addr) return input.prevOut.addr;
    if (input.prevOut && getOutputAddress(input.prevOut)) return getOutputAddress(input.prevOut);
    if (input.addr) return input.addr;
    if (input.address) return input.address;
    if (input.recipient) return input.recipient;
    if (Array.isArray(input.addresses) && input.addresses.length) return input.addresses[0];
    if (input.scriptSig && input.scriptSig.address) return input.scriptSig.address;
    return "";
  }

  function extractInputAddresses(value) {
    const nested = value && value.tx && typeof value.tx === "object" ? value.tx : null;
    const tx = nested && (Array.isArray(nested.vin) || Array.isArray(nested.inputs)) ? nested : value;
    const seen = new Set();
    const out = [];
    safeArray(tx && (tx.vin || tx.inputs)).forEach(function (input) {
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
    if (Array.isArray(value.outputs)) return collectAddressesFromVout(value.outputs);
    if (value.tx && Array.isArray(value.tx.vout)) return collectAddressesFromVout(value.tx.vout);
    if (value.tx && Array.isArray(value.tx.outputs)) return collectAddressesFromVout(value.tx.outputs);
    return [];
  }

  function isEvmTransactionJson(value, indexEntry) {
    if (!value || typeof value !== "object") return false;
    const explicitCoin = normalizeCoinName(value.coin || value.ticker || value.chain || (indexEntry && (indexEntry.coin || indexEntry.ticker || indexEntry.name)));
    if (explicitCoin && explicitCoin !== "evm") return false;
    if (explicitCoin === "evm") return true;
    const tx = txObject(value);
    if (Array.isArray(tx && tx.vout) || Array.isArray(tx && tx.outputs) ||
        Array.isArray(tx && tx.vin) || Array.isArray(tx && tx.inputs)) return false;
    if (value.tx && value.tx.hash && value.tx.input !== undefined) return true;
    return !!(value.hash && value.input !== undefined && value.timeStamp !== undefined);
  }

  function evmHashForExplorer(value, txid) {
    const tx = txObject(value);
    const hash = (value && value.hash) || (tx && tx.hash) || txid || "";
    return String(hash || "").match(/^0x/i) ? String(hash) : (hash ? "0x" + hash : "");
  }

  function evmExplorerUrl(value, txid) {
    const chainId = String((value && value.chainId) || "137");
    const hash = evmHashForExplorer(value, txid);
    if (!hash) return "";
    if (chainId === "1") return "https://etherscan.io/tx/" + encodeURIComponent(hash);
    if (chainId === "11155111") return "https://sepolia.etherscan.io/tx/" + encodeURIComponent(hash);
    if (chainId === "80002") return "https://amoy.polygonscan.com/tx/" + encodeURIComponent(hash);
    return "https://polygonscan.com/tx/" + encodeURIComponent(hash);
  }

  function imageAssetFromSummary(summary) {
    const s = summary || {};
    if (!s.imageAssetPath) return null;
    return {
      assetId: s.imageAssetId || "",
      path: s.imageAssetPath,
      mime: s.imageMime || "",
      bytes: s.imageBytes || 0,
      width: s.imageWidth || 0,
      height: s.imageHeight || 0
    };
  }

  function collectEvmImageAssets(row) {
    const out = [];
    const seen = Object.create(null);
    function add(asset) {
      if (!asset || !asset.path) return;
      const key = String(asset.path);
      if (seen[key]) return;
      seen[key] = true;
      out.push(asset);
    }
    if (row && row.imageAsset) add(row.imageAsset);
    if (row && row.summary) add(imageAssetFromSummary(row.summary));
    const raw = row && row.raw ? row.raw : row;
    if (raw && raw.summary) add(imageAssetFromSummary(raw.summary));
    const assets = raw && raw.assets && typeof raw.assets === "object" ? raw.assets : {};
    safeArray(assets.images).forEach(add);
    return out;
  }

  function mediaUrlFromYoutubeId(id, start) {
    const vid = String(id || "").trim();
    if (!vid) return "";
    return "https://www.youtube.com/watch?v=" + encodeURIComponent(vid) + (start ? "&t=" + encodeURIComponent(start) + "s" : "");
  }

  function youtubeIdFromUrl(url) {
    const u = decodeHtmlEntities(String(url || "")).trim();
    const patterns = [
      /(?:youtube\.com|youtube-nocookie\.com)\/embed\/([A-Za-z0-9_-]{6,})/i,
      /(?:youtube\.com|youtube-nocookie\.com)\/shorts\/([A-Za-z0-9_-]{6,})/i,
      /(?:youtube\.com|youtube-nocookie\.com)\/live\/([A-Za-z0-9_-]{6,})/i,
      /youtu\.be\/([A-Za-z0-9_-]{6,})/i,
      /[?&]v=([A-Za-z0-9_-]{6,})/i
    ];
    for (let i = 0; i < patterns.length; i += 1) {
      const match = u.match(patterns[i]);
      if (match) return match[1];
    }
    return "";
  }

  function secondsFromYoutubeTime(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/^\d+$/.test(text)) return text;
    let total = 0;
    let matched = false;
    text.replace(/(\d+)([hms])/gi, function (_all, number, unit) {
      matched = true;
      const n = Number(number) || 0;
      const u = String(unit).toLowerCase();
      if (u === "h") total += n * 3600;
      else if (u === "m") total += n * 60;
      else total += n;
      return _all;
    });
    return matched ? String(total) : "";
  }

  function youtubeStartFromUrl(url) {
    const u = decodeHtmlEntities(String(url || ""));
    const match = u.match(/[?&](?:start|t)=([0-9hms]+)/i);
    return match ? secondsFromYoutubeTime(match[1]) : "";
  }

  function setSafeHref(element, value) {
    const safe = CHISEL.safeWebUrl(value, window.location.href);
    if (safe) element.href = safe;
    else element.removeAttribute("href");
    return safe;
  }

  function normalizeMediaUrl(url) {
    let u = decodeHtmlEntities(String(url || "")).trim().replace(/[),.;]+$/g, "");
    u = CHISEL.safeWebUrl(u, window.location.href);
    if (!u) return "";
    const vid = youtubeIdFromUrl(u);
    if (vid) return mediaUrlFromYoutubeId(vid, youtubeStartFromUrl(u));
    const spotify = u.match(/open\.spotify\.com\/embed\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/i);
    if (spotify) return "https://open.spotify.com/" + spotify[1].toLowerCase() + "/" + spotify[2];
    return u;
  }

  function mediaKindForUrl(url) {
    const u = String(url || "").toLowerCase();
    if (youtubeIdFromUrl(u)) return "youtube";
    if (tiktokUrlFromUrl(url)) return "tiktok";
    if (u.indexOf("open.spotify.com") >= 0) return "spotify";
    if (u.indexOf("archive.org") >= 0) return "archive";
    if (u.indexOf("voca.ro") >= 0 || u.indexOf("vocaroo.com") >= 0) return "audio";
    if (/\.(mp3|flac|wav|ogg|m4a)(?:[?#].*)?$/i.test(u)) return "audio";
    return "link";
  }

  function youtubeThumbnailUrl(videoId) {
    const vid = String(videoId || "").trim();
    return vid ? "https://i.ytimg.com/vi/" + encodeURIComponent(vid) + "/hqdefault.jpg" : "";
  }

  function tiktokUrlFromUrl(url) {
    const clean = decodeHtmlEntities(String(url || "")).trim().replace(/[),.;]+$/g, "");
    if (!clean || clean.length > 2048) return "";
    try {
      const parsed = new URL(clean, window.location.href);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
      const host = String(parsed.hostname || "").toLowerCase().replace(/\.$/, "");
      if (host === "tiktok.com" || /\.tiktok\.com$/.test(host) || host === "tik.tok" || /\.tik\.tok$/.test(host)) return clean;
    } catch (error) {}
    return "";
  }

  function tiktokVideoIdFromUrl(url) {
    const clean = tiktokUrlFromUrl(url);
    const match = clean.match(/\/(?:@[^/]+\/)?video\/(\d{8,})/i);
    return match ? match[1] : "";
  }

  function tiktokThumbnailProxyUrl(url) {
    const clean = tiktokUrlFromUrl(url);
    return clean ? getFileProxyUrl() + "/tiktok-thumbnail?url=" + encodeURIComponent(clean) : "";
  }

  function htmlAttributeUrls(text) {
    const raw = decodeHtmlEntities(String(text || ""));
    const out = [];
    raw.replace(/\b(?:href|src)\s*=\s*(?:["'])?([^"'\s>]+)/gi, function (_all, url) {
      const clean = String(url || "").replace(/[),.;]+$/g, "");
      if (/^https?:\/\//i.test(clean)) out.push(clean);
      return _all;
    });
    extractUrlsFromText(raw).forEach(function (url) { out.push(url); });
    return uniqueStrings(out);
  }

  function anchorTextsFromHtml(text) {
    const raw = decodeHtmlEntities(String(text || ""));
    const out = [];
    raw.replace(/<a\b[^>]*>(.*?)<\/a>/gis, function (_all, inner) {
      const clean = cleanHtmlishText(inner);
      if (clean) out.push(clean);
      return _all;
    });
    return uniqueStrings(out);
  }

  function isRawHtmlTitle(value) {
    const text = String(value || "");
    return /<\/?[a-z]/i.test(text) || /href\s*=|src\s*=/i.test(text);
  }

  function compactMediaTitle(value) {
    const clean = cleanHtmlishText(value).replace(/^>+\s*/, "");
    return clean.length > 140 ? clean.slice(0, 137) + "…" : clean;
  }

  function buildEvmMediaCardsFromValues(values, words) {
    const rawText = values.map(function (item) { return String(item || ""); }).filter(Boolean).join("\n");
    const urls = htmlAttributeUrls(rawText);
    const anchors = anchorTextsFromHtml(rawText);
    const wordTitle = uniqueStrings(words || []).slice(0, 3).join(" | ");
    const cards = [];
    urls.forEach(function (url, index) {
      const normalized = normalizeMediaUrl(url);
      if (!normalized) return;
      const videoId = youtubeIdFromUrl(url);
      const tiktokUrl = tiktokUrlFromUrl(url);
      const title = compactMediaTitle(anchors[index] || wordTitle || rawText || normalized);
      const card = {
        kind: mediaKindForUrl(url),
        url: normalized,
        sourceUrl: url,
        title: title || normalized,
        text: compactMediaTitle(rawText)
      };
      if (videoId) {
        card.videoId = videoId;
        card.thumbnailUrl = youtubeThumbnailUrl(videoId);
      } else if (tiktokUrl) {
        card.tiktokUrl = tiktokUrl;
        card.tiktokVideoId = tiktokVideoIdFromUrl(tiktokUrl);
        card.thumbnailUrl = tiktokThumbnailProxyUrl(tiktokUrl);
      }
      cards.push(card);
    });
    return cards;
  }

  function collectEvmMediaCards(row) {
    const cache = portalRowCacheFor(row);
    if (cache && cache.mediaCards) return cache.mediaCards;
    const out = [];
    const seen = Object.create(null);
    function add(card) {
      if (!card || typeof card !== "object") return;
      const normalizedUrl = normalizeMediaUrl(card.url || card.sourceUrl || "");
      const url = normalizedUrl;
      const thumb = String(card.thumbnailUrl || "").trim();
      const title = String(card.title || "").trim();
      if (!url && !thumb && !title) return;
      const copy = Object.assign({}, card);
      copy.url = normalizedUrl;
      copy.sourceUrl = CHISEL.safeWebUrl(copy.sourceUrl, window.location.href);
      copy.thumbnailUrl = CHISEL.safeWebUrl(copy.thumbnailUrl, window.location.href);
      if (!copy.kind && url) copy.kind = mediaKindForUrl(url);
      const vid = copy.videoId || youtubeIdFromUrl(copy.sourceUrl || copy.url || url);
      if (vid) {
        copy.videoId = vid;
        copy.thumbnailUrl = copy.thumbnailUrl || youtubeThumbnailUrl(vid);
      }
      const tiktokUrl = copy.tiktokUrl || tiktokUrlFromUrl(copy.sourceUrl || copy.url || url);
      if (tiktokUrl) {
        if (!copy.kind || copy.kind === "link") copy.kind = "tiktok";
        copy.tiktokUrl = tiktokUrl;
        copy.tiktokVideoId = copy.tiktokVideoId || tiktokVideoIdFromUrl(tiktokUrl);
        copy.thumbnailUrl = copy.thumbnailUrl || tiktokThumbnailProxyUrl(tiktokUrl);
      }
      const key = [String(copy.kind || "link"), String(copy.url || copy.sourceUrl || "").toLowerCase(), String(copy.thumbnailUrl || "").toLowerCase(), String(copy.title || "").toLowerCase()].join("|");
      if (seen[key]) return;
      seen[key] = true;
      out.push(copy);
    }
    const raw = row && row.raw ? row.raw : row;
    const summary = row && row.summary ? row.summary : {};
    const rawSummary = raw && raw.summary && typeof raw.summary === "object" ? raw.summary : {};
    const decoded = raw && raw.decoded && typeof raw.decoded === "object" ? raw.decoded : {};
    safeArray(summary.mediaCards).forEach(add);
    const noteMetadata = getPortalAnnotation(row).metadata;
    safeArray(noteMetadata.mediaCards).forEach(add);
    if (noteMetadata.media && typeof noteMetadata.media === "object") add(Object.assign({}, noteMetadata.media, {
      thumbnailUrl: noteMetadata.media.thumbnailUrl || noteMetadata.media.image || ""
    }));
    safeArray(rawSummary.mediaCards).forEach(add);
    safeArray(decoded.mediaCards).forEach(add);
    const words = safeArray(summary.evmWords).concat(safeArray(rawSummary.evmWords), safeArray(decoded.words), decoded.artifact ? [decoded.artifact] : []);
    const values = [
      summary.primaryUrl, summary.title, summary.cleanText,
      rawSummary.primaryUrl, rawSummary.title, rawSummary.cleanText,
      decoded.message, decoded.text, decoded.body, decoded.artifact
    ].concat(safeArray(summary.opReturnUrls), safeArray(rawSummary.opReturnUrls));
    buildEvmMediaCardsFromValues(values, words).forEach(function (card) {
      // A fetched card already describes this link; do not repeat it with a
      // URL-derived title and thumbnail in the same record.
      const url = normalizeMediaUrl(card.url || card.sourceUrl || "");
      if (!out.some(function (existing) { return existing.url === url; })) add(card);
    });
    if (cache) cache.mediaCards = out;
    return out;
  }

  function firstMediaThumbnailCard(row) {
    const cards = collectEvmMediaCards(row);
    for (let i = 0; i < cards.length; i += 1) {
      const display = mediaCardPresentation(cards[i]);
      if (display.thumbnailUrl) return display;
    }
    return null;
  }

  function extractEvmSummary(value, indexEntry) {
    if (!isEvmTransactionJson(value, indexEntry)) return null;
    const tx = txObject(value);
    const txid = extractTxid(value);
    const existing = value && value.summary && typeof value.summary === "object" ? value.summary : {};
    const decoded = value && value.decoded && typeof value.decoded === "object" ? value.decoded : {};
    const assets = value && value.assets && typeof value.assets === "object" ? value.assets : {};
    const imageAssets = safeArray(assets.images).filter(function (asset) { return asset && asset.path; });
    const firstImage = imageAssets[0] || imageAssetFromSummary(existing) || {};
    const valuesForCards = [
      existing.primaryUrl, existing.title, existing.cleanText,
      decoded.message, decoded.text, decoded.body, decoded.artifact
    ].concat(safeArray(existing.opReturnUrls));
    const mediaCards = [];
    safeArray(existing.mediaCards).forEach(function (card) { mediaCards.push(card); });
    buildEvmMediaCardsFromValues(valuesForCards, safeArray(existing.evmWords).concat(safeArray(decoded.words), decoded.artifact ? [decoded.artifact] : [])).forEach(function (card) { mediaCards.push(card); });
    const firstMedia = mediaCards[0] || {};
    const cleanTitle = compactMediaTitle(decoded.message || decoded.text || decoded.body || existing.cleanText || "");
    const existingTitle = isRawHtmlTitle(existing.title) ? "" : printableText(existing.title || "");
    const title = existingTitle || firstMedia.title || cleanTitle || (tx && (tx.functionName || tx.methodId)) || (txid ? "EVM transaction " + shortTxid(txid) : "EVM transaction");
    return {
      txid: txid,
      hash: evmHashForExplorer(value, txid),
      title: title,
      primaryUrl: existing.primaryUrl || firstMedia.url || "",
      lines: 0,
      imageLines: 0,
      imageChordLines: [],
      ipfsCount: 0,
      opReturnText: "",
      opReturnUrls: existing.opReturnUrls || [],
      imageCount: Number(existing.imageCount || imageAssets.length || (firstImage.path ? 1 : 0)) || 0,
      imageAssetPath: existing.imageAssetPath || firstImage.path || "",
      imageMime: existing.imageMime || firstImage.mime || "",
      imageBytes: existing.imageBytes || firstImage.bytes || 0,
      imageWidth: existing.imageWidth || firstImage.width || 0,
      imageHeight: existing.imageHeight || firstImage.height || 0,
      imageAssetId: existing.imageAssetId || firstImage.assetId || "",
      mediaCards: mediaCards,
      blockHeight: extractBlockHeight(value),
      blockTime: extractBlockTime(value),
      methodId: existing.methodId || (tx && tx.methodId) || "",
      functionName: existing.functionName || (tx && tx.functionName) || "",
      contractName: existing.contractName || (value.contract && value.contract.name) || "",
      contractAddress: existing.contractAddress || (value.contract && value.contract.address) || (tx && (tx.to || tx.contractAddress)) || "",
      explorerUrl: existing.explorerUrl || evmExplorerUrl(value, txid) || (indexEntry && txid && window.CHISEL_THUNDERWORDS ? window.CHISEL_THUNDERWORDS.getTxUrl(indexEntry, txid) : "")
    };
  }

  function extractSummary(value, indexEntry) {
    const evmSummary = extractEvmSummary(value, indexEntry);
    if (evmSummary) return evmSummary;
    const txid = extractTxid(value);
    const lines = extractLines(value);
    const semantics = buildSemantics(value, lines);
    const title = titleFromSemantics(semantics, txid);
    const imageLines = lines.filter(function (line) { return /^S/.test(line); }).length;
    const ipfsCount = semantics.records.filter(function (record) { return record.kind === "ipfs-v0-cid"; }).length;
    const opText = semantics.records.filter(function (record) { return record.kind === "op-return" && record.text; }).map(function (record) { return record.text; }).join("\n");
    const opUrls = semantics.records.filter(function (record) { return record.kind === "op-return-url"; }).map(function (record) { return record.url; });
    const primaryUrl = primaryUrlFromSemantics(semantics);
    const artifact = semantics.records.find(function (record) {
      return record.kind === "artifact-index" && record.artifactId;
    });

    return {
      txid: txid,
      artifactId: artifact ? artifact.artifactId : "",
      artifactAddress: artifact ? artifact.line : "",
      title: title,
      primaryUrl: primaryUrl,
      lines: lines.length,
      imageLines: imageLines,
      imageChordLines: lines.filter(function (line) { return /^S/.test(line); }),
      ipfsCount: ipfsCount,
      opReturnText: opText,
      opReturnUrls: opUrls,
      blockHeight: extractBlockHeight(value),
      blockTime: blockTimeForRowValue(value, indexEntry && (indexEntry.coin || indexEntry.ticker || indexEntry.name)),
      ledgerFinance: compactPortalFinanceSummary(portalFinanceForRow({
        raw: value, coin: indexEntry && (indexEntry.coin || indexEntry.ticker || indexEntry.name),
        index: indexEntry
      })),
      blockTimeEstimated: !!(value && value.summary && value.summary.blockTimeEstimated),
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
      setSafeHref(a, record.url);
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
      setSafeHref(a, record.ipfsUrl);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "IPFS gateway";

      const local = document.createElement("a");
      local.className = "secondaryButton";
      setSafeHref(local, record.localIpfsUrl);
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

  function artifactIndexRecordForRow(row) {
    const summary = row && row.summary ? row.summary : {};
    if (summary.artifactId) {
      return {
        kind: "artifact-index",
        artifactId: String(summary.artifactId).toUpperCase(),
        line: String(summary.artifactAddress || "")
      };
    }
    if (!row || !row.raw) return null;
    const semantics = buildSemantics(row.raw, extractLines(row.raw));
    return semantics.records.find(function (record) {
      return record.kind === "artifact-index" && record.artifactId;
    }) || null;
  }

  function makeStickerQr(record, size) {
    if (!record || !record.artifactId || typeof window.QRCode !== "function") return null;

    const artifactId = String(record.artifactId).toUpperCase();
    const pixels = Math.max(96, Number(size) || 220);
    const frame = document.createElement("div");
    frame.className = "portalStickerQrFrame";
    frame.title = "Chisel sticker index " + artifactId;
    // Match tools/qrField: the first six hex digits define the physical
    // sticker's colored frame while the QR itself stays black on white.
    frame.style.backgroundColor = "#" + artifactId.slice(0, 6);

    const body = document.createElement("div");
    body.className = "portalStickerQrBody";
    frame.appendChild(body);

    new window.QRCode(body, {
      text: ChiselSticker.url(artifactId),
      width: pixels,
      height: pixels,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.H
    });

    return frame;
  }

  /*
   * Record behaviors are deliberately separate from the generic transaction
   * renderer. New Chisel record types can add a detector, title and expanded
   * presentation without teaching renderPortalStreamItem about every format.
   */
  const PORTAL_RECORD_BEHAVIORS = [
    {
      id: "sticker-index",
      match: function (row) {
        return artifactIndexRecordForRow(row);
      },
      title: function (record) {
        return "Sticker " + String(record.artifactId || "").toUpperCase();
      },
      renderExpanded: function (container, record) {
        if (!container || !record) return false;

        const panel = document.createElement("section");
        panel.className = "portalInterpretedRecord portalStickerRecord";
        panel.dataset.recordBehavior = "sticker-index";

        const heading = document.createElement("div");
        heading.className = "stepTitle";
        heading.textContent = "Sticker index";
        panel.appendChild(heading);

        const body = document.createElement("div");
        body.className = "portalStickerRecordBody";

        const qr = makeStickerQr(record, 240);
        if (qr) body.appendChild(qr);

        const info = document.createElement("div");
        info.className = "portalStickerRecordInfo";

        const id = document.createElement("code");
        id.className = "portalStickerRecordId";
        id.textContent = String(record.artifactId || "").toUpperCase();
        info.appendChild(id);

        if (record.line) {
          const source = document.createElement("code");
          source.className = "portalStickerRecordSource";
          source.textContent = record.line;
          info.appendChild(source);
        }

        body.appendChild(info);
        panel.appendChild(body);
        container.appendChild(panel);
        return true;
      }
    }
  ];

  function portalRecordBehaviorForRow(row) {
    for (let i = 0; i < PORTAL_RECORD_BEHAVIORS.length; i += 1) {
      const behavior = PORTAL_RECORD_BEHAVIORS[i];
      const record = behavior.match(row);
      if (record) return { behavior: behavior, record: record };
    }
    return null;
  }

  function portalBehaviorTitleForRow(row) {
    const matched = portalRecordBehaviorForRow(row);
    if (!matched || typeof matched.behavior.title !== "function") return "";
    return printableText(matched.behavior.title(matched.record, row));
  }

  function appendPortalInterpretedRecord(container, row) {
    const matched = portalRecordBehaviorForRow(row);
    if (!matched || typeof matched.behavior.renderExpanded !== "function") return false;
    return !!matched.behavior.renderExpanded(container, matched.record, row);
  }

  function appendRowThumbnail(cell, row) {
    // Record-specific renderers belong in the expanded interpretation area.
    // The compact thumbnail remains reserved for actual media/image previews.
    const evmImages = collectEvmImageAssets(row);
    if (evmImages.length) {
      const img = document.createElement("img");
      img.className = "portalStreamThumbImage";
      img.alt = "EVM image thumbnail";
      img.title = evmImages[0].assetId || "EVM image asset";
      img.loading = "lazy";
      const imageUrl = setPortalAssetImage(img, evmImages[0].path, row);
      cell.appendChild(img);
      return imageUrl;
    }

    const mediaCard = firstMediaThumbnailCard(row);
    const mediaThumb = mediaCard ? String(mediaCard.thumbnailUrl || "").trim() : "";
    if (mediaThumb) {
      const img = document.createElement("img");
      img.className = "portalStreamThumbImage portalStreamThumbRemote";
      img.alt = mediaCard.title || "media thumbnail";
      img.title = mediaCard.title || "media thumbnail";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = mediaThumb;
      cell.appendChild(img);
      return normalizeMediaUrl(mediaCard.url || mediaCard.sourceUrl || "");
    }

    const lines = imageChordLinesFromRow(row);
    if (!lines.length) {
      cell.className += " isEmpty";
      cell.textContent = "";
      return "";
    }
    const canvas = document.createElement("canvas");
    canvas.className = "portalStreamThumbCanvas";
    canvas.title = "Base57 image carried by this transaction";
    const scale = Math.max(1, Number(configValue("inlineImageThumbScale", 2)) || 2);
    paintChordCanvas(canvas, lines, { scale: scale, skipPrefix: DEFAULT_SKIP_PREFIX, skipSuffix: DEFAULT_SKIP_SUFFIX });
    cell.appendChild(canvas);
    return "";
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
    setSafeHref(el, href);
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

  function isPublicMainThunderwordAddress(value) {
    const address = String(value || "").trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(address)) return true;
    if (/^(?:ecash|etoken):[qp][0-9a-z]{40,110}$/i.test(address)) return true;
    if (/^[1-9A-HJ-NP-Za-km-z]{26,40}$/.test(address)) return true;
    return /^(?:bc1|tb1|ltc1|tltc1|dgb1|rvn1)[ac-hj-np-z02-9]{20,90}$/i.test(address);
  }

  function canonicalMainThunderwordAddress(value) {
    const address = String(value || "").trim();
    return /^(?:0x|ecash:|etoken:)/i.test(address) ? address.toLowerCase() : address;
  }

  function normalizeAddressForEntry(value, entry) {
    let address = String(value || "").trim();
    const coin = normalizeCoinName(entry && (entry.coin || entry.ticker || entry.name));
    // CashAddr is often copied without its human-readable prefix. When the
    // selected profile is eCash, accept the bare payload and restore ecash:.
    if (coin === "ecash" && !/^[a-z]+:/i.test(address) && /^[qp][0-9a-z]{40,110}$/i.test(address)) {
      address = "ecash:" + address.toLowerCase();
    }
    return address;
  }

  function mainThunderwordCoin(entry) {
    return normalizeCoinName(entry && (entry.coin || entry.ticker || entry.name)) || "unknown";
  }

  function mainThunderwordKey(entry, address) {
    return mainThunderwordCoin(entry) + ":" + canonicalMainThunderwordAddress(address);
  }

  function makeMainThunderword(entry, address, label, source, opts) {
    const clean = canonicalMainThunderwordAddress(address);
    const coin = mainThunderwordCoin(entry);
    const options = opts || {};
    return {
      key: coin + ":" + clean,
      coin: coin,
      ticker: tickerForCoin(coin),
      address: clean,
      label: String(label || clean).trim() || clean,
      source: String(source || "manual").trim() || "manual",
      sourceTxid: TXID_RE.test(String(options.sourceTxid || "")) ? String(options.sourceTxid).toLowerCase() : "",
      selectedAt: Date.now()
    };
  }

  function mainThunderwordForEntry(entry) {
    const stream = state.mainThunderword;
    if (!stream || !entry) return null;
    return stream.key === mainThunderwordKey(entry, entry.address) ? stream : null;
  }

  function mainThunderwordPayload(stream, txids) {
    const ids = uniqueStrings(safeArray(txids).filter(function (txid) { return TXID_RE.test(String(txid || "")); }));
    return {
      streamKey: stream.key,
      coin: stream.coin,
      ticker: stream.ticker,
      address: stream.address,
      label: stream.label,
      source: stream.source,
      sourceTxid: stream.sourceTxid,
      txids: ids,
      refreshIndex: false
    };
  }

  async function persistMainThunderword(stream, txids) {
    if (!stream || !configBool("persistMainThunderwords", true)) return null;
    if (!(await fileProxyIsAvailable())) return null;
    const saved = await fileProxyPostJson("/main-stream", mainThunderwordPayload(stream, txids));
    stream.localPath = saved.path || stream.localPath || "";
    stream.savedTransactions = Number(saved.transactions || stream.savedTransactions || 0);
    // A stream manifest is the canonical address history, not a transaction
    // cache change. Reindex only after an actual transaction JSON write.
    return saved;
  }

  function scheduleMainThunderwordReindex() {
    if (!state.mainThunderwordReindexPending) return;
    if (state.mainThunderwordReindexTimer) window.clearTimeout(state.mainThunderwordReindexTimer);
    const delay = Math.max(100, Number(configValue("mainThunderwordReindexDelayMs", 900)) || 900);
    state.mainThunderwordReindexTimer = window.setTimeout(function () {
      state.mainThunderwordReindexTimer = null;
      if (!state.mainThunderwordReindexPending) return;
      state.mainThunderwordReindexPending = false;
      fileProxyJson("/reindex").catch(function (error) {
        state.mainThunderwordReindexPending = true;
        console.warn("Main thunderword JSON was saved but SQLite reindex is pending:", error);
      });
    }, delay);
  }

  function writeMainThunderwordUrl(stream) {
    if (!stream || stream.source === "wif" || !window.history || !window.history.replaceState) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("txid")) return;
      url.searchParams.set("mode", "portal");
      url.searchParams.set("address", stream.address);
      url.searchParams.set("coin", stream.coin);
      window.history.replaceState(null, "", url.toString());
    } catch (error) {
      console.warn("Could not update main-thunderword URL:", error);
    }
  }

  function promoteMainThunderword(entry, address, label, source, opts) {
    const clean = canonicalMainThunderwordAddress(address);
    if (!isPublicMainThunderwordAddress(clean)) {
      return Promise.reject(new Error("Main thunderword must be a public address or contract. WIF/private material is never stored here."));
    }
    const stream = makeMainThunderword(entry, clean, label, source, opts);
    state.mainThunderword = stream;
    if (!(opts && opts.updateUrl === false)) writeMainThunderwordUrl(stream);
    return persistMainThunderword(stream, []).then(function () {
      scheduleMainThunderwordReindex();
      return stream;
    }).catch(function (error) {
      console.warn("Main thunderword persistence skipped:", error);
      return stream;
    });
  }

  function rememberMainThunderwordTransactions(stream, transactions) {
    if (!stream || state.mainThunderword !== stream) return;
    const txids = safeArray(transactions).map(function (row) {
      return typeof row === "string" ? row : row && row.txid;
    }).filter(function (txid) { return TXID_RE.test(String(txid || "")); });
    persistMainThunderword(stream, txids).then(function () {
      scheduleMainThunderwordReindex();
    }).catch(function (error) {
      console.warn("Main thunderword transaction catalog skipped:", error);
    });
  }

  function mainThunderwordRequestFromUrl() {
    try {
      const params = new URL(window.location.href).searchParams;
      const address = String(params.get("address") || params.get("thunderword") || params.get("stream") || "").trim();
      if (!address) return null;
      return {
        address: address,
        coin: String(params.get("coin") || params.get("currency") || "").trim(),
        label: String(params.get("label") || address).trim() || address
      };
    } catch (error) {
      return null;
    }
  }

  function entryForMainThunderwordRequest(request) {
    const fallback = inferIndexForAddress(request.address, state.currentIndex || getSelectedIndex());
    return request.coin ? indexEntryForCoin(request.coin, fallback) : fallback;
  }

  function artifactScanRequestFromUrl() {
    try {
      const params = new URL(window.location.href).searchParams;
      if (params.get("artifactScan") !== "1") return null;

      const artifactId = String(params.get("artifactId") || "").trim().toLowerCase();
      const artifactAddress = String(params.get("address") || "").trim();
      const currency = String(params.get("currency") || "").trim();
      const artifactPrefix = String(params.get("artifactPrefix") || "").trim();
      const mcDougall = String(params.get("mcDougall") || "").trim();
      const amount = String(params.get("amount") || "0.00001").trim();

      if (!/^[0-9a-f]{16}$/.test(artifactId) || !artifactAddress) return null;

      return {
        artifactId:artifactId,
        artifactAddress:artifactAddress,
        currency:currency,
        artifactPrefix:artifactPrefix,
        mcDougall:mcDougall,
        amount:amount
      };
    } catch (error) {
      return null;
    }
  }

  function handoffUnregisteredArtifact(request) {
    if (!request) return false;

    const payload = {
      schema:"chisel-artifact-index-v1",
      artifactId:request.artifactId,
      mcDougall:request.mcDougall,
      artifactPrefix:request.artifactPrefix,
      artifactAddress:request.artifactAddress,
      currency:request.currency,
      recipients:[{
        address:request.artifactAddress,
        amount:request.amount,
        outputType:"unspendable",
        note:"artifact " + request.artifactId + " " + request.artifactPrefix + request.mcDougall
      }],
      replaceRecipients:false,
      createdAt:new Date().toISOString()
    };

    setStatus("No ledger entry exists for artifact " + request.artifactId + ". Opening registration in Send.", false);
    const targetOrigin = window.location.origin === "null" ? "*" : window.location.origin;
    window.postMessage({type:"chisel.loadArtifactPayload",payload:payload},targetOrigin);
    return true;
  }

  function loadMainThunderwordFromUrl() {
    const request = state.urlMainThunderwordRequest || mainThunderwordRequestFromUrl();
    if (!request || !configBool("autoLoadMainThunderwordFromUrl", true)) return Promise.resolve(null);
    state.urlMainThunderwordRequest = request;
    const entry = entryForMainThunderwordRequest(request);
    return loadAddressStream(request.address, entry, request.label, {
      source: "url",
      updateUrl: false,
      noReloadIfCurrent: true
    }).then(function (result) {
      const artifact = artifactScanRequestFromUrl();
      if (!artifact || !result || !Array.isArray(result.transactions)) return result;

      if (result.transactions.length) {
        setStatus(
          "Artifact " + artifact.artifactId + " resolved on " +
          (entry.ticker || entry.coin || entry.name || artifact.currency) +
          " with " + result.transactions.length + " ledger transaction(s).",
          false
        );
        return result;
      }

      handoffUnregisteredArtifact(artifact);
      return result;
    });
  }

  function loadAddressStream(address, entry, label, opts) {
    const clean = normalizeAddressForEntry(address, entry || getSelectedIndex());
    if (!clean) return Promise.reject(new Error("Address is required."));
    const cloned = cloneIndexForAddress(entry || getSelectedIndex(), clean, label || clean);
    const options = opts || {};
    const previous = state.mainThunderword;
    const sameAsCurrent = previous && previous.key === mainThunderwordKey(cloned, clean);
    state.currentIndex = cloned;
    if ($("#portalThunderwordSelect") && cloned.name) {
      $("#portalThunderwordSelect").value = cloned.name;
    }
    if ($("#portalThunderwordAddress")) $("#portalThunderwordAddress").value = clean;
    setExplorerLink("#portalThunderwordExplorerLink", getThunderwords() ? getThunderwords().getAddressUrl(cloned, clean) : "", "verify address");
    setText("#portalIndexCaption", (cloned.ticker || cloned.coin || cloned.name || "coin") + " main thunderword: " + clean);
    return promoteMainThunderword(cloned, clean, label || clean, options.source || "manual", options).then(function (stream) {
      if (sameAsCurrent && options.noReloadIfCurrent) return stream;
      return loadAddressIndex(cloned, clean, { mainThunderword: stream });
    });
  }

  function makeDrillButton(address, entry, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondaryButton";
    button.textContent = "drill";
    button.title = "Load this address as a rabbit-trail stream";
    button.onclick = function () {
      loadAddressStream(address, entry || state.currentIndex, label || address, {
        source: "rabbit-trail",
        updateUrl: true
      }).catch(function (error) {
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

    const fallbackCoin = normalizeCoinName(fallbackEntry && (fallbackEntry.coin || fallbackEntry.ticker || fallbackEntry.name));
    if (fallbackCoin && fallbackCoin !== "unknown") return fallbackEntry;

    const byRoot = indexes.find(function (entry) {
      const root = String(entry.address || "").charAt(0);
      return root && root === first;
    });
    if (byRoot) return byRoot;

    if (/^(?:ecash|etoken):/i.test(text)) {
      const xec = indexes.find(function (entry) { return /ecash|xec/i.test([entry.coin, entry.ticker, entry.name, entry.label].join(" ")); });
      if (xec) return xec;
    }

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
    setSafeHref(a, url);
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

  function uniqueStrings(items) {
    const seen = new Set();
    const out = [];
    safeArray(items).forEach(function (item) {
      const value = String(item || "").trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return;
      seen.add(key);
      out.push(value);
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

  function recordPortalError(type, error, context) {
    // Diagnostics must never change the result of a request or retry.
    try {
      const diagnostics = window.CHISEL_DIAGNOSTICS;
      if (diagnostics && typeof diagnostics.error === "function") diagnostics.error(type, error, context);
    } catch (_) {}
  }

  async function loadPortalConfig() {
    const directUrls = [DEFAULT_CONFIG_PATH];
    const proxyBase = String((state.config && state.config.fileProxyUrl) || DEFAULT_FILE_PROXY_URL).replace(/\/+$/, "");
    directUrls.push(proxyBase + "/config?path=" + encodeURIComponent(DEFAULT_CONFIG_PATH));

    for (let i = 0; i < directUrls.length; i += 1) {
      try {
        const json = await staticTransport.request(directUrls[i], {cache: "no-store"}, async function (response) {
          if (!response.ok) {
            recordPortalError("portal.config", "HTTP " + response.status, {endpoint:directUrls[i], httpStatus:response.status, method:"GET"});
            return null;
          }
          return response.json();
        }, 2000);
        if (!json) continue;
        if (json && json.ok && json.config) return Object.assign({}, DEFAULT_PORTAL_CONFIG, json.config);
        if (json && !json.ok) continue;
        return Object.assign({}, DEFAULT_PORTAL_CONFIG, json);
      } catch (error) { recordPortalError("portal.config", error, {endpoint:directUrls[i], method:"GET"}); }
    }

    return Object.assign({}, DEFAULT_PORTAL_CONFIG);
  }

  function normalizeFileProxyUrl(value) {
    const url = String(value || "").trim().replace(/\/+$/, "");
    if (!url) return DEFAULT_FILE_PROXY_URL;
    return url;
  }

  function applyPortalConfig(config) {
    state.config = Object.assign({}, DEFAULT_PORTAL_CONFIG, config || {});
    state.config.fileProxyUrl = normalizeFileProxyUrl(state.config.fileProxyUrl);
    const proxy = $("#portalFileProxyUrl");
    if (proxy) {
      proxy.value = state.config.fileProxyUrl;
      proxy.setAttribute("autocomplete", "off");
    }
    const staticUrl = $("#portalStaticDataUrl");
    if (staticUrl && !staticUrl.dataset.edited) staticUrl.value = normalizePathList(state.config.staticDataSources, [DEFAULT_STATIC_DATA_URL])[0] || "";
    applyPortalFilterConfig();
  }

  function getStaticDataSources() {
    const input = $("#portalStaticDataUrl");
    return input && input.value.trim() ? [input.value.trim()] : normalizePathList(configValue("staticDataSources", null), [DEFAULT_STATIC_DATA_URL]);
  }

  function fileProxyReadTimeout() {
    return Math.max(250, Math.min(10000, Number(configValue("fileProxyReadTimeoutMs", 2000)) || 2000));
  }

  function getFileProxyUrl() {
    const input = $("#portalFileProxyUrl");
    const normalized = normalizeFileProxyUrl((input && input.value) || configValue("fileProxyUrl", DEFAULT_FILE_PROXY_URL));
    if (input && input.value !== normalized) input.value = normalized;
    return normalized;
  }

  async function requestFileProxyJson(url, options) {
    const started = Date.now();
    const method = options && options.method || "GET";
    const base = getFileProxyUrl();
    if (failedFileProxyBase === base && Date.now() < fileProxyRetryAfter) throw new Error("FileProxy is temporarily unavailable; static HTTP reads remain available.");
    let response;
    try {
      return await staticTransport.request(url, options, async function (received) {
        response = received;
        state.fileProxyAvailable = true;
        let json;
        try { json = await response.json(); }
        catch (error) { throw new Error("FileProxy HTTP " + response.status + " returned invalid JSON: " + (error.message || String(error)), {cause:error}); }
        if (!response.ok || !json || json.ok === false) {
          throw new Error((json && json.error) || ("FileProxy request failed with HTTP " + response.status));
        }
        try {
          if (window.CHISEL_DIAGNOSTICS) window.CHISEL_DIAGNOSTICS.record("fileproxy.response", "Response received", {
            endpoint:url, method:method, httpStatus:response.status, durationMs:Date.now()-started});
        } catch (_) {}
        fileProxyRetryAfter = 0;
        failedFileProxyBase = "";
        return json;
      }, method === "GET" ? fileProxyReadTimeout() : 8000);
    } catch (error) {
      if (!response || /^(TimeoutError|AbortError)$/.test(error.name) || response.status >= 500 || response.status === 401 || response.status === 403) {
        state.fileProxyAvailable = false;
        failedFileProxyBase = base;
        fileProxyRetryAfter = Date.now() + 30000;
      }
      recordPortalError("fileproxy.request", error, {endpoint:url, method:method,
        httpStatus:response && response.status, durationMs:Date.now()-started});
      throw error;
    }
  }

  async function fileProxyJson(path, params) {
    const query = new URLSearchParams(params || {});
    const url = getFileProxyUrl() + path + (String(query) ? "?" + String(query) : "");
    return requestFileProxyJson(url, {cache:"no-store"});
  }

  async function fileProxyPostJson(path, body) {
    const url = getFileProxyUrl() + path;
    return requestFileProxyJson(url, {method:"POST", cache:"no-store",
      headers:{"Content-Type":"application/json"}, body:JSON.stringify(body || {})});
  }

  async function fileProxyIsAvailable() {
    if (failedFileProxyBase === getFileProxyUrl()) {
      if (Date.now() < fileProxyRetryAfter) return false;
      state.fileProxyAvailable = null;
    }
    if (state.fileProxyAvailable === true) return true;
    if (state.fileProxyAvailable === false) return false;
    try {
      await fileProxyJson("/ping");
      return true;
    } catch (error) {
      return false;
    }
  }

  function annotationFilePath(row) {
    const prefix = String(configValue("annotationFilePrefix", "data/"));
    return prefix + (/[:/]$/.test(prefix) ? "" : "/") + notesData.path(row);
  }

  async function readSharedPortalAnnotation(row) {
    if (failedFileProxyBase === getFileProxyUrl() && Date.now() < fileProxyRetryAfter) throw new Error("FileProxy is temporarily unavailable.");
    let response;
    try {
      return await staticTransport.request(fileProxyRawUrl(annotationFilePath(row)), {cache: "no-store"}, async function (received) {
        response = received;
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Notes read failed with HTTP " + response.status + ".");
        return notesData.parseDocument(row, await response.json());
      }, fileProxyReadTimeout());
    } catch (error) {
      if (!response || response.status >= 500 || /^(TimeoutError|AbortError)$/.test(error.name)) {
        state.fileProxyAvailable = false; failedFileProxyBase = getFileProxyUrl(); fileProxyRetryAfter = Date.now() + 30000;
      }
      throw error;
    }
  }

  function staticAnnotationUrls(row) {
    const bases = [row.staticBaseUrl].concat(safeArray(row.staticRemoteBaseUrls));
    try {
      if (/\/transactions\/[^/]+\/[^/]+\.json$/i.test(new URL(row.staticRawUrl).pathname)) bases.push(new URL("../../", row.staticRawUrl).href);
    } catch (_) {}
    getStaticDataSources().forEach(function (source) {
      try { bases.push(staticData.sourceLocation(source, window.location.href).baseUrl); } catch (_) {}
    });
    bases.push(new URL("./data-bundled/", window.location.href).href);
    return Array.from(new Set(bases.filter(Boolean).map(function (base) { return new URL(staticData.joinDataPath(base, notesData.path(row)), window.location.href).href; })));
  }

  function loadPortalAnnotation(row, opts) {
    if (!tickerForCoin(canonicalCoinForRow(row))) return Promise.resolve(getPortalAnnotation(row));
    if (!configBool("autoLoadTransactionNotes", true) && !(opts && opts.force)) return Promise.resolve(getPortalAnnotation(row));
    const key = portalAnnotationKey(row), generation = state.portalLoadGeneration, read = annotationReads.get(key);
    if (!(opts && opts.force) && read && Date.now() - read.checkedAt < 60000) return Promise.resolve(getPortalAnnotation(row));
    return queuePortalRead("notes:" + key, row, "notes", async function () {
      let loaded = null, source = "browser", remoteUpdatedAt = null;
      try {
        if (state.fileProxyAvailable === false && !(opts && opts.force)) throw new Error("FileProxy is unavailable.");
        loaded = await readSharedPortalAnnotation(row);
        remoteUpdatedAt = loaded ? loaded.updatedAt : 0;
        if (loaded) source = "FileProxy";
      } catch (_) {}
      if (!loaded) for (const url of staticAnnotationUrls(row)) {
        try {
          loaded = await staticTransport.request(url, {cache: "no-store"}, async function (response) {
            if (response.status === 404) return null;
            if (!response.ok) throw new Error("Notes HTTP " + response.status);
            return notesData.parseDocument(row, await response.json());
          }, 4000);
          if (loaded) { source = "HTTP"; break; }
        } catch (_) {}
      }
      if (generation !== state.portalLoadGeneration || state.portalRowKeys[key] !== row) return getPortalAnnotation(row);
      annotationReads.set(key, {checkedAt: Date.now(), source: source, remoteUpdatedAt: remoteUpdatedAt});
      const existing = getPortalAnnotation(row);
      if (loaded && loaded.updatedAt >= existing.updatedAt && JSON.stringify(normalizePortalAnnotation(loaded)) !== JSON.stringify(existing)) {
        state.portalAnnotations[key] = normalizePortalAnnotation(loaded);
        savePortalAnnotations(); invalidatePortalRowCache(row);
        row.annotationRevision = (row.annotationRevision || 0) + 1;
        requestPortalRender();
      }
      return getPortalAnnotation(row);
    }).then(function (value) { return value || getPortalAnnotation(row); });
  }

  async function savePortalAnnotationToFileProxy(row, value) {
    const annotation = normalizePortalAnnotation(value), key = portalAnnotationKey(row);
    const previous = await readSharedPortalAnnotation(row), read = annotationReads.get(key);
    if (previous && (!read || read.remoteUpdatedAt !== previous.updatedAt)) throw new Error("The shared note changed. Reload it before saving; your draft is retained.");
    const document = notesData.documentFor(row, Object.assign({}, annotation, {updatedAt: Date.now()}));
    const saved = await fileProxyPostJson("/save", {path: annotationFilePath(row), text: pretty(document) + "\n"});
    state.portalAnnotations[key] = normalizePortalAnnotation(document);
    savePortalAnnotations(); invalidatePortalRowCache(row);
    annotationReads.set(key, {checkedAt: Date.now(), source: "FileProxy", remoteUpdatedAt: document.updatedAt});
    row.annotationRevision = (row.annotationRevision || 0) + 1;
    return saved;
  }

  function scheduleVisiblePortalAnnotations(rows) {
    if (!configBool("autoLoadTransactionNotes", true) || visibleAnnotationsLoading) return;
    const pending = rows.filter(function (row) {
      const read = annotationReads.get(portalAnnotationKey(row));
      return !read || Date.now() - read.checkedAt >= 60000;
    });
    if (!pending.length) return;
    visibleAnnotationsLoading = true;
    const generation = state.portalLoadGeneration;
    (async function () {
      for (let i = 0; i < pending.length && generation === state.portalLoadGeneration; i += 4) {
        await Promise.all(pending.slice(i, i + 4).map(function (row) { return loadPortalAnnotation(row).catch(function () {}); }));
        await yieldPortalThread();
      }
    })().finally(function () { if (generation === state.portalLoadGeneration) visibleAnnotationsLoading = false; });
  }

  function fileProxyRawUrl(path) {
    if (!path) return "";
    return getFileProxyUrl() + "/raw?path=" + encodeURIComponent(String(path));
  }

  function setPortalAssetImage(img, path, row) {
    const bases = [row && row.staticBaseUrl].concat(safeArray(row && row.staticRemoteBaseUrls));
    getStaticDataSources().forEach(function (source) {
      try { bases.push(staticData.sourceLocation(source, window.location.href).baseUrl); } catch (_) {}
    });
    const urls = Array.from(new Set(bases.filter(Boolean).map(function (base) {
      return CHISEL.safeWebUrl(staticData.joinDataPath(base, path), window.location.href);
    }).filter(Boolean)));
    if (state.fileProxyAvailable !== false) urls.push(fileProxyRawUrl(path));
    img.dataset.portalImageSource = urls.join("|");
    let index = 0;
    img.onerror = function () {
      index += 1;
      if (index < urls.length) img.src = urls[index];
      else img.onerror = null;
    };
    if (urls.length) img.src = urls[0];
    return urls[0] || "";
  }

  function normalizePathList(value, fallback) {
    return staticData.normalizePathList(value, fallback);
  }

  function registerStaticRawRows(rows) {
    rows.forEach(function (row) {
      if (!row.staticRawPath && !row.staticRawUrl) return;
      state.staticRawByTxid[row.coin + ":" + row.txid] = row;
      state.staticRawByTxid[(row.sourceId || sourceIdForRow(row)) + ":" + row.txid] = row;
    });
    return rows;
  }

  function normalizeStaticDatasetRows(dataset, context) {
    return registerStaticRawRows(staticNormalizer.normalizeStaticDatasetRows(dataset, context));
  }

  function mergeStaticRows(rows, opts) {
    let added = 0;
    let updated = 0;
    beginPortalBatch();
    try {
      rows.forEach(function (row) {
        const key = rowKey(row);
        const existed = !!state.portalRowKeys[key];
        if (upsertPortalRow(row, { silent: true })) {
          if (existed) updated += 1;
          else added += 1;
        }
      });
    } finally {
      endPortalBatch();
    }
    state.portalPage = 1;
    if (!(opts && opts.silent)) requestPortalRender();
    return { added: added, updated: updated, total: rows.length };
  }

  function loadEmbeddedStaticDataset() {
    const dataset = window.CHISEL_PORTAL_STARTER_DATA;
    if (!dataset || state.staticDatasetLoaded) return null;
    const rows = normalizeStaticDatasetRows(dataset, {
      baseUrl: "./data-bundled/",
      sourceLabel: "bundled static index",
      sourceBadge: "bundled",
      remoteBaseUrls: ["https://rigler.org/chisel-data/"]
    });
    const report = mergeStaticRows(rows, { silent: true });
    state.staticDatasetLoaded = true;
    state.staticDatasetReports.push(Object.assign({ source: "embedded starter", records: rows.length }, report));
    setStatus("Preloaded " + report.added + " bundled record(s), newest first. Live ledger search can add newer rows without clearing the stream.", false);
    requestPortalRender();
    return report;
  }

  async function loadStaticManifest(manifestUrl, opts) {
    const label = (opts && opts.label) || manifestUrl;
    const loaded = await staticTransport.loadManifest(manifestUrl);
    const rows = normalizeStaticDatasetRows(loaded.index, {
      baseUrl: loaded.baseUrl,
      sourceLabel: label,
      sourceBadge: (opts && opts.badge) || (manifestUrl.indexOf("data-bundled/") >= 0 ? "bundled" : (staticData.isAbsoluteUrl(manifestUrl) ? "remote" : "static")),
      remoteBaseUrls: loaded.manifest.remoteBaseUrls || []
    });
    const report = mergeStaticRows(rows, { silent: opts && opts.silent });
    state.staticManifest = loaded.manifest;
    state.staticDatasetReports.push(Object.assign({ source: label, manifest: manifestUrl, records: rows.length }, report));
    return report;
  }

  async function loadConfiguredStaticDatasets(opts) {
    const reports = [];
    const httpLoad = loadStaticHttpSources();
    const localPaths = normalizePathList(configValue("staticManifestPaths", null), [DEFAULT_STATIC_MANIFEST_PATH, DEFAULT_BUNDLED_MANIFEST_PATH]);
    for (let i = 0; i < localPaths.length; i += 1) {
      try {
        reports.push(await loadStaticManifest(localPaths[i], { label: localPaths[i], badge: localPaths[i].indexOf("data-bundled") >= 0 ? "bundled" : "static", silent: true }));
      } catch (error) {
        reports.push({ source: localPaths[i], error: error.message || String(error) });
      }
    }
    const mirrors = normalizePathList(configValue("staticManifestMirrors", null), [DEFAULT_REMOTE_MANIFEST_URL]);
    for (let j = 0; j < mirrors.length; j += 1) {
      try {
        reports.push(await loadStaticManifest(mirrors[j], { label: mirrors[j], badge: "remote", silent: true }));
        break;
      } catch (error) {
        reports.push({ source: mirrors[j], error: error.message || String(error) });
      }
    }
    const http = await httpLoad;
    reports.push.apply(reports, http.reports);
    requestPortalRender();
    setText("#portalThunderwordRaw", pretty({ staticDatasets: reports }));
    if (!(opts && opts.quiet)) {
      const ok = reports.filter(function (r) { return !r.error; });
      const added = ok.reduce(function (sum, r) { return sum + (Number(r.added) || 0); }, 0);
      const updated = ok.reduce(function (sum, r) { return sum + (Number(r.updated) || 0); }, 0);
      setStatus("Static dataset refresh finished: " + added + " added, " + updated + " updated. fileProxy was not required.", false);
    }
    return reports;
  }

  function loadStaticHttpSources() {
    const generation = state.portalLoadGeneration;
    const sources = getStaticDataSources(), key = sources.join("\n");
    if (staticHttpLoad && staticHttpGeneration === generation && staticHttpSourceKey === key) return staticHttpLoad;
    staticHttpGeneration = generation;
    staticHttpSourceKey = key;
    const promise = Promise.all(sources.map(async function (source) {
      try {
        const loaded = await staticTransport.loadCatalog(source);
        if (generation !== state.portalLoadGeneration) return {source: source, cancelled: true, rows: []};
        const rows = normalizeStaticDatasetRows(loaded.index, {baseUrl: loaded.baseUrl, sourceLabel: source, sourceBadge: "HTTP"});
        const report = mergeStaticRows(rows, {silent: true});
        const storedRows = rows.map(function (row) { return state.portalRowKeys[rowKey(row)]; }).filter(Boolean);
        requestPortalRender();
        if (configBool("backgroundHydrateTransactions", false)) window.setTimeout(function () {
          hydrateStaticHttpRows(storedRows, generation).catch(function (error) { recordPortalError("static.hydration", error, {endpoint: source}); });
        }, 0);
        return Object.assign({source: source, indexUrl: loaded.indexUrl, rows: storedRows}, report);
      } catch (error) {
        recordPortalError("static.catalog", error, {endpoint: source});
        return {source: source, error: error.message || String(error), rows: []};
      }
    })).then(function (reports) {
      return {reports: reports.map(function (report) { const copy = Object.assign({}, report); delete copy.rows; return copy; }),
        rows: [].concat.apply([], reports.map(function (report) { return report.rows; }))};
    }).finally(function () { if (staticHttpLoad === promise) staticHttpLoad = null; });
    staticHttpLoad = promise;
    return promise;
  }

  async function hydrateStaticHttpRows(rows, generation) {
    const ordered = prioritizePortalRows(rows);
    for (let i = 0; i < ordered.length; i += 4) {
      if (generation !== state.portalLoadGeneration) return;
      await Promise.all(ordered.slice(i, i + 4).map(async function (row) {
        if (row.raw || state.pendingHydration[row.key] || state.pendingDateLookup[row.key]) return;
        await hydratePortalRow(row.key, {quiet: true, silent: true, suppressRender: true, deferSort: true});
        if (generation === state.portalLoadGeneration) requestPortalRender();
      }));
      await yieldPortalThread();
    }
  }

  async function loadStaticHttpTransaction(txid, coin, path) {
    const key = rowKey({coin: coin, txid: txid});
    let row = state.portalRowKeys[key] || state.staticRawByTxid[coin + ":" + txid];
    if (row && (row.staticRawPath || row.staticRawUrl)) {
      try { return await fetchStaticRawFromRow(row); } catch (_) {}
    }
    if (path) {
      const bases = getStaticDataSources().map(function (source) { return staticData.sourceLocation(source, window.location.href).baseUrl; });
      try { return await staticTransport.fetchStaticRawFromRow({txid: txid, coin: coin, staticRawPath: path, staticRemoteBaseUrls: bases}); } catch (_) {}
    }
    await loadStaticHttpSources();
    row = state.portalRowKeys[key] || state.staticRawByTxid[coin + ":" + txid];
    if (!row || !(row.staticRawPath || row.staticRawUrl)) throw new Error("Transaction is not present in the static HTTP catalog.");
    return fetchStaticRawFromRow(row);
  }

  async function fetchStaticRawFromRow(row) {
    return staticTransport.fetchStaticRawFromRow(row, canonicalCoinForRow);
  }

  async function validateStaticDataset() {
    const manifests = normalizePathList(configValue("staticValidationManifestPaths", null), [DEFAULT_BUNDLED_MANIFEST_PATH]);
    const reports = await staticTransport.validateStaticDataset(manifests);
    setText("#portalThunderwordRaw", pretty({ validation: reports }));
    setStatus("Dataset validation finished. See Index raw for hash details.", reports.some(function (r) { return r.error || r.ok === false; }));
    return reports;
  }

  function getCurrentCoinName(indexEntry) {
    const entry = indexEntry || state.currentIndex || (function () {
      try { return getSelectedIndex(); } catch (error) { return null; }
    })();
    return String((entry && (entry.coin || entry.ticker || entry.name)) || "unknown").toLowerCase();
  }

  async function saveTransactionToFileProxy(tx, txid, indexEntry, opts) {
    const raw = tx || state.rawJson;
    const id = String(txid || extractTxid(raw) || state.selectedTxid || "").trim();
    const options = opts || {};
    if (!raw) throw new Error("No transaction JSON is loaded in Portal.");
    if (!TXID_RE.test(id)) throw new Error("Cannot save: loaded transaction does not expose a 64-character txid.");
    const coin = getCurrentCoinName(indexEntry);
    const mainThunderword = options.mainThunderword || mainThunderwordForEntry(indexEntry);
    const refreshIndex = options.refreshIndex === false ? false : !mainThunderword;
    const saved = await fileProxyPostJson("/save-tx", {
      txid: id,
      coin: coin,
      json: raw,
      filenameMode: "base58",
      refreshIndex: refreshIndex,
      mainThunderword: mainThunderword ? {
        streamKey: mainThunderword.key,
        coin: mainThunderword.coin,
        ticker: mainThunderword.ticker,
        address: mainThunderword.address,
        label: mainThunderword.label,
        source: mainThunderword.source,
        sourceTxid: mainThunderword.sourceTxid,
        transactionSource: "fetched-tx"
      } : undefined
    });
    state.currentSavedPath = saved.path || "";
    if (mainThunderword || options.refreshIndex === false) {
      state.mainThunderwordReindexPending = true;
      scheduleMainThunderwordReindex();
    }
    if (!options.quiet) {
      setText("#portalSaveTxResult", saved.path ? "saved " + saved.path : pretty(saved));
      setStatus("Saved local jq-format transaction JSON: " + (saved.path || saved.filename || id) + ".", false);
    }
    return saved;
  }

  async function saveCurrentTransaction() {
    return saveTransactionToFileProxy(state.rawJson, state.selectedTxid, state.currentIndex);
  }

  function shouldAutoSaveFetchedTxs() {
    return configBool("autoSaveFetchedTransactions", false) || configBool("cacheFetchedTransactionsWithFileProxy", true);
  }

  async function autoSaveTransactionMaybe(tx, txid, indexEntry, opts) {
    const options = opts || {};
    if (!shouldAutoSaveFetchedTxs()) return null;
    if (!tx || typeof tx !== "object") return null;
    if (!(await fileProxyIsAvailable())) return null;

    try {
        return await saveTransactionToFileProxy(tx, txid || extractTxid(tx), indexEntry, Object.assign({ quiet: true }, options));
    } catch (error) {
      console.warn("Portal auto-save failed:", error);
      if (options.throwOnError) throw error;
      if (!options.quiet) setStatus("Local transaction cache failed: " + (error.message || String(error)), true);
      return null;
    }
  }

  function shouldCacheLiveRawPortalRow(row) {
    if (!row || !row.raw || row.localPath) return false;
    if (row.discoverySource !== "live-search") return false;
    // EVM records have a separate packet/image writer. This path is for UTXO
    // address APIs, notably LitecoinSpace, which already return full tx JSON.
    return canonicalCoinForRow(row) !== "evm";
  }

  async function cacheLiveRawPortalRowMaybe(row, opts) {
    if (!shouldCacheLiveRawPortalRow(row)) return null;
    if (row.rawCachePromise) return row.rawCachePromise;

    const options = Object.assign({}, opts || {}, { quiet: true, throwOnError: true });
    row.rawCachePromise = autoSaveTransactionMaybe(row.raw, row.txid, rowIndexEntry(row), options);
    try {
      const saved = await row.rawCachePromise;
      if (saved && saved.path) {
        row.localPath = saved.path;
        row.rawCacheSavedAt = Date.now();
        row.rawCacheError = "";
      }
      return saved;
    } catch (error) {
      row.rawCacheError = error.message || String(error);
      console.warn("Portal raw address-result cache failed:", error);
      return null;
    } finally {
      delete row.rawCachePromise;
    }
  }



  function getCoinIndexByCoinName(coin) {
    return indexEntryForCoin(coin, state.currentIndex);
  }

  async function loadLocalTransaction(txid, coin) {
    const requestedCoin = normalizeCoinName(coin || "");
    const lookupCoin = requestedCoin && requestedCoin !== "unknown" ? requestedCoin : "";
    let json;
    try { json = await fileProxyJson("/tx", { txid: txid, coin: lookupCoin }); }
    catch (error) {
      try {
        const loaded = await loadStaticHttpTransaction(txid, lookupCoin);
        return {txid: txid, coin: lookupCoin, path: "", raw: loaded.json, source: "static", url: loaded.url};
      } catch (_) { throw error; }
    }
    const tx = json.json || tryParseJsonText(json.text) || { text: json.text, txid: txid };
    return { txid: txid, coin: normalizeCoinName(lookupCoin || json.coin || tx.coin || tx.ticker || tx.chain || ""), path: json.path, raw: tx };
  }

  async function loadLocalTransactionPath(path, txid, coin) {
    const localPath = String(path || "").trim();
    if (!localPath) throw new Error("Local transaction path is missing.");
    let tx;
    try {
      if (failedFileProxyBase === getFileProxyUrl() && Date.now() < fileProxyRetryAfter) throw new Error("FileProxy is temporarily unavailable.");
      tx = await staticTransport.request(fileProxyRawUrl(localPath), {cache: "no-store"}, async function (response) {
        if (!response.ok) throw new Error(localPath + " failed with HTTP " + response.status + ".");
        const value = tryParseJsonText(await response.text());
        if (!value || typeof value !== "object") throw new Error(localPath + " is not transaction JSON.");
        return value;
      }, fileProxyReadTimeout());
    } catch (error) {
      if (/^(TimeoutError|AbortError|TypeError)$/.test(error.name)) {
        state.fileProxyAvailable = false;
        failedFileProxyBase = getFileProxyUrl();
        fileProxyRetryAfter = Date.now() + 30000;
      }
      try {
        const loaded = await loadStaticHttpTransaction(txid, normalizeCoinName(coin), localPath);
        return {txid: txid, coin: normalizeCoinName(coin), path: "", raw: loaded.json, source: "static", url: loaded.url};
      } catch (_) { throw error; }
    }
    const requestedCoin = normalizeCoinName(coin || "");
    return {
      txid: txid || extractTxid(tx),
      coin: requestedCoin && requestedCoin !== "unknown" ? requestedCoin : normalizeCoinName(tx.coin || tx.ticker || tx.chain || ""),
      path: localPath,
      raw: tx
    };
  }

  function coinFromLocalPath(path) {
    const match = String(path || "").replace(/\\/g, "/").match(/(?:^|\/)transactions\/([^/]+)(?:\/|$)/i);
    return match ? normalizeCoinName(match[1]) : "";
  }

  function coinForLocalIndexRow(row, fallback) {
    const summary = row && row.summary ? row.summary : {};
    const declared = normalizeCoinName(row && (row.coin || row.ticker) || summary.coin || summary.ticker || "");
    if (declared && declared !== "unknown") return declared;
    const fromPath = coinFromLocalPath(row && row.path);
    if (fromPath) return fromPath;
    const fallbackCoin = normalizeCoinName(fallback || "");
    return fallbackCoin === "unknown" ? "" : (fallbackCoin || declared);
  }

  function indexEntryForCoin(coin, fallback) {
    const api = getThunderwords();
    const clean = normalizeCoinName(coin);
    if (!api || !clean) return fallback || state.currentIndex || null;
    const ticker = tickerForCoin(clean).toLowerCase();
    const found = api.listIndexes().find(function (entry) {
      return normalizeCoinName(entry.coin || entry.name) === clean || String(entry.ticker || "").toLowerCase() === ticker;
    });
    return found || fallback || state.currentIndex || null;
  }

  function rowIndexEntry(row) {
    const coin = canonicalCoinForRow(row);
    return indexEntryForCoin(coin, row && row.index);
  }

  function coinLabel(entryOrCoin) {
    if (!entryOrCoin) return "?";
    if (typeof entryOrCoin === "string") return tickerForCoin(entryOrCoin) || entryOrCoin || "?";
    return entryOrCoin.ticker || tickerForCoin(entryOrCoin.coin || entryOrCoin.name) || entryOrCoin.coin || entryOrCoin.name || "?";
  }

  function coinLabelForRow(row) {
    return tickerForCoin(canonicalCoinForRow(row)) || coinLabel(row && (row.index || row.coin));
  }

  function rowTime(row) {
    const summary = row.summary || {};
    const exact = Number(summary.blockTime || row.blockTime || extractBlockTime(row.raw) || 0) || 0;
    if (exact) return exact;
    const estimated = estimateUtxoBlockTime(canonicalCoinForRow(row), summary.blockHeight || extractBlockHeight(row.raw));
    return Number(row.receivedTime || estimated || row.modified || (row.publication && row.publication.submittedAt / 1000) || 0) || 0;
  }

  function formatRowTime(row) {
    if (row.draftRecord) return "draft";
    const t = rowTime(row);
    if (!t) return "unknown";
    const d = new Date(t * 1000);
    if (Number.isNaN(d.getTime())) return "unknown";
    return d.toISOString().slice(0, 16).replace("T", " ");
  }

  function rowExplorerUrl(row) {
    if (row.draftRecord) return "";
    // Blockchair is a human-readable verification page, not a JSON transport.
    // Keep Esplora and BlockCypher as independent JSON fetch providers.
    if (canonicalCoinForRow(row) === "litecoin" && /^[0-9a-f]{64}$/i.test(String(row && row.txid || ""))) {
      return "https://blockchair.com/litecoin/transaction/" + row.txid;
    }
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
    if (s.mediaCards && s.mediaCards.length) flags.push("card:" + s.mediaCards.length);
    if (s.ipfsCount) flags.push("ipfs:" + s.ipfsCount);
    if (s.imageLines) flags.push("img:" + s.imageLines);
    if (s.imageCount) flags.push("asset-img:" + s.imageCount);
    if (s.evmWords && s.evmWords.length) flags.push("words:" + s.evmWords.length);
    if (s.lines) flags.push("addr:" + s.lines);
    if (row.staticSource) flags.push(row.staticSource);
    if (row.discoverySource) flags.push(row.discoverySource);
    if (row.localPath) flags.push("local");
    flags.push(row.raw ? "hydrated" : "summary");
    const annotation = getPortalAnnotation(row);
    if (annotation.note) flags.push("note");
    if (!row.raw) flags.push("txid-only");
    return flags.join(" ");
  }

  const PORTAL_FILTER_IDS = [
    "digibyte", "ravencoin", "litecoin", "bitcoin", "dogecoin", "ecash", "evmGomez", "evmJethro", "other"
  ];

  function portalFilterConfigKey(id) {
    return "portalFilter" + id.charAt(0).toUpperCase() + id.slice(1);
  }

  function portalFilterCheckbox(id) {
    return $("#portalFilter" + id.charAt(0).toUpperCase() + id.slice(1));
  }

  function getPortalFilterValue(id) {
    const box = portalFilterCheckbox(id);
    if (box) return !!box.checked;
    if (Object.prototype.hasOwnProperty.call(state.portalSourceFilters, id)) return !!state.portalSourceFilters[id];
    return configBool(portalFilterConfigKey(id), true);
  }

  function setPortalFilterValue(id, value) {
    state.portalSourceFilters[id] = !!value;
    const box = portalFilterCheckbox(id);
    if (box) box.checked = !!value;
  }

  function getPortalSearchText() {
    const box = $("#portalEvmWordSearch");
    return String(box && box.value ? box.value : "").trim().toLowerCase();
  }

  function rawDecodedForRow(row) {
    const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
    return raw.decoded && typeof raw.decoded === "object" ? raw.decoded : {};
  }

  function summaryWordsForRow(row) {
    const s = row && row.summary ? row.summary : {};
    const d = rawDecodedForRow(row);
    const words = [];
    function add(value) {
      if (Array.isArray(value)) value.forEach(add);
      else if (value !== undefined && value !== null && String(value).trim()) words.push(String(value).trim());
    }
    add(s.evmWords);
    add(s.words);
    add(d.words);
    add(d.artifact);
    add(d.receiversDecoded);
    return uniqueStrings(words);
  }

  function searchableTextForRow(row) {
    const cache = portalRowCacheFor(row);
    if (cache && Object.prototype.hasOwnProperty.call(cache, "searchText")) return cache.searchText;
    const s = row && row.summary ? row.summary : {};
    const d = rawDecodedForRow(row);
    const parts = [
      row && row.txid,
      row && row.streamLabel,
      row && row.index && row.index.address,
      row && row.index && row.index.label,
      s.hash, s.title, s.cleanText, s.primaryUrl, s.functionName, s.methodId, s.contractName, s.contractAddress, s.coin,
      d.kind, d.message, d.text, d.artifact, d.body
    ];
    safeArray(s.evmReceivers).forEach(function (x) { parts.push(x); });
    safeArray(d.receivers).forEach(function (x) { parts.push(x); });
    portalRowAddresses(row).forEach(function (x) { parts.push(x); });
    collectEvmMediaCards(row).forEach(function (card) {
      parts.push(card.title, card.text, card.url, card.sourceUrl, card.videoId, card.kind);
    });
    summaryWordsForRow(row).forEach(function (x) { parts.push(x); });
    const text = parts.filter(Boolean).join(" ").toLowerCase();
    if (cache) cache.searchText = text;
    return text;
  }

  function portalRowMatchesSearch(row) {
    const needle = getPortalSearchText();
    if (!needle) return true;
    const hay = searchableTextForRow(row);
    return needle.split(/\s+/).filter(Boolean).every(function (part) { return hay.indexOf(part) !== -1; });
  }

  function portalRowIsVisible(row) {
    return getPortalFilterValue(sourceIdForRow(row)) && portalRowMatchesSearch(row);
  }

  function getFilteredPortalRows() {
    return state.portalRows.filter(portalRowIsVisible);
  }

  function applyPortalFilterConfig() {
    PORTAL_FILTER_IDS.forEach(function (id) {
      setPortalFilterValue(id, configBool(portalFilterConfigKey(id), true));
    });
  }

  function focusPortalSources(ids) {
    const allowed = Object.create(null);
    ids.forEach(function (id) { allowed[id] = true; });
    PORTAL_FILTER_IDS.forEach(function (id) { setPortalFilterValue(id, !!allowed[id]); });
    state.portalPage = 1;
    requestPortalRender();
  }


  function capturePortalView() {
    const filters = Object.create(null);
    PORTAL_FILTER_IDS.forEach(function (id) {
      filters[id] = getPortalFilterValue(id);
    });
    return {
      search: getPortalSearchText(),
      filters: filters,
      page: state.portalPage || 1,
      expandedRowKeys: Object.keys(state.expandedRowKeys || {}),
      selectedRowKey: state.selectedRowKey || "",
      selectedTxid: state.selectedTxid || ""
    };
  }

  function setPersonalStreamBackVisible(visible) {
    const button = $("#portalReturnDefaultStreamButton");
    if (button) button.hidden = !visible;
  }

  function restorePortalView(view) {
    const snapshot = view || { search:"", filters:null, page:1 };
    const search = $("#portalEvmWordSearch");
    if (search) search.value = snapshot.search || "";
    PORTAL_FILTER_IDS.forEach(function (id) {
      const value = snapshot.filters && Object.prototype.hasOwnProperty.call(snapshot.filters,id)
        ? !!snapshot.filters[id]
        : true;
      setPortalFilterValue(id,value);
    });
    state.portalPage = Math.max(1,Number(snapshot.page) || 1);
    state.expandedRowKeys = Object.create(null);
    safeArray(snapshot.expandedRowKeys).forEach(function (key) {
      if (state.portalRowKeys[key]) state.expandedRowKeys[key] = true;
    });
    state.selectedRowKey = state.portalRowKeys[snapshot.selectedRowKey] ? snapshot.selectedRowKey : "";
    state.selectedTxid = state.selectedRowKey ? (snapshot.selectedTxid || state.portalRowKeys[state.selectedRowKey].txid || "") : "";
    requestPortalRender();
  }

  function schedulePortalDiscovery() {
    if (state.discoveryKickPending) return;
    state.discoveryKickPending = true;
    window.setTimeout(function () {
      loadConversationStreams({ reset:false }).catch(function (error) {
        setStatus("ThunderWords discovery is still waiting: " + (error.message || String(error)), true);
      }).finally(function () {
        state.discoveryKickPending = false;
      });
    }, 0);
  }
  function hasPortalUtxoOutputs(raw) {
    const tx = txObject(raw);
    return !!(tx && (Array.isArray(tx.vout) || Array.isArray(tx.outputs)));
  }

  function makeBasicSummary(txid, tx, entry) {
    const raw = tx && tx.raw && typeof tx.raw === "object" ? tx.raw : {};
    const stats = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
    const coin = normalizeCoinName(entry && (entry.coin || entry.ticker || entry.name));
    let title = "transaction " + shortTxid(txid);

    // explorer.e.cash exposes an address-history JSON row without full vin/vout.
    // Preserve it as a useful feed row now; native Chronik hydration can replace
    // this later without changing the Portal row model.
    if (coin === "ecash" && Number.isFinite(Number(stats.deltaSats))) {
      const xec = Number(stats.deltaSats) / 100;
      const signed = (xec > 0 ? "+" : "") + xec.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " XEC";
      const tokenTicker = raw.token && raw.token.tokenTicker ? String(raw.token.tokenTicker).trim() : "";
      title = signed + (tokenTicker ? " · " + tokenTicker : "");
    }

    return {
      txid: txid,
      title: title,
      lines: 0,
      imageLines: 0,
      ipfsCount: 0,
      blockHeight: extractBlockHeight(tx),
      blockTime: blockTimeForRowValue(tx, entry && (entry.coin || entry.ticker || entry.name)),
      explorerUrl: entry && getThunderwords() ? getThunderwords().getTxUrl(entry, txid) : ""
    };
  }

  function sortPortalRows() {
    state.portalRows.sort(function (a, b) {
      const ap = a.publication && a.publication.ledgerState !== "seen" ? 1 : 0;
      const bp = b.publication && b.publication.ledgerState !== "seen" ? 1 : 0;
      if (ap !== bp) return bp - ap;
      if (ap && bp && a.publication.submittedAt !== b.publication.submittedAt) return b.publication.submittedAt - a.publication.submittedAt;
      const am = a.confirmed === false ? 1 : 0, bm = b.confirmed === false ? 1 : 0;
      if (am !== bm) return bm - am;
      const at = rowTime(a);
      const bt = rowTime(b);
      if (at !== bt) return bt - at;
      const ah = Number(a.summary && a.summary.blockHeight) || 0;
      const bh = Number(b.summary && b.summary.blockHeight) || 0;
      if (ah !== bh) return bh - ah;
      return String(b.txid || "").localeCompare(String(a.txid || ""));
    });
    state.portalSortPending = false;
  }

  function getPortalPageSize() {
    const configured = Number(configValue("portalPageSize", state.portalPageSize || 20)) || 20;
    return Math.max(1, Math.min(200, configured));
  }

  function getPortalPageCount(filteredRows) {
    const rows = Array.isArray(filteredRows) ? filteredRows : getFilteredPortalRows();
    return Math.max(1, Math.ceil(rows.length / getPortalPageSize()));
  }

  function clampPortalPage(filteredRows) {
    const count = getPortalPageCount(filteredRows);
    state.portalPage = Math.max(1, Math.min(count, Number(state.portalPage) || 1));
    return state.portalPage;
  }

  function getPortalPageRows(filteredRows) {
    const rows = Array.isArray(filteredRows) ? filteredRows : getFilteredPortalRows();
    const size = getPortalPageSize();
    const page = clampPortalPage(rows);
    return rows.slice((page - 1) * size, page * size);
  }

  function isVisiblePortalRow(row) {
    const key = row && row.key;
    return !!(key && state.visiblePortalRowKeys[key]);
  }

  function beginPortalBatch() {
    state.portalBatchDepth += 1;
  }

  function endPortalBatch() {
    state.portalBatchDepth = Math.max(0, state.portalBatchDepth - 1);
    if (state.portalBatchDepth) return;
    if (state.portalSortPending) sortPortalRows();
    if (!state.portalRenderQueued) return;
    state.portalRenderQueued = false;
    requestPortalRender();
  }

  function cancelScheduledPortalRender() {
    if (!state.portalRenderScheduled) return;
    if (state.portalRenderViaAnimationFrame && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(state.portalRenderHandle);
    } else {
      window.clearTimeout(state.portalRenderHandle);
    }
    state.portalRenderScheduled = false;
    state.portalRenderHandle = null;
    state.portalRenderViaAnimationFrame = false;
  }

  function requestPortalRender() {
    if (state.portalBatchDepth) {
      state.portalRenderQueued = true;
      return;
    }
    if (state.portalSortPending) sortPortalRows();
    if (state.portalRenderScheduled) return;
    state.portalRenderScheduled = true;
    const run = function () {
      state.portalRenderScheduled = false;
      state.portalRenderHandle = null;
      state.portalRenderViaAnimationFrame = false;
      renderPortalRows();
    };
    if (typeof window.requestAnimationFrame === "function") {
      state.portalRenderViaAnimationFrame = true;
      state.portalRenderHandle = window.requestAnimationFrame(run);
    } else {
      state.portalRenderHandle = window.setTimeout(run, 0);
    }
  }

  function setPortalPage(page) {
    const filteredRows = getFilteredPortalRows();
    const previousPage = clampPortalPage(filteredRows);
    state.portalPage = Math.max(1, Number(page) || 1);
    const nextPage = clampPortalPage(filteredRows);
    if (nextPage !== previousPage) {
      state.expandedRowKeys = Object.create(null);
      state.selectedRowKey = "";
    }
    renderPortalRows();
    const list = $("#portalTransactionList");
    if (list) list.scrollTop = 0;
  }

  function resetPortalRowsForNewLoad() {
    snapshotRecentPortalSummaries(false);
    const publications = state.portalRows.filter(function (row) { return !!row.publication; });
    state.portalLoadGeneration += 1;
    loadingQueue.reset();
    state.liveLedgerHistories = Object.create(null);
    transactionStore.reset();
    state.expandedRowKeys = Object.create(null);
    state.pendingHydration = Object.create(null);
    state.pendingDateLookup = Object.create(null);
    state.attemptedDateLookup = Object.create(null);
    state.attemptedFinanceLookup = Object.create(null);
    state.visibleFinanceLookupScheduled = false;
    state.visibleDateLookupScheduled = false;
    state.visibleDateLookupToken = "";
    visibleAnnotationsLoading = false;
    state.visiblePortalRowKeys = Object.create(null);
    state.portalSortPending = false;
    state.selectedRowKey = "";
    state.selectedTxid = "";
    state.conversationRows = [];
    state.rabbitTrails = [];
    state.portalPage = 1;
    publications.forEach(function (row) { upsertPortalRow(row, {silent: true, deferSort: true}); });
    requestPortalRender();
    return state.portalLoadGeneration;
  }

  function clearPortalStream(reason) {
    const generation = resetPortalRowsForNewLoad();
    state.staticDatasetLoaded = false;
    state.staticDatasetReports = [];
    state.staticManifest = null;
    state.staticRawByTxid = Object.create(null);
    setText("#portalThunderwordRaw", "");
    setStatus(reason || "Portal stream cleared. Static data and live searches can be loaded again.", false);
    return generation;
  }

  function renderPortalPageControls(rows) {
    const target = $("#portalPageControls");
    if (!target) return;
    const box = document.createElement("div");

    const filteredRows = Array.isArray(rows) ? rows : getFilteredPortalRows();
    if (!state.portalRows.length || !filteredRows.length) {
      target.textContent = "";
      return;
    }

    const count = getPortalPageCount(filteredRows);
    const page = clampPortalPage(filteredRows);
    const size = getPortalPageSize();
    const start = ((page - 1) * size) + 1;
    const end = Math.min(filteredRows.length, page * size);

    const label = document.createElement("span");
    label.textContent = "page " + page + "/" + count + " · " + start + "–" + end + " of " + filteredRows.length + (filteredRows.length === state.portalRows.length ? "" : " · " + state.portalRows.length + " loaded");
    box.appendChild(label);

    function addButton(text, targetPage, disabled) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondaryButton portalPageButton";
      button.textContent = text;
      button.disabled = !!disabled;
      button.onclick = function () { setPortalPage(targetPage); };
      box.appendChild(button);
    }

    addButton("‹", page - 1, page <= 1);

    const around = [];
    for (let p = 1; p <= count; p += 1) {
      if (p === 1 || p === count || Math.abs(p - page) <= 2) around.push(p);
    }
    let last = 0;
    around.forEach(function (p) {
      if (last && p > last + 1) {
        const gap = document.createElement("span");
        gap.textContent = "…";
        box.appendChild(gap);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondaryButton portalPageButton" + (p === page ? " active" : "");
      button.textContent = "page" + p;
      button.disabled = p === page;
      button.onclick = function () { setPortalPage(p); };
      box.appendChild(button);
      last = p;
    });

    addButton("›", page + 1, page >= count);
    viewApi.patchChildren(target, box);
  }

  function mergePortalSummary(existingSummary, incomingSummary) {
    return transactionStore.mergeSummary(existingSummary, incomingSummary);
  }

  let recentPortalSaveTimer = null;

  function prioritizePortalRows(rows) {
    if (state.portalSortPending) sortPortalRows();
    const visible = new Set(getPortalPageRows(getFilteredPortalRows()).map(rowKey));
    function priority(row) {
      const key = row.key || rowKey(row);
      return state.expandedRowKeys[key] ? 2 : (visible.has(key) ? 1 : 0);
    }
    return rows.slice().sort(function (a, b) {
      return priority(b) - priority(a) || rowTime(b) - rowTime(a) || compareStreamItems(a, b);
    });
  }

  function snapshotRecentPortalSummaries(persist) {
    transactionStore.snapshotRecent(prioritizePortalRows(state.portalRows), persist);
  }

  function scheduleRecentPortalSnapshot() {
    if (recentPortalSaveTimer) return;
    recentPortalSaveTimer = window.setTimeout(function () {
      recentPortalSaveTimer = null;
      snapshotRecentPortalSummaries();
    }, 200);
  }

  function upsertPortalRow(row, opts) {
    if (!row || !TXID_RE.test(String(row.txid || ""))) return null;
    const key = rowKey(row);
    const merged = transactionStore.upsert(row, opts);

    invalidatePortalRowCache(merged);
    state.portalSortPending = true;
    if (!state.portalBatchDepth && !(opts && opts.deferSort)) sortPortalRows();
    if (!(opts && opts.silent)) requestPortalRender();
    scheduleRecentPortalSnapshot();

    if (opts && opts.select) {
      selectPortalRow(key).catch(function (error) { setStatus(error.message || String(error), true); });
    }

    return merged;
  }

  function appendPortalInlineLinks(container, semantics, indexEntry) {
    const records = semantics && semantics.records ? semantics.records : [];
    container.innerHTML = "";

    records.filter(function (record) { return record.kind === "op-return-url"; }).forEach(function (record) {
      const row = document.createElement("div");
      row.className = "portalLinkRow";

      const label = document.createElement("code");
      label.textContent = record.url;

      const a = document.createElement("a");
      a.className = "secondaryButton";
      setSafeHref(a, record.url);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = record.url.indexOf("spotify.com") >= 0 ? "open Spotify" : (record.url.indexOf("youtu") >= 0 ? "open YouTube" : "open URL");

      row.appendChild(label);
      row.appendChild(a);
      container.appendChild(row);
    });

    records.filter(function (record) { return record.kind === "ipfs-v0-cid"; }).forEach(function (record) {
      const row = document.createElement("div");
      row.className = "portalLinkRow";

      const label = document.createElement("code");
      label.textContent = record.cid + (record.validCidV0Shape ? "" : "  [shape warning]");

      const a = document.createElement("a");
      a.className = "secondaryButton";
      setSafeHref(a, record.ipfsUrl);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "IPFS gateway";

      const local = document.createElement("a");
      local.className = "secondaryButton";
      setSafeHref(local, record.localIpfsUrl);
      local.target = "_blank";
      local.rel = "noopener noreferrer";
      local.textContent = "local gateway";

      row.appendChild(label);
      row.appendChild(a);
      row.appendChild(local);
      container.appendChild(row);
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

      const targetEntry = inferIndexForAddress(record.line, indexEntry);
      row.appendChild(label);
      row.appendChild(makeDrillButton(record.line, targetEntry, decoded || record.line));
      row.appendChild(makeAddressExplorerLink(record.line, targetEntry));
      container.appendChild(row);
    });

    return container.childNodes.length;
  }

  function appendPortalVinAddresses(container, row) {
    const addresses = uniqueStrings(extractInputAddresses(row && row.raw));
    if (!addresses.length) return null;

    const block = document.createElement("div");
    block.className = "portalVinBlock";

    const title = document.createElement("div");
    title.className = "stepTitle";
    title.textContent = "VIN";
    block.appendChild(title);

    const list = document.createElement("div");
    list.className = "portalVinList";

    addresses.forEach(function (address) {
      const entry = inferIndexForAddress(address, rowIndexEntry(row));
      const line = document.createElement("div");
      line.className = "portalVinRow";

      const lookup = document.createElement("button");
      lookup.type = "button";
      lookup.className = "portalVinAddress";
      lookup.textContent = address;
      lookup.title = "Load this VIN address as a rabbit trail";
      lookup.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        loadAddressStream(address, entry, "VIN " + address, {
          source: "rabbit-trail",
          sourceTxid: row.txid,
          updateUrl: true
        }).catch(function (error) {
          setStatus(error.message || String(error), true);
        });
      };

      line.appendChild(lookup);
      line.appendChild(makeAddressExplorerLink(address, entry));
      line.appendChild(makeTrackAddressButton(address, entry, row && row.txid));
      list.appendChild(line);
    });

    block.appendChild(list);
    container.appendChild(block);
    return block;
  }

  function makeInlinePre(title, text, open) {
    const details = document.createElement("details");
    details.className = "portalInlineDrawer";
    if (open) details.open = true;

    const summary = document.createElement("summary");
    summary.textContent = title;
    details.appendChild(summary);

    const pre = document.createElement("pre");
    pre.className = "json";
    pre.textContent = text || "";

    if (title === "Raw transaction JSON") {
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "secondaryButton portalCopyJsonButton";
      copy.textContent = "COPY";
      copy.title = "Copy complete raw transaction JSON";
      copy.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        copyPortalText(pre.textContent, copy).catch(function (error) {
          setStatus(error.message || String(error), true);
        });
      };
      details.appendChild(copy);
    }

    details.appendChild(pre);
    return details;
  }

  function makeInlineDrawer(title, open) {
    const details = document.createElement("details");
    details.className = "portalInlineDrawer portalInlineDataDrawer";
    if (open) details.open = true;

    const summary = document.createElement("summary");
    summary.textContent = title;
    details.appendChild(summary);
    return details;
  }

  function decodeHtmlEntities(text) {
    return String(text || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '\"')
      .replace(/&#39;/g, "'");
  }

  function cleanHtmlishText(text) {
    let out = String(text || "");
    out = out.replace(/<!doctype[^>]*>/gi, " ");
    out = out.replace(/<\s*br\s*\/?\s*>/gi, " ");
    out = out.replace(/<\s*\/?\s*[a-z][^>]*>/gi, " ");
    out = out.replace(/https?:\/\/[^\s'"<>]+/gi, " ");
    out = out.replace(/^\s*<[^>]*$/g, " ");
    out = out.replace(/<\/?[a-z][^>]*$/gi, " ");
    out = out.replace(/<\/?[a-z]*\s*$/gi, " ");
    out = decodeHtmlEntities(out);
    return printableText(out).replace(/\s+/g, " ").trim();
  }

  function extractUrlsFromText(text) {
    const out = [];
    String(text || "").replace(/https?:\/\/[^\s'"<>]+/gi, function (url) {
      out.push(url.replace(/[),.;]+$/, ""));
      return url;
    });
    return uniqueStrings(out);
  }

  function makeRecordLink(url, text) {
    const a = document.createElement("a");
    a.className = "secondaryButton";
    setSafeHref(a, url);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text || "open record target";
    return a;
  }

  function appendWordChips(container, words) {
    const chips = document.createElement("div");
    chips.className = "portalWordChips";
    uniqueStrings(words).forEach(function (word) {
      const chip = document.createElement("span");
      chip.className = "portalWordChip";
      chip.textContent = word;
      chips.appendChild(chip);
    });
    if (chips.childNodes.length) container.appendChild(chips);
  }

  function pageMetadataKey(url) {
    return "chisel.portal.pageMetadata.v1:" + encodeURIComponent(url);
  }

  function isNetflixLink(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === "netflix.com" || host.endsWith(".netflix.com");
    } catch (error) { return false; }
  }

  function readPageMetadata(url) {
    try {
      const saved = JSON.parse(localStorage.getItem(pageMetadataKey(url)) || "null");
      if (saved && saved.schema === "chisel-page-metadata-v1") return saved;
      // Migrate the earlier Netflix-specific local annotations transparently.
      if (isNetflixLink(url)) {
        const legacy = JSON.parse(localStorage.getItem("chisel.portal.netflixMetadata.v1:" + encodeURIComponent(url)) || "null");
        if (legacy) return {schema:"chisel-page-metadata-v1",url:url,title:legacy.title || "",description:"",image:legacy.artwork || "",capturedAt:""};
      }
    } catch (error) {}
    return null;
  }

  function savePageMetadata(url, fields, previous) {
    const image = String(fields.image || "").trim();
    const safeImage = image ? CHISEL.safeWebUrl(image, window.location.href) : "";
    const metadata = {
      schema:"chisel-page-metadata-v1",
      url:url,
      title:String(fields.title || "").trim().slice(0,200),
      description:String(fields.description || "").trim().slice(0,1200),
      previewUrl:image.slice(0,2048),
      image:safeImage && /^https:\/\//i.test(image) && /\.(?:png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(image) ? safeImage : "",
      capturedAt:previous && previous.capturedAt || new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      captureMethod:"manual"
    };
    try { localStorage.setItem(pageMetadataKey(url), JSON.stringify(metadata)); return metadata; }
    catch (error) { return null; }
  }

  function downloadPageMetadata(metadata) {
    const blob = new Blob([JSON.stringify(metadata,null,2) + "\n"], {type:"application/json"});
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = "chisel-page-" + new Date().toISOString().slice(0,10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
  }

  function mediaImageUrl(value) {
    const text = String(value || "").trim();
    const safe = CHISEL.safeWebUrl(text, window.location.href);
    if (!safe || !/^https?:\/\//i.test(text)) return "";
    // Explicit image fields may contain extensionless IPFS/proxy URLs. A
    // Netflix watch/title page is a navigation destination, not image bytes.
    if (isNetflixLink(safe) && /^\/(?:watch|title)\//i.test(new URL(safe).pathname)) return "";
    return safe;
  }

  function mediaCardPresentation(card) {
    const url = normalizeMediaUrl(card.url || card.sourceUrl || "");
    const netflix = isNetflixLink(url);
    const saved = url ? readPageMetadata(url) : null;
    const previewUrl = String(saved && (saved.previewUrl || saved.image) || "").trim();
    const knownPublicPreview = /^(?:https:\/\/)?(?:www\.)?netflix\.com\/title\/70264888(?:[/?#]|$)/i.test(previewUrl)
      ? "https://occ-0-3012-3997.1.nflxso.net/dnm/api/v6/MgXQGyNr1xbI8tJSYiMWv5kXg5g/AAAABWKRtnVHa-W7sbHt3OFJ6SLD4XC9XUZcPe_c4JqhKTD7IuY_NqyLuEy7jkZ-0b5jjbdR4NGbuhif_82l516ziGVXTOyDt5wOe-W0oMmKOQiuKShM-qBLVOrsjg.jpg?r=fe6" : "";
    const thumbnailUrl = mediaImageUrl(saved && saved.image) || mediaImageUrl(card.thumbnailUrl) || knownPublicPreview;
    const candidate = printableText(saved && saved.title || card.title || "");
    const hasTitle = candidate && !isLikelyUrl(candidate) && !isRawHtmlTitle(candidate);
    const title = hasTitle ? candidate : netflix ? "Netflix reference (metadata not captured)" : humanUrlTitle(url) || "media";
    return {url: url, sourceUrl: card.sourceUrl || url, saved: saved, previewUrl: previewUrl,
      thumbnailUrl: thumbnailUrl, title: title,
      description: cleanHtmlishText(saved && saved.description || card.description || card.text || ""),
      authorName: printableText(saved && saved.authorName || card.authorName || ""),
      provider: printableText(saved && saved.provider || card.provider || (netflix ? "Netflix" : card.kind === "youtube" ? "YouTube" : card.kind && card.kind !== "link" ? card.kind : ""))};
  }

  function appendCollapsedMediaMetadata(container, row) {
    const cards = collectEvmMediaCards(row);
    if (!cards.length) return;
    const display = mediaCardPresentation(cards[0]);
    const parts = uniqueStrings([display.authorName, display.provider,
      display.description && display.description !== display.title ? display.description : ""].filter(Boolean));
    if (!parts.length) return;
    const metadata = document.createElement("span");
    metadata.className = "portalStreamMetadata";
    metadata.textContent = parts.join(" · ");
    metadata.title = metadata.textContent;
    container.appendChild(metadata);
    return true;
  }

  function appendPortalEvmMediaCards(container, row) {
    const cards = collectEvmMediaCards(row);
    if (!cards.length) return null;

    const block = document.createElement("div");
    block.className = "portalEvmMediaBlock";
    block.setAttribute("aria-label", "Linked media");

    const grid = document.createElement("div");
    grid.className = "portalEvmMediaGrid";

    cards.forEach(function (card) {
      const display = mediaCardPresentation(card);
      const url = display.url;
      const netflix = isNetflixLink(url);
      const saved = display.saved;
      const media = document.createElement(url ? "a" : "div");
      media.className = "portalEvmMediaCard";
      if (card.videoId || String(card.kind || "").toLowerCase() === "youtube") media.classList.add("isYoutube");
      if (String(card.kind || "").toLowerCase() === "tiktok") media.classList.add("isTikTok");
      if (url) {
        setSafeHref(media, url);
        media.target = "_blank";
        media.rel = "noopener noreferrer";
      }

      const previewUrl = display.previewUrl;
      const thumb = display.thumbnailUrl;

      function makePreviewFallback() {
        const fallback = document.createElement("div");
        fallback.className = "portalEvmMediaThumb portalEvmMediaThumbFallback";
        fallback.style.overflowWrap = "anywhere";
        fallback.textContent = netflix ? "Netflix series preview" : String(card.kind || "link").toUpperCase();
        return fallback;
      }
      if (thumb) {
        const img = document.createElement("img");
        img.className = "portalEvmMediaThumb";
        img.alt = display.title || card.kind || "media thumbnail";
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.onerror = function () {
          img.replaceWith(makePreviewFallback());
        };
        img.src = thumb;
        media.appendChild(img);
      } else {
        media.appendChild(makePreviewFallback());
      }

      const body = document.createElement("div");
      body.className = "portalEvmMediaBody";

      const h = document.createElement("strong");
      const cardTitle = display.title;
      h.textContent = cardTitle;
      body.appendChild(h);

      if (display.authorName) {
        const author = document.createElement("p");
        author.className = "muted";
        author.textContent = display.authorName;
        body.appendChild(author);
      }

      const text = display.description;
      if (text && text !== cardTitle) {
        const p = document.createElement("p");
        p.textContent = text.length > 180 ? text.slice(0, 177) + "…" : text;
        body.appendChild(p);
      }

      media.appendChild(body);
      grid.appendChild(media);
      if (previewUrl && previewUrl !== url) {
        const previewInfo = document.createElement("div");
        previewInfo.className = "portalEvmMediaBody";
        const preview = document.createElement("a");
        preview.textContent = "Series preview: " + previewUrl;
        const safePreview = CHISEL.safeWebUrl(previewUrl, window.location.href);
        if (safePreview && /^https:\/\//i.test(safePreview) && /^https:\/\//i.test(previewUrl)) {
          setSafeHref(preview, safePreview);
          preview.target = "_blank";
          preview.rel = "noopener noreferrer";
          previewInfo.appendChild(preview);
        } else {
          previewInfo.textContent = "Series preview reference: " + previewUrl;
        }
        grid.appendChild(previewInfo);
      }
      if (url && !row.draftRecord) {
        const controls = document.createElement("div");
        controls.className = "portalEvmMediaBody";
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "secondaryButton";
        edit.textContent = saved ? "Edit page metadata" : "Capture page metadata";
        edit.onclick = function () {
          const title = window.prompt("Page title:", saved && saved.title || card.title || "");
          if (title === null) return;
          const description = window.prompt("Page description:", saved && saved.description || "");
          if (description === null) return;
          const image = window.prompt("Public series preview page URL (or direct HTTPS image URL):", saved && (saved.previewUrl || saved.image) || "");
          if (image === null) return;
          const metadata = savePageMetadata(url,{title:title,description:description,image:image},saved);
          if (!metadata) { setStatus("Page metadata could not be saved to this browser.",true); return; }
          requestPortalRender();
          setStatus("Page metadata captured locally. Export JSON to publish through your preferred IPFS/FileProxy workflow.",false);
        };
        controls.appendChild(edit);
        if (saved) {
          const exportButton = document.createElement("button");
          exportButton.type = "button";
          exportButton.className = "secondaryButton";
          exportButton.textContent = "Export metadata JSON";
          exportButton.onclick = function () { downloadPageMetadata(saved); };
          controls.appendChild(exportButton);
        }
        grid.appendChild(controls);
      }
    });

    block.appendChild(grid);
    container.appendChild(block);
    return block;
  }

  function appendPortalEvmDecodedBlock(container, row) {
    const sourceId = sourceIdForRow(row);
    if (sourceId.indexOf("evm") !== 0) return null;

    const summary = row.summary || {};
    const decoded = rawDecodedForRow(row);
    const words = summaryWordsForRow(row);
    const receivers = safeArray(summary.evmReceivers && summary.evmReceivers.length ? summary.evmReceivers : decoded.receivers);
    const amounts = safeArray(summary.evmAmounts && summary.evmAmounts.length ? summary.evmAmounts : decoded.amounts);
    const kind = summary.recordKind || decoded.kind || summary.functionName || summary.methodId || "EVM record";
    const rawText = summary.cleanText || decoded.message || decoded.text || decoded.body || summary.title || "";
    const cleanText = cleanHtmlishText(rawText);
    const urls = uniqueStrings([summary.primaryUrl].concat(safeArray(summary.opReturnUrls), extractUrlsFromText(rawText), extractUrlsFromText(summary.title)));
    const mediaCards = collectEvmMediaCards(row);

    if (!words.length && !receivers.length && !cleanText && !urls.length && !kind) return null;

    const block = document.createElement("div");
    block.className = "portalEvmDecodedBlock";

    const title = document.createElement("div");
    title.className = "stepTitle";
    title.textContent = sourceId === "evmGomez" ? "Gomez decoded record" : (sourceId === "evmJethro" ? "Jethro decoded artifact" : "EVM decoded record");
    block.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = [
      kind,
      summary.contractName ? "contract " + summary.contractName : "",
      summary.methodId || ""
    ].filter(Boolean).join(" | ");
    block.appendChild(meta);

    if (cleanText) {
      const message = document.createElement("p");
      const compactText = mediaCards.length && cleanText.length > 520 ? cleanText.slice(0, 517) + "…" : cleanText;
      message.textContent = compactText;
      block.appendChild(message);
    }

    if (urls.length) {
      const actions = document.createElement("div");
      actions.className = "actions";
      urls.forEach(function (url, index) {
        actions.appendChild(makeRecordLink(url, index ? "open link " + (index + 1) : "open record target"));
      });
      block.appendChild(actions);
    }

    if (words.length) {
      const wordsTitle = document.createElement("div");
      wordsTitle.className = "stepTitle";
      wordsTitle.textContent = sourceId === "evmGomez" ? "receiver address words" : "artifact words";
      block.appendChild(wordsTitle);
      appendWordChips(block, words);
    }

    if (receivers.length) {
      const table = document.createElement("table");
      table.className = "portalMiniTable";
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      ["#", "decoded word", "EVM address", "amount"].forEach(function (label) {
        const th = document.createElement("th");
        th.textContent = label;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      receivers.forEach(function (address, index) {
        const tr = document.createElement("tr");
        [String(index + 1), words[index] || "", address, amounts[index] || ""].forEach(function (value) {
          const td = document.createElement("td");
          td.textContent = value;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      block.appendChild(table);
    }

    container.appendChild(block);
    return block;
  }

  function appendPortalEvmImages(container, row) {
    const images = collectEvmImageAssets(row);
    if (!images.length) return null;

    const block = document.createElement("div");
    block.className = "portalInlineImageBlock portalInlineEvmImageBlock";

    const title = document.createElement("div");
    title.className = "stepTitle";
    title.textContent = "EVM image asset";
    block.appendChild(title);

    images.forEach(function (asset) {
      const frame = document.createElement("div");
      frame.className = "portalInlineEvmImageFrame";

      const img = document.createElement("img");
      img.className = "portalInlineEvmImage";
      img.alt = asset.assetId || "EVM image asset";
      img.title = asset.assetId || asset.path || "EVM image asset";
      img.loading = "lazy";
      setPortalAssetImage(img, asset.path, row);
      frame.appendChild(img);

      const caption = document.createElement("p");
      caption.className = "muted";
      caption.textContent = [
        asset.assetId || "image",
        asset.mime || "",
        asset.width && asset.height ? asset.width + " × " + asset.height : "",
        asset.bytes ? asset.bytes + " bytes" : ""
      ].filter(Boolean).join(" | ");
      frame.appendChild(caption);

      block.appendChild(frame);
    });

    container.appendChild(block);
    return block;
  }

  function appendPortalInlineImage(container, imageLines) {
    const lines = getImageLines(imageLines || []);
    if (!lines.length) return null;

    const block = document.createElement("div");
    block.className = "portalInlineImageBlock";

    const title = document.createElement("div");
    title.className = "stepTitle";
    title.textContent = "Base57 image";
    block.appendChild(title);

    const canvasWrap = document.createElement("div");
    canvasWrap.className = "portalInlineImageCanvasWrap";

    const canvas = document.createElement("canvas");
    canvas.className = "portalInlineImageCanvas";
    canvas.title = "Base57 image carried by this transaction";

    const configuredScale = configValue("inlineImageExpandedScale", configValue("inlineImageScale", 12));
    const scale = Math.max(1, Number(configuredScale) || 12);
    const stats = paintChordCanvas(canvas, lines, { scale: scale, skipPrefix: DEFAULT_SKIP_PREFIX, skipSuffix: DEFAULT_SKIP_SUFFIX });

    canvasWrap.appendChild(canvas);
    block.appendChild(canvasWrap);

    const caption = document.createElement("p");
    caption.className = "muted";
    caption.textContent = stats.rows + " rows × " + stats.cols + " cols | scale " + stats.scale + " | " + lines.length + " Base57 line(s)";
    block.appendChild(caption);

    container.appendChild(block);
    return block;
  }

  function appendPortalAnnotationEditor(container, row) {
    const annotation = getPortalAnnotation(row), hasContent = portalAnnotationHasContent(annotation);
    let view = annotationViews.get(container);
    if (!view || view.row !== row) {
      noteFunction.disposeWithin(container); container.replaceChildren();
      const block = document.createElement("section");
      block.className = "portalAnnotationBlock portalTransactionNotes";
      const heading = document.createElement("h5"); heading.textContent = "Notes"; block.appendChild(heading);
      const text = document.createElement("div"); text.className = "portalAnnotationText"; block.appendChild(text);
      const runtime = document.createElement("div"); runtime.style.display = "contents"; block.appendChild(runtime);
      const metadataDrawer = makeInlinePre("Metadata", "", false); block.appendChild(metadataDrawer);
      const metadataPre = metadataDrawer.children[metadataDrawer.children.length - 1];
      const editor = document.createElement("details"); editor.open = !!row.annotationDraft;
      const summary = document.createElement("summary"); editor.appendChild(summary);
      const grid = document.createElement("div"); grid.className = "portalAnnotationGrid";
      const noteLabel = document.createElement("label"); noteLabel.textContent = "Note";
      const note = document.createElement("textarea"); note.rows = 7; note.maxLength = notesData.MAX_NOTE;
      note.placeholder = "What this transaction means, the work behind it, links, analysis or follow-up.";
      noteLabel.appendChild(note); grid.appendChild(noteLabel);
      const metadataLabel = document.createElement("label"); metadataLabel.textContent = "Metadata (optional JSON object)";
      const metadata = document.createElement("textarea"); metadata.rows = 5; metadata.spellcheck = false;
      metadata.placeholder = '{"title":"Record title","sources":[]}';
      metadataLabel.appendChild(metadata); grid.appendChild(metadataLabel); editor.appendChild(grid);
      function rememberDraft() { row.annotationDraft = {note: note.value, metadataText: metadata.value, dirty: true}; }
      note.oninput = metadata.oninput = rememberDraft;
      function value() { return {schema: notesData.SCHEMA, note: note.value, metadata: notesData.metadata(metadata.value)}; }
      const actions = document.createElement("div"); actions.className = "actions portalAnnotationActions";
      const save = document.createElement("button"); save.type = "button"; save.className = "secondaryButton"; save.textContent = "SAVE TO FILEPROXY";
      save.onclick = async function (event) {
        event.preventDefault(); event.stopPropagation(); rememberDraft(); save.disabled = true;
        try {
          const saved = await savePortalAnnotationToFileProxy(row, value());
          row.annotationDraft = null;
          setStatus("Saved transaction note through FileProxy: " + saved.path + ".", false); requestPortalRender();
        } catch (error) { setStatus(error.message || String(error), true); }
        finally { save.disabled = false; }
      };
      const local = document.createElement("button"); local.type = "button"; local.className = "secondaryButton"; local.textContent = "SAVE IN BROWSER";
      local.onclick = function (event) {
        event.preventDefault(); event.stopPropagation(); rememberDraft();
        try {
          if (setPortalAnnotation(row, value())) {
            row.annotationDraft = null;
            annotationReads.set(portalAnnotationKey(row), Object.assign({}, annotationReads.get(portalAnnotationKey(row)), {source: "browser"}));
            setStatus("Saved transaction note in this browser.", false); requestPortalRender();
          }
        } catch (error) { setStatus(error.message || String(error), true); }
      };
      const reload = document.createElement("button"); reload.type = "button"; reload.className = "secondaryButton"; reload.textContent = "RELOAD SHARED NOTE";
      reload.onclick = function (event) {
        event.preventDefault(); event.stopPropagation();
        loadPortalAnnotation(row, {force: true}).then(function () { requestPortalRender(); }).catch(function (error) { setStatus(error.message, true); });
      };
      actions.appendChild(save); actions.appendChild(local); actions.appendChild(reload); editor.appendChild(actions);
      const help = document.createElement("p"); help.className = "muted";
      help.textContent = "FileProxy saves are shared through the configured server. Browser saves stay on this device. Notes and metadata are separate from the ledger.";
      editor.appendChild(help); block.appendChild(editor);
      const stamp = document.createElement("p"); stamp.className = "muted"; block.appendChild(stamp);
      container.appendChild(block);
      view = {row: row, block: block, text: text, runtime: runtime, metadataDrawer: metadataDrawer,
        metadataPre: metadataPre, editor: editor, summary: summary, note: note, metadata: metadata, stamp: stamp};
      annotationViews.set(container, view);
    }
    view.text.hidden = !annotation.note;
    if (view.text.textContent !== annotation.note) view.text.textContent = annotation.note;
    view.metadataDrawer.hidden = !Object.keys(annotation.metadata).length;
    const metadataText = pretty(annotation.metadata);
    if (view.metadataPre.textContent !== metadataText) view.metadataPre.textContent = metadataText;
    view.summary.textContent = hasContent ? "Edit note" : "Add note";
    const draft = row.annotationDraft;
    const noteValue = draft ? draft.note : annotation.note;
    const metadataValue = draft ? draft.metadataText : Object.keys(annotation.metadata).length ? metadataText : "";
    if (view.note.value !== noteValue) view.note.value = noteValue;
    if (view.metadata.value !== metadataValue) view.metadata.value = metadataValue;
    const read = annotationReads.get(portalAnnotationKey(row));
    view.stamp.hidden = !annotation.updatedAt;
    view.stamp.textContent = annotation.updatedAt ? (read && read.source || "browser") + " · updated " +
      new Date(annotation.updatedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "";
    const spec = noteFunction.descriptor(annotation);
    const functionStamp = JSON.stringify(spec && [spec.source, spec.entry, spec.metadata.protocol,
      spec.metadata.locator, spec.metadata.canonicalRoot]);
    if (view.functionStamp !== functionStamp) {
      noteFunction.disposeWithin(view.runtime); view.runtime.replaceChildren();
      noteFunction.render(view.runtime, row, annotation, {loadTransaction: async function (txid, rawUrl) {
        const coin = canonicalCoinForRow(row), known = state.portalRowKeys[rowKey({coin: coin, txid: txid})];
        if (known && known.raw) return known.raw;
        return queuePortalRead("artifact:" + coin + ":" + txid, row, "transaction", async function () {
          if (rawUrl && CHISEL.safeWebUrl(rawUrl, window.location.href)) {
            try { return (await staticTransport.fetchStaticRawFromRow({coin: coin, txid: txid, staticRawUrl: rawUrl})).json; } catch (_) {}
          }
          return (await loadLocalTransaction(txid, coin)).raw;
        });
      }});
      view.functionStamp = functionStamp;
    }
    return view.block;
  }

  // A transaction reference should identify its chain, not its current explorer.
  // This is deliberately plain text: a QR scanner can hand it to Mogwai later.
  function qualifiedTransactionIdForRow(row) {
    const txid = String(row && row.txid || "").trim();
    if (!/^(?:0x)?[0-9a-f]{64}$/i.test(txid)) return "";
    const hash = txid.replace(/^0x/i, "").toLowerCase();
    const coin = canonicalCoinForRow(row);
    const sourceId = sourceIdForRow(row);

    if (coin === "evm" || sourceId === "evmGomez" || sourceId === "evmJethro") {
      const chainId = String(
        (row.index && row.index.chainId) ||
        (row.summary && row.summary.chainId) ||
        (row.raw && row.raw.chainId) ||
        ((sourceId === "evmGomez" || sourceId === "evmJethro") ? "137" : "")
      ).trim();
      const networks = {
        "1": "ethereum",
        "137": "polygon",
        "8453": "base",
        "80002": "polygon-amoy",
        "11155111": "ethereum-sepolia"
      };
      if (networks[chainId]) return networks[chainId] + ":0x" + hash;
      // Preserve chain specificity for other EVM networks; never guess Polygon.
      return /^[0-9]{1,10}$/.test(chainId) ? "eip155:" + chainId + "/tx:0x" + hash : "";
    }

    const prefixes = {
      bitcoin: "bitcoin",
      digibyte: "digibyte",
      dogecoin: "dogecoin",
      ecash: "ecash",
      litecoin: "litecoin",
      ravencoin: "ravencoin"
    };
    return prefixes[coin] ? prefixes[coin] + ":" + hash : "";
  }

  function appendPortalTransactionQr(container, row) {
    const qualified = qualifiedTransactionIdForRow(row);
    if (!qualified) return null;

    const card = document.createElement("div");
    card.className = "portalTransactionQr";

    const qr = document.createElement("div");
    qr.className = "portalTransactionQrCode";
    qr.setAttribute("aria-label", "QR code for " + qualified);
    if (typeof window.QRCode === "function") {
      try {
        new window.QRCode(qr, {
          text: qualified,
          width: 132,
          height: 132,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.M
        });
      } catch (error) {
        qr.textContent = "QR unavailable";
      }
    } else {
      qr.textContent = "QR unavailable";
    }
    card.appendChild(qr);

    const info = document.createElement("div");
    info.className = "portalTransactionQrInfo";
    const label = document.createElement("strong");
    label.textContent = "Chain-qualified transaction ID";
    info.appendChild(label);
    const value = document.createElement("code");
    value.textContent = qualified;
    info.appendChild(value);

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "secondaryButton";
    copy.textContent = "copy qualified ID";
    copy.onclick = async function (event) {
      event.preventDefault();
      event.stopPropagation();
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(qualified);
        setStatus("Copied chain-qualified transaction ID.", false);
      } catch (error) {
        // HTTP and file:// may not expose navigator.clipboard.
        if (typeof window.prompt === "function") window.prompt("Copy qualified transaction ID:", qualified);
      }
    };
    info.appendChild(copy);
    card.appendChild(info);
    container.appendChild(card);
    return card;
  }

  function portalDisplayStamp(row) {
    return JSON.stringify([row.raw, row.summary, row.publication, row.index, row.localPath,
      row.rawSourceUrl, row.blockTime, row.confirmed, row.loadError, row.dateLookupError,
      getPortalAnnotation(row), state.personalAccount, !!state.pendingHydration[row.key],
      !!state.pendingDateLookup[row.key], !!state.attemptedFinanceLookup[row.key],
      rowExplorerUrl(row), portalRecordUrl(row),
      collectEvmMediaCards(row).map(function (card) { return readPageMetadata(card.url); }),
      getStaticDataSources(), getFileProxyUrl(), state.fileProxyAvailable,
      configValue("inlineImageThumbScale", 2), configValue("inlineImageScale", 12), configValue("inlineImageExpandedScale", 12)]);
  }

  function portalDisclosures(container) {
    const found = new Map(), counts = Object.create(null);
    function visit(node) {
      if (String(node.tagName).toLowerCase() === "details") {
        const summary = Array.from(node.childNodes).find(function (child) { return String(child.tagName).toLowerCase() === "summary"; });
        const name = node.className + ":" + (summary && summary.textContent || "");
        const key = name + ":" + (counts[name] = (counts[name] || 0) + 1);
        found.set(key, node);
      }
      Array.from(node.childNodes || []).forEach(visit);
    }
    visit(container); return found;
  }

  function updatePortalDetailPart(view, name, stamp, build, displayOnly) {
    let part = view.parts[name];
    if (!part) {
      const node = document.createElement("div"); node.style.display = "contents";
      node.dataset.portalPart = name; view.container.appendChild(node);
      part = view.parts[name] = {node: node};
    }
    if (part.stamp === stamp) return;
    const focus = document.activeElement;
    if (!displayOnly && focus && part.node.contains && part.node.contains(focus) &&
        /^(?:INPUT|TEXTAREA|SELECT)$/i.test(focus.tagName)) {
      if (!part.waitingForBlur) {
        part.waitingForBlur = true;
        focus.addEventListener("blur", function () { part.waitingForBlur = false; requestPortalRender(); }, {once: true});
      }
      return;
    }
    const next = document.createElement("div"); build(next);
    if (displayOnly) viewApi.patchChildren(part.node, next);
    else {
      const disclosures = portalDisclosures(part.node);
      noteFunction.disposeWithin(part.node);
      part.node.replaceChildren();
      while (next.firstChild) part.node.appendChild(next.firstChild);
      portalDisclosures(part.node).forEach(function (node, key) { if (disclosures.has(key)) node.open = disclosures.get(key).open; });
    }
    part.stamp = stamp;
  }

  function appendPortalInlineDetails(container, row, options) {
    let view = detailViews.get(container);
    if (!view || view.row !== row) {
      noteFunction.disposeWithin(container); container.replaceChildren();
      view = {row: row, container: container, parts: Object.create(null)}; detailViews.set(container, view);
    }
    const stamp = portalDisplayStamp(row);
    if (row.draftRecord) {
      updatePortalDetailPart(view, "draft", JSON.stringify(row.draftRecord), function (target) { appendPortalDraftDetails(target, row); });
      return;
    }
    const cards = collectEvmMediaCards(row);
    const mediaStamp = JSON.stringify([cards, cards.map(function (card) { return readPageMetadata(card.url); }),
      row.publication && row.publication.metadata]);
    updatePortalDetailPart(view, "media", mediaStamp, function (target) {
      const hero = appendPortalEvmMediaCards(target, row);
      if (hero) hero.classList.add("portalMediaHero");
      if (row.publication && row.publication.metadata && Object.keys(row.publication.metadata).length) {
        target.appendChild(makeInlinePre("Linked media metadata (off-chain)", pretty(row.publication.metadata), false));
      }
    }, true);
    updatePortalDetailPart(view, "header", stamp + !!(options && options.recordPage), function (target) { appendPortalInlineHeader(target, row, options); }, true);
    if (!view.parts.notes) {
      const notes = document.createElement("div"); notes.style.display = "contents";
      notes.dataset.portalPart = "notes"; container.appendChild(notes); view.parts.notes = {node: notes};
    }
    appendPortalAnnotationEditor(view.parts.notes.node, row);
    updatePortalDetailPart(view, "payload", JSON.stringify(extractOutputs(row.raw).map(function (output) { return [output.n, output.opReturnPayload]; })),
      function (target) { appendPortalPayloads(target, row); });
    updatePortalDetailPart(view, "body", JSON.stringify([row.raw, row.summary, row.loadError,
      !!state.pendingHydration[row.key], row.index, state.personalAccount, getPortalAnnotation(row).metadata,
      getStaticDataSources(), getFileProxyUrl(), state.fileProxyAvailable,
      configValue("inlineImageScale", 12), configValue("inlineImageExpandedScale", 12)]),
      function (target) { appendPortalInlineBody(target, row); });
  }

  function appendPortalInlineHeader(container, row, options) {
    const summary = row.summary || makeBasicSummary(row.txid, row.raw || row, row.index);
    const header = document.createElement("div");
    header.className = "portalInlineHeader";

    const title = document.createElement("h4");
    title.textContent = displayTitleForRow(row);

    const tx = document.createElement("code");
    tx.textContent = row.txid || "";

    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = [
      summary.blockHeight ? "block " + summary.blockHeight : "",
      row.localPath ? "local " + row.localPath : ""
    ].filter(Boolean).join(" · ");

    const actions = document.createElement("div");
    actions.className = "actions portalInlineActions";

    const recordLink = window.CHISEL_PORTAL_RECORD ? portalRecordUrl(row) : "";
    if (!(options && options.recordPage) && recordLink) {
      const open = document.createElement("a");
      open.className = "secondaryButton";
      open.textContent = "OPEN RECORD";
      setSafeHref(open, recordLink);
      open.onclick = function (event) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); event.stopPropagation();
        openPortalRecord(row);
      };
      actions.appendChild(open);
    }

    const primaryTarget = recordTargetUrlForRow(row);
    if (primaryTarget) {
      const primary = document.createElement("a");
      primary.className = "secondaryButton";
      setSafeHref(primary, primaryTarget);
      primary.target = "_blank";
      primary.rel = "noopener noreferrer";
      primary.textContent = isNetflixLink(primaryTarget) ? "original Netflix URL (may not resolve)" : "open record target";
      actions.appendChild(primary);
    }

    const verifyUrl = rowExplorerUrl(row);
    if (verifyUrl) {
      const verify = document.createElement("a");
      verify.className = "secondaryButton";
      setSafeHref(verify, verifyUrl);
      verify.target = "_blank";
      verify.rel = "noopener noreferrer";
      verify.textContent = canonicalCoinForRow(row) === "litecoin" ? "Blockchair" : "verify tx";
      actions.appendChild(verify);
    }
    if (canonicalCoinForRow(row) === "litecoin" && /^[0-9a-f]{64}$/i.test(String(row.txid || ""))) {
      const alternative = document.createElement("a");
      alternative.className = "secondaryButton";
      setSafeHref(alternative, "https://litecoinspace.org/tx/" + row.txid);
      alternative.target = "_blank";
      alternative.rel = "noopener noreferrer";
      alternative.textContent = "LitecoinSpace";
      actions.appendChild(alternative);
    }

    if (row.raw) {
      const save = document.createElement("button");
      save.type = "button";
      save.className = "secondaryButton";
      save.textContent = "save JSON";
      save.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        saveTransactionToFileProxy(row.raw, row.txid, rowIndexEntry(row)).then(function (saved) {
          row.localPath = saved.path || row.localPath;
          setStatus("Saved local jq-format transaction JSON: " + (saved.path || saved.filename || row.txid) + ".", false);
          requestPortalRender();
        }).catch(function (error) { setStatus(error.message || String(error), true); });
      };
      actions.appendChild(save);
    }

    header.appendChild(title);
    header.appendChild(tx);
    if (meta.textContent) header.appendChild(meta);
    header.appendChild(actions);
    container.appendChild(header);

  }

  function appendPortalInlineBody(container, row) {
    // Linked media leads the expanded record. Ledger flow and supporting
    // interpretation remain available immediately below it.
    const ledgerFirst = canonicalCoinForRow(row) === "litecoin" &&
      !!row.raw && !!portalFinanceForRow(row);
    if (ledgerFirst) appendPortalFinanceDetails(container, row);

    const supporting = ledgerFirst ? document.createElement("details") : null;
    let supportTarget = container;
    if (supporting) {
      supporting.className = "portalLedgerSupporting";
      const supportSummary = document.createElement("summary");
      supportSummary.textContent = "Chisel artifacts, annotations and raw JSON";
      supporting.appendChild(supportSummary);
      const body = document.createElement("div");
      body.className = "portalLedgerSupportingBody";
      supporting.appendChild(body);
      container.appendChild(supporting);
      supportTarget = body;
    }
    appendPortalTransactionQr(supportTarget, row);
    appendPortalInterpretedRecord(supportTarget, row);


    const evmImages = collectEvmImageAssets(row);
    const hasEvmImages = evmImages.length > 0;

    if (hasEvmImages) appendPortalEvmImages(supportTarget, row);

    appendPortalEvmDecodedBlock(supportTarget, row);

    if (row.loadError) {
      const error = document.createElement("p");
      error.className = "error";
      error.textContent = "Could not resolve transaction JSON: " + row.loadError;
      supportTarget.appendChild(error);
    }

    if (state.pendingHydration[row.key]) {
      const loading = document.createElement("p");
      loading.className = "muted";
      loading.textContent = "Loading transaction…";
      supportTarget.appendChild(loading);
      return;
    }

    if (!row.raw) {
      const pending = document.createElement("p");
      pending.className = "muted";
      pending.textContent = rowCanHydrate(row) ? "Transaction data is not loaded." : "Summary only.";
      supportTarget.appendChild(pending);
      return;
    }

    const lines = extractLines(row.raw);
    const imageLines = getImageLines(lines);
    const hasInlineImage = imageLines.length > 0;
    const semantics = buildSemantics(row.raw, lines);
    const decodedLines = lines.map(function (line) {
      return { raw: line, decoded: normalizeMacDougallText(line), payload: getMacPayload(line) };
    });

    if (!row.discoveredLinksSaved && (!row.publication || row.publication.ledgerState === "seen")) {
      row.discoveredLinksSaved = true;
      saveDiscoveredLinksMaybe(row.txid, semantics, rowIndexEntry(row)).catch(function () {
        row.discoveredLinksSaved = false;
      });
    }

    let dataContainer = supportTarget;
    let appendDataContainer = false;

    if (hasInlineImage) {
      const body = document.createElement("div");
      body.className = "portalExpandedBody";

      const mediaColumn = document.createElement("div");
      appendPortalInlineImage(mediaColumn, imageLines);
      body.appendChild(mediaColumn);

      dataContainer = document.createElement("div");
      dataContainer.className = "portalInlineImageSide";
      body.appendChild(dataContainer);
      supportTarget.appendChild(body);
    } else if (hasEvmImages) {
      dataContainer = makeInlineDrawer("record data", false);
      appendDataContainer = true;
    }

    if (ledgerFirst) {
      const vinDrawer = makeInlineDrawer("VIN address actions", false);
      if (appendPortalVinAddresses(vinDrawer, row)) dataContainer.appendChild(vinDrawer);
    } else {
      const ledgerTable = appendPortalFinanceDetails(dataContainer, row);
      if (!ledgerTable) appendPortalVinAddresses(dataContainer, row);
    }

    const links = document.createElement("div");
    links.className = "portalInlineLinks";
    if (appendPortalInlineLinks(links, semantics, rowIndexEntry(row))) {
      const linksTitle = document.createElement("div");
      linksTitle.className = "stepTitle";
      linksTitle.textContent = "Links and addresses";
      dataContainer.appendChild(linksTitle);
      dataContainer.appendChild(links);
    }

    dataContainer.appendChild(makeInlinePre("Decoded lines", pretty(decodedLines), false));
    if (semantics.records.length) dataContainer.appendChild(makeInlinePre("Chisel records", pretty(semantics.records), false));
    dataContainer.appendChild(makeInlinePre("Raw transaction JSON", pretty(row.raw), false));

    if (appendDataContainer) supportTarget.appendChild(dataContainer);
  }

  function appendPortalPayloads(container, row) {
    extractOutputs(row.raw).forEach(function (output) {
      const payload = output.opReturnPayload;
      if (!payload) return;
      const section = document.createElement("section");
      section.className = "portalPayload";
      const heading = document.createElement("h5");
      heading.textContent = "OP_RETURN #" + output.n + " · " + payload.label;
      const actions = document.createElement("div");
      actions.className = "actions";
      const encoding = document.createElement("select");
      encoding.setAttribute("aria-label", "OP_RETURN #" + output.n + " representation");
      const values = payload.kind === "invalid" ? {scriptHex: "Script HEX"} :
        Object.assign({}, payload.kind !== "binary" ? {text: payload.kind === "ascii" ? "ASCII text" : "UTF-8 text"} : {}, {hex: "HEX", base64: "Base64"});
      Object.keys(values).forEach(function (key) {
        const option = document.createElement("option");
        option.value = key; option.textContent = values[key]; encoding.appendChild(option);
      });
      const choices = row.payloadEncodingChoices || (row.payloadEncodingChoices = Object.create(null));
      encoding.value = Object.prototype.hasOwnProperty.call(values, choices[output.n]) ? choices[output.n] : Object.keys(values)[0];
      const data = document.createElement("pre");
      data.className = "portalPayloadValue";
      const copy = document.createElement("button");
      copy.type = "button"; copy.className = "secondaryButton"; copy.textContent = "COPY";
      function show() { data.textContent = payload[encoding.value] || ""; }
      encoding.onchange = function () { choices[output.n] = encoding.value; show(); };
      copy.onclick = function () { copyPortalText(data.textContent, copy).catch(function (error) { setStatus(error.message, true); }); };
      show();
      actions.appendChild(encoding); actions.appendChild(copy);
      section.appendChild(heading); section.appendChild(actions); section.appendChild(data);
      if (payload.error) {
        const error = document.createElement("p"); error.textContent = payload.error; section.appendChild(error);
      }
      container.appendChild(section);
    });
  }

  function isLocalPortalRow(row) {
    return !!(row && (row.localPath || row.discoverySource === "fileProxy"));
  }

  function rowCanHydrate(row) {
    if (!row || row.raw) return false;
    if (row.staticRawPath || row.staticRawUrl) return true;
    if (isLocalPortalRow(row)) return true;
    if (indexCanFetch(rowIndexEntry(row))) return true;
    return false;
  }

  // Non-blocking center indicator: only visible when work takes long enough.
  let portalBusyCount = 0;
  let portalBusyShowTimer = null;
  let portalBusyHideTimer = null;
  function portalBusyStart(message) {
    portalBusyCount += 1;
    const overlay = $("#portalBusyOverlay");
    const label = $("#portalBusyLabel");
    if (label) label.textContent = message || "Loading ledger…";
    if (portalBusyHideTimer) { window.clearTimeout(portalBusyHideTimer); portalBusyHideTimer = null; }
    if (overlay && !portalBusyShowTimer) {
      portalBusyShowTimer = window.setTimeout(function () {
        portalBusyShowTimer = null;
        if (portalBusyCount > 0) overlay.hidden = false;
      }, 300);
    }
  }
  // Any direct interaction dismisses the activity overlay immediately.
  // Ongoing work may show it again after a short quiet interval.
  let portalBusyQuietUntil = 0;
  function dismissPortalBusy() {
    portalBusyQuietUntil = Date.now() + 650;
    const overlay = $("#portalBusyOverlay");
    if (overlay) overlay.hidden = true;
    if (portalBusyShowTimer) { window.clearTimeout(portalBusyShowTimer); portalBusyShowTimer = null; }
    if (portalBusyCount) {
      portalBusyShowTimer = window.setTimeout(function () {
        portalBusyShowTimer = null;
        if (portalBusyCount > 0 && Date.now() >= portalBusyQuietUntil && overlay) overlay.hidden = false;
      }, 660);
    }
  }
  ["pointerdown","keydown","wheel","touchstart"].forEach(function (type) {
    window.addEventListener(type,dismissPortalBusy,{passive:true,capture:true});
  });
  function portalBusyEnd() {
    portalBusyCount = Math.max(0,portalBusyCount - 1);
    if (portalBusyCount) return;
    if (portalBusyShowTimer) { window.clearTimeout(portalBusyShowTimer); portalBusyShowTimer = null; }
    if (portalBusyHideTimer) window.clearTimeout(portalBusyHideTimer);
    portalBusyHideTimer = window.setTimeout(function () {
      portalBusyHideTimer = null;
      const overlay = $("#portalBusyOverlay");
      if (overlay && !portalBusyCount) overlay.hidden = true;
    }, 200);
  }

  function hydratePortalRow(key, opts) {
    const row = state.portalRowKeys[key];
    if (!row) return Promise.resolve(null);
    return queuePortalRead("transaction:" + key, row, "transaction", function () { return hydratePortalRowOnce(key, opts); });
  }

  async function hydratePortalRowOnce(key, opts) {
    const row = state.portalRowKeys[key];
    if (!row) return null;
    const generation = state.portalLoadGeneration;
    if (row.raw || state.pendingHydration[key]) {
      if (row.raw) await cacheLiveRawPortalRowMaybe(row, opts);
      return row;
    }

    state.pendingHydration[key] = true;
    // Background loaders (visible amounts, local cache, rabbit trails) are
    // silent. Only an explicit user expansion should display the busy overlay.
    const busyTracked = !!state.expandedRowKeys[key] &&
      !(opts && (opts.silent || opts.suppressRender || opts.quiet));
    if (busyTracked) portalBusyStart("Reading transaction details…");
    row.loadError = "";
    if (!(opts && opts.suppressRender) && !(opts && opts.silent) && (state.expandedRowKeys[key] || isVisiblePortalRow(row))) requestPortalRender();

    try {
      const loaded = await loadTransactionForRow(row, opts);
      if (generation !== state.portalLoadGeneration || state.portalRowKeys[key] !== row) return null;
      row.raw = loaded.json;
      row.rawSourceUrl = loaded.url || row.rawSourceUrl || "";
      row.localPath = loaded.path || row.localPath;
      row.summary = mergePortalSummary(row.summary, extractSummary(loaded.json, rowIndexEntry(row)));
      row.blockTime = row.summary.blockTime || row.blockTime || 0;
      upsertPortalRow(row, { silent: true, deferSort: !!(opts && opts.deferSort) });
      if (loaded.cachePromise) {
        loaded.cachePromise.then(function (saved) {
          if (saved && state.portalRowKeys[key] === row) row.localPath = saved.path || row.localPath;
        });
      }
      schedulePersonalCacheSnapshot();
      return row;
    } catch (error) {
      if (generation === state.portalLoadGeneration && state.portalRowKeys[key] === row) row.loadError = error.message || String(error);
      return row;
    } finally {
      if (generation === state.portalLoadGeneration) delete state.pendingHydration[key];
      if (busyTracked) portalBusyEnd();
      if (generation === state.portalLoadGeneration &&
          (state.expandedRowKeys[key] || (!(opts && opts.suppressRender) && (!(opts && opts.silent) || isVisiblePortalRow(row))))) requestPortalRender();
    }
  }

  async function togglePortalRowDetails(key, forceOpen) {
    const row = state.portalRowKeys[key];
    if (!row) return null;

    const shouldOpen = forceOpen === true ? true : !state.expandedRowKeys[key];
    if (!shouldOpen) {
      delete state.expandedRowKeys[key];
      if (state.selectedRowKey === key) state.selectedRowKey = "";
      requestPortalRender();
      return row;
    }

    state.expandedRowKeys[key] = true;
    state.selectedRowKey = key;
    state.selectedTxid = row.txid;
    if ($("#portalTxid")) $("#portalTxid").value = row.txid;
    requestPortalRender();
    if (rowCanHydrate(row)) await hydratePortalRow(key);
    return row;
  }

  function portalRowAddresses(row) {
    const out = [];
    const seen = Object.create(null);

    function add(value) {
      const address = String(value || "").trim();
      if (!address || !isPublicMainThunderwordAddress(address)) return;
      const key = canonicalMainThunderwordAddress(address);
      if (seen[key]) return;
      seen[key] = true;
      out.push(address);
    }

    if (row && row.index) add(row.index.address);
    extractInputAddresses(row && row.raw).forEach(add);
    extractLines(row && row.raw).forEach(add);

    const summary = row && row.summary ? row.summary : {};
    safeArray(summary.addresses).forEach(add);
    safeArray(summary.inputAddresses).forEach(add);
    safeArray(summary.outputAddresses).forEach(add);
    safeArray(summary.evmReceivers).forEach(add);

    return out;
  }

  function personalAccountMatchesRow(row) {
    const account = normalizePersonalAccount(state.personalAccount);
    if (!account) return false;
    const target = canonicalMainThunderwordAddress(account.address);
    return portalRowAddresses(row).some(function (address) {
      return canonicalMainThunderwordAddress(address) === target;
    });
  }

  function renderPortalStreamItem(list, row, options) {
    const opts = options || {};
    const expanded = opts.expanded === undefined ? !!state.expandedRowKeys[row.key] : !!opts.expanded;
    const existing = opts.item && streamViews.get(opts.item);
    const stamp = portalDisplayStamp(row) + ":" + expanded + ":" + (row.key === state.selectedRowKey);
    if (existing && existing.stamp === stamp) {
      if (expanded) appendPortalInlineDetails(existing.detail, row);
      return opts.item;
    }
    const primaryUrl = recordTargetUrlForRow(row);
    const isPersonal = personalAccountMatchesRow(row);
    const recordBehavior = portalRecordBehaviorForRow(row);
    const item = opts.item || document.createElement("div");
    item.className = "portalStreamItem" +
      (expanded ? " isExpanded" : "") +
      (row.publication ? (row.publication.ledgerState === "seen" ? " isLedgerSeen" : " isAwaitingLedger") : "") +
      (isPersonal ? " isPersonal" : "") +
      (recordBehavior ? " hasInterpretedRecord behavior-" + recordBehavior.behavior.id : "");
    item.dataset.key = row.key;
    if (row.publication) {
      item.dataset.ledgerState = row.publication.ledgerState;
      item.setAttribute("aria-label", row.publication.ledgerState === "seen"
        ? "Transaction observed by ledger" : "Transaction awaiting ledger read");
    } else {
      delete item.dataset.ledgerState;
      item.removeAttribute("aria-label");
    }
    if (isPersonal) {
      item.dataset.personalAddress = state.personalAccount.address;
      item.title = "This transaction touches your loaded public account.";
    } else {
      delete item.dataset.personalAddress;
      item.removeAttribute("title");
    }

    const line = document.createElement("div");
    line.className = "portalStreamRow" + (row.key === state.selectedRowKey ? " isSelected" : "") + (primaryUrl ? " hasDirectTarget" : "");
    line.dataset.key = row.key;
    line.dataset.txid = row.txid;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "secondaryButton portalExpandButton";
    toggle.textContent = expanded ? "⌄" : "›";
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggle.setAttribute("aria-label", expanded ? "Collapse transaction details" : "Expand transaction details");
    toggle.title = expanded ? "collapse inline record" : "expand inline record";
    toggle.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (opts.onToggle) { opts.onToggle(); return; }
      togglePortalRowDetails(row.key).catch(function (error) { setStatus(error.message || String(error), true); });
    };

    let thumb = document.createElement("span");
    thumb.className = "portalStreamThumb";
    const thumbnailTarget = appendRowThumbnail(thumb, row);
    if (thumbnailTarget && !thumb.classList.contains("isEmpty")) {
      const thumbnailLink = document.createElement("a");
      thumbnailLink.className = thumb.className + " isLinked";
      setSafeHref(thumbnailLink, thumbnailTarget);
      thumbnailLink.target = "_blank";
      thumbnailLink.rel = "noopener noreferrer";
      thumbnailLink.title = "open media";
      thumbnailLink.setAttribute("aria-label", "open media");
      while (thumb.firstChild) thumbnailLink.appendChild(thumb.firstChild);
      thumb = thumbnailLink;
    }

    const recordLink = !row.draftRecord && window.CHISEL_PORTAL_RECORD ? portalRecordUrl(row) : "";
    const time = document.createElement(recordLink ? "a" : "span");
    time.className = "portalStreamTime";
    time.textContent = formatRowTime(row);
    if (recordLink) {
      setSafeHref(time, recordLink);
      time.title = "Open Chisel record page";
      time.onclick = function (event) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); event.stopPropagation(); openPortalRecord(row);
      };
    }

    const coin = document.createElement("span");
    coin.className = "portalStreamCoin";
    coin.textContent = coinLabelForRow(row).toUpperCase();

    const titleWrap = document.createElement("span");
    titleWrap.className = "portalStreamTitle";
    const titleText = displayTitleForRow(row);
    const opText = opReturnTextForRow(row);
    const genericTitle = /^(?:transaction(?:\s+[0-9a-f…]+)?|untitled transaction)$/i.test(titleText.trim());
    const compactGeneric = !primaryUrl && !opText && genericTitle;
    if (compactGeneric) item.classList.add("isCompactGeneric");
    titleWrap.title = compactGeneric ? "Expand for transaction details" : titleText;
    if (primaryUrl) {
      const titleLink = document.createElement("a");
      setSafeHref(titleLink, primaryUrl);
      titleLink.target = "_blank";
      titleLink.rel = "noopener noreferrer";
      titleLink.textContent = titleText;
      titleLink.className = "isDirectLink";
      titleWrap.appendChild(titleLink);
    } else {
      // Plain notes need one full text copy, not a duplicate truncated title.
      titleWrap.textContent = genericTitle || titleText === truncateText(opText, 96) ? "" : titleText;
    }
    if (appendCollapsedMediaMetadata(titleWrap, row)) item.classList.add("hasMediaMetadata");
    if (opText) {
      const payload = document.createElement("span");
      payload.className = "portalStreamOpReturn";
      payload.textContent = opText;
      titleWrap.appendChild(payload);
      item.classList.add("hasOpReturnText");
    }

    let verify = null;
    const url = rowExplorerUrl(row);
    if (expanded && url) {
      verify = document.createElement("span");
      const a = document.createElement("a");
      a.className = "portalStreamVerify";
      setSafeHref(a, url);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "verify";
      a.onclick = function (event) { event.stopPropagation(); };
      verify.appendChild(a);
    }

    line.appendChild(toggle);
    line.appendChild(thumb);
    line.appendChild(time);
    line.appendChild(coin);
    line.appendChild(titleWrap);
    const financial = row.draftRecord ? null : portalFinanceForRow(row);
    const finance = document.createElement("span");
    finance.className = "portalStreamFinance";
    if (financial) {
      const value = document.createElement("span");
      value.className = "portalStreamFinanceAmount";
      if (financial.netSat !== null) {
        value.textContent = formatPortalLitecoin(financial.netSat, true);
        value.title = "Net change at " + financial.selectedAddress + ": " +
          formatPortalSatoshis(financial.netSat);
      } else if (financial.outputTotalSat !== null) {
        value.textContent = "outputs " + formatPortalLitecoin(financial.outputTotalSat, false);
        value.title = "All transaction outputs, not an address balance: " +
          financial.outputTotalSat.toLocaleString("en-US") + " sat";
      } else {
        value.textContent = "amount unavailable";
      }
      finance.appendChild(value);
      if (financial.feeSat !== null) {
        const fee = document.createElement("span");
        fee.className = "portalStreamFinanceFee";
        fee.textContent = "fee " + financial.feeSat.toLocaleString("en-US") + " sat";
        finance.appendChild(fee);
      }
    } else if (!row.draftRecord && canonicalCoinForRow(row) === "litecoin") {
      const value = document.createElement("span");
      value.className = "portalStreamFinanceAmount isPending";
      value.textContent = state.pendingHydration[row.key] || state.pendingDateLookup[row.key]
        ? "reading amount…" : (rowCanHydrate(row) && !state.attemptedFinanceLookup[row.key]
          ? "amount pending" : "amount unavailable");
      value.title = row.loadError || row.dateLookupError ||
        "The transaction value has not been obtained from the available sources.";
      finance.appendChild(value);
    }
    line.appendChild(finance);
    if (verify) line.appendChild(verify);
    if (existing) viewApi.patchDisplay(item.firstChild, line);
    else item.appendChild(line);

    let detail = existing && existing.detail;
    if (expanded) {
      if (!detail) {
        detail = document.createElement("div");
        detail.className = "portalInlineDetails";
        item.appendChild(detail);
      }
      appendPortalInlineDetails(detail, row);
    } else if (detail) {
      noteFunction.disposeWithin(detail);
      item.removeChild(detail);
      detail = null;
    }

    streamViews.set(item, {stamp: stamp, detail: detail});
    if (list) list.appendChild(item);
    return item;
  }

  function appendPortalDraftDetails(container, row) {
    const draft = row.draftRecord;
    const mediaHero = appendPortalEvmMediaCards(container, row);
    if (mediaHero) mediaHero.classList.add("portalMediaHero");
    const title = document.createElement("h4");
    title.textContent = row.summary.title;
    container.appendChild(title);

    const note = document.createElement("p");
    note.className = "help";
    note.textContent = "OP_RETURN and the configured outputs are sent to the ledger. Linked pictures and metadata are displayed from their sources; they are not embedded in OP_RETURN. TXID, inputs and change become available when the transaction is built.";
    container.appendChild(note);

    const text = document.createElement("pre");
    text.className = "json draftRecordText";
    text.textContent = draft.ledger.opReturnText || (draft.ledger.opReturnHex ? "Binary OP_RETURN — see HEX below." : "No OP_RETURN");
    container.appendChild(text);

    const facts = document.createElement("p");
    facts.className = "help";
    facts.textContent = draft.ledger.bytes + " OP_RETURN bytes · Requested fee: " + (draft.ledger.requestedFee || "0") + " " + coinLabelForRow(row);
    container.appendChild(facts);
    if (draft.metadata && Object.keys(draft.metadata).length) {
      const metadata = document.createElement("p");
      metadata.className = "help";
      metadata.textContent = [draft.metadata.authorName, draft.metadata.provider,
        draft.metadata.metadataSource ? "Metadata source: " + draft.metadata.metadataSource : "",
        draft.metadata.fetchedAt ? "Fetched: " + draft.metadata.fetchedAt : ""].filter(Boolean).join(" · ");
      container.appendChild(metadata);
    }
    container.appendChild(makeInlinePre("Ledger payload, outputs and requested fee", pretty(draft.ledger), true));
    container.appendChild(makeInlinePre("Complete preview record", pretty(draft), false));
  }

  function renderDraftRecord(container, draft, options) {
    // An isolated presentation: no insertion, hydration, cache writes, or fake
    // transaction identity in the live Portal stream.
    container.replaceChildren();
    const row = {key: "draft-record", txid: "", coin: draft.portal.coin,
      summary: draft.portal.summary, draftRecord: draft};
    renderPortalStreamItem(container, row, options || {expanded: true});
  }

  function presentPublication(publication, options) {
    const row = upsertPortalRow({coin: publication.coin, txid: publication.txid,
      index: publication.index, raw: publication.raw, summary: Object.assign({}, publication.summary),
      publication: publication, discoverySource: "local-broadcast"}, {silent: true, publicationUpdate: true});
    if (!row) return null;
    if (options && options.reveal) {
      const search = $("#portalEvmWordSearch");
      if (search) search.value = "";
      setPortalFilterValue(sourceIdForRow(row), true);
      state.portalPage = 1;
      state.expandedRowKeys[row.key] = true;
      state.selectedRowKey = row.key;
      state.selectedTxid = row.txid;
      window.setTimeout(function () {
        refreshLiveLedger({force: true}).catch(function () {});
        const list = $("#portalTransactionList");
        if (list) { list.scrollTop = 0; list.scrollIntoView({block: "start"}); }
      }, 0);
    }
    requestPortalRender();
    return row;
  }

  function visibleDateLookupContextToken() {
    const filters = PORTAL_FILTER_IDS.map(function (id) {
      return id + "=" + (getPortalFilterValue(id) ? "1" : "0");
    }).join("&");
    return [state.portalLoadGeneration, state.portalRows.length, state.portalPage, getPortalSearchText(), filters].join("|");
  }

  function rowNeedsVisibleDateLookup(row) {
    if (!row || rowTime(row) || row.raw) return false;
    if (canonicalCoinForRow(row) === "evm") return false;
    if (state.pendingDateLookup[row.key] || state.attemptedDateLookup[row.key]) return false;
    return rowCanHydrate(row);
  }

  async function fetchPortalRowDate(row, generation) {
    const key = row && row.key;
    if (!key || generation !== state.portalLoadGeneration || !rowNeedsVisibleDateLookup(row)) {
      return { changed: false, saved: false };
    }
    state.attemptedDateLookup[key] = true;
    const pending = state.pendingDateLookup;
    pending[key] = true;
    try {
      const hydrated = await hydratePortalRow(key, {quiet: true, silent: true, suppressRender: true,
        deferSort: true, refreshIndex: false, deferCache: true});
      if (generation !== state.portalLoadGeneration || state.portalRowKeys[key] !== row || !hydrated || !row.raw) return {changed: false, saved: false};
      const exactTime = extractBlockTime(row.raw);
      const blockHeight = extractBlockHeight(row.raw);
      row.summary = mergePortalSummary(row.summary, {
        blockTime: exactTime || row.summary.blockTime || 0,
        blockTimeEstimated: false,
        blockHeight: blockHeight || row.summary.blockHeight || 0
      });
      row.blockTime = exactTime || row.blockTime || 0;
      invalidatePortalRowCache(row);
      upsertPortalRow(row, { silent: true, deferSort: true });
      return {changed: true, saved: false};
    } catch (error) {
      if (generation === state.portalLoadGeneration && state.portalRowKeys[key] === row) row.dateLookupError = error.message || String(error);
      return { changed: false, saved: false };
    } finally {
      delete pending[key];
    }
  }

  async function fetchVisiblePortalDates(rows, generation) {
    const maxLookups = Math.max(1, Math.min(getPortalPageSize(), Number(configValue("maxVisibleDateLookups", getPortalPageSize())) || getPortalPageSize()));
    const concurrency = Math.max(1, Math.min(6, Number(configValue("visibleDateLookupConcurrency", 3)) || 3));
    const candidates = safeArray(rows).filter(rowNeedsVisibleDateLookup).slice(0, maxLookups);
    let saved = 0;
    let changed = false;

    for (let offset = 0; offset < candidates.length; offset += concurrency) {
      if (generation !== state.portalLoadGeneration) return;
      const results = await Promise.all(candidates.slice(offset, offset + concurrency).map(function (row) {
        return fetchPortalRowDate(row, generation);
      }));
      results.forEach(function (result) {
        changed = changed || result.changed;
        if (result.saved) saved += 1;
      });
      if (changed) requestPortalRender();
      await yieldPortalThread();
    }

    if (state.portalSortPending) sortPortalRows();
    if (changed) requestPortalRender();
    if (saved) {
      try {
        await fileProxyJson("/reindex");
      } catch (error) {
        console.warn("fileProxy saved transaction JSON but its derived indexes were not refreshed:", error);
      }
    }
  }

  function scheduleVisiblePortalDates(pageRows) {
    if (!configBool("autoFetchVisibleTransactionDates", true) || state.visibleDateLookupScheduled) return;
    const candidates = safeArray(pageRows).filter(rowNeedsVisibleDateLookup);
    if (!candidates.length) return;
    const token = visibleDateLookupContextToken();
    if (state.visibleDateLookupToken === token) return;
    state.visibleDateLookupToken = token;
    state.visibleDateLookupScheduled = true;
    const generation = state.portalLoadGeneration;
    window.setTimeout(function () {
      fetchVisiblePortalDates(candidates, generation).catch(function (error) {
        console.warn("Visible transaction date lookup failed:", error);
      }).finally(function () {
        if (generation === state.portalLoadGeneration) state.visibleDateLookupScheduled = false;
      });
    }, 0);
  }

  // Populate amounts lazily for the visible Litecoin page only. Hydration
  // respects the existing provider fallback and FileProxy cache paths.
  function scheduleVisiblePortalFinance(pageRows) {
    if (!configBool("autoFetchVisibleTransactionAmounts", true) ||
        state.visibleFinanceLookupScheduled) return;
    const candidates = safeArray(pageRows).filter(function (row) {
      return canonicalCoinForRow(row) === "litecoin" && !row.raw &&
        rowCanHydrate(row) && !state.pendingHydration[row.key] &&
        !state.pendingDateLookup[row.key] &&
        !state.attemptedFinanceLookup[row.key];
    });
    if (!candidates.length) return;
    const generation = state.portalLoadGeneration;
    state.visibleFinanceLookupScheduled = true;
    window.setTimeout(function () {
      (async function () {
        for (let offset = 0; offset < candidates.length; offset += 4) {
          if (generation !== state.portalLoadGeneration) return;
          await Promise.all(candidates.slice(offset, offset + 4).map(async function (row) {
            if (row.raw || state.pendingHydration[row.key] ||
                state.pendingDateLookup[row.key]) return;
            state.attemptedFinanceLookup[row.key] = true;
            await hydratePortalRow(row.key, {
              quiet: true, suppressRender: true, silent: true, deferSort: true,
              refreshIndex: false, deferCache: true
            });
            if (generation === state.portalLoadGeneration) requestPortalRender();
          }));
          if (generation !== state.portalLoadGeneration) return;
          requestPortalRender();
          await yieldPortalThread();
        }
      })().catch(function (error) {
        console.warn("Visible transaction amount lookup failed:", error);
      }).finally(function () {
        if (generation === state.portalLoadGeneration) {
          state.visibleFinanceLookupScheduled = false;
          requestPortalRender();
        }
      });
    }, 0);
  }

  function renderPortalRows() {
    cancelScheduledPortalRender();
    if (recordView && recordView.active()) {
      state.portalListDirty = true;
      loadingQueue.reprioritize(portalReadPriority);
      recordView.refresh();
      return;
    }
    if (state.portalSortPending) sortPortalRows();
    const list = $("#portalTransactionList");
    if (!list) return;
    list.classList.remove("muted");
    state.visiblePortalRowKeys = Object.create(null);

    if (!state.portalRows.length) {
      streamList.clear();
      list.classList.add("muted");
      list.textContent = "◷ Loading ThunderWords…";
      setText("#portalExplorerCount", "◷ Loading ThunderWords…");
      renderPortalPageControls([]);
      schedulePortalDiscovery();
      return;
    }

    const filteredRows = getFilteredPortalRows();
    if (!filteredRows.length) {
      streamList.clear();
      list.classList.add("muted");
      list.textContent = "◷ Looking for matching ThunderWords…";
      setText("#portalExplorerCount", "◷ 0 shown · " + state.portalRows.length + " loaded");
      renderPortalPageControls(filteredRows);
      schedulePortalDiscovery();
      return;
    }

    const pageRows = getPortalPageRows(filteredRows);
    const size = getPortalPageSize();
    const page = clampPortalPage(filteredRows);
    const start = ((page - 1) * size) + 1;
    const end = Math.min(filteredRows.length, page * size);
    setText("#portalExplorerCount", filteredRows.length + " shown · " + state.portalRows.length + " loaded · " + start + "–" + end);
    renderPortalPageControls(filteredRows);

    pageRows.forEach(function (row) {
      state.visiblePortalRowKeys[row.key] = true;
    });
    streamList.render(list, pageRows);
    loadingQueue.reprioritize(portalReadPriority);
    scheduleVisiblePortalDates(pageRows);
    scheduleVisiblePortalFinance(pageRows);
    scheduleVisiblePortalAnnotations(pageRows);
  }

  async function selectPortalRow(key) {
    return togglePortalRowDetails(key, true);
  }

  function recordDataUrl(row) {
    const api = window.CHISEL_PORTAL_RECORD;
    const candidates = [row.rawSourceUrl].concat(staticData.rawPathsForRow(row));
    if (/^transactions\//.test(staticData.staticDataPath(row.localPath))) getStaticDataSources().forEach(function (source) {
      try { candidates.push(staticData.joinDataPath(staticData.sourceLocation(source, window.location.href).baseUrl, row.localPath)); } catch (_) {}
    });
    return candidates.map(function (url) { return api.publicDataUrl(url, window.location.href); }).find(Boolean) || "";
  }

  function portalRecordUrl(row) {
    return window.CHISEL_PORTAL_RECORD.recordUrl(row, window.location.href, recordDataUrl(row));
  }

  function findPortalRecord(route) {
    return state.portalRows.find(function (row) {
      return row.txid === route.txid && canonicalCoinForRow(row) === route.coin &&
        (!route.sourceId || sourceIdForRow(row) === route.sourceId) &&
        (!route.chainId || String(row.index && row.index.chainId || "137") === route.chainId);
    });
  }

  function initializeRecordView() {
    if (recordView) return recordView;
    recordView = window.CHISEL_PORTAL_RECORD.createController({document: document, state: state,
      find: findPortalRecord, sourceUrl: recordDataUrl,
      render: function (content, row) { appendPortalInlineDetails(content, row, {recordPage: true}); },
      status: setStatus, copy: copyPortalText,
      annotation: function (row) { return notesData.documentFor(row, getPortalAnnotation(row)); },
      placeholder: function (route) {
        const profile = EVM_PROFILES.find(function (item) { return "evm" + item.label === route.sourceId; });
        const entry = profile ? evmIndexEntry(profile) : getCoinIndexByCoinName(route.coin);
        return upsertPortalRow({coin: route.coin, txid: route.txid, sourceId: route.sourceId,
          index: entry || {coin: route.coin, chainId: route.chainId}, summary: {title: "transaction " + shortTxid(route.txid)}}, {silent: true});
      },
      resolve: async function (route, row) {
        loadPortalAnnotation(row).catch(function () {});
        if (row.raw) return row;
        if (route.dataUrl) row.staticRawUrl = route.dataUrl;
        const loaded = await hydratePortalRow(row.key, {quiet: true, silent: true, suppressRender: true, deferCache: true});
        if (!loaded || !loaded.raw) throw new Error(loaded && loaded.loadError || "Transaction data is unavailable from the saved files and ledger services.");
        return loaded;
      },
      onReturn: function () {
        if (state.portalListDirty) { state.portalListDirty = false; window.setTimeout(requestPortalRender, 0); }
      }
    });
    return recordView;
  }

  function openPortalRecord(rowOrKey) {
    const row = typeof rowOrKey === "string" ? state.portalRowKeys[rowOrKey] : rowOrKey;
    if (!row) return Promise.resolve(null);
    const view = initializeRecordView();
    view.bind();
    return view.openRow(row);
  }

  async function loadTransactionForRow(row, opts) {
    if (!row) throw new Error("No portal row selected for hydration.");
    if (row.staticRawPath || row.staticRawUrl) {
      try { return await fetchStaticRawFromRow(row); }
      catch (error) { row.staticLoadError = error.message || String(error); }
    }
    if (row.localPath) {
      try {
        const local = await loadLocalTransactionPath(row.localPath, row.txid, canonicalCoinForRow(row));
        return { json: local.raw, source: local.source || "local", path: local.path, coin: local.coin, url: local.url };
      } catch (error) {
        row.localPathLoadError = error.message || String(error);
      }
    }
    return loadTransactionLocalFirst(rowIndexEntry(row), row.txid, canonicalCoinForRow(row), opts);
  }

  async function loadTransactionLocalFirst(indexEntry, txid, coin, opts) {
    const id = String(txid || "").trim();
    if (!TXID_RE.test(id)) throw new Error("Transaction id must be 64 hex characters.");

    const existingRow = state.portalRowKeys[rowKey({ index: indexEntry, coin: coin || (indexEntry && indexEntry.coin) || "", txid: id })];
    if (existingRow && (existingRow.staticRawPath || existingRow.staticRawUrl)) {
      try { return await fetchStaticRawFromRow(existingRow); }
      catch (error) { existingRow.staticLoadError = error.message || String(error); }
    }

    if (configBool("localFirstTransactions", true)) {
      try {
        const local = await loadLocalTransaction(id, coin || (indexEntry && indexEntry.coin) || "");
        if (local && local.raw) return { json: local.raw, source: local.source || "local", path: local.path, coin: local.coin, url: local.url };
      } catch (error) {}
    }

    const api = getThunderwords();
    if (!api || !indexEntry || !indexCanFetch(indexEntry)) throw new Error("No local transaction and no live tx fetcher configured.");
    const loaded = await api.fetchTransaction(indexEntry, id);
    const cachePromise = opts && opts.deferCache ?
      autoSaveTransactionMaybe(loaded.json, id, indexEntry, Object.assign({}, opts, {refreshIndex: false})) : null;
    const saved = cachePromise ? null : await autoSaveTransactionMaybe(loaded.json, id, indexEntry, opts);
    return {
      json: loaded.json,
      source: "live",
      url: loaded.url,
      coin: indexEntry.coin || indexEntry.ticker || "",
      path: saved && saved.path ? saved.path : "",
      saved: saved || null,
      cachePromise: cachePromise
    };
  }

  function selectRelativePortalRow(delta) {
    const rows = getFilteredPortalRows();
    if (!rows.length) return;
    let index = rows.findIndex(function (row) { return row.key === state.selectedRowKey; });
    if (index < 0) index = (clampPortalPage(rows) - 1) * getPortalPageSize();
    index = Math.max(0, Math.min(rows.length - 1, index + delta));
    state.portalPage = Math.floor(index / getPortalPageSize()) + 1;
    selectPortalRow(rows[index].key).catch(function (error) { setStatus(error.message || String(error), true); });
  }

  async function hydrateLocalRowsInBackground(rows, generation) {
    const runGeneration = generation == null ? state.portalLoadGeneration : generation;
    const candidates = prioritizePortalRows(safeArray(rows).filter(function (row) {
      return isLocalPortalRow(row) && !row.raw;
    }));
    const report = {
      requested: candidates.length,
      hydrated: 0,
      failed: 0,
      skipped: 0,
      cancelled: false,
      status: "pending"
    };
    state.localHydrationReport = report;

    if (!configBool("backgroundHydrateTransactions", true) || !configBool("autoHydrateLocalTransactions", true)) {
      report.status = "disabled";
      return report;
    }
    if (!candidates.length) {
      report.status = "complete";
      return report;
    }

    let visibleChanges = false;
    for (let i = 0; i < candidates.length; i += 1) {
      if (runGeneration !== state.portalLoadGeneration) {
        report.cancelled = true;
        report.status = "cancelled";
        return report;
      }
      const key = candidates[i].key || rowKey(candidates[i]);
      const row = state.portalRowKeys[key] || candidates[i];
      if (row.raw) {
        report.skipped += 1;
        continue;
      }
      if (state.pendingHydration[key] || state.pendingDateLookup[key]) {
        report.skipped += 1;
        continue;
      }
      visibleChanges = visibleChanges || isVisiblePortalRow(row);
      const hydrated = await hydratePortalRow(key, { silent: true, suppressRender: true, deferSort: true });
      if (runGeneration !== state.portalLoadGeneration) {
        report.cancelled = true;
        report.status = "cancelled";
        return report;
      }
      if (hydrated && hydrated.raw) report.hydrated += 1;
      else report.failed += 1;
      if (isVisiblePortalRow(row)) requestPortalRender();

      if ((i + 1) % 4 === 0) {
        if (visibleChanges) requestPortalRender();
        visibleChanges = false;
        await yieldPortalThread();
      }

      if ((i + 1) % getPortalPageSize() === 0 && i + 1 < candidates.length) {
        setStatus("Hydrated " + report.hydrated + " of " + candidates.length + " local fileProxy transaction(s); continuing in the background.", false);
      }
    }

    report.status = "complete";
    setStatus("Local fileProxy hydration finished: " + report.hydrated + " hydrated, " + report.failed + " failed, " + report.skipped + " already available or in progress.", report.failed > 0);
    requestPortalRender();
    return report;
  }

  async function listLocalTransactions() {
    const coin = "";
    let json = null;
    let rows = [];
    let usedIndex = false;
    const localPortalRows = [];

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
      try { json = await fileProxyJson("/txids", { coin: coin }); }
      catch (error) {
        const loaded = await loadStaticHttpSources();
        if (!loaded.rows.length) throw error;
        setStatus("Loaded " + loaded.rows.length + " saved transaction(s) directly over HTTP. FileProxy is optional.", false);
        return loaded.rows;
      }
      rows = json.transactions || [];
    }

    state.localTransactions = rows;

    beginPortalBatch();
    try {
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const localCoin = coinForLocalIndexRow(row, coin);
        const entry = getCoinIndexByCoinName(localCoin);
        let raw = null;
        let summary = row.summary || makeBasicSummary(row.txid, row, entry);

        if (!usedIndex && i < getPortalPageSize()) {
          try {
            const loaded = await loadLocalTransaction(row.txid, localCoin);
            raw = loaded.raw;
            summary = extractSummary(raw, entry);
          } catch (error) {}
        }

        const portalRow = upsertPortalRow({
          index: entry,
          coin: localCoin || normalizeCoinName(entry && entry.coin) || "unknown",
          txid: row.txid,
          raw: raw,
          summary: summary,
          streamLabel: usedIndex ? "local index" : "local filesystem",
          discoverySource: "fileProxy",
          localPath: row.path,
          modified: row.modified
        }, { silent: true });
        if (portalRow) localPortalRows.push(portalRow);
      }
    } finally {
      endPortalBatch();
    }
    requestPortalRender();

    const hydrationQueued = configBool("backgroundHydrateTransactions", true) && configBool("autoHydrateLocalTransactions", true);
    if (hydrationQueued) {
      const hydrationGeneration = state.portalLoadGeneration;
      window.setTimeout(function () {
        hydrateLocalRowsInBackground(localPortalRows, hydrationGeneration).catch(function (error) {
          setStatus("Local fileProxy background hydration failed: " + (error.message || String(error)), true);
        });
      }, 0);
    }

    setText("#portalThunderwordRaw", pretty(json));
    setStatus("Loaded " + rows.length + " local txid fixture(s) from fileProxy " + (usedIndex ? "index" : "scan") + " into the merged stream." + (hydrationQueued ? " Background hydration queued." : ""), false);
    return localPortalRows;
  }

  function getEvmProfileById(id) {
    return EVM_PROFILES.find(function (profile) { return profile.id === id; }) || null;
  }

  function evmCheckboxForProfile(profile) {
    return $("#portalIncludeEvm" + profile.label.replace(/[^A-Za-z0-9]/g, ""));
  }

  function enabledEvmProfiles() {
    return EVM_PROFILES.filter(function (profile) {
      const box = evmCheckboxForProfile(profile);
      if (box) return !!box.checked;
      return configBool(profile.id === "gomez" ? "includeEvmGomez" : "includeEvmJethro", false);
    });
  }

  function applyEvmProfileConfig() {
    EVM_PROFILES.forEach(function (profile) {
      const box = evmCheckboxForProfile(profile);
      if (!box) return;
      const key = profile.id === "gomez" ? "includeEvmGomez" : "includeEvmJethro";
      box.checked = configBool(key, false);
    });
  }

  function evmIndexEntry(profile) {
    return {
      coin: "evm",
      ticker: "EVM",
      name: profile.label + " EVM",
      label: profile.label + " EVM",
      chainId: profile.chainId,
      contractName: profile.contractName,
      contractAddress: profile.contractAddress
    };
  }

  function evmCatalogRowToPortalRow(row, profile) {
    const summary = row.summary || {};
    return {
      index: evmIndexEntry(profile),
      coin: "evm",
      txid: row.txid,
      raw: null,
      summary: summary,
      blockTime: summary.blockTime || row.modified || 0,
      streamLabel: profile.label + " EVM local catalog",
      discoverySource: "fileProxy",
      localPath: row.path || "",
      imageAsset: row.imageAsset || null,
      modified: row.modified || 0
    };
  }

  async function fetchEvmCatalogRows(profile) {
    const json = await fileProxyJson("/evm-local-catalog", {
      chainId: profile.chainId,
      contractName: profile.contractName,
      contractAddress: profile.contractAddress
    });
    return {
      profile: profile,
      json: json,
      rows: safeArray(json.transactions).map(function (row) { return evmCatalogRowToPortalRow(row, profile); })
    };
  }

  async function loadSelectedEvmCatalogs(opts) {
    const profiles = enabledEvmProfiles();
    if (!profiles.length) {
      setStatus("Choose Gomez EVM, Jethro EVM, or both before loading the local EVM catalog.", true);
      return [];
    }

    const reset = opts && opts.reset;
    if (reset) resetPortalRowsForNewLoad();

    setStatus("Loading local EVM catalog stream(s)…", false);
    const loaded = [];
    const reports = [];

    beginPortalBatch();
    try {
      for (let i = 0; i < profiles.length; i += 1) {
        const result = await fetchEvmCatalogRows(profiles[i]);
        reports.push({
          profile: result.profile.label,
          count: result.rows.length,
          streams: result.json.streams || []
        });
        result.rows.forEach(function (row) {
          loaded.push(upsertPortalRow(row, { silent: true }));
        });
        state.evmCatalogLoaded[result.profile.id] = true;
      }
    } finally {
      endPortalBatch();
    }

    state.portalPage = 1;
    requestPortalRender();
    setText("#portalThunderwordRaw", pretty({ evmCatalog: reports }));
    setStatus("Loaded " + loaded.length + " EVM catalog transaction(s) into the main Portal feed.", false);
    return loaded;
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

  function liveLedgerTarget() {
    const account = normalizePersonalAccount(state.personalAccount);
    const entry = account ? indexEntryForCoin(account.coin, state.currentIndex) : state.currentIndex;
    const address = account ? account.address : (state.mainThunderword && state.mainThunderword.address || entry && entry.address);
    if (!entry || !address || !indexCanFetch(entry)) return null;
    return cloneIndexForAddress(entry, address, account ? account.label : entry.label);
  }

  async function refreshLiveLedger(opts) {
    const options = opts || {};
    if (!configBool("liveLedgerRefresh", true) || document.hidden) return null;
    if (document.body && document.body.dataset.mode && document.body.dataset.mode !== "portal") return null;
    const entry = liveLedgerTarget();
    if (!entry) return null;
    const history = state.liveLedgerHistories[mainThunderwordKey(entry, entry.address)];
    const staleMs = Math.max(1000, Number(configValue("liveLedgerRefreshFocusStaleMs", 60000)) || 60000);
    if (history && (history.promise || !options.force && Date.now() - history.checkedAt < staleMs)) return null;
    try {
      return await loadAddressIndex(entry, entry.address, {background: true});
    } catch (error) {
      setStatus("Ledger refresh will retry; cached transactions remain available. " + (error.message || String(error)), true);
      return null;
    }
  }

  function startLiveLedgerPolling() {
    if (state.liveLedgerTimer) window.clearInterval(state.liveLedgerTimer);
    state.liveLedgerTimer = null;
    if (!configBool("liveLedgerRefresh", true)) return;
    const ms = Math.max(15000, Number(configValue("liveLedgerRefreshMs", 120000)) || 120000);
    state.liveLedgerTimer = window.setInterval(function () { refreshLiveLedger({force: true}); }, ms);
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
      summary.lines ? summary.lines + " address lines" : (sourceIdForRow(row).indexOf("evm") === 0 ? "EVM account/call record, no UTXO set" : "no address lines"),
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
      const text = message || "◷ Loading ThunderWords…";
      const list = $("#portalTransactionList");
      if (list) {
        list.classList.add("muted");
        list.textContent = text;
      }
      setText("#portalExplorerCount", text);
    }
  }

  function renderThunderwordTxs(result, opts) {
    if (!(opts && opts.preserveContext)) {
      state.currentIndex = result.index;
      state.currentTransactions = result.transactions || [];
    }

    if (!result || !result.transactions || !result.transactions.length) {
      renderEmptyTransactionList("◷ No ledger rows here yet. Loading other ThunderWords…");
      schedulePortalDiscovery();
      return;
    }

    beginPortalBatch();
    try {
      result.transactions.forEach(function (tx) {
        const rawTx = hasPortalUtxoOutputs(tx.raw) ? tx.raw : null;
        const summary = rawTx ? extractSummary(rawTx, result.index) : makeBasicSummary(tx.txid, tx, result.index);
        upsertPortalRow({
          index: result.index,
          coin: result.index.coin || result.index.ticker || result.index.name,
          txid: tx.txid,
          raw: rawTx,
          summary: summary,
          blockTime: tx.blockTime,
          confirmed: tx.confirmed,
          receivedTime: tx.receivedTime,
          streamLabel: result.index.label || result.index.address,
          discoverySource: "live-search"
        }, { silent: true });
      });
    } finally {
      endPortalBatch();
    }
    requestPortalRender();
  }

  async function loadAddressIndex(entryOverride, addressOverride, opts) {
    const api = getThunderwords();
    const options = opts || {};
    const entry = entryOverride || getSelectedIndex();
    const address = normalizeAddressForEntry(
      addressOverride || ($("#portalThunderwordAddress") ? $("#portalThunderwordAddress").value.trim() : entry.address) || "",
      entry
    );
    if ($("#portalThunderwordAddress")) $("#portalThunderwordAddress").value = address;
    const activeEntry = cloneIndexForAddress(entry, address, entry.label || entry.address || address);
    const mainThunderword = options.mainThunderword || mainThunderwordForEntry(activeEntry);
    const historyKey = mainThunderwordKey(activeEntry, address);
    const history = state.liveLedgerHistories[historyKey] || (state.liveLedgerHistories[historyKey] = {txids: new Set(), complete: false, checkedAt: 0});
    if (history.promise) return history.promise;
    const reset = false;
    const generation = reset ? resetPortalRowsForNewLoad() : state.portalLoadGeneration;
    if (!options.background) state.currentIndex = activeEntry;
    const account = normalizePersonalAccount(state.personalAccount);
    const personal = account && account.coin === normalizeCoinName(activeEntry.coin) && account.address === canonicalMainThunderwordAddress(address) ? account : null;
    if (!options.background) {
      setStatus("Refreshing " + (activeEntry.ticker || activeEntry.coin || "ledger") + " address history…", false);
      portalBusyStart("Refreshing " + (activeEntry.ticker || activeEntry.coin || "ledger") + " transactions…");
    }
    // Merge and cache each page immediately. An unavailable older page must
    // never hide the newest transactions that were successfully read.
    history.promise = Promise.resolve().then(function () {
      return api.fetchAddressTransactions(activeEntry, address, {
        stopAtTxids: history.complete ? Array.from(history.txids) : [],
        resumeUrl: history.resumeUrl || "",
        resumeAtTxids: history.resumeUrl ? Array.from(history.txids) : [],
        onPage: function (page) {
          if (generation !== state.portalLoadGeneration) return;
          renderThunderwordTxs(page, {preserveContext: true});
          if (personal) cachePersonalTxs(personal, page);
          if (mainThunderword) rememberMainThunderwordTransactions(mainThunderword, page.transactions);
        }
      });
    });
    let result;
    try {
      result = await history.promise;
      history.checkedAt = Date.now();
      history.error = result.error || "";
      history.resumeUrl = result.resumeUrl || "";
      if (result.complete === true) history.complete = true;
      result.transactions.forEach(function (tx) {
        if (tx.confirmed === true || Number(tx.blockHeight) > 0) history.txids.add(tx.txid);
      });
    } catch (error) {
      history.checkedAt = Date.now();
      history.error = error.message || String(error);
      throw error;
    } finally {
      history.promise = null;
      if (!options.background) portalBusyEnd();
    }
    if (generation !== state.portalLoadGeneration) return result;
    renderThunderwordTxs(result, {preserveContext: options.background || state.currentIndex !== activeEntry});
    if (personal) cachePersonalTxs(personal, result);
    if (mainThunderword) rememberMainThunderwordTransactions(mainThunderword, result.transactions);
    setText("#portalThunderwordRaw", pretty({ source: result.url, transactions: result.transactions }));
    setStatus(result.error ? "Recent ledger transactions loaded; older history will retry: " + result.error :
      "Ledger history updated. " + result.transactions.length + " transaction(s) checked.", !!result.error);
    if (personal) setText("#portalPersonalAccountMeta", "Ledger checked " + new Date(history.checkedAt).toLocaleTimeString() +
      (result.error ? "; older history will retry." : ". Transactions are remembered in this browser."));

    const rows = result.transactions.map(function (tx) {
      return state.portalRowKeys[rowKey({ index: activeEntry, coin: activeEntry.coin || activeEntry.ticker || activeEntry.name, txid: tx.txid })];
    }).filter(Boolean).sort(compareStreamItems);

    window.setTimeout(function () {
      if (generation !== state.portalLoadGeneration) return;
      hydratePortalRowsInBackground(rows, [{
        index: activeEntry.label,
        address: activeEntry.address,
        coin: activeEntry.ticker || activeEntry.coin,
        fetched: true,
        transactions: result.transactions.length,
        error: ""
      }], generation, { mainThunderword: mainThunderword }).catch(function (error) {
        setStatus("Background hydration failed: " + (error.message || String(error)), true);
      });
    }, 0);

    return result;
  }

  async function loadThunderwordIndex() {
    const entry = getSelectedIndex();
    const address = $("#portalThunderwordAddress") ? $("#portalThunderwordAddress").value.trim() : entry.address;
    return loadAddressStream(address, entry, address, { source: "manual", updateUrl: true });
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

  function autoTrackedTrailKind(kind) {
    return [
      "artifact-index",
      "person",
      "transport",
      "subject",
      "thunderword-index",
      "free-verse"
    ].indexOf(String(kind || "")) >= 0;
  }

  function recognizedTrailFromAddress(address, sourceIndex, sourceTxid, fallbackTitle) {
    const clean = String(address || "").trim();
    if (!looksLikeAddressLine(clean)) return null;
    const record = classifyAddressLine(clean, 0);
    if (!autoTrackedTrailKind(record.kind)) return null;
    return {
      address: clean,
      title: record.displayText || record.payloadText || fallbackTitle || clean,
      kind: record.kind,
      marker: record.marker,
      sourceTxid: sourceTxid || "",
      index: inferIndexForAddress(clean, sourceIndex)
    };
  }

  function opReturnRecognizedTrails(semantics, sourceIndex, sourceTxid) {
    const out = [];
    const seen = Object.create(null);
    safeArray(semantics && semantics.records).forEach(function (record) {
      if (record.kind !== "op-return" || !record.text) return;
      String(record.text).match(/[1-9A-HJ-NP-Za-km-z]{26,80}/g)?.forEach(function (token) {
        const trail = recognizedTrailFromAddress(token, sourceIndex, sourceTxid, "OP_RETURN " + token);
        if (!trail || seen[trail.address]) return;
        seen[trail.address] = true;
        trail.kind = "op-return-" + trail.kind;
        out.push(trail);
      });
    });
    return out;
  }

  function trailIsAutoTracked(trail) {
    const kind = String(trail && trail.kind || "");
    return autoTrackedTrailKind(kind) || kind.indexOf("op-return-") === 0;
  }

  async function persistRecognizedTrail(trail, txids) {
    if (!trail || !trail.address || !trailIsAutoTracked(trail)) return null;
    if (!configBool("autoTrackRecognizedAddresses", true)) return null;
    const entry = trail.index || inferIndexForAddress(trail.address, state.currentIndex || getSelectedIndex());
    const stream = makeMainThunderword(
      entry,
      trail.address,
      trail.title || trail.address,
      "recognized-" + trail.kind,
      { sourceTxid: trail.sourceTxid || "" }
    );
    const saved = await persistMainThunderword(stream, txids || []);
    scheduleMainThunderwordReindex();
    return saved;
  }

  async function trackAddressManually(address, entry, sourceTxid) {
    const clean = String(address || "").trim();
    if (!isPublicMainThunderwordAddress(clean)) throw new Error("Only a public address can be tracked.");
    const targetEntry = inferIndexForAddress(clean, entry || state.currentIndex || getSelectedIndex());
    const stream = makeMainThunderword(
      targetEntry,
      clean,
      "Tracked " + clean,
      "manual-follow",
      { sourceTxid: sourceTxid || "" }
    );
    const saved = await persistMainThunderword(stream, []);
    scheduleMainThunderwordReindex();
    setStatus("Tracking " + clean + " as a persistent Chisel graph root.", false);
    return saved;
  }

  function makeTrackAddressButton(address, entry, sourceTxid) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondaryButton";
    button.textContent = "track";
    button.title = "Persist this ordinary address as a Chisel graph root";
    button.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      trackAddressManually(address, entry, sourceTxid).then(function () {
        button.textContent = "tracked";
      }).catch(function (error) {
        button.disabled = false;
        setStatus(error.message || String(error), true);
      });
    };
    return button;
  }

  function findRabbitTrailTargets(txJson, sourceIndex) {
    const sourceAddress = sourceIndex && sourceIndex.address;
    const lines = extractLines(txJson);
    const semantics = buildSemantics(txJson, lines);
    const targets = [];
    const sourceTxid = extractTxid(txJson);
    const hasSource = txHasAddressLine(txJson, sourceAddress);

    if (!hasSource) return targets;

    semantics.records.forEach(function (record) {
      if (["artifact-index", "subject", "transport", "person", "address", "thunderword-index", "free-verse"].indexOf(record.kind) < 0) return;
      if (!record.line || record.line === sourceAddress || record.kind === "image-chord-line") return;
      if (String(record.line).charAt(0) === "S") return;
      targets.push({
        address: record.line,
        title: record.displayText || record.payloadText || record.line,
        kind: record.kind,
        marker: record.marker,
        sourceTxid: sourceTxid
      });
    });

    opReturnRecognizedTrails(semantics, sourceIndex, sourceTxid).forEach(function (trail) {
      targets.push(trail);
    });

    if (configBool("rabbitTrailSenders", true)) {
      extractInputAddresses(txJson).forEach(function (address) {
        if (!address || address === sourceAddress) return;
        targets.push({
          address: address,
          title: "sender " + address,
          kind: "sender",
          marker: "VIN",
          sourceTxid: sourceTxid
        });
      });
    }

    return targets.slice(0, Number(configValue("maxRabbitTrails", 24)) || 24);
  }

  function renderConversationStatus(rows, trails, roots) {
    const box = $("#portalConversationStatus");
    if (!box) return;
    box.innerHTML = "";

    const summary = document.createElement("p");
    summary.className = "muted";
    summary.textContent = "Merged " + rows.length + " transaction(s)" + (trails.length ? " with " + trails.length + " rabbit trail(s)." : ".");
    box.appendChild(summary);

    if (roots && roots.length) {
      const rootPre = document.createElement("pre");
      rootPre.className = "json";
      rootPre.textContent = pretty(roots.map(function (root) {
        return {
          coin: root.coin,
          index: root.index,
          address: root.address,
          fetched: root.fetched,
          transactions: root.transactions || 0,
          error: root.error || ""
        };
      }));
      box.appendChild(rootPre);
    }

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

  function renderConversationRows(rows, opts) {
    beginPortalBatch();
    try {
      rows.forEach(function (row) { upsertPortalRow(row, { silent: true }); });
    } finally {
      endPortalBatch();
    }
    if (!(opts && opts.silent)) requestPortalRender();
  }

  async function fetchIndexRows(entry, streamLabel) {
    const api = getThunderwords();
    const rows = [];
    const result = await api.fetchAddressTransactions(entry, entry.address);
    const txs = result.transactions || [];

    for (let i = 0; i < txs.length; i += 1) {
      const tx = txs[i];
      rows.push({
        index: entry,
        coin: entry.coin || entry.ticker || entry.name,
        txid: tx.txid,
        raw: hasPortalUtxoOutputs(tx.raw) ? tx.raw : null,
        summary: hasPortalUtxoOutputs(tx.raw) ? extractSummary(tx.raw, entry) : makeBasicSummary(tx.txid, tx, entry),
        blockTime: tx.blockTime,
        streamLabel: streamLabel || entry.address,
        discoverySource: "live-search"
      });
    }

    return rows;
  }

  async function hydratePortalRowsInBackground(rows, rawReport, generation, opts) {
    if (!configBool("backgroundHydrateTransactions", true)) return;
    const runGeneration = generation || state.portalLoadGeneration;
    const mainThunderword = opts && opts.mainThunderword === state.mainThunderword ? opts.mainThunderword : null;
    const saveOptions = mainThunderword ? { mainThunderword: mainThunderword, refreshIndex: false } : {};

    const trailRows = [];
    const trails = [];
    const seenTrail = new Set();
    const seenChildTx = new Set();
    state.portalRows.forEach(function (existing) { seenChildTx.add(rowKey(existing)); });
    const ordered = prioritizePortalRows(rows);
    const shouldFetchRabbitTrails = configBool("autoFetchRabbitTrails", false);
    let savedRawAddressResults = 0;
    let failedRawAddressResults = 0;

    function rawAddressCacheSummary() {
      const parts = [];
      if (savedRawAddressResults) parts.push(savedRawAddressResults + " full address-result JSON saved");
      if (failedRawAddressResults) parts.push(failedRawAddressResults + " full address-result cache failure" + (failedRawAddressResults === 1 ? "" : "s"));
      return parts.length ? " " + parts.join("; ") + "." : "";
    }

    let visibleChanges = false;
    for (let i = 0; i < ordered.length; i += 1) {
      if (runGeneration !== state.portalLoadGeneration) return;
      const key = rowKey(ordered[i]);
      const row = state.portalRowKeys[key] || ordered[i];
      const visible = isVisiblePortalRow(row) || !!state.expandedRowKeys[key];
      visibleChanges = visibleChanges || visible;
      if (!row.raw && !rowCanHydrate(row)) {
        if ((i + 1) % 4 === 0) {
          if (visibleChanges) requestPortalRender();
          visibleChanges = false;
          await yieldPortalThread();
        }
        continue;
      }
      // A resolved cached summary is enough for the collapsed table.
      // Defer full JSON until expansion rather than refetching it on every boot.
      const cachedTitle = String(row.summary && row.summary.title || "").trim();
      if (!row.raw && row.cachedSummaryReady &&
          cachedTitle && !/^transaction(?:\\s|$)/i.test(cachedTitle) &&
          !state.expandedRowKeys[key]) {
        if ((i + 1) % 4 === 0) await yieldPortalThread();
        continue;
      }
      const previousRawCacheSave = row.rawCacheSavedAt || 0;
      const previousRawCacheError = row.rawCacheError || "";
      const hydrated = await hydratePortalRow(key, Object.assign({
        silent: true,
        suppressRender: true,
        deferSort: true
      }, saveOptions));
      if (hydrated && hydrated.rawCacheSavedAt && !previousRawCacheSave) savedRawAddressResults += 1;
      if (hydrated && hydrated.rawCacheError && hydrated.rawCacheError !== previousRawCacheError) failedRawAddressResults += 1;
      if (!hydrated || !hydrated.raw) {
        if ((i + 1) % 4 === 0) {
          if (visibleChanges) requestPortalRender();
          visibleChanges = false;
          await yieldPortalThread();
        }
        continue;
      }

      findRabbitTrailTargets(hydrated.raw, hydrated.index).forEach(function (trail) {
        const targetIndex = inferIndexForAddress(trail.address, hydrated.index);
        const trailKey = ((targetIndex && (targetIndex.coin || targetIndex.name)) || hydrated.coin || "unknown") + ":" + trail.address;
        if (seenTrail.has(trailKey)) return;
        seenTrail.add(trailKey);
        const discoveredTrail = Object.assign(trail, { index: targetIndex, fetchable: indexCanFetch(targetIndex) });
        trails.push(discoveredTrail);
        if (trailIsAutoTracked(discoveredTrail)) {
          persistRecognizedTrail(discoveredTrail, []).catch(function (error) {
            console.warn("Recognized Chisel graph node could not be persisted:", error);
          });
        }
      });

      if (i === getPortalPageSize() - 1) {
        setStatus("First portal page is hydrated; older transaction records are continuing in the background.", false);
      }

      if ((i + 1) % 4 === 0) {
        if (visibleChanges) requestPortalRender();
        visibleChanges = false;
        await yieldPortalThread();
      }
    }

    if (visibleChanges) requestPortalRender();
    await yieldPortalThread();

    if (!shouldFetchRabbitTrails) {
      state.conversationRows = rows.slice().sort(compareStreamItems);
      state.rabbitTrails = trails;
      renderConversationStatus(state.conversationRows, trails, rawReport || []);
      setText("#portalThunderwordRaw", pretty({ roots: rawReport || [], rabbitTrails: trails, merged: state.conversationRows.map(function (row) {
        const stored = state.portalRowKeys[rowKey(row)] || row;
        return {
          coin: stored.index && (stored.index.ticker || stored.index.coin),
          txid: stored.txid,
          title: stored.summary && stored.summary.title,
          primaryUrl: stored.summary && stored.summary.primaryUrl,
          stream: stored.streamLabel,
          blockTime: stored.summary && stored.summary.blockTime,
          blockHeight: stored.summary && stored.summary.blockHeight
        };
      }) }));
      setStatus("Portal background hydration finished: " + state.conversationRows.length + " root transaction(s)." + rawAddressCacheSummary() + " Rabbit trails were discovered but not auto-merged.", failedRawAddressResults > 0);
      if (mainThunderword) scheduleMainThunderwordReindex();
      requestPortalRender();
      return;
    }

    for (let j = 0; j < trails.length; j += 1) {
      if (runGeneration !== state.portalLoadGeneration) return;
      const trail = trails[j];
      if (!trail.fetchable) continue;
      const child = cloneIndexWithAddress(trail.index, trail.address, trail.title);
      try {
        const childRows = await fetchIndexRows(child, "rabbit trail: " + trail.title);
        trail.transactions = childRows.length;
        if (trailIsAutoTracked(trail)) {
          persistRecognizedTrail(trail, childRows.map(function (row) { return row.txid; })).catch(function (error) {
            console.warn("Recognized Chisel graph transactions could not be persisted:", error);
          });
        }
        const uniqueRows = childRows.filter(function (row) {
          const key = rowKey(Object.assign({}, row, { index: child, coin: child.coin || child.ticker || child.name }));
          if (seenChildTx.has(key)) return false;
          seenChildTx.add(key);
          return true;
        });
        trailRows.push.apply(trailRows, uniqueRows);
        renderConversationRows(uniqueRows);
      } catch (error) {
        trail.error = error.message || String(error);
      }
    }

    let trailVisibleChanges = false;
    for (let k = 0; k < trailRows.length; k += 1) {
      if (runGeneration !== state.portalLoadGeneration) return;
      const key = rowKey(trailRows[k]);
      const row = state.portalRowKeys[key] || trailRows[k];
      trailVisibleChanges = trailVisibleChanges || isVisiblePortalRow(row) || !!state.expandedRowKeys[key];
      await hydratePortalRow(key, Object.assign({
        silent: true,
        suppressRender: true,
        deferSort: true
      }, saveOptions));
      if ((k + 1) % 4 === 0) {
        if (trailVisibleChanges) requestPortalRender();
        trailVisibleChanges = false;
        await yieldPortalThread();
      }
    }
    if (trailVisibleChanges) requestPortalRender();

    state.conversationRows = rows.concat(trailRows).sort(compareStreamItems);
    state.rabbitTrails = trails;
    renderConversationStatus(state.conversationRows, trails, rawReport || []);
    setText("#portalThunderwordRaw", pretty({ roots: rawReport || [], rabbitTrails: trails, merged: state.conversationRows.map(function (row) {
      const stored = state.portalRowKeys[rowKey(row)] || row;
      return {
        coin: stored.index && (stored.index.ticker || stored.index.coin),
        txid: stored.txid,
        title: stored.summary && stored.summary.title,
        primaryUrl: stored.summary && stored.summary.primaryUrl,
        stream: stored.streamLabel,
        blockTime: stored.summary && stored.summary.blockTime,
        blockHeight: stored.summary && stored.summary.blockHeight
      };
    }) }));
    setStatus("Portal background hydration finished: " + state.conversationRows.length + " transaction(s), " + trails.length + " rabbit trail(s)." + rawAddressCacheSummary(), failedRawAddressResults > 0);
    if (mainThunderword) scheduleMainThunderwordReindex();
    requestPortalRender();
  }

  async function loadConversationStreams(opts) {
    const api = getThunderwords();
    if (!api) throw new Error("chisel.thunderwords.js is required for conversation streams.");

    await ensureGeneratedGeneralIndexes();

    const generation = (opts && opts.reset) ? resetPortalRowsForNewLoad() : state.portalLoadGeneration;
    const roots = getGeneralConversationIndexes();
    const allRows = [];
    const seenTx = new Set();
    const rawReport = [];

    setStatus("Searching live/default ledger roots for newer records; results merge into the preloaded stream…", false);

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
        });
      } catch (error) {
        rootReport.error = error.message || String(error);
      }
    }

    const evmReports = [];
    const evmProfiles = enabledEvmProfiles();
    for (let e = 0; e < evmProfiles.length; e += 1) {
      try {
        const result = await fetchEvmCatalogRows(evmProfiles[e]);
        evmReports.push({ profile: result.profile.label, count: result.rows.length, streams: result.json.streams || [] });
        result.rows.forEach(function (row) {
          const key = rowKey(row);
          if (!seenTx.has(key)) {
            seenTx.add(key);
            allRows.push(row);
          }
        });
      } catch (error) {
        evmReports.push({ profile: evmProfiles[e].label, error: error.message || String(error) });
      }
    }

    allRows.sort(compareStreamItems);
    state.conversationRows = allRows;
    state.rabbitTrails = [];
    state.portalPage = 1;

    renderConversationRows(allRows);
    renderConversationStatus(allRows, [], rawReport);
    setText("#portalThunderwordRaw", pretty({ roots: rawReport, evmCatalog: evmReports, merged: allRows.map(function (row) {
      return {
        coin: row.index && (row.index.ticker || row.index.coin),
        txid: row.txid,
        title: row.summary && row.summary.title,
        primaryUrl: row.summary && row.summary.primaryUrl,
        stream: row.streamLabel,
        blockTime: row.summary && row.summary.blockTime,
        blockHeight: row.summary && row.summary.blockHeight
      };
    }) }));

    setStatus("Live ledger search merged " + allRows.length + " candidate transaction(s). Static/preloaded rows were not cleared.", false);

    window.setTimeout(function () {
      if (generation !== state.portalLoadGeneration) return;
      hydratePortalRowsInBackground(allRows, rawReport, generation).catch(function (error) {
        setStatus("Background hydration failed: " + (error.message || String(error)), true);
      });
    }, 0);
  }

  function shouldAutoLoadConversationStreams() {
    if (state.urlMainThunderwordRequest || state.mainThunderword || state.personalAccount) return false;
    if (!configBool("autoLoadConversationStreams", true)) return false;
    try {
      const urlMode = new URL(window.location.href).searchParams.get("mode") || "";
      if (urlMode === "portal") return true;
    } catch (error) {}
    return document.body && document.body.dataset && document.body.dataset.mode === "portal";
  }

  function maybeAutoLoadConversationStreams() {
    if (!shouldAutoLoadConversationStreams() || state.conversationAutoLoaded) return;
    state.conversationAutoLoaded = true;
    loadConversationStreams().catch(function (error) {
      setStatus("Portal auto-load skipped: " + (error.message || String(error)), true);
    });
  }

  function normalizePersonalAccount(value) {
    const source = value && typeof value === "object" ? value : {};
    const address = String(source.address || "").trim();
    if (!address || !isPublicMainThunderwordAddress(address)) return null;
    return {
      address: canonicalMainThunderwordAddress(address),
      coin: normalizeCoinName(source.coin || source.currency || source.ticker || "") || "",
      ticker: String(source.ticker || "").trim(),
      label: String(source.label || source.ticker || "Personal account").trim() || "Personal account",
      savedAt: Number(source.savedAt || Date.now()) || Date.now()
    };
  }

  function savePersonalAccount(account) {
    const clean = normalizePersonalAccount(account);
    if (!clean) return null;
    state.personalAccount = clean;
    try {
      if (window.localStorage) {
        window.localStorage.setItem(PORTAL_PERSONAL_ACCOUNT_STORAGE_KEY,JSON.stringify(clean));
      }
    } catch (error) {
      console.warn("Could not persist public personal-account context:",error);
    }
    return clean;
  }

  function loadPersonalAccount() {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(PORTAL_PERSONAL_ACCOUNT_STORAGE_KEY) : "";
      return raw ? normalizePersonalAccount(JSON.parse(raw)) : null;
    } catch (error) {
      return null;
    }
  }

  function populatePersonalAccountFields(account) {
    const clean = normalizePersonalAccount(account);
    if (!clean) return null;

    const fallback = inferIndexForAddress(clean.address,state.currentIndex || getSelectedIndex());
    const entry = clean.coin ? indexEntryForCoin(clean.coin,fallback) : fallback;

    if ($("#portalThunderwordAddress")) $("#portalThunderwordAddress").value = clean.address;
    if ($("#portalSpendableAddress")) $("#portalSpendableAddress").value = clean.address;
    if ($("#portalSpendableNote") && !$("#portalSpendableNote").value) {
      $("#portalSpendableNote").value = clean.label;
    }
    if ($("#portalThunderwordSelect") && entry && entry.name) {
      $("#portalThunderwordSelect").value = entry.name;
    }

    const card = $("#portalPersonalAccount");
    if (card) card.hidden = false;
    setText("#portalPersonalAccountLabel",clean.label);
    setText("#portalPersonalAccountCoin",clean.ticker || tickerForCoin(clean.coin) || clean.coin.toUpperCase());
    setText("#portalPersonalAccountAddress",clean.address);
    setText("#portalPersonalAccountMeta",
      "Public account context is remembered in this browser and its address stream is also offered to the configured rigler.org fileProxy. WIF/private material is not stored here."
    );

    const explorer = $("#portalPersonalAccountExplorer");
    if (explorer) {
      const href = getThunderwords() && entry ? getThunderwords().getAddressUrl(entry,clean.address) : "";
      if (href) {
        setSafeHref(explorer, href);
        explorer.target = "_blank";
        explorer.rel = "noopener noreferrer";
        explorer.style.display = "inline-flex";
      } else {
        explorer.removeAttribute("href");
        explorer.style.display = "none";
      }
    }

    return { account:clean, entry:entry };
  }

  let personalCacheSaveTimer = null;

  function personalCacheKey(account) {
    return "chisel.portal.accountTxs.v1:" + account.coin + ":" + account.address;
  }

  function readPersonalCache(account) {
    try {
      const rows = JSON.parse(window.localStorage.getItem(personalCacheKey(account)) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (error) { return []; }
  }

  function restorePersonalTxCache(account, entry) {
    const rows = readPersonalCache(account);
    if (!rows.length) return;
    beginPortalBatch();
    try {
      rows.forEach(function (tx) {
        if (!tx || !TXID_RE.test(String(tx.txid || ""))) return;
        const index = cloneIndexForAddress(entry, account.address, account.label);
        const existing = state.portalRowKeys[rowKey({coin: account.coin, index: index, txid: tx.txid})];
        if (existing) {
          existing.summary = mergePortalSummary(tx.summary, existing.summary);
          invalidatePortalRowCache(existing);
          return;
        }
        upsertPortalRow({
          index:index, coin:account.coin, txid:tx.txid,
          summary:tx.summary || makeBasicSummary(tx.txid, tx, entry),
          blockTime:Number(tx.blockTime) || 0,
          confirmed:tx.confirmed,
          receivedTime:Number(tx.receivedTime) || 0,
          cachedSummaryReady:true,
          streamLabel:account.label + " " + account.address,
          discoverySource:"personal-cache"
        }, { silent:true });
      });
    } finally { endPortalBatch(); }
    requestPortalRender();
  }

  function cachePersonalTxs(account, result) {
    if (!result || !Array.isArray(result.transactions)) return;
    const entry = result.index;
    const byId = new Map();
    readPersonalCache(account).forEach(function (tx) {
      if (tx && TXID_RE.test(String(tx.txid || ""))) byId.set(tx.txid,tx);
    });
    result.transactions.forEach(function (tx) {
      if (!tx || !TXID_RE.test(String(tx.txid || ""))) return;
      const old = byId.get(tx.txid) || {};
      const raw = hasPortalUtxoOutputs(tx.raw) ? tx.raw : null;
      byId.set(tx.txid, {
        txid:tx.txid,
        blockTime:Number(tx.blockTime) || old.blockTime || 0,
        confirmed:typeof tx.confirmed === "boolean" ? tx.confirmed : old.confirmed,
        receivedTime:Number(tx.receivedTime) || old.receivedTime || 0,
        summary:mergePortalSummary(old.summary, tx.summary || (raw ? extractSummary(raw,entry) : makeBasicSummary(tx.txid,tx,entry)))
      });
    });
    writePersonalCache(account,Array.from(byId.values()));
  }

  function writePersonalCache(account, rows) {
    const sorted = rows.filter(function (tx) {
      return tx && TXID_RE.test(String(tx.txid || ""));
    }).sort(function (a,b) {
      return (b.confirmed === false ? 1 : 0) - (a.confirmed === false ? 1 : 0) ||
        (Number(b.blockTime || b.receivedTime)||0)-(Number(a.blockTime || a.receivedTime)||0);
    });
    // Storage quotas differ across browsers. Keep older cached data intact
    // if this snapshot cannot be saved.
    try { window.localStorage.setItem(personalCacheKey(account),JSON.stringify(sorted)); }
    catch (error) { console.warn("Personal cache full; existing snapshot preserved:",error); }
  }

  function schedulePersonalCacheSnapshot() {
    if (personalCacheSaveTimer) return;
    personalCacheSaveTimer = window.setTimeout(function () {
      personalCacheSaveTimer = null;
      const account = normalizePersonalAccount(state.personalAccount);
      if (!account) return;
      const byId = new Map();
      readPersonalCache(account).forEach(function (tx) {
        if (tx && TXID_RE.test(String(tx.txid || ""))) byId.set(tx.txid,tx);
      });
      state.portalRows.forEach(function (row) {
        if (canonicalCoinForRow(row) !== account.coin) return;
        if (!portalRowAddresses(row).some(function (address) {
          return canonicalMainThunderwordAddress(address) === canonicalMainThunderwordAddress(account.address);
        })) return;
        const old = byId.get(row.txid) || {};
        byId.set(row.txid,{
          txid:row.txid,blockTime:Number(row.blockTime)||old.blockTime||0,
          confirmed:row.confirmed,
          receivedTime:Number(row.receivedTime)||old.receivedTime||0,
          summary:mergePortalSummary(old.summary,row.summary)
        });
      });
      writePersonalCache(account,Array.from(byId.values()));
    },1200);
  }

  // Optional fast path for a future FileProxy /account-index endpoint.
  // Failures and unsupported servers never delay local cache or explorer loading.
  async function mergePersonalAccountIndex(account, entry) {
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 2500);
    try {
      const endpoint = getFileProxyUrl() + "/account-index?coin=" +
        encodeURIComponent(account.coin) + "&address=" + encodeURIComponent(account.address);
      const response = await fetch(endpoint,{cache:"no-store",signal:controller.signal});
      if (!response.ok) return;
      const payload = await response.json();
      const txs = Array.isArray(payload.transactions) ? payload.transactions :
        (payload.data && Array.isArray(payload.data.transactions) ? payload.data.transactions : []);
      if (!txs.length) return;
      const result = {
        index:entry,
        transactions:txs.filter(function (tx) { return tx && TXID_RE.test(String(tx.txid || "")); }).map(function (tx) {
          return {txid:tx.txid,blockTime:Number(tx.blockTime)||0,summary:tx.summary || {
            title:String(tx.title || ""),blockTime:Number(tx.blockTime)||0
          }};
        })
      };
      if (!result.transactions.length) return;
      cachePersonalTxs(account,result);
      restorePersonalTxCache(account,entry);
    } catch (error) {
      // The current FileProxy may not expose this endpoint yet.
    } finally { window.clearTimeout(timeout); }
  }

  function loadPersonalAccountStream(account, opts) {
    const prepared = populatePersonalAccountFields(account);
    if (!prepared) return Promise.resolve(null);
    const options = opts || {};
    const search = $("#portalEvmWordSearch");
    if (search && options.filterResults !== false) {
      search.value = prepared.account.address;
      state.portalPage = 1;
    }
    restorePersonalTxCache(prepared.account, prepared.entry);
    mergePersonalAccountIndex(prepared.account, prepared.entry).catch(function () {});
    if (options.captureReturnView !== false && !state.personalStreamReturnView) {
      state.personalStreamReturnView = capturePortalView();
    }
    setPersonalStreamBackVisible(true);

    return loadAddressStream(
      prepared.account.address,
      prepared.entry,
      prepared.account.label + " " + prepared.account.address,
      {
        source:options.source || "wif",
        updateUrl:options.updateUrl === true,
        noReloadIfCurrent:options.noReloadIfCurrent !== false
      }
    ).then(function (stream) {
      const search = $("#portalEvmWordSearch");
      if (search && options.filterResults !== false) {
        search.value = prepared.account.address;
        state.portalPage = 1;
        requestPortalRender();
      }
      return stream;
    });
  }

  async function receiveIdentityAccounts(event) {
    const detail = event && event.detail ? event.detail : {};
    const accounts = Array.isArray(detail.accounts) ? detail.accounts : [];
    if (!accounts.length) return;

    const reports = [];
    for (let i = 0; i < accounts.length; i += 1) {
      const account = accounts[i] || {};
      const address = String(account.address || "").trim();
      if (!address) continue;

      const fallback = inferIndexForAddress(address, state.currentIndex || getSelectedIndex());
      const entry = account.currency ? indexEntryForCoin(account.currency, fallback) : fallback;
      if (!entry || !indexCanFetch(entry)) {
        reports.push({ coin: account.ticker || account.currency, address: address, fetched: false, error: "no fetchable explorer profile" });
        continue;
      }

      try {
        const cloned = cloneIndexForAddress(entry, address, (account.label || account.ticker || account.currency || "identity") + " identity");
        const result = await getThunderwords().fetchAddressTransactions(cloned, address);
        renderThunderwordTxs(result);
        reports.push({ coin: account.ticker || account.currency, address: address, fetched: true, transactions: (result.transactions || []).length });
      } catch (error) {
        reports.push({ coin: account.ticker || account.currency, address: address, fetched: false, error: error.message || String(error) });
      }
    }

    if (reports.length) {
      setText("#portalThunderwordRaw", pretty({ identityAccounts: reports }));
      setStatus("Cross-chain identity loaded " + reports.filter(function (r) { return r.fetched; }).length + " address stream(s); results were merged into the Portal feed.", false);
    }
  }

  function receiveMainThunderwordAccount(event) {
    const detail = event && event.detail ? event.detail : {};
    const address = String(detail.address || "").trim();
    if (!address) return;

    const account = savePersonalAccount({
      address:address,
      coin:detail.coin,
      ticker:detail.ticker,
      label:String(detail.label || detail.ticker || "Personal account").trim(),
      savedAt:Date.now()
    });
    if (!account) return;

    populatePersonalAccountFields(account);

    // A scanner/account handoff is an explicit change of Portal context. Keep
    // that personal address stream active instead of allowing the default
    // ThunderWords auto-loader to become the visible view a moment later.
    loadPersonalAccountStream(account,{
      filterResults:true,
      noReloadIfCurrent:false,
      captureReturnView:true,
      source:detail.explicitSearch === true ? "manual" : "scanner",
      updateUrl:detail.explicitSearch === true
    }).catch(function (error) {
      setStatus(error.message || String(error),true);
    });
  }

  async function checkFileProxyHealth() {
    const element = $("#portalFileProxyHealth");
    if (!element) return;
    const base = getFileProxyUrl().replace(new RegExp("/+$"), "");
    let label = "configured endpoint";
    try { label = new URL(base, window.location.href).host; } catch (_) {}
    element.textContent = "FileProxy: checking " + label + "…";
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 6000);
    try {
      await requestFileProxyJson(base + "/ping", {
        method:"GET", cache:"no-store", signal:controller.signal
      });
      element.textContent = "FileProxy: connected (" + label + ")";
      element.style.color = "#a2d889";
    } catch (error) {
      element.textContent = "FileProxy: " + label + " unavailable. Direct HTTP reading does not require it.";
      element.style.color = "#ffb39f";
    } finally {
      window.clearTimeout(timeout);
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
    const loadStaticDataset = $("#portalLoadStaticDatasetButton");
    const validateDataset = $("#portalValidateDatasetButton");
    const clearStream = $("#portalClearStreamButton");
    const loadLocalTxids = $("#portalLoadLocalTxidsButton");
    const loadEvmCatalog = $("#portalLoadEvmCatalogButton");
    const saveCurrentTx = $("#portalSaveCurrentTxButton");
    const copyRawJson = $("#portalCopyRawJsonButton");
    const loadPersonalAccountButton = $("#portalLoadPersonalAccountButton");
    const returnDefaultStreamButton = $("#portalReturnDefaultStreamButton");

    if (!loadThunderword) return;

    initializeRecordView().bind();

    if ($("#portalTxid")) $("#portalTxid").value = DEFAULT_DIGIBYTE_TXID;
    if ($("#portalColorPath")) $("#portalColorPath").value = DEFAULT_COLOR_PATH;
    if ($("#portalFileProxyUrl") && !$("#portalFileProxyUrl").value) $("#portalFileProxyUrl").value = DEFAULT_FILE_PROXY_URL;
    if ($("#portalFileProxyUrl")) $("#portalFileProxyUrl").addEventListener("change", function () {
      state.fileProxyAvailable = null;
      fileProxyRetryAfter = 0;
      checkFileProxyHealth();
    });
    const staticInput = $("#portalStaticDataUrl");
    if (staticInput) {
      staticInput.addEventListener("input", function () { staticInput.dataset.edited = "true"; });
      staticInput.addEventListener("change", function () {
        staticInput.dataset.edited = "true";
        loadStaticHttpSources().then(function (loaded) {
          setStatus(loaded.rows.length ? "Loaded " + loaded.rows.length + " saved transaction(s) directly over HTTP." : "Static HTTP data could not be loaded. Check the activity log.", !loaded.rows.length);
        });
      });
    }
    if ($("#portalScale")) $("#portalScale").value = String(DEFAULT_SCALE);
    if ($("#portalSkipPrefix")) $("#portalSkipPrefix").value = String(DEFAULT_SKIP_PREFIX);
    if ($("#portalSkipSuffix")) $("#portalSkipSuffix").value = String(DEFAULT_SKIP_SUFFIX);

    loadPortalAnnotations();
    window.addEventListener("pagehide", function () { snapshotRecentPortalSummaries(); });
    renderThunderwordOptions();
    state.urlMainThunderwordRequest = mainThunderwordRequestFromUrl();
    state.personalAccount = loadPersonalAccount();
    if (state.personalAccount) {
      const prepared = populatePersonalAccountFields(state.personalAccount);
      if (prepared && !state.urlMainThunderwordRequest) restorePersonalTxCache(prepared.account, prepared.entry);
    }
    window.addEventListener("chisel:main-account", receiveMainThunderwordAccount);
    window.addEventListener("chisel:identity-accounts", function (event) {
      receiveIdentityAccounts(event).catch(function (error) {
        setStatus(error.message || String(error), true);
      });
    });
    renderEmptyTransactionList(state.personalAccount ? "Restoring your account stream…" : "Loading bundled static dataset; live ledger searches can add newer records after first paint.");
    loadEmbeddedStaticDataset();

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
          discoverySource: loaded.source === "local" ? "fileProxy" : "live-search",
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

    if (loadPersonalAccountButton) loadPersonalAccountButton.onclick = function () {
      const account = state.personalAccount || loadPersonalAccount();
      if (!account) {
        setStatus("No public personal account has been loaded into Chisel yet.",true);
        return;
      }
      loadPersonalAccountStream(account,{ filterResults:true, noReloadIfCurrent:false, captureReturnView:true }).catch(function (error) {
        setStatus(error.message || String(error),true);
      });
    };

    if (returnDefaultStreamButton) returnDefaultStreamButton.onclick = function () {
      const previous = state.personalStreamReturnView;
      state.personalStreamReturnView = null;
      restorePortalView(previous);
      setPersonalStreamBackVisible(false);
      setStatus("Returned to the previous ThunderWords view.",false);
      if (!state.portalRows.length) schedulePortalDiscovery();
    };

    if (loadConversation) loadConversation.onclick = async function () {
      try { await loadConversationStreams({ reset: false }); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (loadStaticDataset) loadStaticDataset.onclick = async function () {
      try { await loadConfiguredStaticDatasets(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (validateDataset) validateDataset.onclick = async function () {
      try { await validateStaticDataset(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (clearStream) clearStream.onclick = function () { clearPortalStream(); };

    if (copyRawJson) copyRawJson.onclick = function () {
      const raw = $("#portalRawJson");
      copyPortalText(raw ? raw.textContent : "", copyRawJson).catch(function (error) {
        setStatus(error.message || String(error), true);
      });
    };

    if (loadLocalTxids) loadLocalTxids.onclick = async function () {
      try { await listLocalTransactions(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    if (loadEvmCatalog) loadEvmCatalog.onclick = async function () {
      try { await loadSelectedEvmCatalogs({ reset: false }); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    EVM_PROFILES.forEach(function (profile) {
      const box = evmCheckboxForProfile(profile);
      if (!box) return;
      box.onchange = function () {
        state.evmCatalogLoaded[profile.id] = false;
      };
    });

    PORTAL_FILTER_IDS.forEach(function (id) {
      const box = portalFilterCheckbox(id);
      if (!box) return;
      box.onchange = function () {
        state.portalSourceFilters[id] = !!box.checked;
        state.portalPage = 1;
        requestPortalRender();
      };
    });

    const searchBox = $("#portalEvmWordSearch");
    if (searchBox) searchBox.oninput = function () {
      state.portalPage = 1;
      requestPortalRender();
    };

    const focusGomez = $("#portalFocusGomezButton");
    if (focusGomez) focusGomez.onclick = function () { focusPortalSources(["evmGomez"]); };
    const focusJethro = $("#portalFocusJethroButton");
    if (focusJethro) focusJethro.onclick = function () { focusPortalSources(["evmJethro"]); };
    const showAll = $("#portalShowAllSourcesButton");
    if (showAll) showAll.onclick = function () { focusPortalSources(PORTAL_FILTER_IDS.slice()); };

    if (saveCurrentTx) saveCurrentTx.onclick = async function () {
      try { await saveCurrentTransaction(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    const streamList = $("#portalTransactionList");
    if (streamList) streamList.onkeydown = function (event) {
      if (event.key === "ArrowDown") { event.preventDefault(); selectRelativePortalRow(1); }
      if (event.key === "ArrowUp") { event.preventDefault(); selectRelativePortalRow(-1); }
    };

    const portalModeButton = document.querySelector('[data-mode-target="portal"]');
    if (portalModeButton) portalModeButton.addEventListener("click", function () {
      window.setTimeout(function () {
        const account = state.personalAccount || loadPersonalAccount();
        if (account) populatePersonalAccountFields(account);
        refreshLiveLedger();
        maybeAutoLoadConversationStreams();
      },0);
    });
    window.addEventListener("focus", function () {
      if (configBool("liveLedgerRefreshOnFocus", true)) refreshLiveLedger();
    });
    window.addEventListener("chisel:mode", function (event) {
      if (event.detail && event.detail.mode === "portal") refreshLiveLedger();
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && configBool("liveLedgerRefreshOnFocus", true)) refreshLiveLedger();
    });

    loadColorMap(DEFAULT_COLOR_PATH).catch(function (error) {
      setStatus(error.message || String(error), true);
    });

    loadPortalConfig().then(function (config) {
      applyPortalConfig(config);
      applyEvmProfileConfig();
      // A saved public identity is the homepage. The generic indexes remain
      // available through explicit navigation, never as an automatic takeover.
      if (state.personalAccount && !state.urlMainThunderwordRequest) {
        loadPersonalAccountStream(state.personalAccount, {
          filterResults:true, noReloadIfCurrent:false,
          captureReturnView:false, source:"remembered", updateUrl:false
        }).catch(function (error) {
          setStatus("Your account could not refresh: " + (error.message || String(error)) + ". Public identity remains saved.",true);
        });
      }
      checkFileProxyHealth();
      if (state.urlMainThunderwordRequest) {
        loadMainThunderwordFromUrl().catch(function (error) {
          setStatus("Main thunderword URL could not load: " + (error.message || String(error)), true);
        });
      }
      if (configBool("autoLoadStaticDataset", true)) {
        loadConfiguredStaticDatasets({ quiet: true }).then(function () {
          if (configBool("autoSearchLedgersAfterStatic", true)) maybeAutoLoadConversationStreams();
        }).catch(function (error) {
          setStatus("Static dataset refresh skipped: " + (error.message || String(error)), true);
          if (configBool("autoSearchLedgersAfterStatic", true)) maybeAutoLoadConversationStreams();
        });
      } else if (configBool("autoSearchLedgersAfterStatic", true)) {
        maybeAutoLoadConversationStreams();
      }
      if (configBool("autoLoadLocalTransactions", false)) {
        listLocalTransactions().catch(function (error) {
          setStatus("Local fileProxy load skipped: " + (error.message || String(error)), true);
        });
      }
      if (configBool("autoLoadEvmCatalog", false)) {
        loadSelectedEvmCatalogs({ reset: false }).catch(function (error) {
          setStatus("Local EVM catalog load skipped: " + (error.message || String(error)), true);
        });
      }
      startLocalTransactionPolling();
      startLiveLedgerPolling();
    }).catch(function (error) {
      applyPortalConfig(DEFAULT_PORTAL_CONFIG);
      applyEvmProfileConfig();
      setStatus("Portal config skipped: " + (error.message || String(error)), true);
      if (state.urlMainThunderwordRequest) {
        loadMainThunderwordFromUrl().catch(function (loadError) {
          setStatus("Main thunderword URL could not load: " + (loadError.message || String(loadError)), true);
        });
      }
      if (configBool("autoSearchLedgersAfterStatic", true)) maybeAutoLoadConversationStreams();
      if (state.personalAccount && !state.urlMainThunderwordRequest) {
        loadPersonalAccountStream(state.personalAccount, {filterResults:true, noReloadIfCurrent:false, captureReturnView:false}).catch(function () {});
      }
      startLiveLedgerPolling();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  window.CHISEL_PORTAL = {
    extractLines: extractLines,
    getImageLines: getImageLines,
    getPayload: getPayload,
    paintChordCanvas: paintChordCanvas,
    drawChord: drawChord,
    render: render,
    loadDigibyteTx: loadDigibyteTx,
    loadColorMap: loadColorMap,
    loadThunderwordIndex: loadThunderwordIndex,
    loadAddressIndex: loadAddressIndex,
    loadAddressStream: loadAddressStream,
    loadPersonalAccountStream: loadPersonalAccountStream,
    refreshLiveLedger: refreshLiveLedger,
    loadMainThunderwordFromUrl: loadMainThunderwordFromUrl,
    promoteMainThunderword: promoteMainThunderword,
    mainThunderwordRequestFromUrl: mainThunderwordRequestFromUrl,
    isPublicMainThunderwordAddress: isPublicMainThunderwordAddress,
    renderThunderwordOptions: renderThunderwordOptions,
    buildSemantics: buildSemantics,
    extractInputAddresses: extractInputAddresses,
    displayTitleForRow: displayTitleForRow,
    portalRecordBehaviorForRow: portalRecordBehaviorForRow,
    appendPortalInterpretedRecord: appendPortalInterpretedRecord,
    recordBehaviors: PORTAL_RECORD_BEHAVIORS,
    mediaKindForUrl: mediaKindForUrl,
    tiktokUrlFromUrl: tiktokUrlFromUrl,
    tiktokVideoIdFromUrl: tiktokVideoIdFromUrl,
    buildEvmMediaCardsFromValues: buildEvmMediaCardsFromValues,
    collectEvmMediaCards: collectEvmMediaCards,
    appendPortalInlineDetails: appendPortalInlineDetails,
    renderDraftRecord: renderDraftRecord,
    renderStreamItem: renderPortalStreamItem,
    openRecord: openPortalRecord,
    loadRecordFromUrl: function () { return initializeRecordView().bind(); },
    recordUrl: portalRecordUrl,
    recordSourceUrl: recordDataUrl,
    presentPublication: presentPublication,
    renderSemantics: renderSemantics,
    loadPortalAnnotations: loadPortalAnnotations,
    getPortalAnnotation: getPortalAnnotation,
    setPortalAnnotation: setPortalAnnotation,
    loadPortalAnnotation: loadPortalAnnotation,
    savePortalAnnotationToFileProxy: savePortalAnnotationToFileProxy,
    clearPortalAnnotation: clearPortalAnnotation,
    extractSummary: extractSummary,
    extractBlockTime: extractBlockTime,
    extractBlockHeight: extractBlockHeight,
    titleFromSemantics: titleFromSemantics,
    describeOpReturnText: describeOpReturnText,
    buildPortalMacDougall: buildPortalMacDougall,
    loadConversationStreams: loadConversationStreams,
    loadEmbeddedStaticDataset: loadEmbeddedStaticDataset,
    loadStaticHttpSources: loadStaticHttpSources,
    loadConfiguredStaticDatasets: loadConfiguredStaticDatasets,
    validateStaticDataset: validateStaticDataset,
    clearPortalStream: clearPortalStream,
    loadSelectedEvmCatalogs: loadSelectedEvmCatalogs,
    fetchEvmCatalogRows: fetchEvmCatalogRows,
    listLocalTransactions: listLocalTransactions,
    loadLocalTransaction: loadLocalTransaction,
    loadLocalTransactionPath: loadLocalTransactionPath,
    hydrateLocalRowsInBackground: hydrateLocalRowsInBackground,
    saveCurrentTransaction: saveCurrentTransaction,
    saveTransactionToFileProxy: saveTransactionToFileProxy,
    shouldCacheLiveRawPortalRow: shouldCacheLiveRawPortalRow,
    cacheLiveRawPortalRowMaybe: cacheLiveRawPortalRowMaybe,
    saveDiscoveredLinksMaybe: saveDiscoveredLinksMaybe,
    discoverLocalAssets: discoverLocalAssets,
    findRabbitTrailTargets: findRabbitTrailTargets,
    inferIndexForAddress: inferIndexForAddress,
    state: state
  };
})();
