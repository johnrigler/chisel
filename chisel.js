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
  // Resource registry, provider registry, and generic HTTP helpers
  //
  CHISEL.resources = {};
  CHISEL.providers = {};

  CHISEL.installResource = function installResource(name, resource) {
    if (!name) {
      throw new Error("Resource name is required.");
    }

    if (!resource || typeof resource !== "object") {
      throw new Error("Resource object is required.");
    }

    CHISEL.resources[name] = resource;
    return resource;
  };

  CHISEL.getResource = function getResource(name) {
    const resource = CHISEL.resources[name];

    if (!resource) {
      throw new Error("Resource not installed: " + name);
    }

    return resource;
  };

  CHISEL.getResources = function getResources() {
    return Object.values(CHISEL.resources).sort(function sortResources(a, b) {
      return String(a.DISPLAY_NAME || a.NAME).localeCompare(String(b.DISPLAY_NAME || b.NAME));
    });
  };

  CHISEL.installProvider = function installProvider(name, provider) {
    if (!name) {
      throw new Error("Provider name is required.");
    }

    if (!provider || typeof provider !== "object") {
      throw new Error("Provider object is required.");
    }

    CHISEL.providers[name] = provider;
    return provider;
  };

  CHISEL.getProvider = function getProvider(name) {
    const provider = CHISEL.providers[name];

    if (!provider) {
      throw new Error("Provider not installed: " + name);
    }

    return provider;
  };

  CHISEL.getProviders = function getProviders() {
    return Object.values(CHISEL.providers).sort(function sortProviders(a, b) {
      return String(a.DISPLAY_NAME || a.NAME).localeCompare(String(b.DISPLAY_NAME || b.NAME));
    });
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

  CHISEL.fetchProviderJson = async function fetchProviderJson(providerName, url, options) {
    try {
      return {
        provider: providerName,
        url: url,
        ok: true,
        result: await CHISEL.fetchJson(url, options)
      };
    } catch (error) {
      return {
        provider: providerName,
        url: url,
        ok: false,
        error: error.message || String(error)
      };
    }
  };

  CHISEL.fetchProviderText = async function fetchProviderText(providerName, url, options) {
    try {
      return {
        provider: providerName,
        url: url,
        ok: true,
        result: await CHISEL.fetchText(url, options)
      };
    } catch (error) {
      return {
        provider: providerName,
        url: url,
        ok: false,
        error: error.message || String(error)
      };
    }
  };

  CHISEL.firstSuccessfulProviderResult = function firstSuccessfulProviderResult(reports) {
    const winner = reports.find(function findWinner(report) {
      return report.ok;
    });

    if (!winner) {
      throw new Error("All providers failed: " + JSON.stringify(reports, null, 2));
    }

    return {
      selectedProvider: winner.provider,
      attemptedProviders: reports.map(function summarize(report) {
        return {
          provider: report.provider,
          ok: report.ok,
          url: report.url,
          error: report.error || ""
        };
      }),
      result: winner.result
    };
  };

  CHISEL.reverseHex = function reverseHex(hex) {
    return String(hex || "").match(/../g).reverse().join("");
  };

  CHISEL.uint64LEHex = function uint64LEHex(value) {
    let n = BigInt(value);
    let output = "";

    for (let i = 0; i < 8; i += 1) {
      output += Number(n & 255n).toString(16).padStart(2, "0");
      n >>= 8n;
    }

    return output;
  };

  CHISEL.isHex = function isHex(value) {
    return /^[0-9a-fA-F]*$/.test(String(value || ""));
  };

  CHISEL.stringToHex = function stringToHex(value) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(String(value || ""));

    return Array.from(bytes, function mapByte(byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  };

  CHISEL.normalizePushDataHex = function normalizePushDataHex(hex) {
    const normalized = String(hex || "").trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();

    if (!normalized) {
      return "";
    }

    if (!CHISEL.isHex(normalized)) {
      throw new Error("Pushdata must be hex.");
    }

    if (normalized.length % 2 !== 0) {
      throw new Error("Pushdata hex must have an even number of characters.");
    }

    return normalized;
  };

  CHISEL.resolveOpReturnHex = function resolveOpReturnHex(options) {
    const opts = options || {};
    const ascii = opts.opReturnAscii !== undefined ? String(opts.opReturnAscii) : "";
    const text = opts.opReturnText !== undefined ? String(opts.opReturnText) : "";
    const rawHex = opts.opReturnHex !== undefined ? String(opts.opReturnHex) : "";

    if ((ascii || text) && rawHex) {
      throw new Error("Use OP_RETURN ASCII/text or OP_RETURN hex, not both.");
    }

    if (ascii) {
      return CHISEL.stringToHex(ascii);
    }

    if (text) {
      return CHISEL.stringToHex(text);
    }

    return CHISEL.normalizePushDataHex(rawHex);
  };

  CHISEL.pushDataHex = function pushDataHex(payloadHex) {
    const normalized = CHISEL.normalizePushDataHex(payloadHex);
    const byteLength = normalized.length / 2;

    if (byteLength <= 75) {
      return CHISEL.byteHex(byteLength) + normalized;
    }

    if (byteLength <= 255) {
      return "4c" + CHISEL.byteHex(byteLength) + normalized;
    }

    if (byteLength <= 65535) {
      return "4d" + CHISEL.uint16LEHex(byteLength) + normalized;
    }

    throw new Error("Pushdata is too large.");
  };

  CHISEL.buildOpReturnScript = function buildOpReturnScript(payloadHex) {
    const normalized = CHISEL.normalizePushDataHex(payloadHex);

    if (!normalized) {
      return "";
    }

    return "6a" + CHISEL.pushDataHex(normalized);
  };

  CHISEL.readOpReturnPushHex = function readOpReturnPushHex(scriptPubKeyHex) {
    const hex = String(scriptPubKeyHex || "").trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();

    if (hex.slice(0, 2) !== "6a") {
      return "";
    }

    let cursor = 2;
    let output = "";

    while (cursor < hex.length) {
      const opcode = parseInt(hex.slice(cursor, cursor + 2), 16);
      let length = 0;

      cursor += 2;

      if (opcode >= 1 && opcode <= 75) {
        length = opcode;
      } else if (opcode === 76) {
        length = parseInt(hex.slice(cursor, cursor + 2), 16);
        cursor += 2;
      } else if (opcode === 77) {
        length = parseInt(hex.slice(cursor + 2, cursor + 4) + hex.slice(cursor, cursor + 2), 16);
        cursor += 4;
      } else {
        break;
      }

      output += hex.slice(cursor, cursor + length * 2);
      cursor += length * 2;
    }

    return output;
  };



  CHISEL.readVarInt = function readVarInt(hex, cursor) {
    const normalized = String(hex || "").toLowerCase();
    const first = parseInt(normalized.slice(cursor, cursor + 2), 16);

    if (!Number.isFinite(first)) {
      throw new Error("Could not read varInt at cursor " + cursor + ".");
    }

    if (first < 253) {
      return { value: first, cursor: cursor + 2 };
    }

    if (first === 253) {
      return {
        value: parseInt(normalized.slice(cursor + 4, cursor + 6) + normalized.slice(cursor + 2, cursor + 4), 16),
        cursor: cursor + 6
      };
    }

    if (first === 254) {
      return {
        value: parseInt(
          normalized.slice(cursor + 8, cursor + 10) +
          normalized.slice(cursor + 6, cursor + 8) +
          normalized.slice(cursor + 4, cursor + 6) +
          normalized.slice(cursor + 2, cursor + 4),
          16
        ),
        cursor: cursor + 10
      };
    }

    throw new Error("64-bit varInt parsing is intentionally not supported yet.");
  };

  CHISEL.readUInt32LE = function readUInt32LE(hex, cursor) {
    const normalized = String(hex || "").toLowerCase();

    return parseInt(
      normalized.slice(cursor + 6, cursor + 8) +
      normalized.slice(cursor + 4, cursor + 6) +
      normalized.slice(cursor + 2, cursor + 4) +
      normalized.slice(cursor, cursor + 2),
      16
    );
  };

  CHISEL.readUInt64LE = function readUInt64LE(hex, cursor) {
    const normalized = String(hex || "").toLowerCase();
    let value = 0n;

    for (let i = 7; i >= 0; i -= 1) {
      value = (value << 8n) + BigInt(parseInt(normalized.slice(cursor + i * 2, cursor + i * 2 + 2), 16));
    }

    return value;
  };

  CHISEL.parseRawTransactionDetailed = function parseRawTransactionDetailed(rawTxHex) {
    const hex = String(rawTxHex || "").trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();

    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) {
      throw new Error("Raw transaction must be even-length hex.");
    }

    let cursor = 0;
    const version = CHISEL.readUInt32LE(hex, cursor);
    cursor += 8;

    const marker = hex.slice(cursor, cursor + 2);
    let segwit = false;

    if (marker === "00" && hex.slice(cursor + 2, cursor + 4) !== "00") {
      segwit = true;
      throw new Error("SegWit transaction parsing is not supported in this Chisel path yet.");
    }

    const vinVarInt = CHISEL.readVarInt(hex, cursor);
    const vinCount = vinVarInt.value;
    cursor = vinVarInt.cursor;

    const vin = [];

    for (let i = 0; i < vinCount; i += 1) {
      const txidLE = hex.slice(cursor, cursor + 64);
      cursor += 64;

      const vout = CHISEL.readUInt32LE(hex, cursor);
      cursor += 8;

      const scriptLenVarInt = CHISEL.readVarInt(hex, cursor);
      const scriptLen = scriptLenVarInt.value;
      cursor = scriptLenVarInt.cursor;

      const scriptSig = hex.slice(cursor, cursor + scriptLen * 2);
      cursor += scriptLen * 2;

      const sequence = hex.slice(cursor, cursor + 8);
      cursor += 8;

      vin.push({
        txid: CHISEL.reverseHex(txidLE),
        txidLE: txidLE,
        vout: vout,
        scriptSig: scriptSig,
        scriptSigBytes: scriptLen,
        sequence: sequence
      });
    }

    const voutVarInt = CHISEL.readVarInt(hex, cursor);
    const voutCount = voutVarInt.value;
    cursor = voutVarInt.cursor;

    const vout = [];

    for (let n = 0; n < voutCount; n += 1) {
      const valueSatsBig = CHISEL.readUInt64LE(hex, cursor);
      cursor += 16;

      const scriptLenVarInt = CHISEL.readVarInt(hex, cursor);
      const scriptLen = scriptLenVarInt.value;
      cursor = scriptLenVarInt.cursor;

      const scriptPubKey = hex.slice(cursor, cursor + scriptLen * 2);
      cursor += scriptLen * 2;

      let type = "unknown";
      let hash160 = "";
      let opReturnHex = "";

      if (/^76a914[0-9a-f]{40}88ac$/.test(scriptPubKey)) {
        type = "p2pkh";
        hash160 = scriptPubKey.slice(6, 46);
      } else if (scriptPubKey.slice(0, 2) === "6a") {
        type = "op_return";
        opReturnHex = CHISEL.readOpReturnPushHex(scriptPubKey);
      }

      vout.push({
        n: n,
        valueSats: Number(valueSatsBig),
        valueSatsBig: valueSatsBig.toString(),
        scriptPubKey: scriptPubKey,
        scriptPubKeyBytes: scriptLen,
        type: type,
        hash160: hash160,
        opReturnHex: opReturnHex
      });
    }

    const locktime = CHISEL.readUInt32LE(hex, cursor);
    cursor += 8;

    if (cursor !== hex.length) {
      throw new Error("Raw transaction parser stopped before the end. Cursor " + cursor + " of " + hex.length + ".");
    }

    return {
      version: version,
      segwit: segwit,
      vinCount: vinCount,
      vin: vin,
      voutCount: voutCount,
      vout: vout,
      locktime: locktime,
      bytes: hex.length / 2,
      hex: hex
    };
  };

  CHISEL.about = function about() {
    return {
      name: "chisel",
      core: "2.4.2d",
      coins: CHISEL.getCoins().map(function mapCoin(coin) {
        return coin.NAME;
      }),
      resources: CHISEL.getResources().map(function mapResource(resource) {
        return resource.NAME;
      }),
      providers: CHISEL.getProviders().map(function mapProvider(provider) {
        return provider.NAME;
      }),
      hasLitecoin: Boolean(CHISEL.litecoin),
      hasBitcoinLikeFactory: typeof CHISEL.createBitcoinLikeCoin === "function"
    };
  };

  //
  // Generic bitcoinlike P2PKH resource factory.
  // This is intentionally conservative: legacy P2PKH only, local construction,
  // local signing, third-party UTXO/tx/broadcast providers.
  //
  CHISEL.createBitcoinLikeCoin = function createBitcoinLikeCoin(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Bitcoinlike config is required.");
    }

    const BASE_UNITS = Number(config.BASE_UNITS || config.baseUnits || 100000000);
    const NETWORKS = config.NETWORKS || config.networks || {};
    const DEFAULT_NETWORK = config.DEFAULT_NETWORK || config.defaultNetwork || "mainnet";
    const DEFAULT_FEE_UNITS = Number(config.DEFAULT_FEE_UNITS || config.defaultFeeUnits || 10000);

    function normalizeNetwork(network) {
      const normalized = String(network || DEFAULT_NETWORK).trim().toLowerCase();

      if (NETWORKS[normalized]) {
        return normalized;
      }

      if ((normalized === "test" || normalized === "tltc") && NETWORKS.testnet) {
        return "testnet";
      }

      if ((normalized === "main" || normalized === "ltc") && NETWORKS.mainnet) {
        return "mainnet";
      }

      throw new Error("Unsupported " + config.DISPLAY_NAME + " network: " + normalized);
    }

    function getNetwork(network) {
      return NETWORKS[normalizeNetwork(network)];
    }

    function getProviderNames(options) {
      const opts = options || {};
      const network = getNetwork(opts.network);

      if (Array.isArray(opts.providers) && opts.providers.length > 0) {
        return opts.providers.slice();
      }

      if (opts.provider) {
        return [opts.provider];
      }

      return (network.providers || []).slice();
    }

    function getProvider(providerName, options) {
      const provider = CHISEL.getProvider(providerName);
      const networkName = normalizeNetwork(options && options.network);

      if (provider.coin && provider.coin !== config.NAME) {
        throw new Error("Provider " + providerName + " is for " + provider.coin + ", not " + config.NAME + ".");
      }

      if (provider.network && provider.network !== networkName) {
        throw new Error("Provider " + providerName + " is for " + provider.network + ", not " + networkName + ".");
      }

      return provider;
    }

    function coinToUnits(value) {
      return Math.round(Number(value) * BASE_UNITS);
    }

    function unitsToCoin(value) {
      return Number(value) / BASE_UNITS;
    }

    function getRequiredFeeUnits(feeUnits) {
      return Math.max(Number(feeUnits || 0), DEFAULT_FEE_UNITS);
    }

    async function publicKeyHexToAddress(publicKeyHex, options) {
      const network = getNetwork(options && options.network);
      const versionBytes = new Uint8Array([network.p2pkhPrefix]);
      const publicKeyHashHex = await CHISEL.hash160Hex(publicKeyHex);
      const publicKeyHashBytes = CHISEL.hexToUint8Array(publicKeyHashHex);
      const payloadBytes = CHISEL.concatBytes(versionBytes, publicKeyHashBytes);

      return CHISEL.base58CheckEncode(payloadBytes);
    }

    async function privateKeyHexToAddress(privateKeyHex, compressed, options) {
      const publicKeyHex = CHISEL.privateKeyHexToPublicKeyHex(privateKeyHex, compressed);

      return publicKeyHexToAddress(publicKeyHex, options);
    }

    async function addressToP2pkhScript(address, options) {
      const network = getNetwork(options && options.network);
      const payload = await CHISEL.base58CheckDecode(address);
      const version = payload[0];

      if (version !== network.p2pkhPrefix) {
        throw new Error(
          "Expected " + config.DISPLAY_NAME + " P2PKH prefix " + network.p2pkhPrefix + ", got " + version + "."
        );
      }

      const hash160 = CHISEL.bytesToHex(payload.slice(1));

      if (hash160.length !== 40) {
        throw new Error("Unexpected hash160 length for " + address + ".");
      }

      return "76a914" + hash160 + "88ac";
    }

    async function wifToAccount(wif, options) {
      const networkName = normalizeNetwork(options && options.network);
      const network = getNetwork(networkName);
      const decoded = await CHISEL.wifToPrivateKey(wif);

      if (decoded.version !== network.wifPrefix) {
        throw new Error(
          "Unsupported " + config.DISPLAY_NAME + " WIF prefix " + decoded.version +
          " for " + networkName + ". Expected " + network.wifPrefix + "."
        );
      }

      const accountOptions = Object.assign({}, options || {}, { network: networkName });
      const compressedAddress = await privateKeyHexToAddress(decoded.privateKeyHex, true, accountOptions);
      const uncompressedAddress = await privateKeyHexToAddress(decoded.privateKeyHex, false, accountOptions);

      return {
        currency: config.NAME,
        network: networkName,
        ticker: network.ticker || config.TICKER,
        compressed: decoded.compressed,
        version: decoded.version,
        privateKeyHex: decoded.privateKeyHex,
        address: decoded.compressed ? compressedAddress : uncompressedAddress,
        compressedAddress: compressedAddress,
        uncompressedAddress: uncompressedAddress
      };
    }

    async function getAddressUtxosWithReport(address, options) {
      const opts = options || {};
      const providerNames = getProviderNames(opts);
      const reports = [];

      for (let i = 0; i < providerNames.length; i += 1) {
        const provider = getProvider(providerNames[i], opts);

        if (typeof provider.getAddressUtxos !== "function") {
          reports.push({ provider: provider.NAME, ok: false, error: "Provider has no getAddressUtxos()." });
          continue;
        }

        try {
          const result = await provider.getAddressUtxos(address, opts);

          reports.push({ provider: provider.NAME, ok: true, result: result });
        } catch (error) {
          reports.push({ provider: provider.NAME, ok: false, error: error.message || String(error) });
        }
      }

      return CHISEL.firstSuccessfulProviderResult(reports);
    }

    async function getAddressUtxos(address, options) {
      const report = await getAddressUtxosWithReport(address, options);

      return report.result;
    }

    async function getTransactionWithReport(txid, options) {
      const opts = options || {};
      const providerNames = getProviderNames(opts);
      const reports = [];

      for (let i = 0; i < providerNames.length; i += 1) {
        const provider = getProvider(providerNames[i], opts);

        if (typeof provider.getTransaction !== "function") {
          reports.push({ provider: provider.NAME, ok: false, error: "Provider has no getTransaction()." });
          continue;
        }

        try {
          const result = await provider.getTransaction(txid, opts);

          reports.push({ provider: provider.NAME, ok: true, result: result });
        } catch (error) {
          reports.push({ provider: provider.NAME, ok: false, error: error.message || String(error) });
        }
      }

      return CHISEL.firstSuccessfulProviderResult(reports);
    }

    async function getTransaction(txid, options) {
      const report = await getTransactionWithReport(txid, options);

      return report.result;
    }

    async function broadcastRawTransactionWithReport(rawHex, options) {
      const opts = options || {};
      const providerNames = getProviderNames(opts);
      const reports = [];

      for (let i = 0; i < providerNames.length; i += 1) {
        const provider = getProvider(providerNames[i], opts);

        if (typeof provider.broadcastRawTransaction !== "function") {
          reports.push({ provider: provider.NAME, ok: false, error: "Provider has no broadcastRawTransaction()." });
          continue;
        }

        try {
          const result = await provider.broadcastRawTransaction(rawHex, opts);

          reports.push({ provider: provider.NAME, ok: true, result: result });
        } catch (error) {
          reports.push({ provider: provider.NAME, ok: false, error: error.message || String(error) });
        }
      }

      return CHISEL.firstSuccessfulProviderResult(reports);
    }

    async function broadcastRawTransaction(rawHex, options) {
      const report = await broadcastRawTransactionWithReport(rawHex, options);

      return report.result;
    }

    async function buildP2pkhSelfSend(wif, options) {
      const opts = options || {};
      const networkName = normalizeNetwork(opts.network);
      const opReturnHex = CHISEL.resolveOpReturnHex(opts);
      const opReturnScript = CHISEL.buildOpReturnScript(opReturnHex);
      const feeUnits = getRequiredFeeUnits(opts.feeUnits || opts.feeSats || DEFAULT_FEE_UNITS);
      const account = await wifToAccount(wif, { network: networkName });
      const utxoReport = await getAddressUtxosWithReport(account.address, opts);
      const utxos = utxoReport.result.map(CHISEL.normalizeUTXO).filter(function filterUtxo(utxo) {
        return utxo.txid && utxo.vout !== undefined && Number(utxo.satoshis) > 0;
      }).sort(function sortUtxos(a, b) {
        return Number(b.satoshis) - Number(a.satoshis);
      });

      if (utxos.length === 0) {
        throw new Error("No usable UTXOs found for " + account.address + ".");
      }

      const selectedUtxo = utxos[0];
      const sendBackUnits = Number(selectedUtxo.satoshis) - feeUnits;

      if (sendBackUnits <= 546) {
        throw new Error("Selected UTXO is too small after fee.");
      }

      const outputScript = await addressToP2pkhScript(account.address, { network: networkName });
      const outputChunks = [
        CHISEL.uint64LEHex(sendBackUnits) +
        CHISEL.varInt(outputScript.length / 2) +
        outputScript
      ];

      if (opReturnScript) {
        outputChunks.push(
          CHISEL.uint64LEHex(0) +
          CHISEL.varInt(opReturnScript.length / 2) +
          opReturnScript
        );
      }

      const unsignedHex =
        "01000000" +
        "01" +
        CHISEL.reverseHex(selectedUtxo.txid) +
        CHISEL.uint32LEHex(selectedUtxo.vout) +
        "00" +
        "ffffffff" +
        CHISEL.varInt(outputChunks.length) +
        outputChunks.join("") +
        "00000000";

      const signedHex = await CHISEL.signRawTransaction(unsignedHex, [{
        privateKeyHex: account.privateKeyHex,
        compressed: account.compressed
      }]);
      const decodedUnsignedLocal = CHISEL.parseRawTransactionDetailed(unsignedHex);
      const decodedSignedLocal = CHISEL.parseRawTransactionDetailed(signedHex);
      const warnings = [];

      if (opReturnHex && (opReturnHex.length / 2) > 80) {
        warnings.push("OP_RETURN payload is " + (opReturnHex.length / 2) + " bytes. 80 bytes is the conservative standard-policy ceiling used by this Chisel path.");
      }

      return {
        type: "p2pkh-self-send-plan",
        status: "built-not-broadcast",
        broadcasted: false,
        currency: config.NAME,
        network: networkName,
        address: account.address,
        compressed: account.compressed,
        selectedProvider: utxoReport.selectedProvider,
        attemptedProviders: utxoReport.attemptedProviders,
        selectedUtxo: selectedUtxo,
        inputUnits: Number(selectedUtxo.satoshis),
        feeUnits: feeUnits,
        sendBackUnits: sendBackUnits,
        opReturnHex: opReturnHex,
        opReturnBytes: opReturnHex.length / 2,
        opReturnScript: opReturnScript,
        outputCount: outputChunks.length,
        inputCoin: unitsToCoin(selectedUtxo.satoshis).toFixed(8),
        feeCoin: unitsToCoin(feeUnits).toFixed(8),
        sendBackCoin: unitsToCoin(sendBackUnits).toFixed(8),
        localUnsignedDecode: decodedUnsignedLocal,
        localSignedDecode: decodedSignedLocal,
        unsignedHex: unsignedHex,
        signedHex: signedHex,
        warnings: warnings,
        nextStep: "Inspect this object. Run coin.verifySelfSendPlan(plan), then broadcast with coin.broadcastPlan(plan, { confirmBroadcast: true })."
      };
    }

    async function verifySelfSendPlan(plan, options) {
      const opts = options || {};
      const networkName = normalizeNetwork(opts.network || (plan && plan.network));

      if (!plan || plan.type !== "p2pkh-self-send-plan") {
        throw new Error("Expected a p2pkh-self-send-plan object.");
      }

      if (!plan.signedHex) {
        throw new Error("Plan has no signedHex.");
      }

      const decoded = CHISEL.parseRawTransactionDetailed(plan.signedHex);
      const outputScript = await addressToP2pkhScript(plan.address, { network: networkName });
      const matchingOutputs = decoded.vout.filter(function filterOutput(output) {
        return output.scriptPubKey === outputScript;
      });
      const outputUnits = decoded.vout.reduce(function reduceTotal(total, output) {
        return total + Number(output.valueSats || 0);
      }, 0);
      const expectedSendBackUnits = Number(plan.sendBackUnits);
      const expectedFeeUnits = Number(plan.feeUnits);
      const expectedInputUnits = Number(plan.inputUnits);
      const warnings = [];

      if (decoded.vinCount !== 1) {
        warnings.push("Expected one input, found " + decoded.vinCount + ".");
      }

      const expectedVoutCount = plan.opReturnHex ? 2 : 1;
      const opReturnOutputs = decoded.vout.filter(function filterOpReturn(output) {
        return output.type === "op_return";
      });

      if (decoded.voutCount !== expectedVoutCount) {
        warnings.push("Expected " + expectedVoutCount + " output(s), found " + decoded.voutCount + ".");
      }

      if (plan.opReturnHex) {
        if (opReturnOutputs.length !== 1) {
          warnings.push("Expected one OP_RETURN output, found " + opReturnOutputs.length + ".");
        } else if (opReturnOutputs[0].opReturnHex !== plan.opReturnHex) {
          warnings.push("OP_RETURN payload mismatch.");
        }
      } else if (opReturnOutputs.length !== 0) {
        warnings.push("Unexpected OP_RETURN output found.");
      }

      if (matchingOutputs.length !== 1) {
        warnings.push("Expected one self-send P2PKH output to " + plan.address + ".");
      }

      if (outputUnits !== expectedSendBackUnits) {
        warnings.push("Output total " + outputUnits + " does not match plan sendBackUnits " + expectedSendBackUnits + ".");
      }

      if ((expectedInputUnits - outputUnits) !== expectedFeeUnits) {
        warnings.push("Fee mismatch. input - output = " + (expectedInputUnits - outputUnits) + ", plan feeUnits = " + expectedFeeUnits + ".");
      }

      return {
        ok: warnings.length === 0,
        warnings: warnings,
        network: networkName,
        address: plan.address,
        inputUnits: expectedInputUnits,
        outputUnits: outputUnits,
        feeUnits: expectedInputUnits - outputUnits,
        opReturnHex: plan.opReturnHex || "",
        opReturnBytes: plan.opReturnBytes || 0,
        bytes: decoded.bytes,
        decoded: decoded
      };
    }

    async function broadcastPlan(plan, options) {
      const opts = options || {};

      if (!opts.confirmBroadcast) {
        throw new Error("Refusing to broadcast. Pass { confirmBroadcast: true } after inspecting the plan and verification result.");
      }

      const verification = await verifySelfSendPlan(plan, opts);

      const planWarnings = Array.isArray(plan.warnings) ? plan.warnings : [];

      if ((planWarnings.length > 0 || !verification.ok) && !opts.allowWarnings) {
        throw new Error("Refusing to broadcast plan with warnings: " + JSON.stringify(planWarnings.concat(verification.warnings)));
      }

      const report = await broadcastRawTransactionWithReport(plan.signedHex, Object.assign({}, opts, {
        network: opts.network || plan.network
      }));

      return {
        broadcasted: true,
        verification: verification,
        selectedProvider: report.selectedProvider,
        attemptedProviders: report.attemptedProviders,
        result: report.result
      };
    }

    async function healthCheck(options) {
      const opts = options || {};
      const providerNames = getProviderNames(opts);
      const reports = [];

      for (let i = 0; i < providerNames.length; i += 1) {
        const provider = getProvider(providerNames[i], opts);
        const started = Date.now();

        try {
          let result;

          if (typeof provider.healthCheck === "function") {
            result = await provider.healthCheck(opts);
          } else if (typeof provider.getTip === "function") {
            result = await provider.getTip(opts);
          } else {
            result = { note: "No provider health check function." };
          }

          reports.push({
            provider: provider.NAME,
            ok: true,
            elapsedMs: Date.now() - started,
            result: result
          });
        } catch (error) {
          reports.push({
            provider: provider.NAME,
            ok: false,
            elapsedMs: Date.now() - started,
            error: error.message || String(error)
          });
        }
      }

      return reports;
    }

    return {
      NAME: config.NAME,
      DISPLAY_NAME: config.DISPLAY_NAME,
      TICKER: config.TICKER,
      KIND: "bitcoinlike-p2pkh",
      BASE_UNITS: BASE_UNITS,
      DEFAULT_NETWORK: DEFAULT_NETWORK,
      DEFAULT_FEE_UNITS: DEFAULT_FEE_UNITS,
      NETWORKS: NETWORKS,
      coinToUnits: coinToUnits,
      unitsToCoin: unitsToCoin,
      getRequiredFeeUnits: getRequiredFeeUnits,
      normalizeNetwork: normalizeNetwork,
      getNetwork: getNetwork,
      getProviderNames: getProviderNames,
      getProvider: getProvider,
      publicKeyHexToAddress: publicKeyHexToAddress,
      privateKeyHexToAddress: privateKeyHexToAddress,
      addressToP2pkhScript: addressToP2pkhScript,
      wifToAccount: wifToAccount,
      getAddressUtxosWithReport: getAddressUtxosWithReport,
      getAddressUtxos: getAddressUtxos,
      getTransactionWithReport: getTransactionWithReport,
      getTransaction: getTransaction,
      broadcastRawTransactionWithReport: broadcastRawTransactionWithReport,
      broadcastRawTransaction: broadcastRawTransaction,
      buildP2pkhSelfSend: buildP2pkhSelfSend,
      makeSelfSend: buildP2pkhSelfSend,
      makeOpReturnSelfSend: buildP2pkhSelfSend,
      verifySelfSendPlan: verifySelfSendPlan,
      broadcastPlan: broadcastPlan,
      healthCheck: healthCheck
    };
  };

  //
  // Litecoin providers
  //
  CHISEL.installProvider("litecoinspace", {
    NAME: "litecoinspace",
    DISPLAY_NAME: "Litecoinspace mainnet",
    coin: "litecoin",
    network: "mainnet",
    baseUrl: "https://litecoinspace.org/api",
    explorerTxUrl: "https://litecoinspace.org/tx/",
    getAddressUtxos: async function getAddressUtxos(address) {
      const json = await CHISEL.fetchJson(this.baseUrl + "/address/" + encodeURIComponent(address) + "/utxo");

      if (!Array.isArray(json)) {
        throw new Error("Litecoinspace returned an unexpected UTXO payload.");
      }

      return json.map(function normalize(utxo) {
        return {
          txid: utxo.txid,
          vout: utxo.vout,
          satoshis: Number(utxo.value),
          scriptPubKey: utxo.scriptpubkey || "",
          confirmed: Boolean(utxo.status && utxo.status.confirmed),
          blockHeight: utxo.status ? utxo.status.block_height : undefined,
          blockTime: utxo.status ? utxo.status.block_time : undefined
        };
      });
    },
    getTransaction: async function getTransaction(txid) {
      return CHISEL.fetchJson(this.baseUrl + "/tx/" + encodeURIComponent(txid));
    },
    broadcastRawTransaction: async function broadcastRawTransaction(rawHex) {
      return CHISEL.fetchText(this.baseUrl + "/tx", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: String(rawHex || "").trim()
      });
    },
    getTip: async function getTip() {
      return CHISEL.fetchJson(this.baseUrl + "/blocks/tip/height");
    },
    healthCheck: async function healthCheck() {
      return {
        tipHeight: await this.getTip()
      };
    }
  });

  CHISEL.installProvider("litecoinspaceTestnet", {
    NAME: "litecoinspaceTestnet",
    DISPLAY_NAME: "Litecoinspace testnet",
    coin: "litecoin",
    network: "testnet",
    baseUrl: "https://litecoinspace.org/testnet/api",
    explorerTxUrl: "https://litecoinspace.org/testnet/tx/",
    getAddressUtxos: CHISEL.getProvider("litecoinspace").getAddressUtxos,
    getTransaction: CHISEL.getProvider("litecoinspace").getTransaction,
    broadcastRawTransaction: CHISEL.getProvider("litecoinspace").broadcastRawTransaction,
    getTip: CHISEL.getProvider("litecoinspace").getTip,
    healthCheck: CHISEL.getProvider("litecoinspace").healthCheck
  });

  CHISEL.installProvider("blockcypherLitecoin", {
    NAME: "blockcypherLitecoin",
    DISPLAY_NAME: "BlockCypher Litecoin mainnet",
    coin: "litecoin",
    network: "mainnet",
    baseUrl: "https://api.blockcypher.com/v1/ltc/main",
    explorerTxUrl: "https://live.blockcypher.com/ltc/tx/",
    getAddressUtxos: async function getAddressUtxos(address) {
      const json = await CHISEL.fetchJson(
        this.baseUrl + "/addrs/" + encodeURIComponent(address) + "?unspentOnly=true&includeScript=true"
      );
      const txrefs = (json.txrefs || []).concat(json.unconfirmed_txrefs || []);

      return txrefs.map(function normalize(utxo) {
        return {
          txid: utxo.tx_hash,
          vout: utxo.tx_output_n,
          satoshis: Number(utxo.value),
          scriptPubKey: utxo.script || "",
          confirmed: Number(utxo.confirmations || 0) > 0,
          blockHeight: utxo.block_height,
          confirmations: utxo.confirmations
        };
      });
    },
    getTransaction: async function getTransaction(txid) {
      return CHISEL.fetchJson(this.baseUrl + "/txs/" + encodeURIComponent(txid));
    },
    broadcastRawTransaction: async function broadcastRawTransaction(rawHex) {
      return CHISEL.fetchJson(this.baseUrl + "/txs/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx: String(rawHex || "").trim() })
      });
    },
    getTip: async function getTip() {
      return CHISEL.fetchJson(this.baseUrl);
    },
    healthCheck: async function healthCheck() {
      const status = await this.getTip();

      return {
        name: status.name,
        height: status.height,
        hash: status.hash
      };
    }
  });

  CHISEL.installProvider("blockchairLitecoin", {
    NAME: "blockchairLitecoin",
    DISPLAY_NAME: "Blockchair Litecoin mainnet",
    coin: "litecoin",
    network: "mainnet",
    baseUrl: "https://api.blockchair.com/litecoin",
    explorerTxUrl: "https://blockchair.com/litecoin/transaction/",
    getTransaction: async function getTransaction(txid) {
      return CHISEL.fetchJson(this.baseUrl + "/dashboards/transaction/" + encodeURIComponent(txid));
    },
    getTip: async function getTip() {
      return CHISEL.fetchJson(this.baseUrl + "/stats");
    },
    healthCheck: async function healthCheck() {
      const stats = await this.getTip();

      return {
        blocks: stats && stats.data ? stats.data.blocks : undefined,
        bestBlockHash: stats && stats.data ? stats.data.best_block_hash : undefined
      };
    }
  });

  // Backward compatible alias for 2.4.2a console snippets.
  CHISEL.providers.blockcypher = CHISEL.providers.blockcypherLitecoin;
  CHISEL.providers.blockchair = CHISEL.providers.blockchairLitecoin;

  //
  // Litecoin resource rebuilt on the generic bitcoinlike factory.
  //
  CHISEL.installResource("litecoin", CHISEL.createBitcoinLikeCoin({
    NAME: "litecoin",
    DISPLAY_NAME: "Litecoin resource",
    TICKER: "LTC",
    BASE_UNITS: 100000000,
    DEFAULT_NETWORK: "mainnet",
    DEFAULT_FEE_UNITS: 10000,
    NETWORKS: {
      mainnet: {
        name: "mainnet",
        ticker: "LTC",
        p2pkhPrefix: 48,
        wifPrefix: 176,
        bech32Prefix: "ltc",
        providers: ["litecoinspace", "blockcypherLitecoin", "blockchairLitecoin"]
      },
      testnet: {
        name: "testnet",
        ticker: "TLTC",
        p2pkhPrefix: 111,
        wifPrefix: 239,
        bech32Prefix: "tltc",
        providers: ["litecoinspaceTestnet"]
      }
    }
  }));

  CHISEL.litecoin = CHISEL.getResource("litecoin");
  CHISEL.ltc = CHISEL.litecoin;
  window.LITECOIN = CHISEL.litecoin;
  window.LTC = CHISEL.litecoin;


  window.CHISEL = CHISEL;
})();
