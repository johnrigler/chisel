(function () {
  //
  // Constants
  //
  const NAME = "ravencoin";
  const DISPLAY_NAME = "Ravencoin";
  const TICKER = "RVN";
  const ORDER = 10;
  const BASE_UNITS = 100000000;
  const DEFAULT_RPC_URL = "https://rigler.org:8769/";
  const DEFAULT_EXPLORER_URL = "";
  const DEFAULT_FEE = "0.002";
  const P2PKH_PREFIX = 60;
  const MAINNET_WIF_PREFIX = 128;
  const TESTNET_WIF_PREFIX = 239;
  const REQUIRES_EXPLORER = false;
  const HERO_TITLE = "One-step Ravencoin send-back + broadcast";
  const HERO_TEXT =
    "Paste one Ravencoin WIF, optionally add OP_RETURN data, and broadcast a self-send consolidation transaction. Your private key is only used locally in this session and never sent to the remote API.";
  const HELP_TEXT =
    "Ravencoin uses the RPC/API server directly for UTXOs, create, decode, and send.";

  //
  // Helpers
  //
  function coinToUnits(value) {
    return Math.round(Number(value) * BASE_UNITS);
  }

  function unitsToCoin(value) {
    return Number(value) / BASE_UNITS;
  }

  async function publicKeyHexToAddress(publicKeyHex) {
    const versionBytes = new Uint8Array([P2PKH_PREFIX]);
    const publicKeyHashHex = await CHISEL.hash160Hex(publicKeyHex);
    const publicKeyHashBytes = CHISEL.hexToUint8Array(publicKeyHashHex);
    const payloadBytes = CHISEL.concatBytes(versionBytes, publicKeyHashBytes);

    return CHISEL.base58CheckEncode(payloadBytes);
  }

  async function privateKeyHexToAddress(privateKeyHex, compressed) {
    const publicKeyHex = CHISEL.privateKeyHexToPublicKeyHex(privateKeyHex, compressed);

    return publicKeyHexToAddress(publicKeyHex);
  }

  async function wifToAccount(wif) {
    const decoded = await CHISEL.wifToPrivateKey(wif);

    if (decoded.version !== MAINNET_WIF_PREFIX && decoded.version !== TESTNET_WIF_PREFIX) {
      throw new Error("Unsupported Ravencoin WIF network.");
    }

    const compressedAddress = await privateKeyHexToAddress(decoded.privateKeyHex, true);
    const uncompressedAddress = await privateKeyHexToAddress(decoded.privateKeyHex, false);

    return {
      network: decoded.version === MAINNET_WIF_PREFIX ? "mainnet" : "testnet",
      compressed: decoded.compressed,
      privateKeyHex: decoded.privateKeyHex,
      address: decoded.compressed ? compressedAddress : uncompressedAddress,
      compressedAddress: compressedAddress,
      uncompressedAddress: uncompressedAddress
    };
  }

  function getRequiredFeeUnits(feeUnits) {
    return Number(feeUnits);
  }

  async function getAddressUtxos(client, values, address) {
    if (!client.address || !client.address.getaddressutxos) {
      throw new Error("RPC missing address.getaddressutxos");
    }

    return client.address.getaddressutxos(address);
  }

  async function createRawTransaction(client, values, vin, vout) {
    if (!client.tx || !client.tx.createrawtransaction) {
      throw new Error("RPC missing tx.createrawtransaction");
    }

    return client.tx.createrawtransaction(vin, vout);
  }

  async function decodeRawTransaction(client, values, rawHex) {
    if (!client.tx || !client.tx.decoderawtransaction) {
      throw new Error("RPC missing tx.decoderawtransaction");
    }

    return client.tx.decoderawtransaction(rawHex);
  }

  async function sendRawTransaction(client, values, signedHex) {
    if (!client.tx || !client.tx.sendrawtransaction) {
      throw new Error("RPC missing tx.sendrawtransaction");
    }

    return client.tx.sendrawtransaction(signedHex);
  }

  async function signRawTransaction(rawHex, signingInputs) {
    return CHISEL.signRawTransaction(rawHex, signingInputs);
  }

  //
  // Install
  //
  CHISEL.installCoin(NAME, {
    NAME: NAME,
    DISPLAY_NAME: DISPLAY_NAME,
    TICKER: TICKER,
    ORDER: ORDER,
    BASE_UNITS: BASE_UNITS,
    DEFAULT_RPC_URL: DEFAULT_RPC_URL,
    DEFAULT_EXPLORER_URL: DEFAULT_EXPLORER_URL,
    DEFAULT_FEE: DEFAULT_FEE,
    REQUIRES_EXPLORER: REQUIRES_EXPLORER,
    HERO_TITLE: HERO_TITLE,
    HERO_TEXT: HERO_TEXT,
    HELP_TEXT: HELP_TEXT,
    coinToUnits: coinToUnits,
    unitsToCoin: unitsToCoin,
    publicKeyHexToAddress: publicKeyHexToAddress,
    privateKeyHexToAddress: privateKeyHexToAddress,
    wifToAccount: wifToAccount,
    getRequiredFeeUnits: getRequiredFeeUnits,
    getAddressUtxos: getAddressUtxos,
    createRawTransaction: createRawTransaction,
    decodeRawTransaction: decodeRawTransaction,
    sendRawTransaction: sendRawTransaction,
    signRawTransaction: signRawTransaction
  });
})();
