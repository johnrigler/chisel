(function () {
  //
  // Constants
  //
  const P2PKH_PREFIX = 30;
  const MAINNET_WIF_PREFIX = 128;
  const TESTNET_WIF_PREFIX = 239;
  const NAMESPACE = "digibyte";

  //
  // Plugin
  //
  function installChiselDigibyte(CHISEL) {
    if (!CHISEL) {
      throw new Error("CHISEL is required.");
    }

    if (!CHISEL.base58CheckDecode) {
      throw new Error("installChiselSigner must be called before installChiselDigibyte.");
    }

    CHISEL[NAMESPACE] = CHISEL[NAMESPACE] || {};

    //
    // Address helpers
    //
    CHISEL[NAMESPACE].publicKeyHexToAddress = async function publicKeyHexToAddress(publicKeyHex) {
      const versionBytes = new Uint8Array([P2PKH_PREFIX]);
      const publicKeyHashHex = await CHISEL.hash160Hex(publicKeyHex);
      const publicKeyHashBytes = CHISEL.hexToUint8Array(publicKeyHashHex);
      const payloadBytes = CHISEL.concatBytes(versionBytes, publicKeyHashBytes);

      return CHISEL.base58CheckEncode(payloadBytes);
    };

    CHISEL[NAMESPACE].privateKeyHexToAddress = async function privateKeyHexToAddress(privateKeyHex, compressed) {
      const publicKeyHex = CHISEL.privateKeyHexToPublicKeyHex(privateKeyHex, compressed);

      return CHISEL[NAMESPACE].publicKeyHexToAddress(publicKeyHex);
    };

    CHISEL[NAMESPACE].wifToAccount = async function wifToAccount(wif) {
      const decoded = await CHISEL.wifToPrivateKey(wif);

      if (decoded.version !== MAINNET_WIF_PREFIX && decoded.version !== TESTNET_WIF_PREFIX) {
        throw new Error("Unsupported Digibyte WIF network.");
      }

      const compressedAddress = await CHISEL[NAMESPACE].privateKeyHexToAddress(
        decoded.privateKeyHex,
        true
      );

      const uncompressedAddress = await CHISEL[NAMESPACE].privateKeyHexToAddress(
        decoded.privateKeyHex,
        false
      );

      return {
        network: decoded.version === MAINNET_WIF_PREFIX ? "mainnet" : "testnet",
        compressed: decoded.compressed,
        privateKeyHex: decoded.privateKeyHex,
        address: decoded.compressed ? compressedAddress : uncompressedAddress,
        compressedAddress: compressedAddress,
        uncompressedAddress: uncompressedAddress
      };
    };

    //
    // Explorer helpers
    //
    CHISEL[NAMESPACE].buildExplorerAddressTxsUrl = function buildExplorerAddressTxsUrl(baseUrl, address) {
      const trimmedBaseUrl = String(baseUrl).replace(/\/+$/, "");
      return trimmedBaseUrl + "/api/address/" + encodeURIComponent(address) + "/txs";
    };

    CHISEL[NAMESPACE].deriveAddressUtxosFromTransactions = function deriveAddressUtxosFromTransactions(
      transactions,
      address
    ) {
      const utxoMap = new Map();
      const spentSet = new Set();

      transactions.forEach(function collectSpentOutputs(tx) {
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

      spentSet.forEach(function deleteSpentOutput(key) {
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
    };
  }

  window.installChiselDigibyte = installChiselDigibyte;
})();
