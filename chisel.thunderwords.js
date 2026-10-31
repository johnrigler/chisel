(function () {
  "use strict";

  const DEFAULT_INDEX_BODY = "CHISELxINDEX";
  const DEFAULT_INDEX_STEM_LEN = 28;
  const TXID_RE = /^[0-9a-fA-F]{64}$/;

  const registry = Object.create(null);
  const state = {
    lastIndex: null,
    lastTransactions: []
  };

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function trimSlash(value) {
    return String(value || "").replace(/\/+$/, "");
  }

  function encode(value) {
    return encodeURIComponent(String(value || "").trim());
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(url + " failed with HTTP " + response.status + ".");
    return response.json();
  }

  async function fetchRpc(baseUrl, method, params) {
    const url = trimSlash(baseUrl || "");
    assert(url, "RPC proxy URL is required.");
    assert(method, "RPC method is required.");

    const response = await fetch(url + "/", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "1.0",
        id: "chisel-portal",
        method: method,
        params: params || []
      })
    });

    if (!response.ok) throw new Error(url + " " + method + " failed with HTTP " + response.status + ".");

    const json = await response.json();
    if (json && json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    return json ? json.result : null;
  }

  function normalizeTxid(tx) {
    if (typeof tx === "string") return tx;
    if (!tx || typeof tx !== "object") return "";
    return tx.txid || tx.txHash || tx.hash || tx.id || tx.tx_hash || "";
  }

  function firstValue(values) {
    for (let i = 0; i < values.length; i += 1) {
      if (values[i] !== undefined && values[i] !== null && values[i] !== "") return values[i];
    }
    return undefined;
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

  function normalizeAddressTxs(json) {
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.txs)) return json.txs;
    if (json && Array.isArray(json.transactions)) return json.transactions;
    if (json && Array.isArray(json.data)) return json.data;
    if (json && json.data && Array.isArray(json.data.txs)) return json.data.txs;
    return [];
  }

  function uniqueTxs(items) {
    const seen = new Set();
    const out = [];

    normalizeAddressTxs(items).forEach(function (item) {
      const txid = String(normalizeTxid(item)).toLowerCase();
      if (!TXID_RE.test(txid) || seen.has(txid)) return;
      seen.add(txid);
      const status = item && item.status && typeof item.status === "object" ? item.status : {};
      out.push({
        txid: txid,
        raw: item,
        confirmed: typeof status.confirmed === "boolean" ? status.confirmed :
          (item && typeof item.confirmations === "number" ? item.confirmations > 0 : undefined),
        blockHeight: firstValue([status.block_height, status.blockHeight, item && item.block_height, item && item.blockHeight, item && item.blockheight, item && item.height]),
        blockTime: normalizeUnixTime(firstValue([status.block_time, status.blockTime, status.time, status.timestamp, item && item.block_time, item && item.blockTime, item && item.blocktime, item && item.time, item && item.timestamp, item && typeof item.confirmed === "string" ? item.confirmed : undefined])),
        receivedTime: normalizeUnixTime(item && item.received)
      });
    });

    return out;
  }

  function installIndex(name, config) {
    assert(name, "Index name is required.");
    assert(config && typeof config === "object", "Index config is required.");

    registry[name] = Object.assign({
      name: name,
      label: name,
      kind: "address",
      sourceType: "explorer-link",
      canFetchAddress: false,
      canFetchTx: false
    }, config, { name: name });

    return registry[name];
  }

  function getIndex(name) {
    const entry = registry[name];
    if (!entry) throw new Error("Thunderword index not installed: " + name);
    return entry;
  }

  function listIndexes() {
    return Object.keys(registry).map(function (key) { return registry[key]; });
  }

  function getAddressUrl(entry, address) {
    const addr = address || entry.address;
    if (entry.addressUrlTemplate) return entry.addressUrlTemplate.replace("{address}", encode(addr));
    if (entry.addressExplorerBase) return trimSlash(entry.addressExplorerBase) + "/" + encode(addr);
    return "";
  }

  function getTxUrl(entry, txid) {
    if (entry.txUrlTemplate) return entry.txUrlTemplate.replace("{txid}", encode(txid));
    if (entry.txExplorerBase) return trimSlash(entry.txExplorerBase) + "/" + encode(txid);
    return "";
  }

  function addressTxsUrl(entry, address) {
    const addr = address || entry.address;
    if (entry.addressTxsUrlTemplate) return entry.addressTxsUrlTemplate.replace("{address}", encode(addr));
    if (entry.electrsBaseUrl) return trimSlash(entry.electrsBaseUrl) + "/address/" + encode(addr) + "/txs";
    return "";
  }

  function txApiUrl(entry, txid) {
    if (entry.txApiUrlTemplate) return entry.txApiUrlTemplate.replace("{txid}", encode(txid));
    if (entry.electrsBaseUrl) return trimSlash(entry.electrsBaseUrl) + "/tx/" + encode(txid);
    return "";
  }

  function expandTemplate(template, values) {
    const data = values || {};
    return String(template || "")
      .replace(/\{address\}/g, encode(data.address || ""))
      .replace(/\{txid\}/g, encode(data.txid || ""));
  }

  function addressTxsUrls(entry, address) {
    if (Array.isArray(entry.addressTxsUrlTemplates)) {
      return entry.addressTxsUrlTemplates.map(function (template) {
        return expandTemplate(template, { address: address });
      }).filter(Boolean);
    }
    const single = addressTxsUrl(entry, address);
    return single ? [single] : [];
  }

  function txApiUrls(entry, txid) {
    if (Array.isArray(entry.txApiUrlTemplates)) {
      return entry.txApiUrlTemplates.map(function (template) {
        return expandTemplate(template, { txid: txid });
      }).filter(Boolean);
    }
    const single = txApiUrl(entry, txid);
    return single ? [single] : [];
  }

  async function fetchFirstJson(urls, label) {
    const healthKey = "chisel.portal.providerHealth.v1";
    let health = {};
    try { health = JSON.parse(localStorage.getItem(healthKey) || "{}") || {}; } catch (error) {}
    const ordered = urls.slice().sort(function (a,b) {
      const aa = health[new URL(a).host] || {};
      const bb = health[new URL(b).host] || {};
      const score = function (x) {
        return (x.lastOk ? 10 : 0) - (x.failedUntil && x.failedUntil > Date.now() ? 100 : 0);
      };
      // Never promote LitecoinSpace over another configured provider.
      const aSpace = new URL(a).hostname === "litecoinspace.org";
      const bSpace = new URL(b).hostname === "litecoinspace.org";
      if (aSpace !== bSpace) return aSpace ? 1 : -1;
      return score(bb) - score(aa);
    });
    const errors = [];
    for (let i = 0; i < ordered.length; i += 1) {
      const url = ordered[i], host = new URL(url).host;
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, 7000);
      try {
        const response = await fetch(url, { cache:"no-store", signal:controller.signal });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const json = await response.json();
        if (/address transaction fetch/.test(label || "") && !Array.isArray(json) && !(json && (Array.isArray(json.txs) || Array.isArray(json.transactions) || Array.isArray(json.data)))) {
          throw new Error("unexpected transaction response");
        }
        health[host] = { lastOk:Date.now(), failedUntil:0 };
        try { localStorage.setItem(healthKey,JSON.stringify(health)); } catch (error) {}
        return {url:url,json:json};
      } catch (error) {
        health[host] = {lastOk:0,failedUntil:Date.now()+15*60*1000};
        try { localStorage.setItem(healthKey,JSON.stringify(health)); } catch (storageError) {}
        errors.push(host + " => " + (error.name === "AbortError" ? "timeout" : error.message || String(error)));
      } finally { clearTimeout(timer); }
    }
    throw new Error((label || "request") + " failed across " + ordered.length + " endpoint(s): " + errors.join(" | "));
  }

  function normalizeInsightTx(tx) {
    if (!tx || typeof tx !== "object") return tx;
    (Array.isArray(tx.vout) ? tx.vout : []).forEach(function (out) {
      if (!out || !out.scriptPubKey) return;
      if (!out.scriptpubkey_address && Array.isArray(out.scriptPubKey.addresses) && out.scriptPubKey.addresses.length) {
        out.scriptpubkey_address = out.scriptPubKey.addresses[0];
      }
      if (!out.scriptpubkey_asm && out.scriptPubKey.asm) out.scriptpubkey_asm = out.scriptPubKey.asm;
      if (!out.scriptpubkey && out.scriptPubKey.hex) out.scriptpubkey = out.scriptPubKey.hex;
      if (!out.scriptpubkey_type && out.scriptPubKey.type) out.scriptpubkey_type = out.scriptPubKey.type;
    });

    if (!tx.block_time && (tx.blocktime || tx.time || tx.timestamp || typeof tx.confirmed === "string")) {
      tx.block_time = normalizeUnixTime(firstValue([tx.blocktime, tx.time, tx.timestamp, tx.confirmed]));
    }
    if (!tx.block_height && !tx.blockHeight && tx.height) tx.block_height = tx.height;

    return tx;
  }

  async function fetchAddressTransactions(nameOrEntry, addressOverride, opts) {
    const entry = typeof nameOrEntry === "string" ? getIndex(nameOrEntry) : nameOrEntry;
    const options = opts || {};
    const address = String(addressOverride || entry.address || "").trim();
    assert(address, "Index address is required.");

    if (!entry.canFetchAddress) {
      throw new Error(entry.label + " has no browser-readable address transaction API configured. Open the explorer link or paste JSON.");
    }

    if (entry.rpcBaseUrl && entry.rpcAddressMethod) {
      const result = await fetchRpc(entry.rpcBaseUrl, entry.rpcAddressMethod, [address]);
      const txs = uniqueTxs(result);
      state.lastIndex = Object.assign({}, entry, { address: address, lastAddressTxsUrl: trimSlash(entry.rpcBaseUrl) + "/", lastAddressMethod: entry.rpcAddressMethod });
      state.lastTransactions = txs;

      return {
        index: state.lastIndex,
        url: state.lastIndex.lastAddressTxsUrl,
        method: entry.rpcAddressMethod,
        raw: result,
        transactions: txs
      };
    }

    const urls = addressTxsUrls(entry, address);
    // BlockCypher's Litecoin full-address API is an independent fallback.
    // It returns {txs:[{hash,...}]}, supported by uniqueTxs().
    const coin = String(entry.coin || entry.ticker || "").toLowerCase();
    if (coin === "litecoin" || coin === "ltc") {
      // LitecoinSpace is a last-resort provider, even if it succeeded previously.
      urls.unshift("https://api.blockcypher.com/v1/ltc/main/addrs/" + encode(address) + "/full?limit=50");
    }
    assert(urls.length, "No address transaction URL template configured for " + entry.name + ".");

    let fetched = await fetchFirstJson(urls, entry.label + " address transaction fetch");
    const index = Object.assign({}, entry, { address: address, lastAddressTxsUrl: fetched.url });
    const result = {index: index, url: fetched.url, raw: fetched.json, transactions: [], complete: false, error: "", resumeUrl: ""};
    const byId = new Map(), cursors = new Set();
    // Only a previously completed history may supply this boundary. A cached
    // first page alone must never prevent discovery of older transactions.
    const known = new Set(options.stopAtTxids || []);
    const covered = new Set(options.resumeAtTxids || []);
    let firstPage = true;
    let resumed = false;
    while (true) {
      const page = uniqueTxs(fetched.json).map(function (tx) {
        if (tx.raw && typeof tx.raw === "object") tx.raw = normalizeInsightTx(tx.raw);
        return tx;
      });
      let added = 0;
      page.forEach(function (tx) { if (!byId.has(tx.txid)) added++; byId.set(tx.txid, tx); });
      result.transactions = Array.from(byId.values());
      if (typeof options.onPage === "function") {
        await options.onPage({index: index, url: fetched.url, transactions: page, loaded: byId.size});
      }
      const overlap = page.some(function (tx) { return tx.confirmed !== false && known.has(tx.txid); });
      let next = "";
      const url = new URL(fetched.url);
      if (url.hostname === "api.blockcypher.com" && /\/full$/.test(url.pathname)) {
        // BlockCypher includes the whole boundary block, even when that makes
        // a page larger than limit=50. Its before cursor is exclusive.
        if (fetched.json.hasMore === true || fetched.json.hasMore === undefined && Number(fetched.json.n_tx) > byId.size) {
          const heights = page.map(function (tx) { return Number(tx.blockHeight); }).filter(function (h) { return h > 0; });
          const height = heights.length ? Math.min.apply(null, heights) : 0;
          if (height && (!url.searchParams.has("before") || height < Number(url.searchParams.get("before")))) {
            url.searchParams.set("before", String(height));
            next = url.toString();
          } else result.error = "Address history cursor did not advance.";
        }
      } else if (/\/address\/[^/]+\/txs(?:\/chain\/[0-9a-f]{64})?$/.test(url.pathname) && Array.isArray(fetched.json)) {
        const confirmed = page.filter(function (tx) { return tx.confirmed === true || Number(tx.blockHeight) > 0; });
        if (confirmed.length >= 25) {
          url.pathname = url.pathname.replace(/\/txs.*$/, "/txs/chain/" + confirmed[confirmed.length - 1].txid);
          next = url.toString();
        }
      }
      if (overlap) { result.complete = true; break; }
      // Retry a failed older page after fetching the current head. This keeps
      // recent activity fresh without repeatedly downloading the same prefix.
      if (!resumed && options.resumeUrl && page.some(function (tx) { return covered.has(tx.txid); })) {
        const resume = new URL(options.resumeUrl);
        const root = fetched.url.split("?")[0].replace(/\/chain\/[0-9a-f]{64}$/, "");
        if (resume.origin === url.origin && resume.href.indexOf(root) === 0) {
          next = resume.toString();
          resumed = true;
        }
      }
      if (!firstPage && !added && page.length) result.error = "Address history returned a repeated page.";
      if (result.error) break;
      if (!next) { result.complete = true; break; }
      if (cursors.has(next)) { result.error = "Address history returned a repeated cursor."; break; }
      cursors.add(next);
      firstPage = false;
      // Public address endpoints have rate limits. Space history pages while
      // the already rendered newest rows remain usable.
      await new Promise(function (resolve) { setTimeout(resolve, 400); });
      try {
        fetched = await fetchFirstJson([next], entry.label + " address transaction fetch");
      } catch (error) {
        // Keep and display recent pages when an older page is rate limited.
        // The caller can retry; it must not mark this history complete.
        result.error = error.message || String(error);
        result.resumeUrl = next;
        break;
      }
    }
    result.transactions.sort(function (a, b) {
      const ap = a.confirmed === false ? 1 : 0, bp = b.confirmed === false ? 1 : 0;
      return bp - ap || (b.blockTime || b.receivedTime || 0) - (a.blockTime || a.receivedTime || 0) ||
        (Number(b.blockHeight) || 0) - (Number(a.blockHeight) || 0) || b.txid.localeCompare(a.txid);
    });
    state.lastIndex = index;
    state.lastTransactions = result.transactions;
    return result;
  }

  async function fetchTransaction(nameOrEntry, txid) {
    const entry = typeof nameOrEntry === "string" ? getIndex(nameOrEntry) : nameOrEntry;
    const id = String(txid || "").trim();
    assert(TXID_RE.test(id), "Transaction id must be 64 hex characters.");

    if (!entry.canFetchTx) {
      throw new Error(entry.label + " has no browser-readable transaction API configured. Open the explorer link or paste JSON.");
    }

    if (entry.rpcBaseUrl && entry.rpcTxMethod) {
      const result = await fetchRpc(entry.rpcBaseUrl, entry.rpcTxMethod, [id, true]);
      return {
        index: entry,
        txid: id,
        url: trimSlash(entry.rpcBaseUrl) + "/",
        method: entry.rpcTxMethod,
        json: normalizeInsightTx(result)
      };
    }

    const urls = txApiUrls(entry, id);
    assert(urls.length, "No transaction URL template configured for " + entry.name + ".");

    const fetched = await fetchFirstJson(urls, entry.label + " tx fetch");

    return {
      index: entry,
      txid: id,
      url: fetched.url,
      json: normalizeInsightTx(fetched.json)
    };
  }

  function getGeneratedFetchConfig(coinName) {
    if (coinName === "litecoin") {
      return {
        sourceType: "electrs",
        canFetchAddress: true,
        canFetchTx: true,
        electrsBaseUrl: "https://litecoinspace.org/api",
        addressUrlTemplate: "https://blockchair.com/litecoin/address/{address}",
        txUrlTemplate: "https://blockchair.com/litecoin/transaction/{txid}"
      };
    }

    if (coinName === "litecoinTestnet") {
      return {
        sourceType: "electrs",
        canFetchAddress: true,
        canFetchTx: true,
        electrsBaseUrl: "https://litecoinspace.org/testnet/api",
        addressUrlTemplate: "https://litecoinspace.org/testnet/address/{address}",
        txUrlTemplate: "https://litecoinspace.org/testnet/tx/{txid}"
      };
    }

    return { canFetchAddress: false, canFetchTx: false };
  }

  async function buildGeneratedIndexes() {
    if (!window.CHISEL_UNSPENDABLE || typeof window.CHISEL_UNSPENDABLE.generate !== "function") return [];

    const rows = [];
    const coins = window.CHISEL && typeof window.CHISEL.getCoins === "function" ? window.CHISEL.getCoins() : [];

    for (let i = 0; i < coins.length; i += 1) {
      const coin = coins[i];
      const first = coin.UNSPENDABLE_PREFIX || coin.unspendablePrefix;
      if (!first || coin.NAME === "digibyte" || coin.NAME === "ravencoin" || coin.NAME === "litecoin" || coin.NAME === "litecoinTestnet") continue;

      try {
        const stem = String(first).repeat(DEFAULT_INDEX_STEM_LEN);
        const address = await window.CHISEL_UNSPENDABLE.generate(stem, "");
        const fetchConfig = getGeneratedFetchConfig(coin.NAME);
        rows.push(installIndex(coin.NAME + "Generated", Object.assign({
          label: coin.DISPLAY_NAME + " generated general index",
          coin: coin.NAME,
          ticker: coin.TICKER,
          address: address,
          generated: true,
          phrase: stem,
          note: "Generated with unspendable from " + stem + ". It is a stream root after transactions exist on that address.",
          sourceType: "generated",
          group: "general"
        }, fetchConfig)));
      } catch (error) {
        rows.push({
          name: coin.NAME + "Generated",
          label: coin.DISPLAY_NAME + " generated general index",
          coin: coin.NAME,
          error: error.message || String(error)
        });
      }
    }

    return rows;
  }

  installIndex("digibyteGeneral", {
    label: "Digibyte general thunderword",
    group: "general",
    coin: "digibyte",
    ticker: "DGB",
    address: "DDDDDDDDDDDDDDDDDDDDDDDDDDDD5SVJPi",
    sourceType: "electrs",
    canFetchAddress: true,
    canFetchTx: true,
    electrsBaseUrl: "https://digiexplorer.info/api",
    addressUrlTemplate: "https://digiexplorer.info/address/{address}",
    txUrlTemplate: "https://digiexplorer.info/tx/{txid}",
    note: "v1 generic index. Address transactions are readable through Digiexplorer's electrs-style API."
  });

  installIndex("ravencoinGeneral", {
    label: "Ravencoin general thunderword",
    group: "general",
    coin: "ravencoin",
    ticker: "RVN",
    address: "RRRRRRRRRRRRRRRRRRRRRRRRRRRRTvmrjL",
    sourceType: "rpc-proxy",
    canFetchAddress: true,
    canFetchTx: true,
    rpcBaseUrl: "https://rigler.org:8769",
    rpcAddressMethod: "getaddresstxids",
    rpcTxMethod: "getrawtransaction",
    addressUrlTemplate: "https://explorer.rvn.zelcore.io/address/{address}",
    txUrlTemplate: "https://explorer.rvn.zelcore.io/tx/{txid}",
    note: "Known RVN generic index. Browser fetch uses the Chisel Ravencoin RPC proxy because the Zelcore human explorer can verify the address while its API routes are not reliable as browser JSON sources."
  });



  installIndex("litecoinGeneral", {
    label: "Litecoin general thunderword",
    group: "general",
    coin: "litecoin",
    ticker: "LTC",
    address: "LLLLLLLLLLLLLLLLLLLLLLLLLLLLXgkk2V",
    sourceType: "electrs",
    canFetchAddress: true,
    canFetchTx: true,
    electrsBaseUrl: "https://litecoinspace.org/api",
    addressUrlTemplate: "https://blockchair.com/litecoin/address/{address}",
    txUrlTemplate: "https://blockchair.com/litecoin/transaction/{txid}",
    note: "Litecoin mainnet generic index generated from 28 L characters with Chisel unspendable."
  });

  installIndex("litecoinTestnetGeneral", {
    label: "Litecoin Testnet general thunderword",
    group: "general",
    coin: "litecoinTestnet",
    ticker: "TLTC",
    address: "TTTTTTTTTTTTTTTTTTTTTTTTTTTTXrUvAX",
    sourceType: "electrs",
    canFetchAddress: true,
    canFetchTx: true,
    electrsBaseUrl: "https://litecoinspace.org/testnet/api",
    addressUrlTemplate: "https://litecoinspace.org/testnet/address/{address}",
    txUrlTemplate: "https://litecoinspace.org/testnet/tx/{txid}",
    note: "Litecoin testnet generic index generated from 28 T characters with Chisel unspendable."
  });
  installIndex("dogecoinLocal", {
    label: "Dogecoin local Chisel feed",
    group: "local",
    coin: "dogecoin",
    ticker: "DOGE",
    address: "local-fileproxy-dogecoin",
    sourceType: "local-fileproxy",
    canFetchAddress: false,
    canFetchTx: false,
    txUrlTemplate: "https://blockchair.com/dogecoin/transaction/{txid}",
    addressUrlTemplate: "https://blockchair.com/dogecoin/address/{address}",
    note: "Local Dogecoin Chisel rows imported from bunOven / Bun jist JSONL through fileProxy."
  });


  installIndex("ecashAddress", {
    label: "eCash address / explorer feed",
    group: "manual",
    coin: "ecash",
    ticker: "XEC",
    address: "",
    sourceType: "explorer-json",
    canFetchAddress: true,
    canFetchTx: false,
    addressTxsUrlTemplate: "https://explorer.e.cash/api/address/{address}/transactions?take=200",
    addressUrlTemplate: "https://explorer.e.cash/address/{address}",
    txUrlTemplate: "https://explorer.e.cash/tx/{txid}",
    note: "First-pass eCash feed adapter. Address history comes from explorer.e.cash JSON. Full transaction hydration is intentionally deferred until Chisel has a native Chronik/protobuf adapter."
  });

  installIndex("polygonGeneral", {
    label: "Polygon / EVM general thunderword contract",
    group: "general",
    coin: "polygon",
    ticker: "MATIC",
    address: "0x1111111111111111111111111111111111111111",
    kind: "evm-address",
    sourceType: "explorer-link",
    canFetchAddress: false,
    canFetchTx: false,
    addressUrlTemplate: "https://polygonscan.com/address/{address}",
    txUrlTemplate: "https://polygonscan.com/tx/{txid}",
    note: "EVM index form. Polygonscan pages are useful to humans, but browser JSON generally needs an API key or a separate provider."
  });

  window.CHISEL_THUNDERWORDS = {
    registry: registry,
    installIndex: installIndex,
    getIndex: getIndex,
    listIndexes: listIndexes,
    getAddressUrl: getAddressUrl,
    getTxUrl: getTxUrl,
    addressTxsUrl: addressTxsUrl,
    txApiUrl: txApiUrl,
    addressTxsUrls: addressTxsUrls,
    txApiUrls: txApiUrls,
    fetchAddressTransactions: fetchAddressTransactions,
    fetchTransaction: fetchTransaction,
    buildGeneratedIndexes: buildGeneratedIndexes,
    state: state
  };

  if (window.CHISEL) {
    window.CHISEL.thunderwords = window.CHISEL_THUNDERWORDS;
  }
})();
