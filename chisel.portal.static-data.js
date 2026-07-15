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

  root.CHISEL_PORTAL_STATIC_DATA = {
    isAbsoluteUrl: isAbsoluteUrl,
    trimUrlSlash: trimUrlSlash,
    dirnameUrl: dirnameUrl,
    joinDataPath: joinDataPath,
    normalizePathList: normalizePathList,
    rawPathsForRow: rawPathsForRow,
    createNormalizer: createNormalizer,
    createTransport: createTransport
  };
})(window);
