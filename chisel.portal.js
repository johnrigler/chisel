Warning: truncated output (original token count: 86102)
Total output lines: 7984

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
    autoSyncEvmContracts: true,
    autoSyncEvmContractsMs: 60000,
    autoSyncEvmOverlapBlocks: 16,
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
    includeEvmGomez: true,
    includeEvmJethro: true,
    includeEvmPolygonThunderword: true,
    autoLoadEvmCatalog: true,
    portalFilterDigibyte: true,
    portalFilterRavencoin: true,
    portalFilterLitecoin: true,
    portalFilterBitcoin: true,
    portalFilterDogecoin: true,
    portalFilterEcash: true,
    portalFilterEvmGomez: true,
    portalFilterEvmJethro: true,
    portalFilterEvmPolygonThunderword: true,
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
    },
    {
      id: "polygonThunderword",
      label: "Polygon Thunderword",
      coin: "evm",
      ticker: "EVM",
      chainId: "137",
      chainName: "Polygon Mainnet",
      contractName: "polygon-main-thunderword",
      contractAddress: "0x1111111111111111111111111111111111111111"
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
    evmSyncTimer: null,
    evmSyncPromise: null,
    liveLedgerHistories: Object.create(null),
    mainThunderword: null,
    mainThunderwordReindexTimer: null,
    mainThunderwordReindexPending: false,
    urlMainThunderwordRequest: null,
    evmCatalogLoaded: Object.create(null),
    evmKnownTxids: Object.create(null),
    evmCatalogLatestBlocks: Object.create(null),
    evmCatalogRequests: Object.create(null),
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
  const ledgerDisplayState = storeApi.ledgerDisplayState;
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
  let interactionClient = null, interactionView = null;
  const deferredInteractions = [];
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
    const headingRow = document.createElement("div");
    headingRow.className = "portalFinanceHeadingRow";
    const heading = document.createElement("h5");
    heading.textContent = "Transaction flow";
    headingRow.appendChild(heading);

    const actions = document.createElement("div");
    actions.className = "actions portalFinanceActions";
    const blockchairUrl = rowExplorerUrl(row);
    if (canonicalCoinForRow(row) === "litecoin" && blockchairUrl) {
      const blockchair = document.createElement("a");
      blockchair.className = "secondaryButton";
      setSafeHref(blockchair, blockchairUrl);
      blockchair.target = "_blank";
      blockchair.rel = "noopener noreferrer";
      blockchair.textContent = "Blockchair";
      actions.appendChild(blockchair);
    }
    headingRow.appendChild(actions);
    block.appendChild(headingRow);

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
    return actions;
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
    else if (isMacDougallFirst(first) && (modifier === "C" || modifier === "K") && spacer === "x") record.kind = "subject";
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
    if (u.indexOf("archive.o…56102 tokens truncated… stopAtTxids: history.complete ? Array.from(history.txids) : [],
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
    // The public Thunderword gate is additive: load the public root streams
    // even when a visitor arrived through a specific address or has an identity
    // saved locally. Existing address rows remain in the same Portal dataset.
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
      initializePortalInteractions();
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
      const evmCatalogLoad = configBool("autoLoadEvmCatalog", true)
        ? loadSelectedEvmCatalogs({ reset: false }).catch(function (error) {
          setStatus("Local EVM catalog load skipped: " + (error.message || String(error)), true);
        })
        : Promise.resolve();
      evmCatalogLoad.then(startEvmContractPolling);
      startLocalTransactionPolling();
      startLiveLedgerPolling();
    }).catch(function (error) {
      applyPortalConfig(DEFAULT_PORTAL_CONFIG);
      applyEvmProfileConfig();
      initializePortalInteractions();
      setStatus("Portal config skipped: " + (error.message || String(error)), true);
      if (state.urlMainThunderwordRequest) {
        loadMainThunderwordFromUrl().catch(function (loadError) {
          setStatus("Main thunderword URL could not load: " + (loadError.message || String(loadError)), true);
        });
      }
      const evmCatalogLoad = configBool("autoLoadEvmCatalog", true)
        ? loadSelectedEvmCatalogs({ reset: false }).catch(function (error) {
          console.warn("Local EVM catalog load skipped:", error);
        })
        : Promise.resolve();
      evmCatalogLoad.then(startEvmContractPolling);
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
    resolveSharedYoutube: resolveSharedYoutube,
    findExistingYoutubeRecord: findExistingYoutubeRecord,
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
