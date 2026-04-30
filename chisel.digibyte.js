(function () {
  //
  // Constants
  //
  const NAME = "digibyte";
  const DISPLAY_NAME = "Digibyte";
  const TICKER = "DGB";
  const ORDER = 20;
  const BASE_UNITS = 100000000;
  const DEFAULT_RPC_URL = "https://secretbeachsolutions.com:8443/";
  const DEFAULT_EXPLORER_URL = "https://digiexplorer.info";
  const DEFAULT_FEE = "0.0002";
  const MIN_FEE = 20000;
  const FEE_RATE_UNITS_PER_BYTE = 125;
  const OP_RETURN_OUTPUT_OVERHEAD_BYTES = 12;
  const P2PKH_OUTPUT_BYTES = 34;
  const P2PKH_PREFIX = 30;
  const MAINNET_WIF_PREFIX = 128;
  const TESTNET_WIF_PREFIX = 239;
  const REQUIRES_EXPLORER = true;
  const HERO_TITLE = "One-step Digibyte send-back + broadcast";
  const HERO_TEXT =
    "Paste one Digibyte WIF, optionally add OP_RETURN data, and broadcast a self-send consolidation transaction. Your private key is only used locally in this session and never sent to the remote API.";
  const HELP_TEXT =
    "Digibyte uses the explorer transaction-history endpoint to derive spendable UTXOs locally, then uses the RPC server for create, decode, and send.";

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
      throw new Error("Unsupported Digibyte WIF network.");
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

	//////
  function getRequiredFeeUnits(feeUnits) {
    return Math.max(Number(feeUnits), MIN_FEE);
  }
	/////
	
function getOpReturnByteLength(opReturnHex) {
  if (!opReturnHex) {
    return 0;
  }

  return String(opReturnHex).length / 2;
}


function getOpReturnFeeUnits(opReturnHex) {
  const opReturnBytes = getOpReturnByteLength(opReturnHex);

  if (opReturnBytes === 0) {
    return 0;
  }

  return (OP_RETURN_OUTPUT_OVERHEAD_BYTES + opReturnBytes) * FEE_RATE_UNITS_PER_BYTE;
}

function getRecipientOutputCount(values) {
  if (!values) {
    return 0;
  }

  if (Array.isArray(values.recipients)) {
    return values.recipients.length;
  }

  return Math.max(0, Number(values.extraRecipientCount || 0));
}

function getRecipientOutputFeeUnits(values) {
  return getRecipientOutputCount(values) * P2PKH_OUTPUT_BYTES * FEE_RATE_UNITS_PER_BYTE;
}

function getRequiredFeeUnits(feeUnits, values) {
  const baseFeeUnits = Math.max(Number(feeUnits), MIN_FEE);
  const opReturnFeeUnits = getOpReturnFeeUnits(values && values.opReturnHex);
  const recipientOutputFeeUnits = getRecipientOutputFeeUnits(values);

  return baseFeeUnits + opReturnFeeUnits + recipientOutputFeeUnits;
}

  function buildExplorerAddressTxsUrl(baseUrl, address) {
    const trimmedBaseUrl = String(baseUrl).replace(/\/+$/, "");

    return trimmedBaseUrl + "/api/address/" + encodeURIComponent(address) + "/txs";
  }

  function deriveAddressUtxosFromTransactions(transactions, address) {
    const utxoMap = new Map();
    const spentSet = new Set();

    transactions.forEach(function collectSpent(tx) {
      if (!tx || !tx.status || !tx.status.confirmed || !Array.isArray(tx.vin)) {
        return;
      }

      tx.vin.forEach(function collectVin(vin) {
        if (
          vin &&
          vin.prevout &&
          vin.prevout.scriptpubkey_address === address &&
          vin.txid !== undefined &&
          vin.vout !== undefined
        ) {
          spentSet.add(vin.txid + ":" + vin.vout);
        }
      });
    });

    transactions.forEach(function collectOutputs(tx) {
      if (!tx || !tx.status || !tx.status.confirmed || !Array.isArray(tx.vout)) {
        return;
      }

      tx.vout.forEach(function collectVout(vout, index) {
        if (
          vout &&
          vout.scriptpubkey_type === "p2pkh" &&
          vout.scriptpubkey_address === address &&
          Number(vout.value) > 0
        ) {
          utxoMap.set(tx.txid + ":" + index, {
            txid: tx.txid,
            vout: index,
            satoshis: Number(vout.value),
            confirmed: true,
            blockHeight: tx.status.block_height,
            blockTime: tx.status.block_time
          });
        }
      });
    });

    spentSet.forEach(function deleteSpent(key) {
      utxoMap.delete(key);
    });

    return Array.from(utxoMap.values()).sort(function sortUtxos(a, b) {
      if (b.blockHeight !== a.blockHeight) {
        return b.blockHeight - a.blockHeight;
      }

      if (a.txid !== b.txid) {
        return a.txid.localeCompare(b.txid);
      }

      return a.vout - b.vout;
    });
  }

  async function getAddressUtxos(client, values, address) {
    if (!values.explorerUrl) {
      throw new Error("Explorer URL is required for Digibyte.");
    }

    const url = buildExplorerAddressTxsUrl(values.explorerUrl, address);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Digibyte explorer request failed with HTTP " + response.status + ".");
    }

    const transactions = await response.json();

    if (!Array.isArray(transactions)) {
      throw new Error("Digibyte explorer returned an unexpected response.");
    }

    return deriveAddressUtxosFromTransactions(transactions, address);
  }

  async function createRawTransaction(client, values, vin, vout) {
    return client.call("createrawtransaction", [vin, vout]);
  }

  async function decodeRawTransaction(client, values, rawHex) {
    return client.call("decoderawtransaction", [rawHex]);
  }

  async function sendRawTransaction(client, values, signedHex) {
    return client.call("sendrawtransaction", [signedHex]);
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
    MIN_FEE: MIN_FEE,
    HERO_TITLE: HERO_TITLE,
    HERO_TEXT: HERO_TEXT,
    HELP_TEXT: HELP_TEXT,
    coinToUnits: coinToUnits,
    unitsToCoin: unitsToCoin,
    publicKeyHexToAddress: publicKeyHexToAddress,
    privateKeyHexToAddress: privateKeyHexToAddress,
    wifToAccount: wifToAccount,
    getRequiredFeeUnits: getRequiredFeeUnits,
    buildExplorerAddressTxsUrl: buildExplorerAddressTxsUrl,
    deriveAddressUtxosFromTransactions: deriveAddressUtxosFromTransactions,
    getAddressUtxos: getAddressUtxos,
    createRawTransaction: createRawTransaction,
    decodeRawTransaction: decodeRawTransaction,
    sendRawTransaction: sendRawTransaction,
    signRawTransaction: signRawTransaction
  });
})();
