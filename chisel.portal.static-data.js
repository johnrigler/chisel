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
    if (/^(?:0x)?[0-9a-f]{64}\.json$/i.test(name)) return name.slice(0, -5).replace(/^0x/i, "").toLowerCase();
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

  // Only direct, same-origin children of the public transactions directory.
  function currencyDirectories(html, directoryUrl) {
    const base = new URL(directoryUrl);
    const found = new Map();
    for (const match of String(html || "").matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) {
      try {
        const url = new URL(match[2].replace(/&amp;/g, "&"), base);
        const name = url.pathname.slice(base.pathname.length);
        if (url.origin !== base.origin || url.username || url.password ||
            !url.pathname.startsWith(base.pathname) || url.search || url.hash ||
            !/^[a-zA-Z0-9][a-zA-Z0-9_-]*\/$/.test(name)) continue;
        found.set(url.href, {directory: url.href, coin: normalizeProbeCoin(name.slice(0, -1))});
      } catch (_) {}
    }
    return Array.from(found.values());
  }

  function inventoryLines(text) {
    return Array.from(new Set(String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean)));
  }

  function inventoryDirectories(text, directory) {
    return inventoryLines(text).filter(name => /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name))
      .map(name => ({directory: new URL(name + "/", directory).href, coin: normalizeProbeCoin(name)}));
  }

  function inventoryFiles(text, directory) {
    const rows = new Map();
    for (const name of inventoryLines(text)) {
      if (!/^[A-Za-z0-9-]+\.json$/.test(name)) continue;
      const txid = txidFromFilename(name);
      if (txid && !rows.has(txid)) rows.set(txid, {txid, rawUrl: new URL(name, directory).href});
    }
    return Array.from(rows.values());
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
    const cache = deps.cache;
    const pendingReads = new Map(), failedReads = new Map();
    let readGeneration = 0;
    const now = deps.now || Date.now;
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

    function cacheKey(url, group, identity) {
      try {
        const parsed = new URL(url, deps.baseUrl);
        if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return "";
        if (Array.from(parsed.searchParams.keys()).some(function (key) { return /key|token|auth|secret|signature/i.test(key); })) return "";
        parsed.hash = "";
        return group + ":" + parsed.href + (identity ? ":" + identity : "");
      } catch (_) { return ""; }
    }

    function transient(error) {
      return !error.invalidData && (!error.status || error.status >= 500 || error.status === 429);
    }

    function readCached(url, group, parse, options) {
      const settings = options || {};
      const key = cacheKey(url, group, settings.identity);
      const pendingKey = (key || group + ":" + url) + (settings.refresh ? ":refresh" : "");
      if (pendingReads.has(pendingKey)) return pendingReads.get(pendingKey);
      const promise = (async function () {
        const generation = readGeneration;
        const epoch = cache && cache.generation();
        const saved = cache && key ? await cache.get(key) : null;
        let cachedValue;
        if (saved) { try { cachedValue = parse(saved.text); } catch (_) {} }
        const age = saved ? now() - saved.storedAt : Infinity;
        const freshMs = group === "transaction" ? 15 * 60000 : 5 * 60000;
        const staleMs = group === "transaction" ? 30 * 86400000 : 7 * 86400000;
        function reuse(offline) {
          cache.hit(offline);
          return {value: cachedValue, cached: true, offline: offline, savedAt: saved.storedAt};
        }
        if (cachedValue !== undefined && !settings.refresh && age >= 0 && age < freshMs) return reuse(false);
        const failed = failedReads.get(pendingKey);
        if (cachedValue !== undefined && age >= 0 && age < staleMs && !settings.refresh && failed &&
            now() - failed.at < 30000 && transient(failed.error)) return reuse(true);
        try {
          const text = await request(url, {cache: "no-cache"}, async function (response) {
            if (!response.ok) {
              const error = new Error(url + " failed with HTTP " + response.status + ".");
              error.status = response.status; throw error;
            }
            return response.text ? response.text() : JSON.stringify(await response.json());
          }, settings.timeoutMs || deps.timeoutMs || 8000);
          let value;
          try { value = parse(text); } catch (error) { error.invalidData = true; throw error; }
          if (generation === readGeneration) failedReads.delete(pendingKey);
          if (cache) {
            cache.downloaded(text);
            if (key && generation === readGeneration) await cache.put(key, text, group, epoch);
          }
          return {value: value, cached: false, offline: false};
        } catch (error) {
          if (generation === readGeneration) {
            if (failedReads.size >= 256) failedReads.delete(failedReads.keys().next().value);
            failedReads.set(pendingKey, {at: now(), error: error});
          }
          if (cachedValue !== undefined && age >= 0 && age < staleMs && transient(error)) return reuse(true);
          throw error;
        }
      })().finally(function () { if (pendingReads.get(pendingKey) === promise) pendingReads.delete(pendingKey); });
      pendingReads.set(pendingKey, promise);
      return promise;
    }

    async function fetchCatalogJson(url, settings) {
      return (await readCached(url, "catalog", JSON.parse, settings)).value;
    }

    async function fetchTransactionJson(url, row, settings) {
      const id = String(row && row.txid || "").replace(/^0x/i, "").toLowerCase();
      const result = await readCached(url, "transaction", function (text) {
        const json = JSON.parse(text), tx = json && json.tx || json;
        const actual = String(json && (json.txid || json.hash) || tx && (tx.txid || tx.hash) || "").replace(/^0x/i, "").toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(actual) || id && actual !== id) throw new Error("Static transaction identity does not match the requested TXID.");
        return json;
      }, Object.assign({}, settings, {identity: normalizeProbeCoin(row && row.coin) + ":" + String(row && (row.chainId || row.index && row.index.chainId) || "") + ":" + id}));
      return {json: result.value, cached: result.cached, offline: result.offline, savedAt: result.savedAt};
    }

    function manifestBases(manifest, manifestUrl) {
      const absolute = isAbsoluteUrl(manifestUrl) || deps.baseUrl ? new URL(manifestUrl, deps.baseUrl).href : manifestUrl;
      const directory = dirnameUrl(absolute);
      const declared = manifest.baseUrl || directory;
      const baseUrl = isAbsoluteUrl(directory) ? new URL(declared, directory).href : declared;
      return Array.from(new Set([baseUrl, directory]));
    }

    async function loadManifest(manifestUrl, settings, initialManifest) {
      const manifest = initialManifest || await fetchCatalogJson(manifestUrl, settings);
      const indexPath = manifest.defaultIndex || "index/portal.index.json";
      let error;
      for (const base of manifestBases(manifest, manifestUrl)) {
        const indexUrl = joinDataPath(base, indexPath);
        try { return {manifest: manifest, baseUrl: base, indexUrl: indexUrl, index: await fetchCatalogJson(indexUrl, settings)}; }
        catch (caught) { error = caught; }
      }
      throw error;
    }

    async function loadCatalog(source, settings) {
      const location = sourceLocation(source, deps.baseUrl);
      if (/\.json$/i.test(new URL(location.url).pathname)) {
        const json = await fetchCatalogJson(location.url, settings);
        if (json.defaultIndex || json.hashes) return loadManifest(location.url, settings, json);
        return Object.assign(location, {index: json, indexUrl: location.url});
      }
      const errors = [];
      let catalog = null;
      for (const path of ["index/transactions.index.json", "index/portal.index.json"]) {
        const indexUrl = joinDataPath(location.baseUrl, path);
        try {
          const json = await fetchCatalogJson(indexUrl, settings);
          let rows = Array.isArray(json) ? json : json.transactions;
          if (!Array.isArray(rows)) throw new Error("Static index has no transactions array.");
          if (location.coin) rows = rows.filter(function (row) { return normalizeProbeCoin(row.coin || row.summary && row.summary.coin) === location.coin; });
          if (!rows.length) throw new Error("Static index has no matching transactions.");
          catalog = Object.assign({}, location, {index: {transactions: rows}, indexUrl: indexUrl});
          break;
        } catch (error) { errors.push(error.message || String(error)); }
      }
      const readListing = async directory => (await readCached(directory, "catalog", function (text) { return text; }, settings)).value;
      let targets = [{directory: location.url, coin: location.coin}];
      if (!location.coin) {
        const transactionRoot = joinDataPath(location.baseUrl, "transactions/");
        try { targets = inventoryDirectories(await readListing(transactionRoot + ".files"), transactionRoot); }
        catch (_) {
          try { targets = currencyDirectories(await readListing(transactionRoot), transactionRoot); }
          catch (error) { errors.push(error.message || String(error)); targets = []; }
        }
        // Servers can disable the parent listing but still expose individual currencies.
        if (!targets.length) {
          const known = ["litecoin", "bsv", "digibyte", "ravencoin", "bitcoin", "dogecoin", "ecash", "evm",
            "litecointestnet", "bitcointestnet3", "bitcointestnet4", "bsvtestnet"];
          targets = known.map(coin => ({directory: joinDataPath(transactionRoot, coin + "/"), coin}));
        }
      }
      const combined = new Map();
      if (catalog) catalog.index.transactions.forEach(function (row) {
        combined.set(normalizeProbeCoin(row.coin || row.summary && row.summary.coin || "") + ":" + String(row.txid || row.hash || "").replace(/^0x/i, "").toLowerCase(), row);
      });
      const discovered = [];
      // Limit concurrent requests; directory discovery never downloads transaction bodies.
      for (let i = 0; i < targets.length; i += 6) {
        const batch = await Promise.all(targets.slice(i, i + 6).map(async function ({directory, coin}) {
          try {
            let files;
            try { files = inventoryFiles(await readListing(directory + ".files"), directory); }
            catch (_) { files = directoryFiles(await readListing(directory), directory); }
            const rows = files.map(row => Object.assign({coin: coin}, row));
            if (!rows.length) throw new Error("No transaction JSON files found at " + directory);
            return {directory, rows};
          } catch (error) { errors.push(error.message || String(error)); return null; }
        }));
        discovered.push(...batch);
      }
      for (const result of discovered) {
        if (!result) continue;
        result.rows.forEach(function (row) {
          const key = row.coin + ":" + row.txid;
          combined.set(key, Object.assign({}, combined.get(key), row));
        });
      }
      if (combined.size) return Object.assign({}, location, {index: {transactions: Array.from(combined.values())},
        indexUrl: catalog ? catalog.indexUrl : discovered.find(Boolean).directory});
      throw new Error("Static HTTP data unavailable: " + errors.join(" | "));
    }

    async function fetchStaticRawFromRow(row, canonicalCoinForRow) {
      const paths = rawPathsForRow(row || {});
      const errors = [];
      for (let i = 0; i < paths.length; i += 1) {
        try {
          const loaded = await fetchTransactionJson(paths[i], row);
          return {
            json: loaded.json,
            source: loaded.offline ? "browser-cache (offline)" : loaded.cached ? "browser-cache" : row.staticSource || "static",
            cached: loaded.cached, offline: loaded.offline, savedAt: loaded.savedAt,
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
      fetchTransactionJson: fetchTransactionJson,
      resetPendingReads: function () { readGeneration += 1; pendingReads.clear(); failedReads.clear(); },
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
