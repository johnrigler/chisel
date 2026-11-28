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
  const DEFAULT_REMOTE_MANIFEST_URL = "https://rigler.org/chisel_data/manifest.json";
  const DEFAULT_STATIC_DATA_URL = "https://rigler.org/chisel_data/";
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
    autoSyncEvmContracts: false,
    indexedChiselRefreshMs: 30000,
    autoSyncEvmContractsMs: 60000,
    autoSyncEvmOverlapBlocks: 16,
    autoSelectNewest: false,
    autoLoadConversationStreams: true,
    autoLoadStaticDataset: true,
    autoSearchLedgersAfterStatic: true,
    staticManifestPaths: [DEFAULT_STATIC_MANIFEST_PATH, DEFAULT_BUNDLED_MANIFEST_PATH],
    staticManifestMirrors: [DEFAULT_REMOTE_MANIFEST_URL],
    staticDiscoveryManifestPaths: ["data-bsv/manifest.json", "data-bsv-anchors/manifest.json", "https://rigler.org/chisel_data/bsv/manifest.json"],
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
    includeEvmChisel: true,
    includeEvmPolygonThunderword: true,
    autoLoadEvmCatalog: true,
    portalFilterDigibyte: true,
    portalFilterRavencoin: true,
    portalFilterLitecoin: true,
    portalFilterBitcoin: true,
    portalFilterBsv: true,
    portalFilterDogecoin: true,
    portalFilterEcash: true,
    portalFilterEvmGomez: true,
    portalFilterEvmJethro: true,
    portalFilterEvmChisel: true,
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
      id: "chisel", label: "Chisel", coin: "evm", ticker: "EVM",
      chainId: "137", chainName: "Polygon Mainnet", contractName: "mogwai",
      contractAddress: "0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3"
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
    portalPageSize: null,
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
    indexedChiselTimer: null,
    indexedChiselRefresh: null,
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
  let recordView = null, recordExplore = null, recordCatalogConfig = null;
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
    prepareEvmRow(row);
    const notedTitle = getPortalAnnotation(row).metadata.title;
    if (typeof notedTitle === "string" && notedTitle.trim()) return truncateText(notedTitle, 96);
    const interpreted=window.CHISEL_PORTAL_EXPLORE && /^(?:bsv|bsvTestnet)$/.test(canonicalCoinForRow(row)) ? window.CHISEL_PORTAL_EXPLORE.facts(row).name : "";
    if(interpreted)return truncateText(interpreted,96);
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
    const mediaMetadata = collectEvmMediaCards(row).map(function (card) {
      const url = card.url || card.sourceUrl;
      return youtubeMetadataId(url) ? readPageMetadata(url) : null;
    }).find(function (metadata) { return metadata && metadata.title; });
    if (mediaMetadata) return truncateText(mediaMetadata.title,96);
    const rawTitle = summary.title || (row && row.title) || "";
    const anchorTitle = anchorTextsFromHtml(rawTitle)[0] || "";
    let title = isRawHtmlTitle(rawTitle) ? compactMediaTitle(anchorTitle || rawTitle) : printableText(rawTitle);
    if (title.includes("\ufffd")) title = "";

    if (isLikelyUrl(title) || isPlainAddressDerivedTitle(row, title) || looksLikeEncodedPortalTitle(title)) title = "";
    if (isGenericEvmTitle(title)) title = "";
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
    const urls = extractUrlsFromText(text);
    const spotify = text.match(/spotify:track:([A-Za-z0-9]+)/i);
    if (spotify) urls.push("https://open.spotify.com/track/" + spotify[1]);
    const youtubeId = text.match(/youtube:(?:video:)?([A-Za-z0-9_-]{6,})/i);
    if (youtubeId) urls.push("https://www.youtube.com/watch?v=" + youtubeId[1]);
    return urls;
  }

  function findJsonPayload(value) {
    const source = String(value || "");
    for (let start = 0; start < source.length; start += 1) {
      const first = source.charAt(start);
      if (first !== "{" && first !== "[") continue;
      const stack = [], expected = [];
      let inString = false, escaped = false, invalid = false;
      for (let index = start; index < source.length; index += 1) {
        const char = source.charAt(index);
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === "\"") inString = false;
          continue;
        }
        if (char === "\"") { inString = true; continue; }
        if (char === "{" || char === "[") {
          stack.push(char);
          expected.push(char === "{" ? "}" : "]");
          continue;
        }
        if (char !== "}" && char !== "]") continue;
        if (expected.pop() !== char) { invalid = true; break; }
        stack.pop();
        if (!stack.length) {
          const text = source.slice(start, index + 1);
          try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === "object") return {text: text, value: parsed};
          } catch (_) {}
          invalid = true;
          break;
        }
      }
      if (!invalid) continue;
    }
    return null;
  }

  function tryParseJsonText(value) {
    const text = String(value || "").trim();
    if (!text || !/^[\[{]/.test(text)) return null;
    try { return JSON.parse(text); } catch (error) { return null; }
  }

  function describeOpReturnText(text) {
    const clean = printableText(text);
    const jsonPayload = findJsonPayload(text);
    const parsed = jsonPayload ? jsonPayload.value : null;
    const urls = extractUrls(text);
    const out = {
      text: clean,
      urls: urls,
      parsedJson: parsed,
      jsonText: jsonPayload ? jsonPayload.text : "",
      title: ""
    };

    if (parsed && Array.isArray(parsed)) {
      const firstTitle = parsed.map(function (item) {
        if (!item || typeof item !== "object") return "";
        return item.title || item.subject || item.name || item.text || item.url || "";
      }).filter(Boolean)[0];
      out.title = firstTitle ? "JSON payload · " + truncateText(firstTitle, 88) : "JSON payload · array (" + parsed.length + " items)";
    } else if (parsed && typeof parsed === "object") {
      out.title = parsed.title || parsed.subject || parsed.name || parsed.text || parsed.url
        ? "JSON payload · " + truncateText(parsed.title || parsed.subject || parsed.name || parsed.text || parsed.url, 88)
        : "JSON payload · object";
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

  const evmDecodedCache = new WeakMap();
  function decodedEvmValue(value) {
    if (!value || typeof value !== "object") return {};
    if (evmDecodedCache.has(value)) return evmDecodedCache.get(value);
    const saved = value.decoded && typeof value.decoded === "object" ? value.decoded : {};
    const tx = txObject(value);
    let decoded = saved;
    if (window.CHISEL_EVM_DECODE) {
      try {
        const parsed = window.CHISEL_EVM_DECODE.decode(tx && (tx.input || tx.data));
        if (parsed) decoded = Object.assign({}, saved, parsed);
      } catch (error) { decoded = Object.assign({}, saved, {decodeError: error.message}); }
    }
    evmDecodedCache.set(value, decoded);
    return decoded;
  }

  function prepareEvmRow(row) {
    if (!row || !row.raw || !isEvmTransactionJson(row.raw, row.index)) return;
    const cache = portalRowCacheFor(row);
    if (cache.evmSummaryReady) return;
    row.summary = mergePortalSummary(row.summary, extractEvmSummary(row.raw, row.index));
    cache.evmSummaryReady = true;
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
    const encrypted=direction==="output" && window.CHISEL_BSV_MEDIA && window.CHISEL_BSV_MEDIA.encryptedFiles(raw,0)[0];
    if(encrypted) return {label:encrypted.name,address:"",kind:"data",subtitle:window.CHISEL_BSV_MEDIA.encryptedLabel(encrypted)};
    const api=window.CHISEL_BSV_MEDIA;
    if(direction==="output" && api && api.isBitcomB(raw)) {
      const file=api.fromOutput(raw,0).find(f=>f.protocol==="B");
      const post=api.twetchPost({vout:[raw]});
      return {label:"Bitcom B",address:"",kind:"data",
        subtitle:post&&post.text ? post.text : file ? file.mime+" · "+file.bytes.toLocaleString()+" bytes" : "File protocol",
        rawScript:script||asm};
    }
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
          appendLinkedTransactionText(subtitle, target.subtitle);
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
      const encrypted=window.CHISEL_BSV_MEDIA && window.CHISEL_BSV_MEDIA.encryptedFiles(entry,index)[0];
      const payload=encrypted?{text:window.CHISEL_BSV_MEDIA.encryptedLabel(encrypted),label:encrypted.name,kind:"encrypted",bytes:encrypted.bytes}:payloadData.fromOutput(entry);
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

  function opReturnJsonPayloadsForRow(row) {
    if (!row || !row.raw) return [];
    return extractOutputs(row.raw).reduce(function (payloads, output) {
      if (!output.opReturnPayload || !output.opReturnText) return payloads;
      const parsed = describeOpReturnText(output.opReturnText);
      if (!parsed.parsedJson || !parsed.jsonText) return payloads;
      payloads.push({output: output.n, text: parsed.jsonText, value: parsed.parsedJson, title: parsed.title,
        bytes: new TextEncoder().encode(parsed.jsonText).length});
      return payloads;
    }, []);
  }

  function treechatForRow(row) {
    const api=window.CHISEL_BSV_MEDIA, summary=row&&row.summary||{};
    if(row&&row.raw&&api&&api.treechatPost)return api.treechatPost(row.raw);
    const record=summary.recordType;
    return record&&record.id==="treechat-post"?{postId:record.postId,url:"https://app.treechat.com/quest/post-"+encodeURIComponent(record.postId),
      captureTitle:record.captureTitle||"",sourceUrl:record.sourceUrl||"",warningCode:record.warningCode||"",payloadBytes:record.payloadBytes||0,
      output:record.output,complete:record.complete,text:""}:null;
  }

  function opReturnTextForRow(row) {
    // Read the same output scripts used by the expanded transaction flow.
    // Older cached summaries may have only a generic title or no OP_RETURN.
    const twetch=twetchForRow(row);
    if(twetch) return twetch.text || twetch.name;
    const treechat=treechatForRow(row);
    if(treechat)return ["Treechat post",treechat.captureTitle,Number.isFinite(treechat.payloadBytes)?treechat.payloadBytes.toLocaleString()+" captured bytes":"",
      treechat.warningCode?"source returned "+treechat.warningCode:""].filter(Boolean).join(" · ");
    const encrypted=encryptedBsvFilesForRow(row);
    if (encrypted.length) return encrypted.map(window.CHISEL_BSV_MEDIA.encryptedLabel).join("\n");
    const payloads = extractOutputs(row && row.raw).map(function (output) { return output.opReturnPayload; }).filter(Boolean);
    if (payloads.length) return payloads.map(function (payload) { return payload.text || payload.label; }).join("\n");
    const text = String(row && row.summary && row.summary.opReturnText ||
      row && row.draftRecord && row.draftRecord.ledger.opReturnText || "").trim();
    if (/^(?:bsv|bsvTestnet)$/.test(canonicalCoinForRow(row)) && /BSVWRAPPER_MERKLE_E|indelible\.claude-code/.test(text)) return "Encrypted artifact · open record to inspect envelope";
    return text.includes("\ufffd") ? "OP_RETURN data · open record to inspect bytes" : text;
  }

  function bsvInlineImageForRow(row) {
    if (!row || !/^(?:bsv|bsvTestnet)$/.test(canonicalCoinForRow(row))) return null;
    const candidates = [];
    if (row.raw) {
      extractOutputs(row.raw).forEach(function (output) {
        if (output && output.opReturnText) candidates.push(String(output.opReturnText));
      });
    }
    if (row.summary && row.summary.opReturnText) candidates.push(String(row.summary.opReturnText));
    if (row.draftRecord && row.draftRecord.ledger && row.draftRecord.ledger.opReturnText) {
      candidates.push(String(row.draftRecord.ledger.opReturnText));
    }
    const pattern = /^data:(image\/(?:png|jpeg|gif|webp|avif|bmp|x-icon));base64,([A-Za-z0-9+/=\s]+)$/i;
    for (let i = 0; i < candidates.length; i += 1) {
      const match = candidates[i].trim().match(pattern);
      if (!match) continue;
      const encoded = match[2].replace(/\s/g, "");
      if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) continue;
      const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
      const bytes = Math.floor(encoded.length * 3 / 4) - padding;
      if (bytes < 1 || bytes > 32 * 1024 * 1024) continue;
      return {src: "data:" + match[1].toLowerCase() + ";base64," + encoded,
        mime: match[1].toLowerCase(), bytes: bytes};
    }
    return null;
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
    const treechat = window.CHISEL_BSV_MEDIA && window.CHISEL_BSV_MEDIA.treechatPost
      ? window.CHISEL_BSV_MEDIA.treechatPost(value) : null;

    outputs.forEach(function (output) {
      if (output.opReturnPayload) {
        const payload = describeOpReturnText(output.opReturnText);
        if (treechat && treechat.output === output.n) {
          payload.title = treechat.captureTitle || "Treechat post";
          payload.text = ["Treechat post", treechat.captureTitle, treechat.payloadBytes.toLocaleString() + " captured bytes",
            treechat.warningCode ? "source returned " + treechat.warningCode : ""].filter(Boolean).join(" · ");
          payload.urls = treechat.sourceUrl ? [treechat.sourceUrl] : [];
          payload.parsedJson = null;
        }
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
            text: payload.jsonText,
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
    const raw = row && row.raw ? row.raw : row;
    const image = decodedEvmValue(raw).image;
    // Gomez has one native image payload. Its recovered bytes supersede old
    // extracted copies, which can include ABI padding or a stale server path.
    if (image && /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(image.src)) {
      return [{path: image.src, mime: image.mime, bytes: image.bytes, inline: true}];
    }
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
    if (/\.(?:png|jpe?g|gif|webp)(?:[?#].*)?$/i.test(u)) return "image";
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

  function isGenericEvmTitle(value) {
    return /^(?:(?:gomez|jethro|mogwai|chisel|evm|polygon-main-thunderword)\s+)?(?:transaction(?:\s+[0-9a-f…]+)?|untitled transaction)$/i.test(String(value || "").trim());
  }

  function needsBsvClassification(row, value) {
    return /^(?:bsv|bsvTestnet)$/.test(canonicalCoinForRow(row)) &&
      /^(?:truncated op_return preview|bsv data output|bsv large transaction|large transaction)$/i.test(String(value || "").trim());
  }

  function compactMediaTitle(value) {
    const clean = cleanHtmlishText(value).replace(/^>+\s*/, "");
    return clean.length > 140 ? clean.slice(0, 137) + "…" : clean;
  }

  function buildEvmMediaCardsFromValues(values, words) {
    const rawText = values.map(function (item) { return String(item || ""); }).filter(Boolean).join("\n");
    const urls = htmlAttributeUrls(rawText);
    const anchors = anchorTextsFromHtml(rawText);
    const imageUrls = [];
    rawText.replace(/<img\b[^>]*\bsrc\s*=\s*["']?([^\s"'<>]+)/gi, function (_, url) {
      imageUrls.push(normalizeMediaUrl(decodeHtmlEntities(url))); return _;
    });
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
      } else if (card.kind === "image" || imageUrls.indexOf(normalized) !== -1) {
        card.kind = "image";
        card.thumbnailUrl = normalized;
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
      if (copy.kind === "image" && !copy.thumbnailUrl) copy.thumbnailUrl = normalizedUrl;
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
    const decoded = decodedEvmValue(raw);
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
    const decoded = decodedEvmValue(value);
    const assets = value && value.assets && typeof value.assets === "object" ? value.assets : {};
    const imageAssets = safeArray(assets.images).filter(function (asset) { return asset && asset.path; });
    const firstImage = imageAssets[0] || imageAssetFromSummary(existing) || {};
    const valuesForCards = [
      existing.primaryUrl, isGenericEvmTitle(existing.title) ? "" : existing.title, isGenericEvmTitle(existing.cleanText) ? "" : existing.cleanText,
      decoded.message, decoded.text, decoded.body, decoded.artifact
    ].concat(safeArray(existing.opReturnUrls));
    const mediaCards = [];
    safeArray(existing.mediaCards).forEach(function (card) { mediaCards.push(card); });
    buildEvmMediaCardsFromValues(valuesForCards, safeArray(existing.evmWords).concat(safeArray(decoded.words), decoded.artifact ? [decoded.artifact] : [])).forEach(function (card) { mediaCards.push(card); });
    const firstMedia = mediaCards[0] || {};
    const cleanText = cleanHtmlishText(decoded.message || decoded.text || decoded.body || (isGenericEvmTitle(existing.cleanText) ? "" : existing.cleanText) || "");
    const cleanTitle = compactMediaTitle(cleanText);
    const existingTitle = isRawHtmlTitle(existing.title) || isGenericEvmTitle(existing.title) || isLikelyUrl(existing.title) ? "" : printableText(existing.title || "");
    const imageTitle = decoded.image ? (safeArray(decoded.words).join(" · ") || decoded.image.mime.replace("image/", "").toUpperCase() + " image") : "";
    const isChisel = /^(?:mogwai|chisel)$/i.test(String(existing.contractName || (value.contract && value.contract.name) || (indexEntry && indexEntry.contractName) || ""));
    const mediaTitle = firstMedia.title && !isLikelyUrl(firstMedia.title) ? firstMedia.title : (firstMedia.url ? humanUrlTitle(firstMedia.url) : "");
    const artifactTitle = decoded.artifact && !isLikelyUrl(decoded.artifact) && !looksLikeEncodedPortalTitle(decoded.artifact) ? compactMediaTitle(decoded.artifact) : "";
    const methodTitle = decoded.kind === "chisel.logRecord" ? "Chisel log" + (Number.isFinite(decoded.payloadBytes) ? " · " + decoded.payloadBytes + " bytes" : "") :
      decoded.kind === "chisel.execute" ? "Chisel execute" : decoded.kind === "jethro.mapArtifact" ? "Chisel artifact mapping" : "Chisel record " + shortTxid(txid);
    const title = isChisel ? (artifactTitle || cleanTitle || imageTitle || mediaTitle || existingTitle || safeArray(decoded.words).join(" · ") || methodTitle) :
      (existingTitle || cleanTitle || imageTitle || firstMedia.title || safeArray(decoded.words).join(" · ") || (tx && (tx.functionName || tx.methodId)) || (txid ? "EVM transaction " + shortTxid(txid) : "EVM transaction"));
    return {
      txid: txid,
      hash: evmHashForExplorer(value, txid),
      title: title,
      cleanText: cleanText,
      evmWords: safeArray(decoded.words).length ? decoded.words : existing.evmWords || [],
      evmReceivers: decoded.receivers || existing.evmReceivers || [],
      evmAmounts: decoded.amounts || existing.evmAmounts || [],
      recordKind: decoded.kind || existing.recordKind || "",
      primaryUrl: existing.primaryUrl || firstMedia.url || "",
      lines: 0,
      imageLines: 0,
      imageChordLines: [],
      ipfsCount: 0,
      opReturnText: "",
      opReturnUrls: existing.opReturnUrls || [],
      imageCount: Number(existing.imageCount || imageAssets.length || (firstImage.path || decoded.image ? 1 : 0)) || 0,
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

    const summary = {
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
    if (/^(?:bsv|bsvTestnet)$/.test(normalizeCoinName(indexEntry && (indexEntry.coin || indexEntry.ticker))) && window.CHISEL_BSV_MEDIA) {
      Object.assign(summary, window.CHISEL_BSV_MEDIA.summarize(value));
      if (summary.recordType && summary.recordType.id === "krep-v1") summary.title = summary.recordType.name;
      const named = summary.files.find(file => file.protocol === "1Sat Ordinals" && file.name) || summary.files.find(file => file.protocol === "1Sat Ordinals");
      if (named) summary.title = window.CHISEL_PORTAL_EXPLORE ? window.CHISEL_PORTAL_EXPLORE.ordinalTitle(named) : (named.name || "1Sat Ordinal") + " · inscription";
      const encrypted=summary.files.find(file=>file.encrypted);
      if(encrypted) summary.title=encrypted.name;
      const treechat=window.CHISEL_BSV_MEDIA.treechatPost(value);
      if(treechat){
        summary.title=treechat.captureTitle?"Treechat · "+treechat.captureTitle:"Treechat post";
        summary.primaryUrl=treechat.sourceUrl||summary.primaryUrl;
        summary.opReturnText=["Treechat post",treechat.captureTitle,treechat.payloadBytes.toLocaleString()+" captured bytes",
          treechat.warningCode?"source returned "+treechat.warningCode:""].filter(Boolean).join(" · ");
        summary.opReturnUrls=treechat.sourceUrl?[treechat.sourceUrl]:[];
      } else if(!encrypted && !named && summary.files.some(file=>file.protocol==="B")) summary.title="Bitcom B";
      const twetch=window.CHISEL_BSV_MEDIA.twetchPost(value);
      if(twetch){
        summary.title=window.CHISEL_PORTAL_EXPLORE ? window.CHISEL_PORTAL_EXPLORE.twetchTitle(twetch) : (twetch.text||twetch.name);
        summary.opReturnText=twetch.text||twetch.name;
        summary.opReturnUrls=extractUrls(twetch.text);
        summary.primaryUrl="";
      }
    }
    return summary;
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

    const browser = makePortalAddressBrowser(records, currentEntry);
    if (browser) links.appendChild(browser);

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
      id: "subject-reference",
      match: function (row) {
        if (!row || !row.raw || canonicalCoinForRow(row) !== "litecoin" ||
            !window.CHISEL_PORTAL_SUBJECT) return null;
        return window.CHISEL_PORTAL_SUBJECT.interpret(row.raw, row.txid, payloadData.fromOutput);
      },
      title: function (record) { return record.subject; },
      renderExpanded: function (container, record, row) {
        const panel = document.createElement("section");
        panel.className = "portalInterpretedRecord portalSubjectReference";
        panel.dataset.recordBehavior = "subject-reference";
        const label = document.createElement("h5");
        label.textContent = record.subject;
        panel.appendChild(label);
        const explanation = document.createElement("p");
        explanation.className = "muted";
        explanation.textContent = "Decoded from the address in this Litecoin transaction; this does not establish that the named organization published it.";
        panel.appendChild(explanation);
        const address = document.createElement("code");
        address.className = "portalSubjectAddress";
        address.textContent = record.address;
        panel.appendChild(address);

        if (record.sha256) {
          const kind = document.createElement("strong");
          kind.textContent = "SHA-256 checksum";
          panel.appendChild(kind);
          const digest = document.createElement("code");
          digest.className = "portalSubjectDigest";
          digest.textContent = record.sha256;
          panel.appendChild(digest);
          const note = document.createElement("p");
          note.className = "muted";
          note.textContent = "The transaction carries 64 ASCII hexadecimal characters" +
            (record.bytesOnLedger === 71 ? " with a sha256: prefix" : "") +
            ". Check the original file bytes before asserting a match.";
          panel.appendChild(note);
        } else if (record.url) {
          const kind = document.createElement("strong");
          kind.textContent = "Linked reference";
          panel.appendChild(kind);
          const url = document.createElement("code");
          url.className = "portalSubjectDigest";
          url.textContent = record.url;
          panel.appendChild(url);
          const note = document.createElement("p");
          note.className = "muted";
          note.textContent = "An outbound URL recorded in OP_RETURN. It is not a verification of the target's contents.";
          panel.appendChild(note);
        }
        // Show already-known sibling records immediately; fetch additional
        // on-chain history only when the user requests it below.
        const siblings = state.portalRows.filter(function (candidate) {
          if (!candidate || candidate === row || candidate.txid === row.txid ||
              canonicalCoinForRow(candidate) !== "litecoin") return false;
          const summary = candidate.summary || {};
          const addresses = [candidate.index && candidate.index.address]
            .concat(safeArray(summary.outputAddresses), safeArray(summary.addresses),
              candidate.raw ? extractLines(candidate.raw) : []);
          return addresses.includes(record.address);
        });
        if (siblings.length) {
          const related = document.createElement("div");
          related.className = "portalSubjectRelated";
          const heading = document.createElement("strong");
          heading.textContent = "Other loaded records on this subject (" + siblings.length + ")";
          related.appendChild(heading);
          siblings.slice(0, 12).forEach(function (candidate) {
            const link = document.createElement("a");
            setSafeHref(link, portalRecordUrl(candidate));
            link.textContent = displayTitleForRow(candidate) + " · " + shortTxid(candidate.txid);
            link.onclick = function (event) {
              if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              openPortalRecord(candidate);
            };
            related.appendChild(link);
          });
          panel.appendChild(related);
        }
        const actions = document.createElement("div");
        actions.className = "actions portalSubjectActions";
        if (record.sha256) {
          const copy = document.createElement("button");
          copy.type = "button";
          copy.className = "secondaryButton";
          copy.textContent = "Copy SHA-256";
          copy.onclick = function () {
            copyPortalText(record.sha256, copy).catch(function (error) { setStatus(error.message, true); });
          };
          actions.appendChild(copy);
          const link = window.CHISEL_PORTAL_SUBJECT.commonsHandoff(record);
          if (link) {
            const commons = document.createElement("a");
            commons.className = "secondaryButton";
            setSafeHref(commons, link);
            commons.textContent = "Use in Commons";
            commons.target = "_blank";
            commons.rel = "noopener noreferrer";
            actions.appendChild(commons);
          }
        }
        if (record.url) {
          const open = document.createElement("a");
          open.className = "secondaryButton";
          setSafeHref(open, record.url);
          open.textContent = "Follow reference";
          open.target = "_blank";
          open.rel = "noopener noreferrer";
          actions.appendChild(open);
        }
        const history = document.createElement("button");
        history.type = "button";
        history.className = "secondaryButton";
        history.textContent = "Related subject records";
        history.title = "Load the ledger history of this shared unspendable address";
        history.onclick = function () {
          if (recordView && recordView.active()) recordView.back();
          loadAddressStream(record.address, inferIndexForAddress(record.address, rowIndexEntry(row)), record.subject, {
            source: "rabbit-trail", updateUrl: true
          }).catch(function (error) { setStatus(error.message || String(error), true); });
        };
        actions.appendChild(history);
        panel.appendChild(actions);
        container.appendChild(panel);
        return true;
      }
    },
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

  // Session-only compact raster previews. No full-size image blobs retained.
  const bsvRowThumbnails = new WeakMap();
  let visibleBsvThumbnailsScheduled = false;
  function bsvThumbnailForRow(row) {
    const entry = bsvRowThumbnails.get(row);
    return entry && entry.url || "";
  }

  function isBsvRasterImage(file) {
    return file && /^image\/(?:jpeg|png|gif|webp|avif|bmp|x-icon)$/.test(file.mime);
  }

  async function makeBsvRowThumbnail(row) {
    const api = window.CHISEL_BSV_MEDIA;
    if (!api || !row.raw) return "";
    let file = api.files(row.raw).find(isBsvRasterImage);
    if (!file || file.bytes > 32 * 1024 * 1024) return "";
    if (!file.complete) {
      file = await api.loadFile(canonicalCoinForRow(row), row.txid, file,
        window.fetch.bind(window), AbortSignal.timeout(30000));
    }
    if (!file.data || !file.data.length || file.data.length > 32 * 1024 * 1024) return "";
    const source = URL.createObjectURL(new Blob([file.data], {type: file.mime}));
    try {
      const img = document.createElement("img");
      img.src = source;
      await img.decode();
      if (!img.naturalWidth || !img.naturalHeight) return "";
      const scale = Math.min(1, 208 / img.naturalWidth, 112 / img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(source);
    }
  }

  function scheduleVisibleBsvThumbnails(pageRows) {
    if (!window.CHISEL_BSV_MEDIA || visibleBsvThumbnailsScheduled) return;
    const candidates = safeArray(pageRows).filter(function (row) {
      if (!/^(?:bsv|bsvTestnet)$/.test(canonicalCoinForRow(row))) return false;
      const previous = bsvRowThumbnails.get(row);
      if (previous && (previous.url || previous.raw === row.raw && previous.summary === row.summary)) return false;
      return !!row.raw || rowCanHydrate(row);
    });
    if (!candidates.length) return;
    visibleBsvThumbnailsScheduled = true;
    const generation = state.portalLoadGeneration;
    window.setTimeout(function () {
      (async function () {
        for (let offset = 0; offset < candidates.length; offset += 2) {
          if (generation !== state.portalLoadGeneration) return;
          await Promise.all(candidates.slice(offset, offset + 2).map(async function (row) {
            if (!isVisiblePortalRow(row)) return;
            try {
              if (!row.raw) await hydratePortalRow(row.key, {
                quiet: true, silent: true, suppressRender: true, deferSort: true, deferCache: true, refreshIndex: false
              });
              if (generation !== state.portalLoadGeneration || state.portalRowKeys[row.key] !== row) return;
              if (!isVisiblePortalRow(row)) return;
              const entry = {raw: row.raw, summary: row.summary, url: ""};
              bsvRowThumbnails.set(row, entry);
              if (row.raw) entry.url = await makeBsvRowThumbnail(row);
            } catch (_) {
              // Unavailable media must not interrupt the ledger feed.
              bsvRowThumbnails.set(row, {raw: row.raw, summary: row.summary, url: ""});
            } finally {
              if (generation === state.portalLoadGeneration && isVisiblePortalRow(row)) requestPortalRender();
            }
          }));
          await yieldPortalThread();
        }
      })().catch(function (error) {
        console.warn("BSV thumbnail lookup failed:", error);
      }).finally(function () {
        visibleBsvThumbnailsScheduled = false;
        requestPortalRender();
      });
    }, 0);
  }

  function appendRowThumbnail(cell, row) {
    const bsvThumbnail = bsvThumbnailForRow(row);
    if (bsvThumbnail) {
      const img = document.createElement("img");
      img.className = "portalStreamThumbImage portalStreamThumbRemote";
      img.alt = "BSV transaction image";
      img.title = "Image embedded in this transaction";
      img.loading = "lazy";
      img.src = bsvThumbnail;
      cell.appendChild(img);
      return "";
    }

    const bsvInlineImage = bsvInlineImageForRow(row);
    if (bsvInlineImage) {
      const img = document.createElement("img");
      img.className = "portalStreamThumbImage";
      img.alt = "Image embedded in BSV transaction";
      img.title = "Embedded " + bsvInlineImage.mime.slice(6).toUpperCase() + " image · " + bsvInlineImage.bytes.toLocaleString() + " bytes";
      img.loading = "lazy";
      img.src = bsvInlineImage.src;
      cell.appendChild(img);
      return "";
    }

    // Record-specific renderers belong in the expanded interpretation area.
    // The compact thumbnail remains reserved for actual media/image previews.
    const evmImages = collectEvmImageAssets(row);
    if (evmImages.length) {
      const img = document.createElement("img");
      img.className = "portalStreamThumbImage";
      img.alt = "EVM image thumbnail";
      img.title = evmImages[0].assetId || "EVM image asset";
      img.loading = "lazy";
      const imageUrl = evmImages[0].inline ? (img.src = evmImages[0].path, "") : setPortalAssetImage(img, evmImages[0].path, row);
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
      if (url.searchParams.has("txid") || (window.CHISEL_PORTAL_RECORD && window.CHISEL_PORTAL_RECORD.parseRoute(url.href))) return;
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
    // Configuration must never depend on FileProxy being online.

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
        if (json.ok === false || typeof json !== "object" || Array.isArray(json)) continue;
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

  async function requestFileProxyJson(url, options, timeoutOverrideMs) {
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
      }, Math.max(Number(timeoutOverrideMs) || 0, method === "GET" ? fileProxyReadTimeout() : 8000));
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

  async function fileProxyJson(path, params, timeoutOverrideMs) {
    const query = new URLSearchParams(params || {});
    const url = getFileProxyUrl() + path + (String(query) ? "?" + String(query) : "");
    return requestFileProxyJson(url, {cache:"no-store"}, timeoutOverrideMs);
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
    if (!(opts && opts.silent)) requestPortalRender();
    return { added: added, updated: updated, total: rows.length };
  }

  // The 832 KB starter bundle is Portal data, not a Send dependency.
  let starterDatasetPromise = null;
  function ensureStarterDataset() {
    if (window.CHISEL_PORTAL_STARTER_DATA) return Promise.resolve(loadEmbeddedStaticDataset());
    if (starterDatasetPromise) return starterDatasetPromise;
    starterDatasetPromise = new Promise(function (resolve) {
      const script = document.createElement("script");
      script.src = "data-bundled/portal-starter.js?rev=20261012S";
      script.async = true;
      script.onload = function () {
        try { resolve(loadEmbeddedStaticDataset()); }
        catch (error) { console.warn("Bundled Portal data:", error); resolve(null); }
      };
      script.onerror = function () { starterDatasetPromise = null; resolve(null); };
      document.head.appendChild(script);
    });
    return starterDatasetPromise;
  }

  function loadEmbeddedStaticDataset() {
    const dataset = window.CHISEL_PORTAL_STARTER_DATA;
    if (!dataset || state.staticDatasetLoaded) return null;
    const rows = normalizeStaticDatasetRows(dataset, {
      baseUrl: "./data-bundled/",
      sourceLabel: "bundled static index",
      sourceBadge: "bundled",
      remoteBaseUrls: ["https://rigler.org/chisel_data/"]
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
    if (loaded.index.scan && window.CHISEL_PORTAL_DISCOVERY) {
      window.CHISEL_PORTAL_DISCOVERY.renderCoverage($("#portalBsvScanCoverage"), loaded.index.scan);
    }
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
    // Discovery feeds supplement the legacy mirror fallbacks. Load every
    // configured feed so an available general mirror never hides BSV history.
    const discovery = normalizePathList(configValue("staticDiscoveryManifestPaths", null), []);
    for (const manifest of discovery) {
      try { reports.push(await loadStaticManifest(manifest, {label: "BSV public history", badge: "scan", silent: true})); }
      catch (error) { reports.push({source: manifest, error: error.message || String(error)}); }
    }
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

  // Explicit browser export, distinct from the optional FileProxy cache.
  function downloadRawTransactionJson(row) {
    if (!row || !row.raw || typeof row.raw !== "object") throw new Error("No transaction JSON is loaded.");
    const coin = canonicalCoinForRow(row), txid = String(row.txid || "").replace(/^0x/i,"").toLowerCase();
    if (!TXID_RE.test(txid) || !/^[a-zA-Z0-9]+$/.test(coin) || coin === "unknown") throw new Error("Transaction identity is unavailable.");
    const filename = "chisel-" + coin + "-" + txid + "-raw.json";
    const blob = new Blob([pretty(row.raw) + "\n"], {type:"application/json"});
    const objectUrl = URL.createObjectURL(blob), link = document.createElement("a");
    try {
      link.href = objectUrl; link.download = filename;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(objectUrl); },60000);
    }
    return filename;
  }

  function downloadJsonPayload(row, payload) {
    if (!row || !row.raw || !payload || typeof payload.text !== "string" ||
        !Number.isInteger(payload.output) || payload.output < 0) throw new Error("No JSON payload is available.");
    let parsed;
    try { parsed = JSON.parse(payload.text); }
    catch (_) { throw new Error("The detected JSON payload is no longer valid."); }
    if (!parsed || typeof parsed !== "object") throw new Error("The detected payload is not a JSON object or array.");
    const coin = canonicalCoinForRow(row), txid = String(row.txid || "").replace(/^0x/i, "").toLowerCase();
    if (!TXID_RE.test(txid) || !/^[a-zA-Z0-9]+$/.test(coin) || coin === "unknown") throw new Error("Transaction identity is unavailable.");
    const filename = "chisel-" + coin + "-" + txid + "-output-" + payload.output + "-payload.json";
    const blob = new Blob([payload.text + "\n"], {type:"application/json;charset=utf-8"});
    const objectUrl = URL.createObjectURL(blob), link = document.createElement("a");
    try {
      link.href = objectUrl; link.download = filename;
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(objectUrl); },60000);
    }
    return filename;
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
    if (row.polygonReceiptStatus) flags.push(row.polygonReceiptStatus);
    flags.push(row.raw ? "hydrated" : "summary");
    const annotation = getPortalAnnotation(row);
    if (annotation.note) flags.push("note");
    if (!row.raw) flags.push("txid-only");
    return flags.join(" ");
  }

  const PORTAL_FILTER_IDS = [
    "digibyte", "ravencoin", "litecoin", "bitcoin", "bsv", "dogecoin", "ecash", "evmGomez", "evmJethro", "evmChisel", "evmPolygonThunderword", "other"
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

  function clearPortalSearch() {
    const box = $("#portalEvmWordSearch");
    if (!box) return;
    box.value = "";
    ++exactSearchSequence;
    if (exactSearchTimer !== null) { window.clearTimeout(exactSearchTimer); exactSearchTimer = null; }
    state.portalPage = 1;
    requestPortalRender();
  }

  function getPortalSearchText() {
    const box = $("#portalEvmWordSearch");
    return String(box && box.value ? box.value : "").trim().toLowerCase();
  }

  function rawDecodedForRow(row) {
    const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
    return decodedEvmValue(raw);
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
    if(window.CHISEL_PORTAL_EXPLORE && /^(?:bsv|bsvTestnet)$/.test(canonicalCoinForRow(row))){const f=window.CHISEL_PORTAL_EXPLORE.facts(row);parts.push(f.name,...f.apps,...f.collections,...f.parents.map(p=>p.txid));}
    const text = parts.filter(Boolean).join(" ").toLowerCase();
    if (cache) cache.searchText = text;
    return text;
  }

  function portalRowMatchesSearch(row) {
    const needle = getPortalSearchText();
    if (!needle) return true;
    if(needle.startsWith("app:") && window.CHISEL_PORTAL_EXPLORE){try{return window.CHISEL_PORTAL_EXPLORE.matchesFacet(row,{kind:"app",value:decodeURIComponent(needle.slice(4))});}catch(_){return false;}}
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
    const search = $("#portalEvmWordSearch");
    if (search) search.value = "";
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
      const pin = recentPolygon && Date.now() - recentPolygon.at < 900000 ? recentPolygon.hash.slice(2) : "";
      if (pin) {
        const apin = a.txid === pin && sourceIdForRow(a) === "evmChisel";
        const bpin = b.txid === pin && sourceIdForRow(b) === "evmChisel";
        if (apin !== bpin) return Number(bpin) - Number(apin);
      }
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

  const portalPageSizes = [20, 50, 100];
  const portalPageSizeStorageKey = "chisel.portal.pageSize.v1";

  function getPortalPageSize() {
    if (portalPageSizes.includes(state.portalPageSize)) return state.portalPageSize;
    try {
      const saved = Number(window.localStorage.getItem(portalPageSizeStorageKey));
      if (portalPageSizes.includes(saved)) return (state.portalPageSize = saved);
    } catch (_) {}
    const configured = Math.trunc(Number(configValue("portalPageSize", 20))) || 20;
    return Math.max(1, Math.min(200, configured));
  }

  function setPortalPageSize(value) {
    const size = Number(value);
    if (!portalPageSizes.includes(size)) return;
    const rows = getFilteredPortalRows();
    const offset = (clampPortalPage(rows) - 1) * getPortalPageSize();
    state.portalPageSize = size;
    try { window.localStorage.setItem(portalPageSizeStorageKey, String(size)); } catch (_) {}
    state.portalPage = Math.floor(offset / size) + 1;
    clampPortalPage(rows);
    state.expandedRowKeys = Object.create(null);
    state.selectedRowKey = "";
    state.selectedTxid = "";
    renderPortalRows();
    const list = $("#portalTransactionList");
    if (list) { list.scrollTop = 0; }
  }

  function getPortalPageCount(filteredRows) {
    const rows = Array.isArray(filteredRows) ? filteredRows : getFilteredPortalRows();
    return Math.max(1, Math.ceil(rows.length / getPortalPageSize()));
  }

  function portalTransactionCountLabel(rows) {
    const coin = rows.length && canonicalCoinForRow(rows[0]);
    const ticker = coin && rows.every(function (row) { return canonicalCoinForRow(row) === coin; }) ? tickerForCoin(coin) : "";
    return rows.length + (ticker ? " " + ticker : "") + " transaction" + (rows.length === 1 ? "" : "s");
  }

  function clampPortalPage(filteredRows) {
    const count = getPortalPageCount(filteredRows);
    state.portalPage = Math.max(1, Math.min(count, Math.trunc(Number(state.portalPage)) || 1));
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
    state.portalPage = Math.max(1, Math.trunc(Number(page)) || 1);
    const nextPage = clampPortalPage(filteredRows);
    if (nextPage !== previousPage) {
      state.expandedRowKeys = Object.create(null);
      state.selectedRowKey = "";
      state.selectedTxid = "";
    }
    renderPortalRows();
    const list = $("#portalTransactionList");
    if (list) list.scrollTop = 0;
  }

  function bindPortalPageSwipe() {
    const host = $("#portalListView");
    const list = $("#portalTransactionList");
    if (!host || !list) return;
    let swipe = null;
    const edgeTolerance = 3;

    function active() {
      return document.body.dataset.mode === "portal" && !host.hidden && !(recordView && recordView.active());
    }
    function atBottom(node) {
      return node && node.clientHeight > 0 && node.scrollTop + node.clientHeight >= node.scrollHeight - edgeTolerance;
    }
    function scrollable(node) {
      return node.scrollHeight > node.clientHeight + edgeTolerance && /^(auto|scroll)$/.test(window.getComputedStyle(node).overflowY);
    }
    function bottomScroller(target) {
      // Expanded JSON and other nested readers keep their own scrolling.
      for (let node = target; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        if (scrollable(node)) return node === list && atBottom(list) ? list : null;
      }
      if (scrollable(list) && !atBottom(list)) return null;
      const page = document.scrollingElement || document.documentElement;
      const controls = $("#portalPageControls");
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      // On phones the rows scroll with the document. The page controls mark
      // the end of the results, before the optional storage/settings drawers.
      const end = controls && controls.getBoundingClientRect().bottom;
      const resultsEnd = controls && (list.contains(target) || controls.contains(target)) && end > 0 && end <= viewportHeight + edgeTolerance;
      return atBottom(page) || resultsEnd ? page : null;
    }
    function canAdvance() {
      return active() && state.portalPage < getPortalPageCount();
    }

    host.addEventListener("touchstart", function (event) {
      swipe = null;
      if (event.touches.length !== 1 || !canAdvance()) return;
      const target = event.target;
      if (target.closest("input,select,textarea,video,audio,iframe,canvas,[contenteditable]:not([contenteditable='false']),[role='slider']")) return;
      const scroller = bottomScroller(target);
      if (!scroller) return;
      const touch = event.touches[0];
      swipe = {id: touch.identifier, x: touch.clientX, y: touch.clientY, scroller: scroller,
        context: visibleDateLookupContextToken()};
    }, {passive: true});
    host.addEventListener("touchmove", function (event) {
      if (!swipe) return;
      if (event.touches.length !== 1 || event.touches[0].identifier !== swipe.id) { swipe = null; return; }
      const touch = event.touches[0];
      const dx = Math.abs(touch.clientX - swipe.x);
      const dy = swipe.y - touch.clientY;
      if (dx > 16 && dx > Math.abs(dy)) { swipe = null; return; }
      // Suppress the native overscroll only for an upward gesture that began
      // at the boundary; ordinary scrolling and pinch zoom remain native.
      if (dy > 10 && dy > dx * 1.5 && event.cancelable) event.preventDefault();
    }, {passive: false});
    host.addEventListener("touchend", function (event) {
      const gesture = swipe;
      swipe = null;
      if (!gesture || event.touches.length) return;
      const touch = Array.from(event.changedTouches).find(function (item) { return item.identifier === gesture.id; });
      if (!touch) return;
      const dy = gesture.y - touch.clientY;
      const dx = Math.abs(touch.clientX - gesture.x);
      if (dy < 64 || dy <= dx * 1.5 || !canAdvance() || gesture.context !== visibleDateLookupContextToken()) return;
      if (bottomScroller(event.target) !== gesture.scroller) return;
      if (event.cancelable) event.preventDefault();
      setPortalPage(state.portalPage + 1);
      list.scrollIntoView({block: "start", behavior: "instant"});
    }, {passive: false});
    host.addEventListener("touchcancel", function () { swipe = null; }, {passive: true});
  }

  function resetPortalRowsForNewLoad() {
    snapshotRecentPortalSummaries(false);
    const publications = state.portalRows.filter(function (row) { return !!row.publication || !!row.recentPolygon; });
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
    const filteredRows = Array.isArray(rows) ? rows : getFilteredPortalRows();
    if (!state.portalRows.length || !filteredRows.length) {
      target.replaceChildren();
      return;
    }
    const count = getPortalPageCount(filteredRows);
    const page = clampPortalPage(filteredRows);
    const size = getPortalPageSize();
    const start = ((page - 1) * size) + 1;
    const end = Math.min(filteredRows.length, page * size);

    // Keep interactive controls mounted across live feed and thumbnail updates.
    // The display-only patcher must not reset an in-progress page entry.
    let controls = target.querySelector(".portalPagination");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "portalPagination";
      const label = document.createElement("div");
      label.className = "portalPaginationStatus";
      label.setAttribute("aria-live", "polite");
      const sizes = document.createElement("label");
      sizes.textContent = "Records per page ";
      const select = document.createElement("select");
      select.className = "portalPaginationSize";
      select.setAttribute("aria-label", "Records per page");
      select.addEventListener("change", function () {
        delete jump.dataset.editing;
        setPortalPageSize(select.value);
      });
      sizes.appendChild(select);
      const nav = document.createElement("div");
      nav.className = "portalPaginationNav";
      function addButton(text, title, action, cls) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondaryButton portalPageButton " + cls;
        button.textContent = text;
        button.setAttribute("aria-label", title);
        button.title = title;
        button.addEventListener("click", function () {
          if (cls !== "portalGoPage") delete jump.dataset.editing;
          action();
        });
        nav.appendChild(button);
      }
      addButton("«", "First page", function () { setPortalPage(1); }, "portalFirstPage");
      addButton("‹", "Previous page", function () { setPortalPage(state.portalPage - 1); }, "portalPreviousPage");
      const jump = document.createElement("input");
      jump.type = "number";
      jump.min = "1";
      jump.step = "1";
      jump.inputMode = "numeric";
      jump.className = "portalPaginationJump";
      jump.setAttribute("aria-label", "Go to page number");
      jump.addEventListener("input", function () { jump.dataset.editing = "true"; });
      function go() {
        delete jump.dataset.editing;
        const value = Number(jump.value);
        if (!jump.value.trim() || !Number.isFinite(value)) { jump.value = String(state.portalPage); return; }
        setPortalPage(value);
        jump.value = String(state.portalPage);
      }
      jump.addEventListener("keydown", function (event) {
        if (event.key === "Enter") { event.preventDefault(); go(); }
      });
      nav.appendChild(jump);
      addButton("Go", "Go to page", go, "portalGoPage");
      addButton("›", "Next page", function () { setPortalPage(state.portalPage + 1); }, "portalNextPage");
      addButton("»", "Last page", function () { setPortalPage(getPortalPageCount()); }, "portalLastPage");
      const swipeHint = document.createElement("div");
      swipeHint.className = "help portalPaginationSwipeHint";
      swipeHint.textContent = "Swipe up again at the bottom for the next page.";
      controls.append(label, sizes, nav, swipeHint);
      target.replaceChildren(controls);
    }
    const label = controls.querySelector(".portalPaginationStatus");
    const summary = "Page " + page + " of " + count + " · Records " + start + "–" + end + " of " + filteredRows.length;
    if (label.textContent !== summary) label.textContent = summary;
    const select = controls.querySelector(".portalPaginationSize");
    const options = Array.from(new Set(portalPageSizes.concat(size))).sort(function (a,b) { return a-b; });
    if (Array.from(select.options).map(function (opt) { return Number(opt.value); }).join(",") !== options.join(",")) {
      select.replaceChildren();
      options.forEach(function (value) {
        const opt = document.createElement("option");
        opt.value = String(value);
        opt.textContent = String(value);
        select.appendChild(opt);
      });
    }
    if (select.value !== String(size)) select.value = String(size);
    const jump = controls.querySelector(".portalPaginationJump");
    jump.max = String(count);
    if (document.activeElement !== jump && !jump.dataset.editing && jump.value !== String(page)) jump.value = String(page);
    controls.querySelector(".portalFirstPage").disabled = page <= 1;
    controls.querySelector(".portalPreviousPage").disabled = page <= 1;
    controls.querySelector(".portalNextPage").disabled = page >= count;
    controls.querySelector(".portalLastPage").disabled = page >= count;
    controls.querySelector(".portalPaginationSwipeHint").hidden = page >= count;
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

  function restoreRecentFeed() {
    if (state.recentFeedRestored) return;
    state.recentFeedRestored = true;
    const rows = transactionStore.restoreRecent ? transactionStore.restoreRecent() : [];
    rows.forEach(function (row) {
      const profile = EVM_PROFILES.find(function (item) {
        return row.sourceId === "evm" + item.label.replace(/[^A-Za-z0-9]/g,"");
      }) || (row.sourceId === "evmChisel" ? getEvmProfileById("chisel") : null);
      row.index = profile ? evmIndexEntry(profile) : getCoinIndexByCoinName(row.coin);
      // Stored public relative transaction paths can be read from Apache
      // even when the FileProxy process is stopped.
    });
    if (rows.length) {
      mergeStaticRows(rows);
      setStatus("Showing cached public records; refreshing ledger in background.",false);
    }
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
    prepareEvmRow(merged);
    state.portalSortPending = true;
    if (!state.portalBatchDepth && !(opts && opts.deferSort)) sortPortalRows();
    if (!(opts && opts.silent)) requestPortalRender();
    scheduleRecentPortalSnapshot();

    if (opts && opts.select) {
      selectPortalRow(key).catch(function (error) { setStatus(error.message || String(error), true); });
    }

    return merged;
  }

  // Keep address fan-out bounded; the full set is available on demand.
  function makePortalAddressBrowser(records, indexEntry) {
    const addresses = uniqueBy(records.filter(function (record) {
      return record.line && looksLikeAddressLine(record.line) && record.kind !== "image-chord-line";
    }), function (record) { return record.line; });
    if (!addresses.length) return null;
    const recognized = function (record) { return record.kind !== "address"; };
    addresses.sort(function (a, b) { return Number(recognized(b)) - Number(recognized(a)); });
    const drawer = makeInlineDrawer("Addresses / rabbit trails (" + addresses.length + ")", false);
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Find address, label or type";
    search.setAttribute("aria-label", search.placeholder);
    search.className = "portalAddressSearch";
    const list = document.createElement("div");
    const nav = document.createElement("div");
    nav.className = "portalAddressNav";
    const prev = document.createElement("button");
    const next = document.createElement("button");
    [prev, next].forEach(function (button) {
      button.type = "button";
      button.className = "secondaryButton";
    });
    prev.textContent = "Previous";
    next.textContent = "Next";
    const count = document.createElement("span");
    count.setAttribute("aria-live", "polite");
    nav.append(prev, count, next);
    drawer.append(search, list, nav);
    const pageSize = 8;
    let page = 0;
    function decoded(record) {
      return recognized(record) ? printableText(record.displayText || record.payloadText || "") : "";
    }
    function render() {
      const query = search.value.trim().toLowerCase();
      const matches = addresses.filter(function (record) {
        return !query || [record.line, record.kind, decoded(record)].join(" ").toLowerCase().includes(query);
      });
      page = Math.max(0, Math.min(page, Math.ceil(matches.length / pageSize) - 1));
      const start = page * pageSize;
      list.replaceChildren();
      matches.slice(start, start + pageSize).forEach(function (record) {
        const row = document.createElement("div");
        row.className = "portalLinkRow portalAddressRow";
        const targetEntry = inferIndexForAddress(record.line, indexEntry);
        const label = document.createElement("code");
        const description = decoded(record);
        label.textContent = record.line;
        if (recognized(record)) {
          const annotation = document.createElement("span");
          annotation.className = "portalAddressAnnotation";
          annotation.textContent = record.kind + (description ? ": " + description : "");
          label.appendChild(annotation);
        }
        const drill = makeDrillButton(record.line, targetEntry, description || record.line);
        drill.setAttribute("aria-label", "Drill into " + record.line);
        row.append(label, drill, makeAddressExplorerLink(record.line, targetEntry));
        list.appendChild(row);
      });
      count.textContent = matches.length ? (start + 1) + "–" + Math.min(start + pageSize, matches.length) + " of " + matches.length : "No matching addresses";
      prev.disabled = page === 0;
      next.disabled = start + pageSize >= matches.length;
    }
    search.addEventListener("input", function () { page = 0; render(); });
    prev.onclick = function () { page--; render(); };
    next.onclick = function () { page++; render(); };
    // Do not build any address rows until the user expands the drawer.
    drawer.addEventListener("toggle", function () { if (drawer.open) render(); });
    return drawer;
  }

  function appendPortalInlineLinks(container, semantics, indexEntry, transactionFlowActions) {
    const records = semantics && semantics.records ? semantics.records : [];
    container.replaceChildren();

    // Media URLs are already linked from the record preview above.
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

    const browser = makePortalAddressBrowser(records, indexEntry);
    if (browser) container.appendChild(browser);
    if (transactionFlowActions) {
      const shortcuts = uniqueBy(records.filter(function (record) {
        return record.line && looksLikeAddressLine(record.line) &&
          record.kind !== "address" && record.kind !== "image-chord-line";
      }), function (record) { return record.line; });
      if (shortcuts.length && shortcuts.length <= 3) shortcuts.forEach(function (record) {
        const decoded = printableText(record.displayText || record.payloadText || "");
        const button = makeDrillButton(record.line, inferIndexForAddress(record.line, indexEntry), decoded || record.line);
        button.textContent = record.kind;
        transactionFlowActions.appendChild(button);
      });
    }

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

  function transactionTextUrlRanges(value) {
    const text = String(value || ""), links = [];
    const pattern = /https?:\/\/[^\s'"<>]+/gi;
    let match;
    while ((match = pattern.exec(text))) {
      // A Markdown label and its destination can contain adjacent URLs.
      let url = match[0].split(/\]\(|\]\[/)[0], previous;
      do {
        previous = url;
        url = url.replace(/[.,;!?]+$/, "");
        [["(", ")"], ["[", "]"], ["{", "}"]].forEach(function (pair) {
          while (url.endsWith(pair[1]) && url.split(pair[1]).length > url.split(pair[0]).length) url = url.slice(0, -1);
        });
      } while (url !== previous);
      pattern.lastIndex = match.index + url.length;
      const href = CHISEL.safeWebUrl(decodeHtmlEntities(url), window.location.href);
      if (href) links.push({start: match.index, end: pattern.lastIndex, raw: url, href: href});
    }
    return links;
  }

  function appendLinkedTransactionText(container, value) {
    const text = String(value || ""), links = transactionTextUrlRanges(text);
    if (!links.length) { container.textContent = text; return; }
    let offset = 0;
    function appendText(fragment) {
      if (!fragment) return;
      const span = document.createElement("span"); span.textContent = fragment; container.appendChild(span);
    }
    links.forEach(function (link) {
      appendText(text.slice(offset, link.start));
      const anchor = document.createElement("a");
      setSafeHref(anchor, link.href);
      anchor.className = "isDirectLink portalPayloadLink";
      anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
      anchor.textContent = link.raw;
      anchor.onclick = function (event) { event.stopPropagation(); };
      container.appendChild(anchor);
      offset = link.end;
    });
    appendText(text.slice(offset));
  }

  function extractUrlsFromText(text) {
    return uniqueStrings(transactionTextUrlRanges(text).map(function (link) { return link.raw; }));
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

  function isFacebookLink(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      return host === "facebook.com" || host.endsWith(".facebook.com") ||
        host === "fb.watch" || host === "www.fb.watch";
    } catch (error) { return false; }
  }

  const youtubeMetadataMemory = new Map();
  const youtubeMetadataAttempts = new Map();
  const youtubeMetadataPending = new Set();
  let youtubeMetadataActive = 0;
  function youtubeMetadataId(url) {
    // Only actual YouTube hosts, not arbitrary pages with a v= parameter.
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (!/^(?:(?:www|m|music)\.)?youtube\.com$|^(?:www\.)?youtu\.be$|^(?:www\.)?youtube-nocookie\.com$/.test(host)) return "";
      const id = youtubeIdFromUrl(url);
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
    } catch (_) { return ""; }
  }
  function readPageMetadata(url) {
    try {
      const saved = JSON.parse(localStorage.getItem(pageMetadataKey(url)) || "null");
      if (saved && saved.schema === "chisel-page-metadata-v1") return saved;
      const videoId = youtubeMetadataId(url);
      if (videoId) {
        const canonical = mediaUrlFromYoutubeId(videoId);
        const shared = youtubeMetadataMemory.get(videoId) || JSON.parse(localStorage.getItem(pageMetadataKey(canonical)) || "null");
        if (shared && shared.schema === "chisel-page-metadata-v1") return shared;
      }
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
      image:safeImage && /^https:\/\//i.test(image) &&
        (fields.captureMethod === "facebook-oembed" || /\.(?:png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(image)) ? safeImage : "",
      capturedAt:previous && previous.capturedAt || new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      captureMethod:String(fields.captureMethod || "manual").slice(0,80),
      provider:String(fields.provider || "").slice(0,100),
      authorName:String(fields.authorName || "").slice(0,500),
      metadataSource:String(fields.metadataSource || "").slice(0,2048),
      fetchedAt:String(fields.fetchedAt || "").slice(0,80)
    };
    try { localStorage.setItem(pageMetadataKey(url), JSON.stringify(metadata)); return metadata; }
    catch (error) { return null; }
  }

  async function fetchYoutubePortalMetadata(id) {
    const canonical = mediaUrlFromYoutubeId(id);
    // Direct YouTube first, then a public CORS-capable oEmbed service.
    const endpoints = ["https://www.youtube.com/oembed?format=json&url=", "https://noembed.com/embed?url="];
    for (const endpoint of endpoints) {
      try {
        const source = endpoint + encodeURIComponent(canonical);
        const data = await directPolygonJson(source);
        if (!data || data.error || typeof data.title !== "string" || !data.title.trim() ||
            !/^youtube$/i.test(String(data.provider_name || ""))) continue;
        const fields = {title:data.title,authorName:data.author_name,provider:"YouTube",
          image:youtubeThumbnailUrl(id),captureMethod:"youtube-oembed",metadataSource:source,fetchedAt:new Date().toISOString()};
        const saved = savePageMetadata(canonical,fields,null);
        youtubeMetadataMemory.set(id,saved || Object.assign({schema:"chisel-page-metadata-v1",url:canonical},fields));
        return true;
      } catch (_) {}
    }
    return false;
  }
  function scheduleVisibleYoutubeMetadata(rows) {
    for (const row of rows) {
      if (youtubeMetadataActive >= 3) break;
      if (canonicalCoinForRow(row) !== "evm") continue;
      for (const card of collectEvmMediaCards(row)) {
        if (youtubeMetadataActive >= 3) break;
        const id = youtubeMetadataId(card.url || card.sourceUrl);
        if (!id || youtubeMetadataPending.has(id) ||
            readPageMetadata(card.url || card.sourceUrl) ||
            Date.now() - (youtubeMetadataAttempts.get(id) || 0) < 300000) continue;
        youtubeMetadataAttempts.set(id,Date.now());
        youtubeMetadataPending.add(id);
        youtubeMetadataActive++;
        fetchYoutubePortalMetadata(id).then(function (ok) {
          if (!ok) return;
          state.portalRows.forEach(function (item) {
            if (collectEvmMediaCards(item).some(function (c) { return youtubeMetadataId(c.url || c.sourceUrl) === id; })) invalidatePortalRowCache(item);
          });
        }).catch(function () {}).finally(function () {
          youtubeMetadataActive--; youtubeMetadataPending.delete(id); requestPortalRender();
        });
      }
    }
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
        if (isFacebookLink(url)) {
          const fetchFacebook = document.createElement("button");
          fetchFacebook.type = "button";
          fetchFacebook.className = "secondaryButton";
          fetchFacebook.textContent = saved && saved.captureMethod === "facebook-oembed" ? "Refresh Facebook metadata" : "Fetch Facebook metadata";
          fetchFacebook.onclick = async function () {
            const label = fetchFacebook.textContent;
            fetchFacebook.disabled = true;
            setStatus("Querying Facebook public metadata through FileProxy…", false);
            try {
              const result = await fileProxyJson("/facebook-metadata", {url:url});
              const remote = result && result.metadata || {};
              const metadata = savePageMetadata(url, {
                title:remote.title || remote.authorName || card.title || "",
                description:remote.description || "",
                image:remote.thumbnailUrl || "",
                captureMethod:"facebook-oembed",
                provider:remote.provider || "Facebook",
                authorName:remote.authorName || "",
                metadataSource:remote.metadataSource || "",
                fetchedAt:remote.fetchedAt || ""
              }, saved);
              if (!metadata) throw new Error("Facebook metadata could not be saved in this browser.");
              requestPortalRender();
              setStatus((result.cached ? "Loaded cached" : "Fetched") + " Facebook metadata into FileProxy and this browser.", false);
            } catch (error) {
              setStatus(error && error.message || "Facebook metadata lookup failed.", true);
            } finally {
              fetchFacebook.disabled = false;
              fetchFacebook.textContent = label;
            }
          };
          controls.appendChild(fetchFacebook);
        }
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
    const rawText = summary.cleanText || decoded.message || decoded.text || decoded.body || (decoded.image ? "" : summary.title) || "";
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

    if (decoded.decodeError) block.appendChild(makeInlinePre("Input decoding error", decoded.decodeError, false));
    if (decoded.message || decoded.body) block.appendChild(makeInlinePre("Original ledger message", decoded.message || decoded.body, false));

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
      if (asset.inline) img.src = asset.path;
      else setPortalAssetImage(img, asset.path, row);
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

  function appendPortalInlineImage(container, imageLines, inlineImage) {
    const lines = getImageLines(imageLines || []);
    if (!lines.length && !inlineImage) return null;

    const block = document.createElement("div");
    block.className = "portalInlineImageBlock";

    const title = document.createElement("div");
    title.className = "stepTitle";
    title.textContent = inlineImage ? "Embedded " + inlineImage.mime.slice(6).toUpperCase() + " image" : "Base57 image";
    block.appendChild(title);

    if (inlineImage) {
      const image = document.createElement("img");
      image.className = "portalInlineBase64Image";
      image.alt = "Image embedded in this BSV transaction";
      image.src = inlineImage.src;
      block.appendChild(image);
      const caption = document.createElement("p");
      caption.className = "muted";
      caption.textContent = inlineImage.mime + " · " + inlineImage.bytes.toLocaleString() + " bytes · Base64 data URI";
      block.appendChild(caption);
      container.appendChild(block);
      return block;
    }

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
      noteFunction.render(view.runtime, row, annotation, {onEngage: function (action) {
        recordPortalInteraction("engage", row, {action: action});
      }, loadTransaction: async function (txid, rawUrl) {
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
        (["evmGomez", "evmJethro", "evmChisel", "evmPolygonThunderword"].includes(sourceId) ? "137" : "")
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

    const open = document.createElement("button");
    open.type = "button";
    open.className = "portalTransactionIdTrigger";
    open.setAttribute("aria-label", "Show chain-qualified transaction ID");
    open.title = "Show chain-qualified transaction ID";
    open.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.75 3.75h6.5v6.5h-6.5zM13.75 3.75h6.5v6.5h-6.5zM3.75 13.75h6.5v6.5h-6.5z"/><path d="M13.75 13.75h2.5v2.5h-2.5zM18 13.75h2.25M18 18h2.25v2.25M13.75 18v2.25"/></svg>';

    const dialog = document.createElement("dialog");
    dialog.className = "portalTransactionIdDialog";
    dialog.setAttribute("aria-label", "Chain-qualified transaction ID");

    const heading = document.createElement("div");
    heading.className = "portalTransactionIdDialogHeading";
    const label = document.createElement("strong");
    label.textContent = "Chain-qualified transaction ID";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "portalTransactionIdClose";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.onclick = function () { if (dialog.close) dialog.close(); else dialog.removeAttribute("open"); };
    heading.appendChild(label);
    heading.appendChild(close);
    dialog.appendChild(heading);

    const qr = document.createElement("button");
    qr.type = "button";
    qr.className = "portalTransactionQrCode";
    qr.setAttribute("aria-label", "Copy chain-qualified transaction ID");
    qr.title = "Copy transaction ID";
    if (typeof window.QRCode === "function") {
      try {
        new window.QRCode(qr, {
          text: qualified,
          width: 168,
          height: 168,
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

    const value = document.createElement("code");
    value.className = "portalTransactionIdValue";
    value.textContent = qualified;

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "secondaryButton portalTransactionIdCopy";
    copy.textContent = "COPY ID";

    async function copyQualifiedId(event) {
      event.preventDefault();
      event.stopPropagation();
      try {
        if (!window.navigator.clipboard || !window.navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
        await window.navigator.clipboard.writeText(qualified);
        setStatus("Copied chain-qualified transaction ID.", false);
        copy.textContent = "COPIED";
      } catch (error) {
        if (typeof window.prompt === "function") window.prompt("Copy qualified transaction ID:", qualified);
      }
    }
    qr.onclick = copyQualifiedId;
    copy.onclick = copyQualifiedId;

    dialog.appendChild(qr);
    dialog.appendChild(value);
    dialog.appendChild(copy);
    open.onclick = function () {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
    };
    card.appendChild(open);
    card.appendChild(dialog);
    container.appendChild(card);
    return card;
  }

  function publicInteractionUrl(value, data) {
    try {
      const safe = CHISEL.safeWebUrl(value, window.location.href);
      if (!safe) return "";
      const url = new URL(safe);
      if (!data) {
        url.hash = "";
        for (const key of url.searchParams.keys()) if (/token|secret|password|authorization|api.?key|credential|wif/i.test(key)) return "";
      }
      return window.CHISEL_INTERACTIONS.publicUrl(url.href, data);
    } catch (_) { return ""; }
  }

  function describeInteractionRecord(row) {
    const coin = canonicalCoinForRow(row), summary = row.summary || {};
    const card = safeArray(summary.mediaCards)[0] || {};
    const read = annotationReads.get(portalAnnotationKey(row)), annotation = getPortalAnnotation(row);
    // Automatic history never publishes a browser-only note or its metadata.
    const shared = read && read.source === "FileProxy" && read.remoteUpdatedAt === annotation.updatedAt ? annotation : null;
    const title = printableText(shared && shared.metadata.title || card.title || summary.title || "transaction " + shortTxid(row.txid));
    const synopsis = printableText(card.description || card.text || shared && shared.note || summary.cleanText || opReturnTextForRow(row));
    return {subject: {coin: coin, txid: row.txid.toLowerCase().replace(/^0x/, ""),
      sourceId: coin === "evm" ? sourceIdForRow(row) : "", chainId: coin === "evm" ? String(row.index && row.index.chainId || "137") : "", dataUrl: recordDataUrl(row)},
      title: title.includes("\ufffd") ? "transaction " + shortTxid(row.txid) : title,
      synopsis: synopsis.includes("\ufffd") ? opReturnTextForRow(row) : synopsis,
      url: publicInteractionUrl(summary.primaryUrl || card.url || safeArray(summary.opReturnUrls)[0] || "")};
  }

  function recordPortalInteraction(kind, row, options) {
    if (row && row.draftRecord || !window.CHISEL_INTERACTIONS) return;
    try {
      const record = row ? describeInteractionRecord(row) : null;
      if (record && kind === "select" && interactionView && typeof interactionView.rememberSelection === "function") {
        interactionView.rememberSelection(record);
      }
      const detail = Object.assign({at: new Date().toISOString(), mode: document.body.dataset.mode || "portal"}, options || {});
      if (record && detail.url) record.url = publicInteractionUrl(detail.url);
      if (interactionClient) interactionClient.record(kind, record, detail).catch(function (error) {
        if (window.CHISEL_DIAGNOSTICS) window.CHISEL_DIAGNOSTICS.record("history", error.message || String(error), {kind: kind});
      });
      else if ($("#portalViewingNow") && deferredInteractions.length < 100) deferredInteractions.push({kind: kind, record: record, detail: detail});
    } catch (_) { /* History must not interrupt selection or media interaction. */ }
  }

  function initializePortalInteractions() {
    if (interactionClient || !$("#portalViewingNow") || !window.CHISEL_INTERACTIONS || !window.CHISEL_INTERACTIONS_UI) return;
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") return;
    interactionClient = window.CHISEL_INTERACTIONS.createClient({baseUrl: getFileProxyUrl,
      readStorage: function (key) { return window.localStorage.getItem(key); },
      writeStorage: function (key, value) { window.localStorage.setItem(key, value); },
      signer: function () { return window.CHISEL_COMMENT_SIGNER; }, crypto: CHISEL,
      request: function (base, path, options) {
        return staticTransport.request(base + path, options || {}, async function (response) {
          let result;
          try { result = await response.json(); } catch (_) { throw new Error("History API returned no JSON (HTTP " + response.status + ")."); }
          if (!response.ok || !result || result.ok === false) throw new Error("History API HTTP " + response.status + ": " + (result && result.error || "unavailable"));
          return result;
        }, fileProxyReadTimeout());
      }
    });
    interactionView = window.CHISEL_INTERACTIONS_UI.create({client: interactionClient, document: document,
      open: function (subject) {
        try {
          window.CHISEL_INTERACTIONS.subjectKey(subject);
          let row = findPortalRecord(subject);
          if (!row) {
            const profile = EVM_PROFILES.find(function (item) { return "evm" + item.label === subject.sourceId; });
            const index = subject.coin === "evm" ? Object.assign({}, profile ? evmIndexEntry(profile) : {}, {coin: "evm", chainId: subject.chainId}) : getCoinIndexByCoinName(subject.coin);
            row = upsertPortalRow({coin: subject.coin, txid: subject.txid, sourceId: subject.sourceId, index: index,
              staticRawUrl: subject.dataUrl, summary: {title: "transaction " + shortTxid(subject.txid)}}, {silent: true});
          }
          openPortalRecord(row);
        } catch (error) { setStatus(error.message || String(error), true); }
      }});
    interactionView.start();
    deferredInteractions.splice(0).forEach(function (event) {
      if (event.kind === "select" && event.record) interactionView.rememberSelection(event.record);
      interactionClient.record(event.kind, event.record, event.detail).catch(function () {});
    });
    document.addEventListener("click", function (event) {
      const link = event.target.closest && event.target.closest("a");
      if (!link || !link.matches(".portalEvmMediaCard, .portalStreamThumb, .isDirectLink, .portalRecordTarget, .portalInlineLinks a")) return;
      const owner = link.closest(".portalStreamItem, #portalRecordContent"), row = owner && state.portalRowKeys[owner.dataset.key];
      if (row) recordPortalInteraction("engage", row, {action: "open_media", url: link.href});
    }, {capture: true});
    window.addEventListener("chisel:record-engagement", function (event) {
      const detail = event.detail || {}, row = state.portalRowKeys[detail.key];
      if (row) recordPortalInteraction("engage", row, {action: String(detail.action || "engage").slice(0, 48)});
    });
    requestPortalRender();
  }

  function portalDisplayStamp(row) {
    return JSON.stringify([bsvThumbnailForRow(row), row.raw, row.summary, row.publication, row.index, row.localPath,
      row.rawSourceUrl, row.blockTime, row.confirmed, row.ledgerObserved, row.loadError, row.dateLookupError,
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
    container.dataset.key = row.key;
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
    updatePortalDetailPart(view, "jsonPayload", stamp, function (target) { appendPortalJsonPayloadDetails(target, row); }, true);
    if (!view.parts.notes) {
      const notes = document.createElement("div"); notes.style.display = "contents";
      notes.dataset.portalPart = "notes"; container.appendChild(notes); view.parts.notes = {node: notes};
    }
    appendPortalAnnotationEditor(view.parts.notes.node, row);
    if (interactionView) {
      if (!view.parts.comments) {
        const comments = document.createElement("div"); comments.style.display = "contents";
        container.appendChild(comments); view.parts.comments = {node: comments};
      }
      // Comments/history are optional. A rejected identity or unavailable
      // interaction renderer must not suppress the ledger record itself.
      try {
        interactionView.comments(view.parts.comments.node, describeInteractionRecord(row));
      } catch (error) {
        view.parts.comments.node.textContent = "Comments unavailable for this record.";
        console.warn("Portal comments:", error);
      }
    }
    updatePortalDetailPart(view, "body", JSON.stringify([row.raw, row.summary, row.loadError,
      !!state.pendingHydration[row.key], row.index, state.personalAccount, getPortalAnnotation(row).metadata,
      getStaticDataSources(), getFileProxyUrl(), state.fileProxyAvailable,
      configValue("inlineImageScale", 12), configValue("inlineImageExpandedScale", 12)]),
      function (target) { appendPortalInlineBody(target, row, options); });
  }

  function appendPortalInlineHeader(container, row, options) {
    const summary = row.summary || makeBasicSummary(row.txid, row.raw || row, row.index);
    const header = document.createElement("div");
    header.className = "portalInlineHeader";

    const title = document.createElement("h4");
    title.textContent = displayTitleForRow(row);
    const bsv = /^(?:bsv|bsvTestnet)$/.test(canonicalCoinForRow(row));
    const inlineImage = bsvInlineImageForRow(row);
    const interpreted=bsv && window.CHISEL_PORTAL_EXPLORE;
    const post=twetchForRow(row);
    const treechat=treechatForRow(row);
    const bsvType=bsv&&window.CHISEL_BSV_MEDIA&&row.raw?window.CHISEL_BSV_MEDIA.classify(row.raw):null;
    const jsonPayloads=opReturnJsonPayloadsForRow(row);
    if(post)title.textContent=options&&options.recordPage?"Transaction details":interpreted.twetchTitle(post);
    else if(interpreted && !getPortalAnnotation(row).metadata.title)title.textContent=interpreted.facts(row).name||title.textContent;
    if (inlineImage) title.textContent = "Embedded " + inlineImage.mime.slice(6).toUpperCase() + " image";

    const tx = document.createElement("code");
    tx.textContent = row.txid || "";

    const meta = document.createElement("p");
    meta.className = "muted";
    meta.textContent = [
      summary.blockHeight ? "block " + summary.blockHeight : "",
      window.CHISEL_PORTAL_DISCOVERY ? window.CHISEL_PORTAL_DISCOVERY.recordLabel(summary) : "",
      jsonPayloads.map(function (payload) { return "JSON payload · output " + payload.output; }).join(" · "),
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
      primary.classList.add("portalRecordTarget");
      setSafeHref(primary, primaryTarget);
      primary.target = "_blank";
      primary.rel = "noopener noreferrer";
      primary.textContent = isNetflixLink(primaryTarget) ? "original Netflix URL (may not resolve)" : "open record target";
      actions.appendChild(primary);
    }
    if(treechat&&treechat.url){
      const openTreechat=document.createElement("a");openTreechat.className="secondaryButton";openTreechat.textContent="OPEN IN TREECHAT";
      setSafeHref(openTreechat,treechat.url);openTreechat.target="_blank";openTreechat.rel="noopener noreferrer";actions.appendChild(openTreechat);
    }
    if(bsvType&&bsvType.id==="indelible-drift-v1"){
      const project=document.createElement("a");project.className="secondaryButton";project.textContent="INDELIBLE · THE DRIFT";
      setSafeHref(project,"https://indelible.one/drift/");project.target="_blank";project.rel="noopener noreferrer";actions.appendChild(project);
    }

    if (canonicalCoinForRow(row) !== "litecoin") {
      const verifyUrl = rowExplorerUrl(row);
      if (verifyUrl) {
        const verify = document.createElement("a");
        verify.className = "secondaryButton";
        setSafeHref(verify, verifyUrl);
        verify.target = "_blank";
        verify.rel = "noopener noreferrer";
        verify.textContent = "verify tx";
        actions.appendChild(verify);
      }
    }

    if (row.raw) {
      const save = document.createElement("button");
      save.type = "button";
      save.className = "secondaryButton";
      save.textContent = "save transaction JSON";
      save.title = "Download the original transaction JSON to this device";
      const feedback = document.createElement("span");
      feedback.className = "muted";
      feedback.setAttribute("role","status");
      save.onclick = function (event) {
        event.preventDefault();
        event.stopPropagation();
        try {
          const filename = downloadRawTransactionJson(row);
          feedback.textContent = "Download requested: " + filename;
          setStatus(feedback.textContent,false);
        } catch (error) {
          feedback.textContent = "Download failed: " + (error.message || String(error));
          setStatus(feedback.textContent,true);
        }
      };
      actions.appendChild(save);
      const copy = document.createElement("button");
      copy.type = "button"; copy.className = "secondaryButton"; copy.textContent = "copy transaction JSON";
      copy.onclick = function (event) {
        event.preventDefault(); event.stopPropagation();
        copyPortalText(pretty(row.raw),copy).then(function () {
          feedback.textContent = "Raw JSON copied.";
        }).catch(function (error) {
          feedback.textContent = error.message || String(error);
        });
      };
      actions.appendChild(copy);
      if (canonicalCoinForRow(row) !== "evm") {
        const cache = document.createElement("button");
        cache.type = "button"; cache.className = "secondaryButton"; cache.textContent = "cache on FileProxy";
        cache.onclick = function (event) {
          event.preventDefault(); event.stopPropagation();
          cache.disabled = true; feedback.textContent = "Saving to FileProxy…";
          saveTransactionToFileProxy(row.raw,row.txid,rowIndexEntry(row)).then(function (saved) {
            row.localPath = saved.path || row.localPath;
            feedback.textContent = "FileProxy saved: " + (saved.path || saved.filename || row.txid);
            requestPortalRender();
          }).catch(function (error) {
            feedback.textContent = "FileProxy save failed: " + (error.message || String(error)) + ". Save JSON still works.";
            setStatus(feedback.textContent,true);
          }).finally(function () { cache.disabled = false; });
        };
        actions.appendChild(cache);
      }
      actions.appendChild(feedback);
    }

    header.appendChild(title);
    if(interpreted){
      if(!post)interpreted.interpretationLines(row).forEach(line=>{const info=document.createElement("p");info.textContent=line;header.appendChild(info);});
      if(!(options&&options.recordPage)){
        Array.from(new Set(interpreted.facts(row).parents.map(p=>p.txid))).slice(0,4).forEach(txid=>{
          const a=document.createElement("a");a.className="secondaryButton";a.textContent="Open parent "+txid.slice(0,12)+"…";
          const coin=canonicalCoinForRow(row);a.href=relatedRecordUrl(coin,txid);
          a.onclick=event=>{if(event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();openRelatedRecord(coin,txid);};
          header.appendChild(a);
        });
      }
    }
    header.appendChild(tx);
    if (meta.textContent) header.appendChild(meta);
    header.appendChild(actions);
    container.appendChild(header);

  }

  function appendPortalJsonPayloadDetails(container, row) {
    const payloads = opReturnJsonPayloadsForRow(row);
    payloads.forEach(function (payload) {
      const section = document.createElement("section");
      section.className = "portalInterpretedRecord portalJsonPayload";
      const heading = document.createElement("h5");
      heading.textContent = "JSON payload · output " + payload.output;
      section.appendChild(heading);
      const meta = document.createElement("p");
      meta.className = "muted";
      meta.textContent = (Array.isArray(payload.value) ? "JSON array" : "JSON object") + " · " + payload.bytes.toLocaleString() + " bytes";
      section.appendChild(meta);
      const actions = document.createElement("div");
      actions.className = "actions";
      const download = document.createElement("button");
      download.type = "button";
      download.className = "secondaryButton";
      download.textContent = "download payload JSON";
      download.title = "Download only the JSON carried in this output, without the transaction wrapper";
      const status = document.createElement("span");
      status.className = "muted";
      status.setAttribute("role", "status");
      download.onclick = function (event) {
        event.preventDefault(); event.stopPropagation();
        try {
          status.textContent = "Download requested: " + downloadJsonPayload(row, payload);
        } catch (error) {
          status.textContent = "Download failed: " + (error.message || String(error));
        }
      };
      actions.appendChild(download);
      actions.appendChild(status);
      section.appendChild(actions);
      const view = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "View JSON payload";
      view.appendChild(summary);
      const pre = document.createElement("pre");
      pre.className = "json";
      pre.textContent = pretty(payload.value);
      view.appendChild(pre);
      section.appendChild(view);
      container.appendChild(section);
    });
  }

  function twetchForRow(row) {
    const explore=window.CHISEL_PORTAL_EXPLORE;
    return explore ? explore.twetchForRow(row) : null;
  }
  let pendingTwetchFeed=false;
  function showTwetchFeed() {
    if(recordView && recordView.active()){pendingTwetchFeed=true;recordView.back();return;}
    const box=$("#portalEvmWordSearch");
    if(!box)return;
    PORTAL_FILTER_IDS.forEach(id=>setPortalFilterValue(id,true));
    box.value="app:twetch";state.portalPage=1;requestPortalRender();
  }
  const encryptedBsvCache=new WeakMap();
  function encryptedBsvFilesForRow(row) {
    const api=window.CHISEL_BSV_MEDIA;
    if(!row||!api||!/^(?:bsv|bsvTestnet)$/.test(canonicalCoinForRow(row))) return [];
    if(!row.raw) return safeArray(row.summary && row.summary.files).filter(f=>f.encrypted);
    if(!encryptedBsvCache.has(row.raw)){
      const tx=row.raw.tx||row.raw;
      encryptedBsvCache.set(row.raw,safeArray(tx.vout||tx.outputs).flatMap(api.encryptedFiles));
    }
    return encryptedBsvCache.get(row.raw);
  }
  function appendEncryptedBsvDetails(container,row,files) {
    const api=window.CHISEL_BSV_MEDIA;
    files.forEach(file=>{
      const section=document.createElement("section");section.className="portalInterpretedRecord";
      const title=document.createElement("div");title.className="stepTitle";title.textContent=file.name;section.appendChild(title);
      const details=document.createElement("p"),meta=file.metadata||{};
      details.textContent=[api.encryptedLabel(file),file.protocol,meta.application,
        "Output "+file.output,file.bytes.toLocaleString()+" bytes envelope",
        meta.componentBytes && meta.componentBytes.length===3?"Base64 components: "+meta.componentBytes.join(" / ")+" bytes":"",
        Array.isArray(meta.eventSenders)&&meta.eventSenders.length?"Sender public key"+(meta.eventSenders.length===1?"":"s")+": "+meta.eventSenders.join(", "):"",
        Array.isArray(meta.eventDetails)?meta.eventDetails.map((event,index)=>"Event "+(index+1)+" · wrapped-key bytes "+event.wrapBytes.join("/")+" · ciphertext parts "+event.componentBytes.join("/")+" bytes · signature "+event.signatureBytes+" bytes").join("; "):"",
        meta.signatureVerified===false?"Signature present; not verified":"",
        meta.hasOwnerWrap?"Owner key wrap present":"",
        "Encryption algorithm not verified; plaintext not available."].filter(Boolean).join(" · ");
      section.appendChild(details);
      const button=document.createElement("button");button.type="button";button.className="secondaryButton";button.textContent="Download encrypted envelope";
      const status=document.createElement("p");status.className="muted";status.setAttribute("role","status");
      button.onclick=async event=>{
        event.preventDefault();event.stopPropagation();button.disabled=true;
        try{
          let full=file;
          if(!full.complete) full=await api.loadFile(canonicalCoinForRow(row),row.txid,file,window.fetch.bind(window),AbortSignal.timeout(30000));
          if(!full.data||!full.complete||full.data.length!==full.bytes) throw Error("Complete envelope not available.");
          const url=URL.createObjectURL(new Blob([full.data],{type:"application/json"}));
          const link=document.createElement("a");link.href=url;link.download="bsv-"+row.txid+"-"+file.output+"-encrypted.json";
          document.body.appendChild(link);try{link.click();}finally{link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);}
          status.textContent="Download requested: "+full.data.length.toLocaleString()+" bytes.";
        }catch(error){status.textContent="Download failed: "+(error.message||String(error));}
        finally{button.disabled=false;}
      };
      section.appendChild(button);section.appendChild(status);container.appendChild(section);
    });
  }
  function appendTreechatCaptureDetails(container,post) {
    if(!post)return;
    const section=document.createElement("section");section.className="portalInterpretedRecord";
    const title=document.createElement("div");title.className="stepTitle";title.textContent="Treechat post";section.appendChild(title);
    const summary=document.createElement("p");summary.textContent=[post.captureTitle||"Post title not present in capture",
      post.payloadBytes.toLocaleString()+" bytes · "+(post.complete?"complete":"partial preview"),
      post.warningCode?"source returned HTTP "+post.warningCode:""].filter(Boolean).join(" · ");section.appendChild(summary);
    const actions=document.createElement("div");actions.className="actions";
    const treechatLink=document.createElement("a");treechatLink.className="secondaryButton";treechatLink.textContent="OPEN IN TREECHAT";
    setSafeHref(treechatLink,post.url);treechatLink.target="_blank";treechatLink.rel="noopener noreferrer";actions.appendChild(treechatLink);
    if(post.sourceUrl){
      const source=document.createElement("a");source.className="secondaryButton";source.textContent="OPEN SOURCE PAGE";
      setSafeHref(source,post.sourceUrl);source.target="_blank";source.rel="noopener noreferrer";actions.appendChild(source);
    }
    section.appendChild(actions);
    const id=document.createElement("p");id.className="muted";id.textContent="Treechat post ID · "+post.postId;section.appendChild(id);
    if(post.text){
      const disclosure=document.createElement("details");disclosure.className="portalInlineDrawer";
      const label=document.createElement("summary");label.textContent="Captured page text";disclosure.appendChild(label);
      const pre=document.createElement("pre");pre.className="json";pre.textContent=post.text;disclosure.appendChild(pre);section.appendChild(disclosure);
    }
    container.appendChild(section);
  }
  function appendPortalInlineBody(container, row, options) {
    // Linked media leads the expanded record. Ledger flow and supporting
    // interpretation remain available immediately below it.
    const ledgerFirst = canonicalCoinForRow(row) === "litecoin" &&
      !!row.raw && !!portalFinanceForRow(row);
    const transactionFlowActions = ledgerFirst ? appendPortalFinanceDetails(container, row) : null;
    // A decoded subject and SHA-256 are primary record content, not hidden
    // under the optional raw JSON / annotations disclosure.
    const frontRecord = ledgerFirst ? portalRecordBehaviorForRow(row) : null;
    const subjectVisible = !!(frontRecord && frontRecord.behavior.id === "subject-reference");
    if (subjectVisible) frontRecord.behavior.renderExpanded(container, frontRecord.record, row);

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
    const toolbar = options && options.recordPage && document.querySelector(".portalRecordToolbar");
    if (toolbar) {
      const identity = qualifiedTransactionIdForRow(row), existing = toolbar.querySelector(".portalTransactionQr");
      // Keep the same button and open dialog through background hydration.
      if (existing && existing.dataset.transactionId !== identity) existing.remove();
      if (identity && !toolbar.querySelector(".portalTransactionQr")) {
        const control = appendPortalTransactionQr(toolbar, row);
        control.dataset.transactionId = identity;
        toolbar.insertBefore(control, document.querySelector("#portalRecordCopyLink"));
      }
    } else appendPortalTransactionQr(supportTarget, row);
    if (!subjectVisible) appendPortalInterpretedRecord(supportTarget, row);
    appendTreechatCaptureDetails(supportTarget,treechatForRow(row));


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

    const summaryInlineImage = !row.raw ? bsvInlineImageForRow(row) : null;
    if (summaryInlineImage) appendPortalInlineImage(supportTarget, [], summaryInlineImage);

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

    if (!(options && options.recordPage) && window.CHISEL_PORTAL_EXPLORE) window.CHISEL_PORTAL_EXPLORE.appendInlineBsvMedia(supportTarget,row);
    const encryptedFiles=encryptedBsvFilesForRow(row);
    if(encryptedFiles.length) appendEncryptedBsvDetails(supportTarget,row,encryptedFiles);
    const lines = extractLines(row.raw);
    const imageLines = getImageLines(lines);
    const bsvInlineImage = bsvInlineImageForRow(row);
    const hasInlineImage = imageLines.length > 0 || !!bsvInlineImage;
    const semantics = buildSemantics(row.raw, lines);
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
      appendPortalInlineImage(mediaColumn, imageLines, bsvInlineImage);
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
    if (appendPortalInlineLinks(links, semantics, rowIndexEntry(row), transactionFlowActions)) {
      const linksTitle = document.createElement("div");
      linksTitle.className = "stepTitle";
      linksTitle.textContent = "Links and addresses";
      dataContainer.appendChild(linksTitle);
      dataContainer.appendChild(links);
    }

    if (!encryptedFiles.length) dataContainer.appendChild(makeInlinePre("Raw transaction JSON", pretty(row.raw), false));

    if (appendDataContainer) supportTarget.appendChild(dataContainer);
  }

  function isLocalPortalRow(row) {
    return !!(row && (row.localPath || row.discoverySource === "fileProxy"));
  }

  function rowCanHydrate(row) {
    if (!row || row.raw) return false;
    if (row.staticRawPath || row.staticRawUrl || sourceIdForRow(row) === "evmChisel") return true;
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
      // Local JSON may contain reported confirmations, but only a direct
      // ledger provider response can establish this display transition.
      const liveTx = loaded.source === "live" && extractTxid(loaded.json).toLowerCase() === String(row.txid).toLowerCase();
      const tx = loaded.json && (loaded.json.tx || loaded.json) || {};
      const confirmed = !!(tx.status && tx.status.confirmed === true || tx.confirmed === true ||
        Number(tx.confirmations) > 0 || Number(tx.block_height || tx.blockHeight) > 0);
      upsertPortalRow(row, { silent: true, deferSort: !!(opts && opts.deferSort),
        ledgerObserved: liveTx && confirmed });
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
    recordPortalInteraction("select", row, {action: "expand"});
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
    prepareEvmRow(row);
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
    const ledgerState = ledgerDisplayState(row);
    item.className = "portalStreamItem" +
      (expanded ? " isExpanded" : "") +
      (ledgerState === "seen" ? " isLedgerSeen" : ledgerState === "awaiting-ledger" ? " isAwaitingLedger" : "") +
      (isPersonal ? " isPersonal" : "") +
      (recordBehavior ? " hasInterpretedRecord behavior-" + recordBehavior.behavior.id : "");
    item.dataset.key = row.key;
    if (ledgerState) {
      item.dataset.ledgerState = ledgerState;
      item.setAttribute("aria-label", row.publication
        ? (ledgerState === "seen" ? "Transaction observed by ledger" : "Transaction awaiting ledger read")
        : (ledgerState === "seen" ? "Transaction confirmed by ledger read" : "Saved transaction; not yet confirmed by ledger read"));
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
    if (recordLink) {
      line.classList.add("isRecordLink");
      line.onclick = function (event) {
        if (!viewApi.shouldOpenRecordRow(event, line.ownerDocument)) return;
        event.preventDefault();
        openPortalRecord(row);
      };
    }
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
    const rawOpText = opReturnTextForRow(row);
    const bsvInlineImage = bsvInlineImageForRow(row);
    const opText = bsvInlineImage
      ? "Embedded " + bsvInlineImage.mime.slice(6).toUpperCase() + " image · " + bsvInlineImage.bytes.toLocaleString() + " bytes"
      : rawOpText;
    const post=twetchForRow(row);
    const treechat=treechatForRow(row);
    const genericTitle = /^(?:transaction(?:\s+[0-9a-f…]+)?|untitled transaction)$/i.test(titleText.trim());
    const compactGeneric = !primaryUrl && !opText && genericTitle && thumb.classList.contains("isEmpty");
    if (compactGeneric) item.classList.add("isCompactGeneric");
    titleWrap.title = bsvInlineImage
      ? opText
      : compactGeneric ? (recordLink ? "Open Chisel record page" : "Expand for transaction details") : titleText;
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
      titleWrap.textContent = post ? window.CHISEL_PORTAL_EXPLORE.twetchTitle(post) : genericTitle || bsvInlineImage || titleText === truncateText(opText, 96) ? "" : titleText;
    }
    if (appendCollapsedMediaMetadata(titleWrap, row)) item.classList.add("hasMediaMetadata");
    if (!post && window.CHISEL_PORTAL_DISCOVERY && canonicalCoinForRow(row) === "bsv") {
      const facts = document.createElement("span"); facts.className = "portalStreamOpReturn";
      facts.textContent = bsvInlineImage
        ? "BSV image · " + bsvInlineImage.mime.slice(6).toUpperCase() + " · " + bsvInlineImage.bytes.toLocaleString() + " bytes"
        : window.CHISEL_PORTAL_DISCOVERY.recordLabel(row.summary);
      titleWrap.appendChild(facts);
    }
    if(window.CHISEL_PORTAL_EXPLORE && /^(?:bsv|bsvTestnet)$/.test(canonicalCoinForRow(row))){
      if(post)window.CHISEL_PORTAL_EXPLORE.appendTwetchMenu(titleWrap,row,showTwetchFeed);
      window.CHISEL_PORTAL_EXPLORE.facts(row).apps.filter(app=>!["twetch","treechat","indelible"].includes(app.toLowerCase())).forEach(app=>{
        const b=document.createElement("button");b.type="button";b.className="secondaryButton";b.textContent="Explore "+app;
        b.onclick=event=>{event.preventDefault();event.stopPropagation();const box=$("#portalEvmWordSearch");if(box){box.value="app:"+encodeURIComponent(app.toLowerCase());state.portalPage=1;requestPortalRender();}};
        titleWrap.appendChild(b);
      });
    }
    if(treechat&&treechat.url){
      const link=document.createElement("a");link.className="secondaryButton";link.textContent="Treechat";link.title="Open the exact Treechat post";
      setSafeHref(link,treechat.url);link.target="_blank";link.rel="noopener noreferrer";
      link.onclick=event=>event.stopPropagation();titleWrap.appendChild(link);
    }
    const bsvType=canonicalCoinForRow(row)==="bsv"&&row.raw&&window.CHISEL_BSV_MEDIA?window.CHISEL_BSV_MEDIA.classify(row.raw):null;
    if(bsvType&&bsvType.id==="indelible-drift-v1"){
      const link=document.createElement("a");link.className="secondaryButton";link.textContent="Indelible";link.title="Project: Indelible · The Drift";
      setSafeHref(link,"https://indelible.one/drift/");link.target="_blank";link.rel="noopener noreferrer";
      link.onclick=event=>event.stopPropagation();titleWrap.appendChild(link);
    }
    if (opText && !post) {
      const payload = document.createElement("span");
      payload.className = "portalStreamOpReturn";
      appendLinkedTransactionText(payload, opText);
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
    return [state.portalLoadGeneration, state.portalRows.length, state.portalPage, getPortalPageSize(), getPortalSearchText(), filters].join("|");
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

  let visibleEvmLookupScheduled = false;
  const attemptedEvmLookup = new WeakMap();
  function scheduleVisiblePortalEvm(pageRows) {
    if (!configBool("backgroundHydrateTransactions", true) || visibleEvmLookupScheduled) return;
    const candidates = safeArray(pageRows).filter(function (row) {
      return canonicalCoinForRow(row) === "evm" && !row.raw && rowCanHydrate(row) &&
        !state.pendingHydration[row.key] && Date.now() - (attemptedEvmLookup.get(row) || 0) > 30000;
    });
    if (!candidates.length) return;
    visibleEvmLookupScheduled = true;
    const generation = state.portalLoadGeneration;
    window.setTimeout(function () {
      (async function () {
        for (let offset = 0; offset < candidates.length; offset += 4) {
          if (generation !== state.portalLoadGeneration) return;
          await Promise.all(candidates.slice(offset, offset + 4).map(async function (row) {
            if (row.raw || !isVisiblePortalRow(row)) return;
            attemptedEvmLookup.set(row, Date.now());
            await hydratePortalRow(row.key, {quiet: true, silent: true, suppressRender: true, deferSort: true, deferCache: true});
          }));
          requestPortalRender();
          await yieldPortalThread();
        }
      })().catch(function (error) { console.warn("Visible EVM input lookup failed:", error); })
        .finally(function () { visibleEvmLookupScheduled = false; requestPortalRender(); });
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
      // The HTML shell can already show real cached/bundled summaries.
      // Keep it in place until the full feed has actual rows.
      if (list.querySelector("[data-portal-boot-preview]")) return;
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
    setText("#portalExplorerCount", portalTransactionCountLabel(filteredRows) + " · Page " + page + " of " + getPortalPageCount(filteredRows) + (filteredRows.length > size ? " · showing " + start + "–" + end : ""));
    renderPortalPageControls(filteredRows);

    pageRows.forEach(function (row) {
      state.visiblePortalRowKeys[row.key] = true;
    });
    streamList.render(list, pageRows);
    loadingQueue.reprioritize(portalReadPriority);
    scheduleVisiblePortalDates(pageRows);
    scheduleVisiblePortalFinance(pageRows);
    scheduleVisiblePortalEvm(pageRows);
    scheduleVisibleBsvThumbnails(pageRows);
    scheduleVisiblePortalAnnotations(pageRows);
    scheduleVisibleYoutubeMetadata(pageRows);
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
    return window.CHISEL_PORTAL_RECORD.compactRecordUrl(row, window.location.href);
  }

  // Exact-ID search is independent of the scanner's inventory freshness.
  function exactPortalSearchId(value) {
    const text = String(value || "").trim();
    if (/^(?:0x)?[0-9a-f]{64}$/i.test(text)) return text.replace(/^0x/i,"").toLowerCase();
    try {
      const url = new URL(text);
      const match = url.pathname.match(/^\/t\/([0-9a-f]{64})\/?$/i);
      if (url.protocol === "https:" && url.hostname === "twetch.com" && match) return match[1].toLowerCase();
    } catch (_) {}
    return "";
  }

  async function readExactBsvTransaction(txid) {
    const entry = getCoinIndexByCoinName("bsv");
    const index = entry && normalizeCoinName(entry.coin) === "bsv" ? entry : {coin:"bsv",ticker:"BSV"};
    const name = window.CHISEL_PORTAL_RECORD.encodeTxid(txid) + "-" + txid.slice(0,12) + ".json";
    const bases = Array.from(new Set(getStaticDataSources().map(function (source) {
      try { return staticData.sourceLocation(source, window.location.href).baseUrl; } catch (_) { return ""; }
    }).filter(Boolean)));
    const urls = bases.flatMap(base => [txid + ".json", name].map(file => staticData.joinDataPath(base,"transactions/bsv/"+file)));
    // Try the known storage names without downloading the full directory index.
    const saved = await Promise.all(urls.map(async function (url) {
      try { return await staticTransport.fetchStaticRawFromRow({txid,coin:"bsv",staticRawUrl:url}); }
      catch (_) { return null; }
    }));
    let loaded = saved.find(Boolean);
    if (!loaded) {
      const url = "https://api.whatsonchain.com/v1/bsv/main/tx/hash/" + txid;
      const json = await staticTransport.request(url,{cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"},async function (response) {
        if (!response.ok) throw Error("WhatsOnChain HTTP " + response.status);
        return response.json();
      },15000);
      const tx = txObject(json);
      if (extractTxid(json) !== txid || !Array.isArray(tx.vin) || !Array.isArray(tx.vout)) throw Error("WhatsOnChain transaction identity or shape mismatch.");
      loaded = {json,source:"live",coin:"bsv",url};
    }
    const summary = extractSummary(loaded.json,index);
    const row = upsertPortalRow({coin:"bsv",txid,index,raw:loaded.json,summary,
      blockTime:summary.blockTime || 0,rawSourceUrl:loaded.url,
      staticRawUrl:loaded.source === "live" ? "" : loaded.url,
      discoverySource:"exact-id-lookup"}, {silent:true});
    return {row,source:loaded.source,url:loaded.url,json:loaded.json,coin:"bsv"};
  }

  let exactSearchSequence = 0, exactSearchTimer = null;
  function scheduleExactPortalSearch(box, immediate) {
    const token = ++exactSearchSequence;
    if (exactSearchTimer !== null) window.clearTimeout(exactSearchTimer);
    const id = exactPortalSearchId(box.value);
    if (!id) return;
    exactSearchTimer = window.setTimeout(async function () {
      exactSearchTimer = null;
      if (token !== exactSearchSequence || exactPortalSearchId(box.value) !== id) return;
      // Normalize a pasted Twetch URL so the regular TXID filter also matches.
      box.value = id;
      const matches = state.portalRows.filter(row => !row.draftRecord && row.txid === id);
      if (matches.length) {
        matches.forEach(row => setPortalFilterValue(sourceIdForRow(row),true));
        state.portalPage = 1; requestPortalRender();
        setStatus("Found " + matches.length + " matching catalog record(s).",false);
        return;
      }
      setStatus("Searching saved BSV files, then WhatsOnChain…",false);
      try {
        const result = await readExactBsvTransaction(id);
        if (token !== exactSearchSequence || exactPortalSearchId(box.value) !== id) return;
        setPortalFilterValue("bsv",true);
        state.portalPage = 1;
        requestPortalRender();
        setStatus(result.source === "live" ? "BSV transaction retrieved from WhatsOnChain. Expand it to cache on FileProxy." : "BSV transaction found in static catalog files.",false);
      } catch (error) {
        if (token !== exactSearchSequence || exactPortalSearchId(box.value) !== id) return;
        setStatus("No available BSV result: " + (error.message || String(error)) + ". Other ledger providers were not queried.",true);
      }
    }, immediate ? 0 : 350);
  }

  async function lookupPortalRecords(route) {
    // Initial configuration and embedded records may still be loading when
    // an external fragment is opened. Refresh all configured local catalogs
    // before choosing a chain, even if the starter bundle already matches.
    await Promise.resolve();
    if (recordCatalogConfig) await recordCatalogConfig;
    loadEmbeddedStaticDataset();
    await Promise.allSettled([loadConfiguredStaticDatasets({quiet: true}), listLocalTransactions()]);
    const matches = state.portalRows.filter(function (row) {
      return !row.draftRecord && String(row.txid || "").replace(/^0x/i, "").toLowerCase() === route.txid &&
        window.CHISEL_PORTAL_RECORD.compactRecordUrl(row, window.location.href);
    });
    if (matches.length) return matches;
    try { return [(await readExactBsvTransaction(route.txid)).row]; }
    catch (_) { return []; }
  }

  function findPortalRecord(route) {
    return state.portalRows.find(function (row) {
      return row.txid === route.txid && canonicalCoinForRow(row) === route.coin &&
        (!route.sourceId || sourceIdForRow(row) === route.sourceId) &&
        (!route.chainId || String(row.index && row.index.chainId || "137") === route.chainId);
    });
  }

  // Resolve a shared video to its existing ledger record before offering a
  // new transaction. Match stable YouTube IDs, not URL spelling or watch params.
  function findExistingYoutubeRecord(input) {
    const videoId = youtubeIdFromUrl(input);
    if (!videoId) return null;
    const matches = state.portalRows.filter(function (row) {
      if (!row || row.draftRecord || !TXID_RE.test(String(row.txid || ""))) return false;
      const summary = row.summary || {};
      const candidates = [
        summary.primaryUrl, summary.opReturnText, summary.cleanText
      ].concat(safeArray(summary.opReturnUrls));
      const cards = collectEvmMediaCards(row);
      cards.forEach(function (card) {
        candidates.push(card.url, card.sourceUrl);
        if (card.videoId === videoId) candidates.push(input);
      });
      return candidates.some(function (candidate) {
        if (!candidate) return false;
        if (youtubeIdFromUrl(candidate) === videoId) return true;
        return extractUrlsFromText(candidate).some(function (url) {
          return youtubeIdFromUrl(url) === videoId;
        });
      });
    });
    // One canonical destination per coin. Prefer a confirmed, older record.
    matches.sort(function (a, b) {
      const aTime = Number(a.summary && a.summary.blockTime || a.blockTime || 0);
      const bTime = Number(b.summary && b.summary.blockTime || b.blockTime || 0);
      return aTime - bTime;
    });
    return matches[0] || null;
  }

  async function resolveSharedYoutube(input, mayNavigate) {
    if (!youtubeIdFromUrl(input)) return null;
    await ensureStarterDataset();
    let row = findExistingYoutubeRecord(input);
    if (!row) {
      // The startup bundle is not a complete ledger index. Refresh the
      // configured static catalogs before deciding that this video is new.
      try { await loadConfiguredStaticDatasets({quiet:true}); }
      catch (error) { console.warn("Shared video index lookup:", error); }
      row = findExistingYoutubeRecord(input);
    }
    if (!row || (typeof mayNavigate === "function" && !mayNavigate())) return null;
    if (typeof window.setGuiMode === "function") window.setGuiMode("portal");
    await openPortalRecord(row);
    return row;
  }

  function initializeRecordView() {
    if (recordView) return recordView;
    if (window.CHISEL_PORTAL_EXPLORE) recordExplore = window.CHISEL_PORTAL_EXPLORE.createController({
      document: document, rows: function () { return state.portalRows; },
      open: openPortalRecord, recordUrl: portalRecordUrl, parentUrl: relatedRecordUrl, openParent: openRelatedRecord, showTwetch:showTwetchFeed,
      hydrate: function (row) { return hydratePortalRow(row.key, {quiet: true, silent: true, suppressRender: true}); },
      refresh: async function () {
        const results = await Promise.allSettled([loadConfiguredStaticDatasets({quiet: true}), listLocalTransactions()]);
        if (results.every(function (result) { return result.status === "rejected"; })) throw new Error("Catalog refresh failed; saved records remain available.");
      },
      checkFileProxy: async function () {
        const result = await fileProxyJson("/ping", {}, 12000);
        if (!result || !result.ok) throw new Error("unavailable");
        return "connected";
      },
      checkScanner: async function () {
        const paths = state.config.staticDiscoveryManifestPaths || [];
        const manifest = paths.find(function (path) { return /^https?:/.test(path) && /\/bsv\/manifest\.json$/.test(path); });
        if (!manifest) return "no remote feed configured";
        const response = await fetch(manifest.replace(/manifest\.json$/, "scan.json"), {cache: "no-store", signal: AbortSignal.timeout(12000)});
        if (!response.ok) throw new Error("unavailable (HTTP " + response.status + ")");
        const scan = await response.json();
        return String(scan.transactionsChecked || 0) + " checked · last export " + String(scan.generatedAt || "unknown");
      }
    });
    recordView = window.CHISEL_PORTAL_RECORD.createController({document: document, state: state,
      onOpen: function (row) { recordPortalInteraction("select", row, {action: "open_record"}); },
      onRefresh: function (row) { if (recordExplore) recordExplore.setRow(row); },
      find: findPortalRecord, lookup: lookupPortalRecords, sourceUrl: recordDataUrl,
      render: function (content, row) { appendPortalInlineDetails(content, row, {recordPage: true}); },
      status: setStatus, copy: copyPortalText, fileProxyUrl: getFileProxyUrl,
      annotation: function (row) { return notesData.documentFor(row, getPortalAnnotation(row)); },
      facebookPreviewMetadata: function (row) {
        const cards = collectEvmMediaCards(row);
        for (let i = 0; i < cards.length; i += 1) {
          const captured = readPageMetadata(cards[i].sourceUrl || cards[i].url) || readPageMetadata(cards[i].url);
          if (captured) return captured;
        }
        return null;
      },
      placeholder: function (route) {
        const profile = EVM_PROFILES.find(function (item) { return "evm" + item.label === route.sourceId; });
        const entry = profile ? evmIndexEntry(profile) : getCoinIndexByCoinName(route.coin);
        return upsertPortalRow({coin: route.coin, txid: route.txid, sourceId: route.sourceId,
          index: entry || {coin: route.coin, chainId: route.chainId}, summary: {title: "transaction " + shortTxid(route.txid)}}, {silent: true});
      },
      resolve: async function (route, row) {
        loadPortalAnnotation(row).catch(function () {});
        if (row.raw) return row;
        // Only explicit record navigation uses this exact-ID fallback, not background hydration.
        if (route.coin === "bsv" && !route.dataUrl && !row.staticRawPath && !row.staticRawUrl && !row.localPath) {
          try { return (await readExactBsvTransaction(route.txid)).row; }
          catch (_) { /* Keep the configured provider fallback below. */ }
        }
        if (route.dataUrl) row.staticRawUrl = route.dataUrl;
        const loaded = await hydratePortalRow(row.key, {quiet: true, silent: true, suppressRender: true, deferCache: true});
        if (!loaded || !loaded.raw) throw new Error(loaded && loaded.loadError || "Transaction data is unavailable from the saved files and ledger services.");
        return loaded;
      },
      onReturn: function () {
        if (recordExplore) recordExplore.clear();
        if(pendingTwetchFeed){pendingTwetchFeed=false;showTwetchFeed();}
        if (state.portalListDirty) { state.portalListDirty = false; window.setTimeout(requestPortalRender, 0); }
      }
    });
    return recordView;
  }

  function relatedRecordUrl(coin,txid) {
    return window.CHISEL_PORTAL_RECORD.compactRecordUrl({coin,txid},window.location.href,true);
  }
  function openRelatedRecord(coin,txid) {
    if(!/^(?:bsv|bsvTestnet)$/.test(coin)||!TXID_RE.test(txid))return Promise.resolve(null);
    const row=findPortalRecord({coin,txid})||upsertPortalRow({coin,txid,index:getCoinIndexByCoinName(coin)||{coin},summary:{title:"transaction "+shortTxid(txid)}},{silent:true});
    return openPortalRecord(row);
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
    const archivePath=window.CHISEL_BSV_MEDIA && window.CHISEL_BSV_MEDIA.archivePath(canonicalCoinForRow(row),row.txid);
    if(archivePath){
      try{
        const url=new URL(archivePath,document.baseURI).href;
        const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
        if(!response.ok)throw Error("Archive HTTP "+response.status);
        const json=await response.json();
        if(extractTxid(json).toLowerCase()!==row.txid.toLowerCase())throw Error("Archive transaction ID mismatch");
        return {json,source:"archive",coin:"bsv",url};
      }catch(error){row.archiveLoadError=error.message||String(error);}
    }
    if (sourceIdForRow(row) === "evmChisel") {
      try {
        const hash = "0x" + row.txid;
        const profile = getEvmProfileById("chisel");
        if (BigInt(await readRecentPolygon("eth_chainId", [])) !== 137n) throw Error("Unexpected Polygon chain");
        const [tx,receipt] = await Promise.all([readRecentPolygon("eth_getTransactionByHash",[hash]),readRecentPolygon("eth_getTransactionReceipt",[hash])]);
        if (!tx || String(tx.hash).toLowerCase() !== hash || String(tx.to).toLowerCase() !== profile.contractAddress.toLowerCase()) throw Error("Polygon transaction not found for Chisel");
        if (receipt && String(receipt.transactionHash).toLowerCase() !== hash) throw Error("Polygon receipt hash mismatch");
        let timestamp = 0;
        if (receipt && receipt.blockNumber) {
          try {
            const block = await readRecentPolygon("eth_getBlockByNumber",[receipt.blockNumber,false]);
            if (block && block.hash === receipt.blockHash) timestamp = Number(block.timestamp);
          } catch (_) {}
        }
        const packet = evmTxPacket(Object.assign({},tx,{timeStamp:timestamp,gasUsed:receipt ? receipt.gasUsed : ""}),profile);
        packet.source.kind = "polygon-rpc-hash";
        if (receipt) packet.receipt = receipt;
        return {json:packet,source:"live",coin:"evm",url:"https://polygonscan.com/tx/"+hash};
      } catch (error) { row.polygonLookupError = error.message || String(error); }
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

        // Paint summary rows now; hydrate through the existing background queue.

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
      return configBool("includeEvm" + profile.label.replace(/[^A-Za-z0-9]/g, ""), false);
    });
  }

  function applyEvmProfileConfig() {
    EVM_PROFILES.forEach(function (profile) {
      const box = evmCheckboxForProfile(profile);
      if (!box) return;
      const key = "includeEvm" + profile.label.replace(/[^A-Za-z0-9]/g, "");
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

  function fetchEvmCatalogRows(profile) {
    if (state.evmCatalogRequests[profile.id]) return state.evmCatalogRequests[profile.id];
    const request = (async function () {
      // EVM catalogs summarize hundreds of split JSON records on FileProxy;
      // the general 2-second read timeout is too short for these endpoints.
      const json = await fileProxyJson("/evm-local-catalog", {
        chainId: profile.chainId,
        contractName: profile.contractName,
        contractAddress: profile.contractAddress
      }, 20000);
      const known = Object.create(null);
      let latestBlock = 0;
      safeArray(json.transactions).forEach(function (row) {
        const txid = String(row && row.txid || "").replace(/^0x/i, "").toLowerCase();
        if (/^[0-9a-f]{64}$/.test(txid)) known[txid] = true;
        const summary = row && row.summary || {};
        latestBlock = Math.max(latestBlock, Number(summary.blockHeight || summary.blockNumber || 0) || 0);
      });
      state.evmKnownTxids[profile.id] = known;
      state.evmCatalogLatestBlocks[profile.id] = latestBlock;
      return {
        profile: profile,
        json: json,
        rows: safeArray(json.transactions).map(function (row) { return evmCatalogRowToPortalRow(row, profile); })
      };
    })();
    state.evmCatalogRequests[profile.id] = request;
    return request.finally(function () { delete state.evmCatalogRequests[profile.id]; });
  }

  async function loadSelectedEvmCatalogs(opts) {
    const profiles = enabledEvmProfiles().sort(function (a, b) { return Number(b.id === "chisel") - Number(a.id === "chisel"); });
    if (!profiles.length) {
      setStatus("Choose at least one EVM stream (Gomez, Jethro, or Polygon Thunderword) before loading the FileProxy catalog.", true);
      return [];
    }

    const reset = opts && opts.reset;
    if (reset) resetPortalRowsForNewLoad();

    setStatus("Loading local EVM catalog stream(s)…", false);
    const loaded = [];
    const reports = [];

    await Promise.all(profiles.map(async function (profile) {
        try {
          const result = await fetchEvmCatalogRows(profile);
          reports.push({
            profile: result.profile.label,
            count: result.rows.length,
            streams: result.json.streams || []
          });
          beginPortalBatch();
          try {
            result.rows.forEach(function (row) { loaded.push(upsertPortalRow(row, {silent:true})); });
            state.evmCatalogLoaded[result.profile.id] = true;
          } finally { endPortalBatch(); }
          requestPortalRender();
        } catch (error) {
          reports.push({profile: profile.label, error: error.message || String(error)});
        }
    }));

    requestPortalRender();
    setText("#portalThunderwordRaw", pretty({ evmCatalog: reports }));
    const failures = reports.filter(function (report) { return report.error; });
    setStatus("Loaded " + loaded.length + " EVM catalog transaction(s) into the main Portal feed." +
      (failures.length ? " Unavailable: " + failures.map(function (report) { return report.profile; }).join(", ") + "." : ""), failures.length === reports.length);
    return loaded;
  }

  // Rigler's scheduled indexer owns discovery. Refresh its Chisel catalog
  // independently of the optional browser Etherscan adapter.
  // Remember only the public hash, not any signing material.
  const RECENT_POLYGON_KEY = "chisel.portal.recentPolygonHash.v1";
  let recentPolygon = null, recentPolygonTimer = null, recentPolygonBusy = false;
  let recentPolygonReveal = false;
  function revealRecentPolygon() {
    if (!recentPolygonReveal || document.body.dataset.mode !== "portal") return;
    recentPolygonReveal = false;
    clearPortalSearch();
    setPortalFilterValue("evmChisel", true);
    state.portalPage = 1;
    state.portalSortPending = true;
    requestPortalRender();
  }
  async function readRecentPolygon(method, params) {
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 10000);
    try {
      const response = await fetch("https://polygon.drpc.org", {method:"POST", cache:"no-store",
        headers:{"Content-Type":"application/json"}, signal:controller.signal,
        body:JSON.stringify({jsonrpc:"2.0",id:1,method:method,params:params})});
      if (!response.ok) throw Error("Polygon RPC unavailable");
      const body = await response.json();
      if (body.error || !Object.prototype.hasOwnProperty.call(body,"result")) throw Error("Polygon RPC read failed");
      return body.result;
    } finally { window.clearTimeout(timeout); }
  }
  async function refreshRecentPolygon() {
    if (!recentPolygon || recentPolygonBusy) return;
    const target = recentPolygon;
    recentPolygonBusy = true;
    let retry = true;
    try {
      const chain = await readRecentPolygon("eth_chainId", []);
      if (BigInt(chain) !== 137n) throw Error("Unexpected Polygon chain");
      const [tx, receipt] = await Promise.all([
        readRecentPolygon("eth_getTransactionByHash",[target.hash]),
        readRecentPolygon("eth_getTransactionReceipt",[target.hash])
      ]);
      if (target !== recentPolygon) return;
      if (!tx) return;
      const profile = EVM_PROFILES.find(function (item) { return item.id === "chisel"; });
      if (String(tx.hash).toLowerCase() !== target.hash ||
          String(tx.to).toLowerCase() !== profile.contractAddress.toLowerCase()) {
        retry = false; return;
      }
      if (receipt && (String(receipt.transactionHash).toLowerCase() !== target.hash ||
          !["0x0","0x1"].includes(receipt.status))) throw Error("Invalid Polygon receipt");
      let timestamp = 0;
      if (receipt && receipt.blockNumber) {
        try {
          const block = await readRecentPolygon("eth_getBlockByNumber",[receipt.blockNumber,false]);
          if (block && block.hash === receipt.blockHash) timestamp = Number(block.timestamp);
        } catch (_) {}
      }
      if (target !== recentPolygon) return;
      const publicTx = Object.assign({},tx,{timeStamp:timestamp,
        gasUsed:receipt ? receipt.gasUsed : "",isError:receipt ? (receipt.status === "0x0" ? "1" : "0") : ""});
      const packet = evmTxPacket(publicTx,profile);
      packet.source.kind = "polygon-rpc-hash";
      if (receipt) packet.receipt = receipt;
      const status = receipt ? (receipt.status === "0x1" ? "receipt confirmed" : "execution reverted") : "receipt pending";
      const row = upsertPortalRow({coin:"evm",txid:packet.txid,index:evmIndexEntry(profile),raw:packet,
        summary:packet.summary,receivedTime:target.at/1000,confirmed:!!receipt,
        recentPolygon:true,polygonReceiptStatus:status,discoverySource:"polygon-rpc"}, {ledgerObserved:true});
      if (row) revealRecentPolygon();
      retry = !receipt;
    } catch (error) { console.warn("Recent Polygon transaction lookup:", error); }
    finally {
      recentPolygonBusy = false;
      if (recentPolygon !== target) {
        if (recentPolygon) refreshRecentPolygon();
      } else if (retry && Date.now()-target.at < 120000) {
        recentPolygonTimer = window.setTimeout(function () { recentPolygonTimer = null; refreshRecentPolygon(); },5000);
      }
    }
  }
  function trackPolygonHash(hash, restoredAt) {
    hash = String(hash || "").toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(hash)) return;
    const at = Number(restoredAt) || Date.now();
    if (at > Date.now()) return;
    if (recentPolygonTimer) window.clearTimeout(recentPolygonTimer);
    recentPolygonTimer = null;
    recentPolygon = {hash:hash,at:at};
    recentPolygonReveal = !restoredAt && Date.now()-at < 900000;
    try { window.localStorage.setItem(RECENT_POLYGON_KEY,JSON.stringify(recentPolygon)); } catch (_) {}
    refreshRecentPolygon();
  }
  function restoreRecentPolygon() {
    if (recentPolygon) {
      revealRecentPolygon();
      if (!state.portalRows.some(function (row) { return row.txid === recentPolygon.hash.slice(2) && row.polygonReceiptStatus === "receipt confirmed"; })) refreshRecentPolygon();
      return;
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECENT_POLYGON_KEY) || "null");
      if (saved && Number(saved.at) > 0) trackPolygonHash(saved.hash,saved.at);
    } catch (_) {}
  }

  function refreshIndexedChisel() {
    if (document.hidden || document.body.dataset.mode !== "portal" ||
        !configBool("autoLoadEvmCatalog", true)) return Promise.resolve(null);
    if (state.indexedChiselRefresh) return state.indexedChiselRefresh;
    const profile = enabledEvmProfiles().find(function (item) { return item.id === "chisel"; });
    if (!profile) return Promise.resolve(null);
    state.indexedChiselRefresh = fetchEvmCatalogRows(profile).then(function (result) {
      beginPortalBatch();
      try {
        result.rows.forEach(function (row) { upsertPortalRow(row, {silent: true}); });
        state.evmCatalogLoaded[profile.id] = true;
      } finally { endPortalBatch(); }
      requestPortalRender();
      return result.rows.length;
    }).catch(function (error) {
      console.warn("Rigler Chisel catalog refresh:", error);
      setStatus("Chisel (POL) catalog unavailable: " + (error.message || String(error)), true);
      return null;
    }).finally(function () { state.indexedChiselRefresh = null; });
    return state.indexedChiselRefresh;
  }

  let proxyCatalogRefresh = null, proxyCatalogConnected = false;
  async function refreshOptionalFileProxy() {
    if (document.hidden || document.body.dataset.mode !== "portal") return;
    if (proxyCatalogRefresh) return proxyCatalogRefresh;
    proxyCatalogRefresh = (async function () {
      const online = await checkFileProxyHealth();
      if (!online) { proxyCatalogConnected = false; return; }
      const recovered = !proxyCatalogConnected;
      proxyCatalogConnected = true;
      const jobs = [];
      if (recovered && configBool("autoLoadLocalTransactions", false)) jobs.push(listLocalTransactions());
      if (configBool("autoLoadEvmCatalog", true)) {
        jobs.push(recovered ? loadSelectedEvmCatalogs({reset:false}) : refreshIndexedChisel());
      }
      await Promise.allSettled(jobs);
    })().finally(function () { proxyCatalogRefresh = null; });
    return proxyCatalogRefresh;
  }


  // Browser-owned Polygon discovery. FileProxy is only a supplementary cache.
  const DIRECT_POLYGON_RPC = ["https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com"];
  let directPolygonRefresh = null, directPolygonLastAttempt = 0;
  let directPolygonTip = null, directPolygonBackfill = null;
  const directPolygonSeen = new Set();
  async function directPolygonJson(url, options) {
    const controller = new AbortController();
    const timer = window.setTimeout(function () { controller.abort(); }, 8000);
    try {
      const response = await fetch(url, Object.assign({cache:"no-store",signal:controller.signal}, options));
      if (!response.ok) throw Error("Polygon provider HTTP " + response.status);
      return await response.json();
    } finally { window.clearTimeout(timer); }
  }
  async function directPolygonRpc(url, method, params) {
    const body = await directPolygonJson(url, {method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({jsonrpc:"2.0",id:1,method:method,params:params})});
    if (!body || body.error || !Object.prototype.hasOwnProperty.call(body,"result"))
      throw Error("Polygon RPC " + method + " failed");
    return body.result;
  }
  function acceptDirectPolygon(raw, profile, source, receipt) {
    if (!raw || String(raw.to || "").toLowerCase() !== profile.contractAddress.toLowerCase() ||
        !/^0x[0-9a-f]{64}$/i.test(String(raw.hash || "")) ||
        !Number.isFinite(Number(raw.timeStamp)) || Number(raw.timeStamp) <= 0 ||
        !/^0x(?:[0-9a-f]{2})*$/i.test(String(raw.input || ""))) return false;
    const packet = evmTxPacket(raw,profile);
    packet.source.kind = source;
    if (receipt) packet.receipt = receipt;
    const reverted = raw.isError === "1";
    const row = upsertPortalRow({coin:"evm",txid:packet.txid,index:evmIndexEntry(profile),
      raw:packet,summary:packet.summary,blockTime:packet.summary.blockTime,confirmed:true,
      polygonReceiptStatus:reverted ? "execution reverted" : "receipt confirmed",
      discoverySource:source}, {ledgerObserved:true});
    if (row) directPolygonSeen.add(packet.hash);
    return !!row;
  }
  async function discoverPolygonAddressHistory(profile) {
    // Use the browser's own Etherscan credential if present. Never fetch a server secret.
    const key = savedEtherscanApiKey();
    if (key) {
      try {
        const rows = await etherscanTxList(profile,key,0,1);
        rows.forEach(function (raw) {
          if (raw.isError === "0" || raw.isError === "1") acceptDirectPolygon(raw,profile,"etherscan-v2",null);
        });
        return;
      } catch (error) { console.warn("Direct Polygon Etherscan history:",error); }
    }
    const url = "https://polygon.blockscout.com/api/v2/addresses/" +
      encodeURIComponent(profile.contractAddress) + "/transactions?filter=to";
    const data = await directPolygonJson(url);
    if (!data || !Array.isArray(data.items)) throw Error("Invalid Polygon address history");
    data.items.forEach(function (tx) {
      const status = String(tx.status || "").toLowerCase();
      if (!["ok","error"].includes(status) || !Number(tx.block_number)) return;
      acceptDirectPolygon({hash:tx.hash,from:tx.from && tx.from.hash,to:tx.to && tx.to.hash,
        input:tx.raw_input,blockNumber:tx.block_number,transactionIndex:tx.position || 0,
        timeStamp:Date.parse(tx.timestamp)/1000,value:tx.value,gasUsed:tx.gas_used,
        isError:status === "ok" ? "0" : "1"},profile,"polygon-blockscout",null);
    });
  }
  async function discoverPolygonLogs(profile) {
    // Recent blocks first; advance a cursor and fill older blocks in bounded batches.
    // Logs cannot discover reverted or eventless calls; address history handles those.
    let lastError;
    for (const url of DIRECT_POLYGON_RPC) {
      try {
        const rpc = function (method,params) { return directPolygonRpc(url,method,params); };
        if (Number(await rpc("eth_chainId",[])) !== 137) throw Error("Wrong Polygon network");
        const tip = Number(await rpc("eth_blockNumber",[]));
        if (!Number.isSafeInteger(tip) || tip < 1) throw Error("Invalid Polygon tip");
        const hex = function (n) { return "0x" + n.toString(16); };
        const span = 1000, floor = Math.max(0,tip-50000);
        async function scan(from,to) {
          if (from > to) return;
          const logs = await rpc("eth_getLogs",[{address:profile.contractAddress,fromBlock:hex(from),toBlock:hex(to)}]);
          if (!Array.isArray(logs)) throw Error("Invalid Polygon logs");
          const hashes = Array.from(new Set(logs.filter(function (log) {
            return !log.removed && String(log.address).toLowerCase() === profile.contractAddress.toLowerCase();
          }).map(function (log) { return String(log.transactionHash).toLowerCase(); })));
          // Limit simultaneous RPC requests; do not advance the cursor on incomplete reads.
          for (const hash of hashes) {
            if (directPolygonSeen.has(hash)) continue;
            const pair = await Promise.all([rpc("eth_getTransactionByHash",[hash]),rpc("eth_getTransactionReceipt",[hash])]);
            const tx = pair[0], receipt = pair[1];
            if (!tx || !receipt || String(tx.hash).toLowerCase() !== hash ||
                String(receipt.transactionHash).toLowerCase() !== hash || receipt.status !== "0x1")
              throw Error("Incomplete Polygon receipt");
            if (String(tx.to || "").toLowerCase() !== profile.contractAddress.toLowerCase()) continue;
            const block = await rpc("eth_getBlockByNumber",[receipt.blockNumber,false]);
            if (!block || block.hash !== receipt.blockHash) throw Error("Polygon block changed");
            if (!acceptDirectPolygon(Object.assign({},tx,{timeStamp:Number(block.timestamp),
                gasUsed:receipt.gasUsed,isError:"0"}),profile,"polygon-rpc",receipt))
              throw Error("Invalid Polygon transaction");
          }
        }
        if (directPolygonTip === null) {
          const start = Math.max(0,tip-span+1);
          await scan(start,tip);
          directPolygonTip = tip;
          directPolygonBackfill = start-1;
        } else {
          const start = Math.max(0, directPolygonTip-15);
          const end = Math.min(tip,start+span-1);
          await scan(start,end);
          directPolygonTip = Math.max(directPolygonTip,end);
        }
        // Catch up history without holding up the newest results or scanning all of Polygon.
        for (let i=0;i<3 && directPolygonBackfill >= floor;i++) {
          const start = Math.max(floor,directPolygonBackfill-span+1);
          await scan(start,directPolygonBackfill);
          directPolygonBackfill = start-1;
        }
        return;
      } catch (error) { lastError = error; }
    }
    throw lastError || Error("Polygon RPC unavailable");
  }
  function refreshDirectPolygon() {
    if (document.hidden || document.body.dataset.mode !== "portal") return Promise.resolve();
    if (directPolygonRefresh) return directPolygonRefresh;
    const profile = enabledEvmProfiles().find(function (item) { return item.id === "chisel"; });
    if (!profile || Date.now()-directPolygonLastAttempt < 15000) return Promise.resolve();
    directPolygonLastAttempt = Date.now();
    directPolygonRefresh = Promise.allSettled([discoverPolygonAddressHistory(profile),discoverPolygonLogs(profile)])
      .then(function (results) {
        results.forEach(function (result) {
          if (result.status === "rejected") console.warn("Direct Polygon discovery:",result.reason);
        });
        if (results.every(function (result) { return result.status === "rejected"; }))
          setStatus("Polygon discovery providers unavailable; retrying. Cached records remain visible.",true);
      }).finally(function () { directPolygonRefresh = null; });
    return directPolygonRefresh;
  }

  function startIndexedChiselPolling() {
    if (state.indexedChiselTimer) window.clearInterval(state.indexedChiselTimer);
    const ms = Number(configValue("indexedChiselRefreshMs", 30000));
    if (!Number.isFinite(ms) || ms < 1000) return;
    refreshDirectPolygon();
    refreshOptionalFileProxy();
    state.indexedChiselTimer = window.setInterval(function () {
      refreshDirectPolygon();
      refreshOptionalFileProxy();
    }, Math.max(15000, ms));
  }

  const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";
  const ETHERSCAN_KEY_STORAGE = "chisel.evm2.etherscanApiKey";
  const EVM_SYNC_STORAGE = "chisel.portal.evmSync.lastAttempt";

  function savedEtherscanApiKey() {
    try { return String(window.localStorage.getItem(ETHERSCAN_KEY_STORAGE) || "").trim(); }
    catch (error) { return ""; }
  }

  function evmTxPacket(raw, profile) {
    const hash = String(raw && raw.hash || "").trim();
    const txid = hash.replace(/^0x/i, "").toLowerCase();
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) return null;
    const input = String(raw.input || "0x");
    const inputHex = input.replace(/^0x/i, "");
    const methodId = /^([0-9a-f]{8})/i.exec(inputHex);
    const blockNumber = Number(raw.blockNumber || 0);
    const timestamp = Number(raw.timeStamp || 0);
    const transactionIndex = Number(raw.transactionIndex || 0);
    const name = profile.contractName;
    const savedAt = new Date().toISOString();
    return {
      txid: txid,
      hash: hash.toLowerCase(),
      coin: "evm",
      chainId: "137",
      chainName: "Polygon Mainnet",
      contract: { name: name, address: profile.contractAddress, queriedAddress: profile.contractAddress },
      source: {
        kind: "etherscan-v2-account-txlist",
        generatedBy: "chisel.portal.js",
        savedAt: savedAt,
        sort: "desc"
      },
      tx: raw,
      decoded: { kind: "evm", methodId: methodId ? "0x" + methodId[1].toLowerCase() : "" },
      summary: {
        txid: txid,
        hash: hash.toLowerCase(),
        title: profile.id === "chisel" ? "Chisel transaction" : name.toUpperCase() + " transaction",
        methodId: methodId ? "0x" + methodId[1].toLowerCase() : "",
        from: String(raw.from || ""),
        to: String(raw.to || ""),
        contractAddress: profile.contractAddress,
        blockNumber: blockNumber,
        blockHeight: blockNumber,
        blockTime: timestamp,
        date: timestamp ? new Date(timestamp * 1000).toISOString() : "",
        value: String(raw.value || "0"),
        gasUsed: String(raw.gasUsed || ""),
        inputBytes: Math.floor(inputHex.length / 2),
        kind: "evm",
        transactionIndex: transactionIndex,
        explorerUrl: evmExplorerUrl({ chainId: "137", hash: hash }, hash)
      }
    };
  }

  async function etherscanTxList(profile, apiKey, startBlock, page) {
    const params = new URLSearchParams({
      chainid: "137",
      module: "account",
      action: "txlist",
      address: profile.contractAddress,
      startblock: String(startBlock),
      endblock: "999999999",
      page: String(page),
      offset: "1000",
      sort: "desc",
      apikey: apiKey
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 15000);
    let response;
    try {
      response = await fetch(ETHERSCAN_V2_URL + "?" + params.toString(), {
        cache: "no-store",
        signal: controller.signal
      });
    } finally {
      window.clearTimeout(timeout);
    }
    if (!response.ok) throw new Error("Etherscan HTTP " + response.status);
    const payload = await response.json();
    if (payload && payload.status === "0") {
      const result = String(payload.result || "");
      if (/no transactions found/i.test(result)) return [];
      throw new Error("Etherscan transaction query failed (check API key or rate limit).");
    }
    if (!payload || !Array.isArray(payload.result)) throw new Error("Etherscan returned an invalid transaction page.");
    return payload.result;
  }

  async function syncEvmProfile(profile, apiKey) {
    let latestBlock;
    if (Object.prototype.hasOwnProperty.call(state.evmCatalogLatestBlocks, profile.id)) {
      latestBlock = state.evmCatalogLatestBlocks[profile.id];
    } else {
      const status = await fileProxyJson("/evm-stream-status", {
        chainId: profile.chainId,
        contractName: profile.contractName,
        contractAddress: profile.contractAddress
      }, 20000);
      latestBlock = Number(status.latestBlock || 0);
    }
    const overlap = Math.max(1, Number(configValue("autoSyncEvmOverlapBlocks", 16)) || 16);
    const startBlock = latestBlock > 0 ? Math.max(0, latestBlock - overlap) : 0;
    const packets = [];
    const seen = Object.create(null);
    const known = state.evmKnownTxids[profile.id] || Object.create(null);
    // First-time loads can be historical; cap work per open while descending
    // pages ensure the newest records are captured first.
    const maxPages = 10;
    for (let page = 1; page <= maxPages; page += 1) {
      const rows = await etherscanTxList(profile, apiKey, startBlock, page);
      rows.forEach(function (row) {
        const packet = evmTxPacket(row, profile);
        if (!packet || seen[packet.txid] || known[packet.txid]) return;
        seen[packet.txid] = true;
        packets.push(packet);
      });
      if (rows.length < 1000) break;
    }
    if (!packets.length) return 0;
    const result = await fileProxyPostJson("/save-evm-batch", {
      chainId: profile.chainId,
      chainName: profile.chainName,
      contractName: profile.contractName,
      contractAddress: profile.contractAddress,
      source: { kind: "etherscan-v2-account-txlist", generatedBy: "chisel.portal.js", savedAt: new Date().toISOString() },
      transactions: packets,
      filenameMode: "base58"
    });
    packets.forEach(function (packet) { known[packet.txid] = true; });
    state.evmKnownTxids[profile.id] = known;
    return Number(result.saved || 0);
  }

  async function syncEvmContractsFromEtherscan() {
    if (!configBool("autoSyncEvmContracts", false) || document.hidden) return 0;
    if (state.evmSyncPromise) return state.evmSyncPromise;
    const apiKey = savedEtherscanApiKey();
    if (!apiKey) return 0;
    const now = Date.now();
    try {
      const lastAttempt = Number(window.localStorage.getItem(EVM_SYNC_STORAGE) || 0);
      const minInterval = Math.max(30000, Number(configValue("autoSyncEvmContractsMs", 60000)) || 60000);
      if (lastAttempt && now - lastAttempt < minInterval) return 0;
      window.localStorage.setItem(EVM_SYNC_STORAGE, String(now));
    } catch (error) {}

    state.evmSyncPromise = (async function () {
      let saved = 0;
      const profiles = enabledEvmProfiles();
      for (const profile of profiles) {
        try { saved += await syncEvmProfile(profile, apiKey); }
        catch (error) { console.warn("Polygon " + profile.label + " auto-sync skipped:", error); }
      }
      if (saved) {
        await loadSelectedEvmCatalogs({ reset: false });
        setStatus("Captured and loaded " + saved + " new Polygon contract transaction(s).", false);
      }
      return saved;
    })().finally(function () { state.evmSyncPromise = null; });
    return state.evmSyncPromise;
  }

  function startEvmContractPolling() {
    if (state.evmSyncTimer) window.clearInterval(state.evmSyncTimer);
    if (!configBool("autoSyncEvmContracts", false)) return;
    if (!savedEtherscanApiKey()) {
      console.info("Polygon auto-sync is waiting for the Etherscan key saved by the Polygon workbench; cached FileProxy transactions still load.");
    }
    const ms = Math.max(30000, Number(configValue("autoSyncEvmContractsMs", 60000)) || 60000);
    syncEvmContractsFromEtherscan().catch(function (error) { console.warn("Polygon contract auto-sync failed:", error); });
    state.evmSyncTimer = window.setInterval(function () {
      if (document.body.dataset.mode !== "portal") return;
      syncEvmContractsFromEtherscan().catch(function (error) { console.warn("Polygon contract auto-sync failed:", error); });
    }, ms);
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
      if (document.body.dataset.mode !== "portal") return;
      listLocalTransactions().catch(function () {});
    }, ms);
  }

  function liveLedgerTarget() {
    const account = normalizePersonalAccount(state.personalAccount);
    if (account && account.accountOnly) return null;
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
      if ($("#portalTransactionList [data-portal-boot-preview]")) return;
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
        }, { silent: true, ledgerObserved: tx.confirmed === true ||
          (tx.confirmed !== false && Number(tx.blockHeight) > 0) });
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
          cachedTitle && !isGenericEvmTitle(cachedTitle) && !needsBsvClassification(row, cachedTitle) &&
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
      accountOnly: source.accountOnly === true,
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

    const fallback = clean.accountOnly ? null : inferIndexForAddress(clean.address,state.currentIndex || getSelectedIndex());
    const entry = clean.accountOnly ? null : (clean.coin ? indexEntryForCoin(clean.coin,fallback) : fallback);

    if ($("#portalThunderwordAddress")) $("#portalThunderwordAddress").value = clean.accountOnly ? "" : clean.address;
    if ($("#portalSpendableAddress")) $("#portalSpendableAddress").value = clean.accountOnly ? "" : clean.address;
    if ($("#portalSpendableNote") && !$("#portalSpendableNote").value) {
      $("#portalSpendableNote").value = clean.label;
    }
    if ($("#portalThunderwordSelect") && entry && entry.name) {
      $("#portalThunderwordSelect").value = entry.name;
    }

    const card = $("#portalPersonalAccount");
    if (card) { card.hidden = false; card.dataset.currency = clean.coin; }
    const refresh = $("#portalLoadPersonalAccountButton");
    if (refresh) refresh.disabled = clean.accountOnly;
    const addRecord = card && card.querySelector('[data-mode-target="send"]');
    if (addRecord) addRecord.disabled = clean.accountOnly;
    setText("#portalPersonalAccountLabel",clean.label);
    setText("#portalPersonalAccountCoin",clean.ticker || tickerForCoin(clean.coin) || clean.coin.toUpperCase());
    setText("#portalPersonalAccountAddress",clean.address);
    setText("#portalPersonalAccountMeta",
      clean.accountOnly ? "Public address and balance supported. Portal transaction history and sending are not yet available for this network. Private key material is not stored here." :
      "Public account context is remembered in this browser and its address stream is also offered to the configured rigler.org fileProxy. WIF/private material is not stored here."
    );

    const explorer = $("#portalPersonalAccountExplorer");
    if (explorer) {
      const plugin = clean.accountOnly && window.CHISEL && window.CHISEL.coins && window.CHISEL.coins[clean.coin];
      const base = plugin && plugin.DEFAULT_EXPLORER_URL;
      const href = clean.accountOnly ? (base && /\/tx\/$/.test(base) ? base.replace(/\/tx\/$/, "/address/") + encodeURIComponent(clean.address) : "") :
        (getThunderwords() && entry ? getThunderwords().getAddressUrl(entry,clean.address) : "");
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
    if (!prepared || prepared.account.accountOnly) return Promise.resolve(null);
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
      if (search && options.filterResults !== false && search.value === prepared.account.address) {
        search.value = prepared.account.address;
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
      // Account-only networks have explicit balance adapters, but no Portal
      // history adapter yet. Never infer another chain from a shared address.
      if (account.accountOnly === true) continue;
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
      accountOnly:detail.accountOnly === true,
      label:String(detail.label || detail.ticker || "Personal account").trim(),
      savedAt:Date.now()
    });
    if (!account) return;

    populatePersonalAccountFields(account);
    if (account.accountOnly) {
      // Keep the new public identity without guessing a history adapter from
      // its address (BTC and BSV addresses may be byte-for-byte identical).
      const search = $("#portalEvmWordSearch");
      if (search) search.value = "";
      state.portalPage = 1;
      setPersonalStreamBackVisible(false);
      state.personalStreamReturnView = null;
      requestPortalRender();
      return;
    }

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
    const base = getFileProxyUrl().replace(new RegExp("/+$"), "");
    let label = "configured endpoint";
    try { label = new URL(base, window.location.href).host; } catch (_) {}
    if (element) element.textContent = "FileProxy: checking " + label + "…";
    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 6000);
    try {
      await requestFileProxyJson(base + "/ping", {
        method:"GET", cache:"no-store", signal:controller.signal
      });
      if (element) {
        element.textContent = "FileProxy: connected (" + label + ")";
        element.style.color = "#a2d889";
      }
      return true;
    } catch (error) {
      if (element) {
        element.textContent = "FileProxy: offline · cached records and direct HTTP/RPC still available.";
        element.style.color = "#ffb39f";
      }
      return false;
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
      failedFileProxyBase = "";
      proxyCatalogConnected = false;
      refreshOptionalFileProxy();
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
    window.addEventListener("chisel:main-account", receiveMainThunderwordAccount);
    // app.js may finish the identity handoff before DOMContentLoaded binds
    // Portal. The active public account takes precedence over remembered LTC.
    const activeAccount = window.CHISEL_ACTIVE_ACCOUNT;
    if (activeAccount && activeAccount.address && activeAccount.currency) {
      state.personalAccount = savePersonalAccount({
        address:activeAccount.address,
        coin:activeAccount.currency,
        ticker:activeAccount.ticker,
        accountOnly:activeAccount.accountOnly === true,
        label:(activeAccount.ticker || activeAccount.currency) + " account"
      });
    } else {
      state.personalAccount = loadPersonalAccount();
    }
    if (state.personalAccount) {
      const prepared = populatePersonalAccountFields(state.personalAccount);
      if (prepared && !prepared.account.accountOnly && !state.urlMainThunderwordRequest) restorePersonalTxCache(prepared.account, prepared.entry);
    }
    window.addEventListener("chisel:identity-accounts", function (event) {
      receiveIdentityAccounts(event).catch(function (error) {
        setStatus(error.message || String(error), true);
      });
    });
    if (document.body.dataset.mode === "portal") {
      applyPortalFilterConfig();
      restoreRecentFeed();
    }
    renderEmptyTransactionList(state.personalAccount ? "Restoring your account stream…" : "Loading bundled static dataset; live ledger searches can add newer records after first paint.");
    // Starter data is loaded when Portal or an explicit duplicate lookup needs it.

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
    if (searchBox) {
      searchBox.oninput = function () {
        state.portalPage = 1;
        requestPortalRender();
        scheduleExactPortalSearch(searchBox,false);
      };
      searchBox.addEventListener("keydown",function (event) {
        if (event.key === "Enter" && exactPortalSearchId(searchBox.value)) {
          event.preventDefault();
          scheduleExactPortalSearch(searchBox,true);
        }
      });
    }

    // An installed PWA may briefly have an older HTML shell than this script.
    // Add the control to that shell as well instead of depending on its markup.
    let clearWordSearch = $("#portalClearWordSearchButton");
    if (!clearWordSearch && searchBox && searchBox.parentNode) {
      clearWordSearch = document.createElement("button");
      clearWordSearch.id = "portalClearWordSearchButton";
      clearWordSearch.className = "secondaryButton portalPageButton";
      clearWordSearch.type = "button";
      clearWordSearch.textContent = "Clear search";
      clearWordSearch.setAttribute("aria-label", "Clear search filter");
      searchBox.parentNode.insertBefore(clearWordSearch, searchBox.nextSibling);
    }
    if (clearWordSearch) clearWordSearch.onclick = clearPortalSearch;

    const focusGomez = $("#portalFocusGomezButton");
    if (focusGomez) focusGomez.onclick = function () { focusPortalSources(["evmGomez"]); };
    const focusJethro = $("#portalFocusJethroButton");
    if (focusJethro) focusJethro.onclick = function () { focusPortalSources(["evmJethro"]); };
    const focusBsv = $("#portalFocusBsvButton");
    if (focusBsv) focusBsv.onclick = function () { focusPortalSources(["bsv"]); };
    const showAll = $("#portalShowAllSourcesButton");
    if (showAll) showAll.onclick = function () { focusPortalSources(PORTAL_FILTER_IDS.slice()); };

    if (saveCurrentTx) saveCurrentTx.onclick = async function () {
      try { await saveCurrentTransaction(); }
      catch (error) { setStatus(error.message || String(error), true); }
    };

    const streamList = $("#portalTransactionList");
    bindPortalPageSwipe();
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
      if (recordCatalogConfig) recordCatalogConfig.then(function () { refreshDirectPolygon(); refreshOptionalFileProxy(); }).catch(function () {});
    });
    window.addEventListener("chisel:mode", function (event) {
      if (event.detail && event.detail.mode === "portal") {
        restoreRecentPolygon();
        revealRecentPolygon();
        refreshLiveLedger();
        if (recordCatalogConfig) recordCatalogConfig.then(function () { refreshDirectPolygon(); refreshOptionalFileProxy(); }).catch(function () {});
      }
    });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && configBool("liveLedgerRefreshOnFocus", true)) { refreshLiveLedger(); refreshDirectPolygon(); }
    });

    recordCatalogConfig = loadPortalConfig().then(function (config) {
      applyPortalConfig(config);
      applyEvmProfileConfig();
    });
    let portalBackgroundStarted = false;
    function startPortalBackground() {
      if (portalBackgroundStarted || document.body.dataset.mode !== "portal") return;
      portalBackgroundStarted = true;
      applyPortalFilterConfig();
      restoreRecentFeed();
      // Small bundled first page only on a cold start; full archive follows.
      if (!state.portalRows.length) {
        const script = document.createElement("script");
        script.src = "data-bundled/portal-first-page.js?rev=20261125-fast-feed-v2894";
        script.onload = function () {
          const data = window.CHISEL_PORTAL_FIRST_PAGE;
          if (data) mergeStaticRows(normalizeStaticDatasetRows(data,{baseUrl:"./data-bundled/",sourceLabel:"bundled first page",sourceBadge:"bundled"}));
          window.setTimeout(ensureStarterDataset,100);
        };
        script.onerror = ensureStarterDataset;
        document.head.appendChild(script);
      } else window.setTimeout(ensureStarterDataset,100);
      loadColorMap(DEFAULT_COLOR_PATH).catch(function (error) {
        setStatus(error.message || String(error), true);
      });
      recordCatalogConfig.then(function () {
      initializePortalInteractions();
      // A saved public identity is the homepage. The generic indexes remain
      // available through explicit navigation, never as an automatic takeover.
      if (state.personalAccount && !state.urlMainThunderwordRequest && !(recordView && recordView.active())) {
        loadPersonalAccountStream(state.personalAccount, {
          filterResults:false, noReloadIfCurrent:false,
          captureReturnView:false, source:"remembered", updateUrl:false
        }).catch(function (error) {
          setStatus("Your account could not refresh: " + (error.message || String(error)) + ". Public identity remains saved.",true);
        });
      }
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
      startEvmContractPolling();
      startIndexedChiselPolling();
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
      startEvmContractPolling();
      startIndexedChiselPolling();
      if (configBool("autoSearchLedgersAfterStatic", true)) maybeAutoLoadConversationStreams();
      if (state.personalAccount && !state.urlMainThunderwordRequest && !(recordView && recordView.active())) {
        loadPersonalAccountStream(state.personalAccount, {filterResults:false, noReloadIfCurrent:false, captureReturnView:false, updateUrl:false}).catch(function () {});
      }
      startLiveLedgerPolling();
      });
    }
    window.addEventListener("chisel:mode", startPortalBackground);
    // Defer the initial Portal workload until after the shell can paint.
    window.setTimeout(function () {
      startPortalBackground();
      if (document.body.dataset.mode === "portal") restoreRecentPolygon();
    }, 0);
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
    trackPolygonHash: trackPolygonHash,
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
    clearPortalSearch: clearPortalSearch,
    clearPortalStream: clearPortalStream,
    loadSelectedEvmCatalogs: loadSelectedEvmCatalogs,
    fetchEvmCatalogRows: fetchEvmCatalogRows,
    listLocalTransactions: listLocalTransactions,
    loadLocalTransaction: loadLocalTransaction,
    loadLocalTransactionPath: loadLocalTransactionPath,
    hydrateLocalRowsInBackground: hydrateLocalRowsInBackground,
    downloadRawTransactionJson: downloadRawTransactionJson,
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
