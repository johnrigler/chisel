(function () {
  if (!window.CHISEL) {
    throw new Error("CHISEL must be loaded before chisel.litecoin.js.");
  }

  if (!CHISEL.litecoin) {
    throw new Error("CHISEL.litecoin resource must be installed before chisel.litecoin.js.");
  }

  const BASE_UNITS = 100000000;
  const DEFAULT_MAINNET_PROVIDERS = "litecoinspace,blockcypherLitecoin,blockchairLitecoin";
  const DEFAULT_TESTNET_PROVIDERS = "litecoinspaceTestnet";
  const DUST_UNITS = 546;
  const P2PKH_OUTPUT_BYTES = 34;
  const OP_RETURN_OUTPUT_OVERHEAD_BYTES = 12;
  const FEE_RATE_UNITS_PER_BYTE = 40;

  function coinToUnits(value) {
    return Math.round(Number(value || 0) * BASE_UNITS);
  }

  function unitsToCoin(value) {
    return Number(value || 0) / BASE_UNITS;
  }

  function splitProviderList(value, fallback) {
    const text = String(value || "").trim();

    if (!text) {
      return fallback.slice();
    }

    return text.split(/[\s,]+/).map(function normalizeProviderName(name) {
      return name.trim();
    }).filter(Boolean);
  }

  function getProviderNames(values, network) {
    const fallback = network === "testnet"
      ? ["litecoinspaceTestnet"]
      : ["litecoinspace", "blockcypherLitecoin", "blockchairLitecoin"];

    return splitProviderList(values && values.rpcUrl, fallback);
  }

  function getOptions(values, network) {
    return {
      network: network,
      providers: getProviderNames(values, network)
    };
  }

  function getOpReturnByteLength(opReturnHex) {
    return opReturnHex ? String(opReturnHex).length / 2 : 0;
  }

  function getRequiredFeeUnits(feeUnits, values) {
    const baseFeeUnits = Math.max(Number(feeUnits || 0), 10000);
    const opReturnBytes = getOpReturnByteLength(values && values.opReturnHex);
    const recipientCount = Math.max(0, Number(values && values.extraRecipientCount || 0));
    const opReturnFeeUnits = opReturnBytes ? (OP_RETURN_OUTPUT_OVERHEAD_BYTES + opReturnBytes) * FEE_RATE_UNITS_PER_BYTE : 0;
    const recipientFeeUnits = recipientCount * P2PKH_OUTPUT_BYTES * FEE_RATE_UNITS_PER_BYTE;

    return Math.ceil(baseFeeUnits + opReturnFeeUnits + recipientFeeUnits);
  }

  function buildOutputHex(valueUnits, scriptHex) {
    return CHISEL.uint64LEHex(valueUnits) + CHISEL.varInt(scriptHex.length / 2) + scriptHex;
  }

  async function buildRawTransaction(network, vin, vout) {
    const outputs = [];
    const resource = CHISEL.litecoin;

    for (const key in vout) {
      if (!Object.prototype.hasOwnProperty.call(vout, key)) {
        continue;
      }

      if (key === "data") {
        const opReturnScript = CHISEL.buildOpReturnScript(vout[key]);

        if (opReturnScript) {
          outputs.push(buildOutputHex(0, opReturnScript));
        }

        continue;
      }

      if (key === "ipfs") {
        throw new Error("Litecoin does not support the Ravencoin IPFS output field.");
      }

      const valueUnits = coinToUnits(vout[key]);

      if (valueUnits <= DUST_UNITS) {
        throw new Error("Litecoin output to " + key + " is dust or too small: " + unitsToCoin(valueUnits).toFixed(8));
      }

      const scriptHex = await resource.addressToP2pkhScript(key, { network: network });
      outputs.push(buildOutputHex(valueUnits, scriptHex));
    }

    if (outputs.length === 0) {
      throw new Error("Litecoin transaction needs at least one output.");
    }

    return (
      "01000000" +
      CHISEL.varInt(vin.length) +
      vin.map(function mapInput(input) {
        return CHISEL.reverseHex(input.txid) + CHISEL.uint32LEHex(input.vout) + "00" + "ffffffff";
      }).join("") +
      CHISEL.varInt(outputs.length) +
      outputs.join("") +
      "00000000"
    ).toLowerCase();
  }

  function makeLitecoinCoin(config) {
    const network = config.network;

    return {
      NAME: config.name,
      DISPLAY_NAME: config.displayName,
      TICKER: config.ticker,
      ORDER: config.order,
      BASE_UNITS: BASE_UNITS,
      DEFAULT_RPC_URL: config.defaultProviders,
      DEFAULT_EXPLORER_URL: config.explorerUrl,
      DEFAULT_FEE: "0.00010000",
      DEFAULT_BURN_AMOUNT: network === "testnet" ? "0.00001000" : "0.00010000",
      UNSPENDABLE_PREFIX: config.unspendablePrefix,
      UNSPENDABLE_MODIFIERS: config.unspendableModifiers ? config.unspendableModifiers.slice() : null,
      REQUIRES_EXPLORER: false,
      SUPPORTS_IPFS_FIELD: false,
      USES_THIRD_PARTY_PROVIDERS: true,
      HERO_TITLE: config.displayName + " provider send-back + broadcast",
      HERO_TEXT: "Paste one " + config.displayName + " WIF, optionally add OP_RETURN data, and broadcast a local P2PKH transaction through public providers. The WIF is decoded and signed locally.",
      HELP_TEXT: "Provider list is comma-separated. Default: " + config.defaultProviders + ". This first GUI bridge is legacy P2PKH only.",
      coinToUnits: coinToUnits,
      unitsToCoin: unitsToCoin,
      getRequiredFeeUnits: getRequiredFeeUnits,
      wifToAccount: function wifToAccount(wif) {
        return CHISEL.litecoin.wifToAccount(wif, { network: network });
      },
      getAddressUtxos: function getAddressUtxos(client, values, address) {
        return CHISEL.litecoin.getAddressUtxos(address, getOptions(values, network));
      },
      createRawTransaction: function createRawTransaction(client, values, vin, vout) {
        return buildRawTransaction(network, vin, vout);
      },
      decodeRawTransaction: function decodeRawTransaction(client, values, rawHex) {
        return CHISEL.parseRawTransactionDetailed(rawHex);
      },
      signRawTransaction: function signRawTransaction(rawHex, signingInputs) {
        return CHISEL.signRawTransaction(rawHex, signingInputs);
      },
      sendRawTransaction: async function sendRawTransaction(client, values, signedHex) {
        const report = await CHISEL.litecoin.broadcastRawTransactionWithReport(signedHex, getOptions(values, network));

        return {
          selectedProvider: report.selectedProvider,
          attemptedProviders: report.attemptedProviders,
          txid: report.result,
          result: report.result
        };
      }
    };
  }

  CHISEL.installCoin("litecoin", makeLitecoinCoin({
    name: "litecoin",
    displayName: "Litecoin",
    ticker: "LTC",
    order: 30,
    network: "mainnet",
    defaultProviders: DEFAULT_MAINNET_PROVIDERS,
    explorerUrl: "https://litecoinspace.org/tx/",
    unspendablePrefix: "L",
    unspendableModifiers: ["K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h"]
  }));

  CHISEL.installCoin("litecoinTestnet", makeLitecoinCoin({
    name: "litecoinTestnet",
    displayName: "Litecoin Testnet",
    ticker: "TLTC",
    order: 31,
    network: "testnet",
    defaultProviders: DEFAULT_TESTNET_PROVIDERS,
    explorerUrl: "https://litecoinspace.org/testnet/tx/",
    unspendablePrefix: "T",
    unspendableModifiers: ["K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h"]
  }));
})();
