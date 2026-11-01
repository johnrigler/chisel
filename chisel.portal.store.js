(function (root) {
  "use strict";

  // Record identity and merging are independent of rendering and transport.
  // Keep the v2.8.18 identity rules, row objects and cache format unchanged.
  function normalizeCoinName(value) {
    const clean = String(value || "").trim().toLowerCase();
    if (!clean) return "";
    const compact = clean.replace(/[^a-z0-9]+/g, "");
    const aliases = {
      dgb: "digibyte",
      digibyte: "digibyte",
      rvn: "ravencoin",
      raven: "ravencoin",
      ravencoin: "ravencoin",
      ltc: "litecoin",
      litecoin: "litecoin",
      tltc: "litecoinTestnet",
      litecointestnet: "litecoinTestnet",
      btc: "bitcoin",
      bitcoin: "bitcoin",
      doge: "dogecoin",
      dogecoin: "dogecoin",
      xec: "ecash",
      ecash: "ecash",
      etoken: "ecash",
      evm: "evm",
      eth: "evm",
      ethereum: "evm",
      polygon: "evm",
      matic: "evm"
    };
    return aliases[compact] || clean;
  }

  function tickerForCoin(value) {
    const coin = normalizeCoinName(value);
    if (coin === "digibyte") return "DGB";
    if (coin === "ravencoin") return "RVN";
    if (coin === "litecoin") return "LTC";
    if (coin === "litecoinTestnet") return "tLTC";
    if (coin === "bitcoin") return "BTC";
    if (coin === "dogecoin") return "DOGE";
    if (coin === "ecash") return "XEC";
    if (coin === "evm") return "EVM";
    return "";
  }

  function rawCoinFromRow(row) {
    const s = row && row.summary ? row.summary : {};
    const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
    return normalizeCoinName(row && (row.coin || row.ticker)) ||
      normalizeCoinName(s.coin || s.ticker || s.chain) ||
      normalizeCoinName(raw.coin || raw.ticker || raw.chain) || "";
  }

  function canonicalCoinForRow(row) {
    const explicit = rawCoinFromRow(row);
    if (explicit) return explicit;
    const entry = row && row.index ? row.index : {};
    return normalizeCoinName(entry.coin || entry.ticker || entry.name) || "unknown";
  }

  function rowKey(row) {
    const coin = canonicalCoinForRow(row);
    // UTXO identity belongs to the chain and TXID, regardless of which
    // index, cache or live provider discovered it. Keep EVM source views.
    const chain = tickerForCoin(coin) && coin !== "evm" ? coin : sourceIdForRow(row);
    return chain + ":" + String(row && row.txid || "").toLowerCase();
  }

  function sourceIdForRow(row) {
    if (row && row.sourceId) return String(row.sourceId);
    const s = row && row.summary ? row.summary : {};
    const entry = row && row.index ? row.index : {};
    const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
    const rawContract = raw.contract && typeof raw.contract === "object" ? raw.contract : {};
    const coin = canonicalCoinForRow(row);
    const contractName = String(s.contractName || entry.contractName || rawContract.name || "").toLowerCase();
    const contractAddress = String(s.contractAddress || entry.contractAddress || rawContract.address || "").toLowerCase();

    if (coin === "digibyte") return "digibyte";
    if (coin === "ravencoin") return "ravencoin";
    if (coin === "litecoin") return "litecoin";
    if (coin === "bitcoin") return "bitcoin";
    if (coin === "dogecoin") return "dogecoin";
    if (coin === "ecash") return "ecash";
    if (coin === "evm" || contractName || contractAddress.match(/^0x/)) {
      if (contractName.indexOf("gomez") !== -1 || contractAddress.indexOf("5a2220d56f56") !== -1) return "evmGomez";
      if (contractName.indexOf("jethro") !== -1 || contractAddress.indexOf("0076416c84c7") !== -1) return "evmJethro";
      return "other";
    }
    return "other";
  }

  function normalizeUnixTime(value) {
    if (value === undefined || value === null || value === "") return 0;
    let n = Number(value);
    if (!Number.isFinite(n)) {
      const parsed = Date.parse(String(value));
      if (!Number.isNaN(parsed)) n = parsed / 1000;
    }
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (n > 1000000000000) n = n / 1000;
    return Math.floor(n);
  }

  function safeArray(value) { return Array.isArray(value) ? value : []; }
  function isLikelyUrl(value) { return /^https?:\/\/\S+/i.test(String(value || "").trim()); }

  const RECENT_PORTAL_CACHE_KEY = "chisel.portal.recentDisplay.v1";
  const RECENT_PORTAL_CACHE_LIMIT = 60;

  function createStore(options) {
    const deps = options || {};
    // These two public data fields remain shared with CHISEL_PORTAL.state.
    // UI state, timers, sorting and request scheduling stay with the caller.
    const records = deps.records || {portalRows: [], portalRowKeys: Object.create(null)};
    const extractBlockTime = deps.extractBlockTime;
    const normalizeMediaUrl = deps.normalizeMediaUrl;
    const TXID_RE = /^[0-9a-fA-F]{64}$/;
    let recentPortalSummaries = null;

    function mergeSummary(existingSummary, incomingSummary) {
      const previous = existingSummary && typeof existingSummary === "object" ? existingSummary : {};
      const incoming = incomingSummary && typeof incomingSummary === "object" ? incomingSummary : {};
      const merged = Object.assign({}, previous, incoming);
      // Index/address refreshes often omit display data already decoded from
      // this immutable transaction. Keep it until a richer value arrives.
      ["opReturnText", "primaryUrl", "cleanText", "imageAssetPath", "imageMime", "ledgerFinance"].forEach(function (field) {
        if (!incoming[field] && previous[field]) merged[field] = previous[field];
      });
      ["opReturnUrls", "mediaCards", "imageChordLines"].forEach(function (field) {
        if (!safeArray(incoming[field]).length && safeArray(previous[field]).length) merged[field] = previous[field];
      });
      if (safeArray(previous.mediaCards).length && safeArray(incoming.mediaCards).length) {
        const cards = previous.mediaCards.slice();
        incoming.mediaCards.forEach(function (card) {
          if (!card || typeof card !== "object") return;
          const url = normalizeMediaUrl(card.url || card.sourceUrl || "");
          const index = url ? cards.findIndex(function (old) {
            return old && normalizeMediaUrl(old.url || old.sourceUrl || "") === url;
          }) : -1;
          if (index < 0) { cards.push(card); return; }
          const old = cards[index];
          const updated = Object.assign({}, old, card);
          Object.keys(old).forEach(function (field) {
            if (card[field] === undefined || card[field] === null || card[field] === "") updated[field] = old[field];
          });
          if (old.title && isLikelyUrl(card.title)) updated.title = old.title;
          cards[index] = updated;
        });
        merged.mediaCards = cards;
      }
      if (previous.title && (!incoming.title || isLikelyUrl(incoming.title) ||
          /^(?:(?:evm )?transaction(?:\s|$)|untitled transaction$)/i.test(incoming.title))) {
        merged.title = previous.title;
      }
      const previousTime = normalizeUnixTime(previous.blockTime || previous.block_time || previous.time || previous.timestamp);
      const incomingTime = normalizeUnixTime(incoming.blockTime || incoming.block_time || incoming.time || incoming.timestamp);
      const previousIsExact = previousTime && !previous.blockTimeEstimated;
      const incomingIsExact = incomingTime && !incoming.blockTimeEstimated;

      if (incomingIsExact || (!previousIsExact && incomingTime)) {
        merged.blockTime = incomingTime;
        merged.blockTimeEstimated = !incomingIsExact;
      } else if (previousTime) {
        merged.blockTime = previousTime;
        merged.blockTimeEstimated = !!previous.blockTimeEstimated;
      } else {
        merged.blockTime = 0;
      }

      const previousHeight = Number(previous.blockHeight || previous.block_height || 0) || 0;
      const incomingHeight = Number(incoming.blockHeight || incoming.block_height || 0) || 0;
      merged.blockHeight = incomingHeight > 0 ? incomingHeight : (previousHeight > 0 ? previousHeight : undefined);
      return merged;
    }

    function readRecentPortalSummaries() {
      if (recentPortalSummaries) return recentPortalSummaries;
      recentPortalSummaries = new Map();
      try {
        const saved = JSON.parse((deps.readStorage ? deps.readStorage(RECENT_PORTAL_CACHE_KEY) : null) || "[]");
        safeArray(saved).slice(0, RECENT_PORTAL_CACHE_LIMIT).forEach(function (row) {
          if (row && typeof row.key === "string" && row.summary && typeof row.summary === "object") {
            recentPortalSummaries.set(row.key, row.summary);
          }
        });
      } catch (error) {}
      return recentPortalSummaries;
    }

    function snapshotRecent(orderedRows, persist) {
      const previous = readRecentPortalSummaries();
      const next = new Map();
      safeArray(orderedRows).slice(0, RECENT_PORTAL_CACHE_LIMIT).forEach(function (row) {
        const summary = {};
        // Store public presentation fields only; raw transactions, accounts,
        // transport credentials and ledger-verification state are excluded.
        ["txid", "title", "primaryUrl", "cleanText", "opReturnText", "opReturnUrls", "mediaCards",
          "lines", "imageLines", "imageChordLines", "ipfsCount", "imageCount", "imageAssetPath",
          "imageMime", "imageBytes", "imageWidth", "imageHeight", "imageAssetId", "artifactId",
          "artifactAddress", "blockHeight", "blockTime", "blockTimeEstimated", "ledgerFinance"].forEach(function (field) {
          if (row.summary && row.summary[field] !== undefined) summary[field] = row.summary[field];
        });
        if (JSON.stringify(summary).length <= 32768) next.set(row.key || rowKey(row), summary);
      });
      previous.forEach(function (summary, key) {
        if (next.size < RECENT_PORTAL_CACHE_LIMIT && !next.has(key)) next.set(key, summary);
      });
      recentPortalSummaries = next;
      if (persist === false) return;
      try {
        if (deps.writeStorage) deps.writeStorage(RECENT_PORTAL_CACHE_KEY, JSON.stringify(Array.from(next, function (entry) {
          return {key: entry[0], summary: entry[1]};
        })));
      } catch (error) { if (deps.onStorageError) deps.onStorageError(error); }
    }

    function upsert(row, opts) {
      if (!row || !TXID_RE.test(String(row.txid || ""))) return null;
      const key = rowKey(row);
      row.summary = mergeSummary(readRecentPortalSummaries().get(key), row.summary);
      const existing = records.portalRowKeys[key];
      const publicationUpdate = !!(opts && opts.publicationUpdate);
      const previousRowTime = existing ? extractBlockTime(existing) : 0;
      const incomingRowTime = extractBlockTime(row);
      const merged = existing ? Object.assign(existing, row, {
        summary: publicationUpdate ? mergeSummary(row.summary, existing.summary) : mergeSummary(existing.summary, row.summary),
        blockTime: incomingRowTime || previousRowTime || 0,
        confirmed: typeof row.confirmed === "boolean" ? row.confirmed : existing.confirmed,
        receivedTime: row.receivedTime || existing.receivedTime,
        raw: publicationUpdate ? existing.raw || row.raw : row.raw || existing.raw,
        index: publicationUpdate ? existing.index || row.index : row.index || existing.index,
        coin: canonicalCoinForRow(row) || row.coin || existing.coin,
        localPath: row.localPath || existing.localPath,
        staticRawPath: row.staticRawPath || existing.staticRawPath,
        staticRawUrl: row.staticRawUrl || existing.staticRawUrl,
        staticBaseUrl: row.staticBaseUrl || existing.staticBaseUrl,
        staticRemoteBaseUrls: row.staticRemoteBaseUrls || existing.staticRemoteBaseUrls,
        staticSource: row.staticSource || existing.staticSource,
        sourceId: row.sourceId || existing.sourceId,
        discoverySource: publicationUpdate ? existing.discoverySource || row.discoverySource : row.discoverySource || existing.discoverySource
      }) : Object.assign({}, row, { key: key });

      // Locally reviewed media is display data. Retain it as normal discovery
      // replaces this same chain/TXID row, without letting a cache mark it seen.
      if (merged.publication) {
        ["title", "primaryUrl", "opReturnUrls", "mediaCards"].forEach(function (field) {
          if (merged.publication.summary[field]) merged.summary[field] = merged.publication.summary[field];
        });
      }

      if (!existing) {
        records.portalRowKeys[key] = merged;
        records.portalRows.push(merged);
      }

      return merged;
    }

    function reset() {
      records.portalRows = [];
      records.portalRowKeys = Object.create(null);
    }

    return {
      records: records,
      upsert: upsert,
      mergeSummary: mergeSummary,
      snapshotRecent: snapshotRecent,
      reset: reset
    };
  }

  root.CHISEL_PORTAL_STORE = {
    normalizeCoinName: normalizeCoinName,
    tickerForCoin: tickerForCoin,
    canonicalCoinForRow: canonicalCoinForRow,
    sourceIdForRow: sourceIdForRow,
    rowKey: rowKey,
    normalizeUnixTime: normalizeUnixTime,
    createStore: createStore
  };
})(window);
