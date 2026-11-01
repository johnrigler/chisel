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
    const p = staticDataPath(path).replace(/^\/+/, "");
    if (!p) return String(base || "");
    if (isAbsoluteUrl(p)) return p;
    const b = String(base || "");
    if (!b) return p;
    return trimUrlSlash(b) + "/" + p;
  }

  function staticDataPath(value) {
    return String(value || "").replace(/^data-root:/i, "").replace(/^data\/(?=(?:transactions|assets|index)\/)/i, "");
  }

  function sourceLocation(value, pageUrl) {
    const text = String(value || "").trim();
    const url = new URL(text, pageUrl || undefined);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Static data needs an HTTP(S) URL without credentials.");
    if (!/\.json$/i.test(url.pathname) && !url.pathname.endsWith("/")) url.pathname += "/";
    const currency = url.pathname.match(/^(.*\/)transactions\/([^/]+)\/$/);
    const rootUrl = new URL(currency ? currency[1] : /\/index\/[^/]+\.json$/i.test(url.pathname) ? "../" : "./", url).href;
    return {url: url.href, source: text, baseUrl: rootUrl, coin: currency ? normalizeProbeCoin(currency[2]) : ""};
  }

  function txidFromFilename(value) {
    const name = decodeURIComponent(String(value || "").split("/").pop());
    if (/^[0-9a-f]{64}\.json$/i.test(name)) return name.slice(0, -5).toLowerCase();
    const match = name.match(/^([1-9A-HJ-NP-Za-km-z]{1,45})-([0-9a-f]{12})\.json$/i);
    if (!match) return "";
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let number = 0n;
    for (const letter of match[1]) {
      const digit = alphabet.indexOf(letter);
      if (digit < 0) return "";
      number = number * 58n + BigInt(digit);
    }
    const hex = number.toString(16).padStart(64, "0");
    return hex.length === 64 && hex.startsWith(match[2].toLowerCase()) ? hex : "";
  }

  function directoryFiles(html, directoryUrl) {
    const base = new URL(directoryUrl);
    const out = [], seen = new Set();
    const links = String(html || "").matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi);
    for (const match of links) {
      try {
        const url = new URL(match[2].replace(/&amp;/g, "&"), base);
        const name = url.pathname.slice(base.pathname.length);
        if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || name.includes("/") || url.search || url.hash) continue;
        const txid = txidFromFilename(name);
        if (!txid || seen.has(txid)) continue;
        seen.add(txid);
        out.push({txid: txid, rawUrl: url.href});
      } catch (_) {}
    }
    return out;
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
        staticRawPath: staticDataPath(row.rawPath || row.path || ""),
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

    async function request(url, options, read, timeoutMs) {
      const Controller = deps.AbortController || root.AbortController;
      const controller = Controller ? new Controller() : null;
      const timer = deps.setTimeout || root.setTimeout && root.setTimeout.bind(root);
      const clear = deps.clearTimeout || root.clearTimeout && root.clearTimeout.bind(root);
      const external = options && options.signal;
      const abort = function () { if (controller) controller.abort(); };
      if (external && controller) {
        if (external.aborted) controller.abort();
        else external.addEventListener("abort", abort, {once: true});
      }
      let timerId;
      try {
        const pending = Promise.resolve().then(function () {
          return fetchFn(url, Object.assign({}, options, controller ? {signal: controller.signal} : {}));
        }).then(read);
        if (!timer || !(timeoutMs > 0)) return await pending;
        return await Promise.race([pending, new Promise(function (_, reject) {
          timerId = timer(function () {
            abort();
            const error = new Error(String(url) + " timed out after " + timeoutMs + " ms.");
            error.name = "TimeoutError";
            reject(error);
          }, timeoutMs);
        })]);
      } finally {
        if (timerId !== undefined && clear) clear(timerId);
        if (external && controller) external.removeEventListener("abort", abort);
      }
    }

    async function fetchJsonNoStore(url) {
      return request(url, {cache: "no-store"}, function (response) {
        if (!response.ok) throw new Error(url + " failed with HTTP " + response.status + ".");
        return response.json();
      }, deps.timeoutMs || 8000);
    }

    function manifestBases(manifest, manifestUrl) {
      const absolute = isAbsoluteUrl(manifestUrl) || deps.baseUrl ? new URL(manifestUrl, deps.baseUrl).href : manifestUrl;
      const directory = dirnameUrl(absolute);
      const declared = manifest.baseUrl || directory;
      const baseUrl = isAbsoluteUrl(directory) ? new URL(declared, directory).href : declared;
      return Array.from(new Set([baseUrl, directory]));
    }

    async function loadManifest(manifestUrl) {
      const manifest = await fetchJsonNoStore(manifestUrl);
      const indexPath = manifest.defaultIndex || "index/portal.index.json";
      let error;
      for (const base of manifestBases(manifest, manifestUrl)) {
        const indexUrl = joinDataPath(base, indexPath);
        try { return {manifest: manifest, baseUrl: base, indexUrl: indexUrl, index: await fetchJsonNoStore(indexUrl)}; }
        catch (caught) { error = caught; }
      }
      throw error;
    }

    async function loadCatalog(source) {
      const location = sourceLocation(source, deps.baseUrl);
      if (/\.json$/i.test(new URL(location.url).pathname)) {
        const json = await fetchJsonNoStore(location.url);
        if (json.defaultIndex || json.hashes) return loadManifest(location.url);
        return Object.assign(location, {index: json, indexUrl: location.url});
      }
      const errors = [];
      let catalog = null;
      for (const path of ["index/transactions.index.json", "index/portal.index.json"]) {
        const indexUrl = joinDataPath(location.baseUrl, path);
        try {
          const json = await fetchJsonNoStore(indexUrl);
          let rows = Array.isArray(json) ? json : json.transactions;
          if (!Array.isArray(rows)) throw new Error("Static index has no transactions array.");
          if (location.coin) rows = rows.filter(function (row) { return normalizeProbeCoin(row.coin || row.summary && row.summary.coin) === location.coin; });
          if (!rows.length) throw new Error("Static index has no matching transactions.");
          catalog = Object.assign({}, location, {index: {transactions: rows}, indexUrl: indexUrl});
          break;
        } catch (error) { errors.push(error.message || String(error)); }
      }
      const directories = location.coin ? [location.url] : [joinDataPath(location.baseUrl, "transactions/litecoin/")];
      for (const directory of directories) {
        try {
          const html = await request(directory, {cache: "no-store"}, function (response) {
            if (!response.ok) throw new Error(directory + " failed with HTTP " + response.status);
            return response.text();
          }, deps.timeoutMs || 8000);
          const coin = location.coin || "litecoin";
          const rows = directoryFiles(html, directory).map(function (row) { return Object.assign({coin: coin}, row); });
          if (!rows.length) throw new Error("No transaction JSON files found at " + directory);
          const combined = new Map();
          if (catalog) catalog.index.transactions.forEach(function (row) { combined.set((row.coin || "") + ":" + row.txid, row); });
          rows.forEach(function (row) {
            const key = row.coin + ":" + row.txid;
            combined.set(key, Object.assign({}, combined.get(key), row));
          });
          return Object.assign({}, location, {index: {transactions: Array.from(combined.values())}, indexUrl: catalog ? catalog.indexUrl : directory});
        } catch (error) { errors.push(error.message || String(error)); }
      }
      if (catalog) return catalog;
      throw new Error("Static HTTP data unavailable: " + errors.join(" | "));
    }

    async function fetchStaticRawFromRow(row, canonicalCoinForRow) {
      const paths = rawPathsForRow(row || {});
      const errors = [];
      for (let i = 0; i < paths.length; i += 1) {
        try {
          const json = await fetchJsonNoStore(paths[i]);
          const tx = json && json.tx || json;
          const actual = String(json && (json.txid || json.hash) || tx && (tx.txid || tx.hash) || "").replace(/^0x/i, "").toLowerCase();
          if (row.txid && actual !== String(row.txid).toLowerCase()) throw new Error("Static transaction identity does not match the requested TXID.");
          return {
            json: json,
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
          const hashes = manifest.hashes || {};
          const paths = Object.keys(hashes);
          for (let j = 0; j < paths.length; j += 1) {
            const path = paths[j];
            let buffer, failure;
            for (const base of manifestBases(manifest, manifestUrl)) {
              const url = joinDataPath(base, path);
              try {
                buffer = await request(url, {cache: "no-store"}, function (response) {
                  if (!response.ok) throw new Error(url + " failed with HTTP " + response.status);
                  return response.arrayBuffer();
                }, deps.timeoutMs || 8000);
                break;
              } catch (error) { failure = error; }
            }
            if (!buffer) throw failure;
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
      request: request,
      fetchJsonNoStore: fetchJsonNoStore,
      loadManifest: loadManifest,
      loadCatalog: loadCatalog,
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
    staticDataPath: staticDataPath,
    sourceLocation: sourceLocation,
    directoryFiles: directoryFiles,
    txidFromFilename: txidFromFilename,
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
