(function () {
  //
  // Constants
  //
  const JSON_RPC_VERSION = "1.0";
  const REQUEST_ID = "chisel";

  //
  // Class
  //
  class CHISEL {
    constructor(url) {
      this.url = url;
      this.rpc = {};
    }

    async call(method, params = []) {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: JSON_RPC_VERSION,
          id: REQUEST_ID,
          method: method,
          params: params
        })
      });

      const json = await response.json();

      if (json.error) {
        throw new Error(json.error.message || JSON.stringify(json.error));
      }

      return json.result;
    }

    async load() {
      const groups = await fetch(this.url + "methods").then(function onResponse(response) {
        return response.json();
      });

      for (const groupName in groups) {
        this[groupName] = this[groupName] || {};

        groups[groupName].forEach((methodName) => {
          this[groupName][methodName] = (...params) => this.call(methodName, params);
          this.rpc[methodName] = (...params) => this.call(methodName, params);
        });
      }
    }

    static installCoin(name, plugin) {
      if (!name) {
        throw new Error("Coin name is required.");
      }

      if (!plugin || typeof plugin !== "object") {
        throw new Error("Coin plugin is required.");
      }

      CHISEL.coins[name] = plugin;
    }

    static getCoin(name) {
      const coin = CHISEL.coins[name];

      if (!coin) {
        throw new Error("Coin not installed: " + name);
      }

      return coin;
    }

    static getCoins() {
      return Object.values(CHISEL.coins).sort(function sortCoins(a, b) {
        const aOrder = Number(a.ORDER || 0);
        const bOrder = Number(b.ORDER || 0);

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return String(a.DISPLAY_NAME || a.NAME).localeCompare(String(b.DISPLAY_NAME || b.NAME));
      });
    }

    static normalizeUTXO(utxo) {
      return {
        txid: utxo.txid,
        vout: utxo.vout !== undefined ? utxo.vout : utxo.outputIndex,
        satoshis: Number(utxo.satoshis),
        scriptPubKey: utxo.scriptPubKey || utxo.scriptpubkey || "",
        address: utxo.address || ""
      };
    }

    static buildVin(utxos) {
      return utxos.map(function mapUtxoToVin(utxo) {
        const normalized = CHISEL.normalizeUTXO(utxo);

        return {
          txid: normalized.txid,
          vout: normalized.vout
        };
      });
    }

    static sumUtxoSatoshis(utxos) {
      return utxos.reduce(function reduceTotal(total, utxo) {
        return total + Number(utxo.satoshis);
      }, 0);
    }
  }

  CHISEL.coins = {};

  //
  // Resource registry and generic HTTP helpers
  //
  CHISEL.resources = {};

  CHISEL.installResource = function installResource(name, resource) {
    if (!name) {
      throw new Error("Resource name is required.");
    }

    if (!resource || typeof resource !== "object") {
      throw new Error("Resource object is required.");
    }

    CHISEL.resources[name] = resource;
  };

  CHISEL.getResource = function getResource(name) {
    const resource = CHISEL.resources[name];

    if (!resource) {
      throw new Error("Resource not installed: " + name);
    }

    return resource;
  };

  CHISEL.getResources = function getResources() {
    return Object.values(CHISEL.resources);
  };

  CHISEL.fetchJson = async function fetchJson(url, options) {
    const response = await fetch(url, options || {});
    const text = await response.text();
    let json = null;

    if (text) {
      try {
        json = JSON.parse(text);
      } catch (error) {
        throw new Error("JSON parse failed for " + url + ": " + text.slice(0, 240));
      }
    }

    if (!response.ok) {
      const message = json && (json.error || json.message)
        ? (json.error.message || json.error || json.message)
        : text;

      throw new Error("HTTP " + response.status + " from " + url + ": " + String(message).slice(0, 240));
    }

    return json;
  };

  CHISEL.fetchText = async function fetchText(url, options) {
    const response = await fetch(url, options || {});
    const text = await response.text();

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " from " + url + ": " + text.slice(0, 240));
    }

    return text;
  };

  //
  // Litecoin resource, console-first. This is intentionally not a coin plugin yet.
  // It gives Chisel redundant third-party lookup/broadcast resources without
  // dragging Litecoin into the Ravencoin/Digibyte RPC send pipeline.
  //
  (function installLitecoinResource() {
    const BASE_UNITS = 100000000;
    const NETWORKS = {
      mainnet: {
        name: "mainnet",
        ticker: "LTC",
        p2pkhPrefix: 48,
        wifPrefix: 176,
        bech32Prefix: "ltc",
        defaultProvider: "litecoinspace"
      },
      testnet: {
        name: "testnet",
        ticker: "TLTC",
        p2pkhPrefix: 111,
        wifPrefix: 239,
        bech32Prefix: "tltc",
        defaultProvider: "litecoinspaceTestnet"
      }
    };

    const PROVIDERS = {
      litecoinspace: {
        name: "litecoinspace",
        network: "mainnet",
        baseUrl: "https://litecoinspace.org/api",
        explorerTxUrl: "https://litecoinspace.org/tx/"
      },
      litecoinspaceTestnet: {
        name: "litecoinspaceTestnet",
        network: "testnet",
        baseUrl: "https://litecoinspace.org/testnet/api",
        explorerTxUrl: "https://litecoinspace.org/testnet/tx/"
      },
      blockcypher: {
        name: "blockcypher",
        network: "mainnet",
        baseUrl: "https://api.blockcypher.com/v1/ltc/main",
        explorerTxUrl: "https://live.blockcypher.com/ltc/tx/"
      },
      blockchair: {
        name: "blockchair",
        network: "mainnet",
        baseUrl: "https://api.blockchair.com/litecoin",
        explorerTxUrl: "https://blockchair.com/litecoin/transaction/"
      }
    };

    function normalizeNetwork(network) {
      const normalized = String(network || "").trim().toLowerCase();

      if (normalized === "test" || normalized === "testnet" || normalized === "tltc") {
        return "testnet";
      }

      return "mainnet";
    }

    function getNetwork(network) {
      return NETWORKS[normalizeNetwork(network)];
    }

    function getProvider(providerName, networkName) {
      const normalizedNetwork = normalizeNetwork(networkName);
      const name = providerName || NETWORKS[normalizedNetwork].defaultProvider;
      const provider = PROVIDERS[name];

      if (!provider) {
        throw new Error("Unknown Litecoin provider: " + name);
      }

      if (provider.network !== normalizedNetwork) {
        throw new Error(
          "Litecoin provider " + name + " is for " + provider.network + ", not " + normalizedNetwork + "."
        );
      }

      return provider;
    }

    function coinToUnits(value) {
      return Math.round(Number(value) * BASE_UNITS);
    }

    function unitsToCoin(value) {
      return Number(value) / BASE_UNITS;
    }

    async function publicKeyHexToAddress(publicKeyHex, networkName) {
      const network = getNetwork(networkName);
      const versionBytes = new Uint8Array([network.p2pkhPrefix]);
      const publicKeyHashHex = await CHISEL.hash160Hex(publicKeyHex);
      const publicKeyHashBytes = CHISEL.hexToUint8Array(publicKeyHashHex);
      const payloadBytes = CHISEL.concatBytes(versionBytes, publicKeyHashBytes);

      return CHISEL.base58CheckEncode(payloadBytes);
    }

    async function privateKeyHexToAddress(privateKeyHex, compressed, networkName) {
      const publicKeyHex = CHISEL.privateKeyHexToPublicKeyHex(privateKeyHex, compressed);

      return publicKeyHexToAddress(publicKeyHex, networkName);
    }

    async function wifToAccount(wif, options) {
      const networkName = normalizeNetwork(options && options.network);
      const network = getNetwork(networkName);
      const decoded = await CHISEL.wifToPrivateKey(wif);

      if (decoded.version !== network.wifPrefix) {
        throw new Error(
          "Unsupported Litecoin WIF prefix " + decoded.version + " for " + networkName + ". Expected " + network.wifPrefix + "."
        );
      }

      const compressedAddress = await privateKeyHexToAddress(decoded.privateKeyHex, true, networkName);
      const uncompressedAddress = await privateKeyHexToAddress(decoded.privateKeyHex, false, networkName);

      return {
        currency: "litecoin",
        network: networkName,
        ticker: network.ticker,
        compressed: decoded.compressed,
        version: decoded.version,
        privateKeyHex: decoded.privateKeyHex,
        address: decoded.compressed ? compressedAddress : uncompressedAddress,
        compressedAddress: compressedAddress,
        uncompressedAddress: uncompressedAddress
      };
    }

    function normalizeLitecoinspaceUtxo(utxo) {
      return {
        txid: utxo.txid,
        vout: utxo.vout,
        satoshis: Number(utxo.value),
        scriptPubKey: utxo.scriptpubkey || "",
        confirmed: Boolean(utxo.status && utxo.status.confirmed),
        blockHeight: utxo.status ? utxo.status.block_height : undefined,
        blockTime: utxo.status ? utxo.status.block_time : undefined
      };
    }

    function normalizeBlockcypherUtxo(utxo) {
      return {
        txid: utxo.tx_hash,
        vout: utxo.tx_output_n,
        satoshis: Number(utxo.value),
        scriptPubKey: utxo.script || "",
        confirmed: !utxo.spent,
        blockHeight: utxo.block_height,
        confirmations: utxo.confirmations
      };
    }

    async function getAddressUtxos(address, options) {
      const opts = options || {};
      const networkName = normalizeNetwork(opts.network);
      const provider = getProvider(opts.provider, networkName);

      if (provider.name === "litecoinspace" || provider.name === "litecoinspaceTestnet") {
        const url = provider.baseUrl + "/address/" + encodeURIComponent(address) + "/utxo";
        const utxos = await CHISEL.fetchJson(url);

        if (!Array.isArray(utxos)) {
          throw new Error("Litecoinspace returned an unexpected UTXO payload.");
        }

        return utxos.map(normalizeLitecoinspaceUtxo);
      }

      if (provider.name === "blockcypher") {
        const url = provider.baseUrl + "/addrs/" + encodeURIComponent(address) + "?unspentOnly=true&includeScript=true";
        const json = await CHISEL.fetchJson(url);
        const txrefs = (json.txrefs || []).concat(json.unconfirmed_txrefs || []);

        return txrefs.map(normalizeBlockcypherUtxo);
      }

      throw new Error("UTXO lookup is not implemented for Litecoin provider: " + provider.name);
    }

    async function getTransaction(txid, options) {
      const opts = options || {};
      const networkName = normalizeNetwork(opts.network);
      const provider = getProvider(opts.provider, networkName);

      if (provider.name === "litecoinspace" || provider.name === "litecoinspaceTestnet") {
        return CHISEL.fetchJson(provider.baseUrl + "/tx/" + encodeURIComponent(txid));
      }

      if (provider.name === "blockcypher") {
        return CHISEL.fetchJson(provider.baseUrl + "/txs/" + encodeURIComponent(txid));
      }

      if (provider.name === "blockchair") {
        return CHISEL.fetchJson(provider.baseUrl + "/dashboards/transaction/" + encodeURIComponent(txid));
      }

      throw new Error("Transaction lookup is not implemented for Litecoin provider: " + provider.name);
    }

    async function broadcastRawTransaction(rawHex, options) {
      const opts = options || {};
      const networkName = normalizeNetwork(opts.network);
      const provider = getProvider(opts.provider, networkName);

      if (provider.name === "litecoinspace" || provider.name === "litecoinspaceTestnet") {
        return CHISEL.fetchText(provider.baseUrl + "/tx", {
          method: "POST",
          headers: {
            "Content-Type": "text/plain"
          },
          body: String(rawHex || "").trim()
        });
      }

      if (provider.name === "blockcypher") {
        return CHISEL.fetchJson(provider.baseUrl + "/txs/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ tx: String(rawHex || "").trim() })
        });
      }

      throw new Error("Broadcast is not implemented for Litecoin provider: " + provider.name);
    }

    function getExplorerTxUrl(txid, options) {
      const opts = options || {};
      const networkName = normalizeNetwork(opts.network);
      const provider = getProvider(opts.provider, networkName);

      return provider.explorerTxUrl + encodeURIComponent(txid);
    }

    const litecoin = {
      NAME: "litecoin",
      DISPLAY_NAME: "Litecoin resource",
      BASE_UNITS: BASE_UNITS,
      NETWORKS: NETWORKS,
      PROVIDERS: PROVIDERS,
      coinToUnits: coinToUnits,
      unitsToCoin: unitsToCoin,
      getNetwork: getNetwork,
      getProvider: getProvider,
      publicKeyHexToAddress: publicKeyHexToAddress,
      privateKeyHexToAddress: privateKeyHexToAddress,
      wifToAccount: wifToAccount,
      getAddressUtxos: getAddressUtxos,
      getTransaction: getTransaction,
      broadcastRawTransaction: broadcastRawTransaction,
      getExplorerTxUrl: getExplorerTxUrl
    };

    CHISEL.installResource("litecoin", litecoin);
    CHISEL.litecoin = litecoin;
    CHISEL.ltc = litecoin;
    window.LITECOIN = litecoin;
    window.LTC = litecoin;
  })();


  window.CHISEL = CHISEL;
})();
