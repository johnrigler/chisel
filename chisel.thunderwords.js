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
    return tx.txid || tx.hash || tx.id || tx.tx_hash || "";
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
      const txid = normalizeTxid(item);
      if (!TXID_RE.test(txid) || seen.has(txid)) return;
      seen.add(txid);
      out.push({
        txid: txid,
        raw: item,
        confirmed: item && item.status ? Boolean(item.status.confirmed) : undefined,
        blockHeight: item && item.status ? item.status.block_height : item.block_height,
        blockTime: item && item.status ? item.status.block_time : item.block_time
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
    const errors = [];
    for (let i = 0; i < urls.length; i += 1) {
      try {
        return { url: urls[i], json: await fetchJson(urls[i]) };
      } catch (error) {
        errors.push(urls[i] + " => " + (error.message || String(error)));
      }
    }
    throw new Error((label || "request") + " failed across " + urls.length + " endpoint(s): " + errors.join(" | "));
  }

  function normalizeInsightTx(tx) {
    if (!tx || typeof tx !== "object") return tx;
    if (!Array.isArray(tx.vout)) return tx;

    tx.vout.forEach(function (out) {
      if (!out || !out.scriptPubKey) return;
      if (!out.scriptpubkey_address && Array.isArray(out.scriptPubKey.addresses) && out.scriptPubKey.addresses.length) {
        out.scriptpubkey_address = out.scriptPubKey.addresses[0];
      }
      if (!out.scriptpubkey_asm && out.scriptPubKey.asm) out.scriptpubkey_asm = out.scriptPubKey.asm;
      if (!out.scriptpubkey && out.scriptPubKey.hex) out.scriptpubkey = out.scriptPubKey.hex;
      if (!out.scriptpubkey_type && out.scriptPubKey.type) out.scriptpubkey_type = out.scriptPubKey.type;
    });

    return tx;
  }

  async function fetchAddressTransactions(nameOrEntry, addressOverride) {
    const entry = typeof nameOrEntry === "string" ? getIndex(nameOrEntry) : nameOrEntry;
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
    assert(urls.length, "No address transaction URL template configured for " + entry.name + ".");

    const fetched = await fetchFirstJson(urls, entry.label + " address transaction fetch");
    const json = fetched.json;
    const txs = uniqueTxs(json).map(function (tx) {
      if (tx.raw && typeof tx.raw === "object") tx.raw = normalizeInsightTx(tx.raw);
      return tx;
    });
    state.lastIndex = Object.assign({}, entry, { address: address, lastAddressTxsUrl: fetched.url });
    state.lastTransactions = txs;

    return {
      index: state.lastIndex,
      url: fetched.url,
      raw: json,
      transactions: txs
    };
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
        addressUrlTemplate: "https://litecoinspace.org/address/{address}",
        txUrlTemplate: "https://litecoinspace.org/tx/{txid}"
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
    addressUrlTemplate: "https://litecoinspace.org/address/{address}",
    txUrlTemplate: "https://litecoinspace.org/tx/{txid}",
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
