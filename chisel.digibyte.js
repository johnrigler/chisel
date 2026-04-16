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
    // Helpers
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
  }

  window.installChiselDigibyte = installChiselDigibyte;
})();
