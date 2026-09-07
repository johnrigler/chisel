(function (root) {
  "use strict";

  function isAbsoluteUrl(value) {
    return /^https?:\/\//i.test(String(value || ""));
  }

  function trimUrlSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function dirnameUrl(value) {
    const text = String(value || "");
    const idx = text.lastIndexOf("/");
    return idx >= 0 ? text.slice(0, idx + 1) : "";
  }

  function joinDataPath(base, path) {
    const p = String(path || "").replace(/^\/+/, "");
    if (!p) return String(base || "");
    if (isAbsoluteUrl(p)) return p;
    const b = String(base || "");
    if (!b) return p;
    return trimUrlSlash(b) + "/" + p;
  }

  function normalizePathList(value, fallback) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return fallback || [];
  }

  function createNormalizer(options) {
    const deps = options || {};
    const normalizeCoinName = deps.normalizeCoinName || function (value) { return String(value || "").toLowerCase(); };
    const tickerForCoin = deps.tickerForCoin || function () { return ""; };
    const getCoinIndexByCoinName = deps.getCoinIndexByCoinName || function () { return null; };
    const shortTxid = deps.shortTxid || function (value) { return String(value || ""); };
    const txidRe = deps.txidRe || /^[0-9a-fA-F]{64}$/;

    function makeStaticIndexEntry(row) {
      const coin = normalizeCoinName(row.coin || row.chain || (row.summary && row.summary.coin) || "");
      if (coin === "evm" || row.chainId || row.contractName || row.contractAddress) {
        return {
          coin: "evm",
          ticker: "EVM",
          name: (row.contractName || "static") + " EVM",
          label: (row.contractName || "static") + " EVM static",
          chainId: String(row.chainId || "137"),
          contractName: row.contractName || (row.summary && row.summary.contractName) || "",
          contractAddress: row.contractAddress || (row.summary && row.summary.contractAddress) || ""
        };
      }
      return getCoinIndexByCoinName(coin || row.ticker || row.sourceId) || {
        coin: coin || row.coin || "unknown",
        ticker: row.ticker || tickerForCoin(coin) || "",
        name: row.sourceId || coin || "static",
        label: row.streamLabel || row.sourceId || coin || "static"
      };
    }

    function staticRowToPortalRow(item, context) {
      const row = item && typeof item === "object" ? item : {};
      const txid = String(row.txid || row.hash || "").replace(/^0x/i, "").toLowerCase();
      if (!txidRe.test(txid)) return null;
      const summary = Object.assign({}, row.summary || {});
      summary.txid = summary.txid || txid;
      summary.hash = summary.hash || row.hash || (row.coin === "evm" ? "0x" + txid : txid);
      summary.title = summary.title || row.title || ("transaction " + shortTxid(txid));
      summary.coin = summary.coin || row.coin || "";
      summary.ticker = summary.ticker || row.ticker || tickerForCoin(row.coin || "");
      if (!summary.blockTime && row.blockTime) summary.blockTime = row.blockTime;
      if (!summary.blockHeight && row.blockHeight) summary.blockHeight = row.blockHeight;
      if (row.contractName && !summary.contractName) summary.contractName = row.contractName;
      if (row.contractAddress && !summary.contractAddress) summary.contractAddress = row.contractAddress;

      const contextValue = context || {};
      return {
        index: row.index || makeStaticIndexEntry(row),
        coin: normalizeCoinName(row.coin || summary.coin || row.ticker || "") || row.coin || "unknown",
        txid: txid,
        raw: row.raw || null,
        summary: summary,
        blockTime: summary.blockTime || row.blockTime || 0,
        streamLabel: row.streamLabel || contextValue.sourceLabel || "static dataset",
        localPath: row.localPath || "",
        staticRawPath: row.rawPath || row.path || "",
        staticRawUrl: row.rawUrl || "",
        staticBaseUrl: contextValue.baseUrl || "",
        staticRemoteBaseUrls: normalizePathList(contextValue.remoteBaseUrls, []),
        staticSource: contextValue.sourceBadge || "static",
        sourceId: row.sourceId || "",
        discoverySource: row.discoverySource || "preloaded"
      };
    }

    function normalizeStaticDatasetRows(dataset, context) {
      const rows = Array.isArray(dataset) ? dataset : (dataset && (dataset.transactions || dataset.records || dataset.rows));
      return (Array.isArray(rows) ? rows : []).map(function (row) {
        return staticRowToPortalRow(row, context || {});
      }).filter(Boolean);
    }

    return {
      makeStaticIndexEntry: makeStaticIndexEntry,
      staticRowToPortalRow: staticRowToPortalRow,
      normalizeStaticDatasetRows: normalizeStaticDatasetRows
    };
  }

  function rawPathsForRow(row) {
    const paths = [];
    if (row.staticRawUrl) paths.push(row.staticRawUrl);
    if (row.staticRawPath && row.staticBaseUrl) paths.push(joinDataPath(row.staticBaseUrl, row.staticRawPath));
    normalizePathList(row.staticRemoteBaseUrls, []).forEach(function (base) {
      if (row.staticRawPath) paths.push(joinDataPath(base, row.staticRawPath));
    });
    return paths;
  }

  function createTransport(options) {
    const deps = options || {};
    const fetchFn = deps.fetch;
    const cryptoApi = deps.crypto;
    if (typeof fetchFn !== "function") throw new Error("Static dataset transport requires fetch.");

    async function fetchJsonNoStore(url) {
      const response = await fetchFn(url, { cache: "no-store" });
      if (!response.ok) throw new Error(url + " failed with HTTP " + response.status + ".");
      return response.json();
    }

    async function loadManifest(manifestUrl) {
      const manifest = await fetchJsonNoStore(manifestUrl);
      const baseUrl = manifest.baseUrl ? manifest.baseUrl : dirnameUrl(manifestUrl);
      const indexPath = manifest.defaultIndex || "index/portal.index.json";
      const indexUrl = joinDataPath(baseUrl, indexPath);
      const index = await fetchJsonNoStore(indexUrl);
      return { manifest: manifest, baseUrl: baseUrl, indexUrl: indexUrl, index: index };
    }

    async function fetchStaticRawFromRow(row, canonicalCoinForRow) {
      const paths = rawPathsForRow(row || {});
      const errors = [];
      for (let i = 0; i < paths.length; i += 1) {
        try {
          return {
            json: await fetchJsonNoStore(paths[i]),
            source: row.staticSource || "static",
            url: paths[i],
            coin: row.coin || (canonicalCoinForRow ? canonicalCoinForRow(row) : "")
          };
        } catch (error) {
          errors.push(paths[i] + " => " + (error.message || String(error)));
        }
      }
      if (!paths.length) throw new Error("No static raw path is registered for this row.");
      throw new Error("Static transaction fetch failed: " + errors.join(" | "));
    }

    async function validateStaticDataset(manifestUrls) {
      const reports = [];
      const manifests = normalizePathList(manifestUrls, []);
      for (let i = 0; i < manifests.length; i += 1) {
        const manifestUrl = manifests[i];
        const report = { manifest: manifestUrl, ok: false, checks: [] };
        reports.push(report);
        try {
          const manifest = await fetchJsonNoStore(manifestUrl);
          const baseUrl = manifest.baseUrl ? manifest.baseUrl : dirnameUrl(manifestUrl);
          const hashes = manifest.hashes || {};
          const paths = Object.keys(hashes);
          for (let j = 0; j < paths.length; j += 1) {
            const path = paths[j];
            const url = joinDataPath(baseUrl, path);
            const response = await fetchFn(url, { cache: "no-store" });
            if (!response.ok) throw new Error(url + " failed with HTTP " + response.status);
            const buffer = await response.arrayBuffer();
            let digest = "";
            if (cryptoApi && cryptoApi.subtle) {
              const hashBuffer = await cryptoApi.subtle.digest("SHA-256", buffer);
              digest = Array.from(new Uint8Array(hashBuffer)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
            }
            const expected = String(hashes[path] || "").replace(/^sha256-/i, "");
            report.checks.push({ path: path, bytes: buffer.byteLength, expected: expected, actual: digest, ok: digest ? digest === expected : "crypto.subtle unavailable" });
          }
          report.ok = report.checks.every(function (check) { return check.ok === true || check.ok === "crypto.subtle unavailable"; });
        } catch (error) {
          report.error = error.message || String(error);
        }
      }
      return reports;
    }

    return {
      fetchJsonNoStore: fetchJsonNoStore,
      loadManifest: loadManifest,
      fetchStaticRawFromRow: fetchStaticRawFromRow,
      validateStaticDataset: validateStaticDataset
    };
  }

  function normalizeProbeCoin(value) {
    const compact = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const aliases = {
      dgb: "digibyte",
      digibyte: "digibyte",
      rvn: "ravencoin",
      raven: "ravencoin",
      ravencoin: "ravencoin",
      ltc: "litecoin",
      litecoin: "litecoin",
      tltc: "litecointestnet",
      litecointestnet: "litecointestnet",
      btc: "bitcoin",
      bitcoin: "bitcoin",
      doge: "dogecoin",
      dogecoin: "dogecoin",
      polygon: "evm",
      matic: "evm",
      eth: "evm",
      evm: "evm"
    };
    return aliases[compact] || compact;
  }

  function portalModeActive() {
    if (root.document && root.document.body && root.document.body.dataset && root.document.body.dataset.mode === "portal") return true;
    try {
      return new URL(root.location.href).searchParams.get("mode") === "portal";
    } catch (error) {
      return false;
    }
  }

  function existingPortalTxids(portal) {
    const seen = new Set();
    const rows = portal && portal.state && Array.isArray(portal.state.portalRows) ? portal.state.portalRows : [];
    rows.forEach(function (row) {
      const txid = String(row && row.txid || "").replace(/^0x/i, "").toLowerCase();
      if (/^[0-9a-f]{64}$/.test(txid)) seen.add(txid);
    });
    return seen;
  }

  function probeIndexes(portal, thunderwords) {
    const stream = portal && portal.state ? portal.state.mainThunderword : null;
    if (stream) {
      let current = portal.state.currentIndex || null;
      const wantedCoin = normalizeProbeCoin(stream.coin || stream.ticker);
      if (!current || !current.canFetchAddress || normalizeProbeCoin(current.coin || current.ticker || current.name) !== wantedCoin) {
        current = thunderwords.listIndexes().find(function (entry) {
          return entry.canFetchAddress && normalizeProbeCoin(entry.coin || entry.ticker || entry.name) === wantedCoin;
        }) || current;
      }
      if (!current || !current.canFetchAddress) return [];
      return [Object.assign({}, current, { address: stream.address })];
    }

    return thunderwords.listIndexes().filter(function (entry) {
      return entry && entry.group === "general" && entry.canFetchAddress && entry.address;
    });
  }

  function installLiveLedgerRefresh(options) {
    if (root.__CHISEL_PORTAL_LIVE_REFRESH__) return root.__CHISEL_PORTAL_LIVE_REFRESH__;
    const defaults = options || {};
    const controller = {
      running: false,
      timer: null,
      lastProbeAt: 0,
      lastChangeAt: 0,
      lastNewTxids: [],
      errors: []
    };

    function configValue(name, fallback) {
      const portal = root.CHISEL_PORTAL;
      const config = portal && portal.state && portal.state.config ? portal.state.config : {};
      return Object.prototype.hasOwnProperty.call(config, name) ? config[name] : fallback;
    }

    function intervalMs() {
      const requested = Number(configValue("liveLedgerRefreshMs", defaults.liveLedgerRefreshMs == null ? 120000 : defaults.liveLedgerRefreshMs));
      if (!Number.isFinite(requested) || requested <= 0) return 0;
      return Math.max(30000, requested);
    }

    async function refresh() {
      const portal = root.CHISEL_PORTAL;
      const thunderwords = root.CHISEL_THUNDERWORDS;
      if (controller.running || !portalModeActive() || !portal || !portal.state || !thunderwords || typeof thunderwords.fetchAddressTransactions !== "function") return { changed: false, skipped: true };
      if (configValue("liveLedgerRefresh", true) === false) return { changed: false, disabled: true };

      controller.running = true;
      controller.errors = [];
      const known = existingPortalTxids(portal);
      const indexes = probeIndexes(portal, thunderwords);
      const newTxids = [];
      let changedEntry = null;
      try {
        for (let i = 0; i < indexes.length; i += 1) {
          const entry = indexes[i];
          try {
            const result = await thunderwords.fetchAddressTransactions(entry, entry.address);
            const transactions = result && Array.isArray(result.transactions) ? result.transactions : [];
            for (let j = 0; j < transactions.length; j += 1) {
              const txid = String(transactions[j] && transactions[j].txid || "").replace(/^0x/i, "").toLowerCase();
              if (/^[0-9a-f]{64}$/.test(txid) && !known.has(txid) && newTxids.indexOf(txid) < 0) {
                newTxids.push(txid);
                changedEntry = changedEntry || entry;
              }
            }
          } catch (error) {
            controller.errors.push({
              index: entry.name || entry.label || entry.address,
              error: error.message || String(error)
            });
          }
        }

        controller.lastProbeAt = Date.now();
        controller.lastNewTxids = newTxids.slice();
        if (!newTxids.length) return { changed: false, newTxids: [] };

        const stream = portal.state.mainThunderword;
        if (stream && typeof portal.loadAddressIndex === "function") {
          const entry = changedEntry || portal.state.currentIndex;
          await portal.loadAddressIndex(Object.assign({}, entry, { address: stream.address }), stream.address, { mainThunderword: stream });
        } else if (typeof portal.loadConversationStreams === "function") {
          await portal.loadConversationStreams({ reset: false });
        }
        controller.lastChangeAt = Date.now();
        return { changed: true, newTxids: newTxids };
      } finally {
        controller.running = false;
      }
    }

    function schedule() {
      if (controller.timer) root.clearTimeout(controller.timer);
      const ms = intervalMs();
      if (!ms) {
        controller.timer = null;
        return;
      }
      controller.timer = root.setTimeout(function tick() {
        refresh().catch(function (error) {
          controller.errors.push({ index: "refresh", error: error.message || String(error) });
        }).finally(schedule);
      }, ms);
    }

    controller.refresh = refresh;
    controller.schedule = schedule;
    root.__CHISEL_PORTAL_LIVE_REFRESH__ = controller;

    function start() {
      schedule();
      root.setTimeout(function () {
        refresh().catch(function () {});
      }, Math.max(5000, Number(defaults.initialDelayMs) || 15000));
    }

    if (root.document && root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start);
    else start();

    root.addEventListener("focus", function () {
      if (configValue("liveLedgerRefreshOnFocus", true) === false) return;
      const staleAfter = Math.max(30000, Number(configValue("liveLedgerRefreshFocusStaleMs", 60000)) || 60000);
      if (!controller.lastProbeAt || Date.now() - controller.lastProbeAt >= staleAfter) refresh().catch(function () {});
    });

    return controller;
  }

  root.CHISEL_PORTAL_STATIC_DATA = {
    isAbsoluteUrl: isAbsoluteUrl,
    trimUrlSlash: trimUrlSlash,
    dirnameUrl: dirnameUrl,
    joinDataPath: joinDataPath,
    normalizePathList: normalizePathList,
    rawPathsForRow: rawPathsForRow,
    createNormalizer: createNormalizer,
    createTransport: createTransport,
    installLiveLedgerRefresh: installLiveLedgerRefresh
  };

  installLiveLedgerRefresh();
})(window);
