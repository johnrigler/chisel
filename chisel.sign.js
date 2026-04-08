(function () {
  //
  // Constants
  //
  const CURVE_NAME = "secp256k1";
  const SIGHASH_ALL_HEX = "01000000";

  //
  // Plugin
  //
  function installChiselSigner(CHISEL, deps) {
    const ELLIPTIC = deps.elliptic;
    const CRYPTO_JS = deps.CryptoJS;

    if (!CHISEL) {
      throw new Error("CHISEL is required.");
    }

    if (!ELLIPTIC || !ELLIPTIC.ec) {
      throw new Error("elliptic dependency is required.");
    }

    if (!CRYPTO_JS || !CRYPTO_JS.RIPEMD160 || !CRYPTO_JS.enc || !CRYPTO_JS.lib) {
      throw new Error("CryptoJS dependency is required.");
    }

    //
    // Static helpers
    //
    CHISEL.hexToBytes = function hexToBytes(hex) {
      const normalized = hex.trim().replace(/^0x/i, "").toLowerCase();

      if (normalized.length % 2 !== 0) {
        throw new Error("Invalid hex length.");
      }

      const bytes = [];

      for (let i = 0; i < normalized.length; i += 2) {
        bytes.push(parseInt(normalized.slice(i, i + 2), 16));
      }

      return bytes;
    };

    CHISEL.bytesToHex = function bytesToHex(bytes) {
      return Array.from(bytes, function mapByte(byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    };

    CHISEL.normalizeHex = function normalizeHex(hex) {
      return hex.trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();
    };

    CHISEL.byteHex = function byteHex(number) {
      return number.toString(16).padStart(2, "0");
    };

    CHISEL.uint16LEHex = function uint16LEHex(number) {
      const byte1 = number & 255;
      const byte2 = (number >>> 8) & 255;

      return CHISEL.byteHex(byte1) + CHISEL.byteHex(byte2);
    };

    CHISEL.uint32LEHex = function uint32LEHex(number) {
      const byte1 = number & 255;
      const byte2 = (number >>> 8) & 255;
      const byte3 = (number >>> 16) & 255;
      const byte4 = (number >>> 24) & 255;

      return (
        CHISEL.byteHex(byte1) +
        CHISEL.byteHex(byte2) +
        CHISEL.byteHex(byte3) +
        CHISEL.byteHex(byte4)
      );
    };

    CHISEL.varInt = function varInt(number) {
      if (number < 253) {
        return CHISEL.byteHex(number);
      }

      if (number <= 65535) {
        return "fd" + CHISEL.uint16LEHex(number);
      }

      if (number <= 4294967295) {
        return "fe" + CHISEL.uint32LEHex(number);
      }

      throw new Error("varInt too large.");
    };

    CHISEL.sha256Hex = async function sha256Hex(hex) {
      const bytes = new Uint8Array(CHISEL.hexToBytes(hex));
      const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);

      return CHISEL.bytesToHex(new Uint8Array(hashBuffer));
    };

    CHISEL.ripemd160Hex = function ripemd160Hex(hex) {
      const bytes = CHISEL.hexToBytes(hex);
      const wordArray = CRYPTO_JS.lib.WordArray.create(bytes);

      return CRYPTO_JS.RIPEMD160(wordArray).toString(CRYPTO_JS.enc.Hex);
    };

    CHISEL.hash160Hex = async function hash160Hex(hex) {
      const sha = await CHISEL.sha256Hex(hex);

      return CHISEL.ripemd160Hex(sha);
    };

    CHISEL.doubleSha256Hex = async function doubleSha256Hex(hex) {
      const first = await CHISEL.sha256Hex(hex);

      return CHISEL.sha256Hex(first);
    };

    CHISEL.parseRawTransaction = function parseRawTransaction(rawTxHex) {
      const normalized = CHISEL.normalizeHex(rawTxHex);
      const version = normalized.slice(0, 8);
      const vinCount = parseInt(normalized.slice(8, 10), 16);

      let cursor = 10;
      const vins = [];

      for (let i = 0; i < vinCount; i++) {
        const txidLE = normalized.slice(cursor, cursor + 64);
        const vout = normalized.slice(cursor + 64, cursor + 72);
        const scriptLen = parseInt(normalized.slice(cursor + 72, cursor + 74), 16);
        const scriptStart = cursor + 74;
        const scriptEnd = scriptStart + scriptLen * 2;
        const seq = normalized.slice(scriptEnd, scriptEnd + 8);

        vins.push({
          txidLE: txidLE,
          vout: vout,
          seq: seq,
          scriptSig: ""
        });

        cursor = scriptEnd + 8;
      }

      return {
        version: version,
        vinCount: vinCount,
        vins: vins,
        outputsAndLock: normalized.slice(cursor)
      };
    };

    CHISEL.buildP2pkhLockScript = async function buildP2pkhLockScript(privateKeyHex) {
      const ec = new ELLIPTIC.ec(CURVE_NAME);
      const keyPair = ec.keyFromPrivate(privateKeyHex);
      const publicKeyHex = keyPair.getPublic(true, "hex");
      const publicKeyHashHex = await CHISEL.hash160Hex(publicKeyHex);

      return "76a914" + publicKeyHashHex + "88ac";
    };

	      const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const RVN_MAINNET_P2PKH_PREFIX = 60;
    const RVN_MAINNET_WIF_PREFIX = 128;
    const RVN_TESTNET_WIF_PREFIX = 239;

    CHISEL.concatBytes = function concatBytes(...arrays) {
      const totalLength = arrays.reduce(function addLength(sum, array) {
        return sum + array.length;
      }, 0);

      const merged = new Uint8Array(totalLength);
      let offset = 0;

      arrays.forEach(function appendArray(array) {
        merged.set(array, offset);
        offset += array.length;
      });

      return merged;
    };

    CHISEL.numberToBytes = function numberToBytes(number) {
      if (number === 0) {
        return new Uint8Array([0]);
      }

      const bytes = [];
      let value = number;

      while (value > 0) {
        bytes.unshift(value & 255);
        value = Math.floor(value / 256);
      }

      return new Uint8Array(bytes);
    };

    CHISEL.base58ToBytes = function base58ToBytes(value) {
      const trimmed = value.trim();

      if (!trimmed) {
        throw new Error("Base58 value is required.");
      }

      let decoded = new Uint8Array([0]);

      for (const character of trimmed) {
        const characterIndex = BASE58_ALPHABET.indexOf(character);

        if (characterIndex === -1) {
          throw new Error("Invalid Base58 character.");
        }

        let carry = characterIndex;
        const next = [];

        for (let i = decoded.length - 1; i >= 0; i--) {
          const current = decoded[i] * 58 + carry;
          next.unshift(current & 255);
          carry = current >> 8;
        }

        while (carry > 0) {
          next.unshift(carry & 255);
          carry >>= 8;
        }

        decoded = new Uint8Array(next);
      }

      let leadingZeroCount = 0;

      for (const character of trimmed) {
        if (character === "1") {
          leadingZeroCount++;
        } else {
          break;
        }
      }

      if (leadingZeroCount > 0) {
        decoded = CHISEL.concatBytes(new Uint8Array(leadingZeroCount), decoded);
      }

      return decoded;
    };

    CHISEL.bytesToBase58 = function bytesToBase58(bytes) {
      if (!bytes || bytes.length === 0) {
        return "";
      }

      let digits = [0];

      for (const byte of bytes) {
        let carry = byte;

        for (let i = digits.length - 1; i >= 0; i--) {
          const value = digits[i] * 256 + carry;
          digits[i] = value % 58;
          carry = Math.floor(value / 58);
        }

        while (carry > 0) {
          digits.unshift(carry % 58);
          carry = Math.floor(carry / 58);
        }
      }

      let output = "";

      for (const byte of bytes) {
        if (byte === 0) {
          output += "1";
        } else {
          break;
        }
      }

      output += digits.map(function mapDigit(digit) {
        return BASE58_ALPHABET[digit];
      }).join("");

      return output;
    };

    CHISEL.hexToUint8Array = function hexToUint8Array(hex) {
      return new Uint8Array(CHISEL.hexToBytes(hex));
    };

    CHISEL.base58CheckDecode = async function base58CheckDecode(value) {
      const bytes = CHISEL.base58ToBytes(value);

      if (bytes.length < 5) {
        throw new Error("Invalid Base58Check payload.");
      }

      const payload = bytes.slice(0, -4);
      const checksum = bytes.slice(-4);
      const payloadHex = CHISEL.bytesToHex(payload);
      const checksumHex = CHISEL.bytesToHex(checksum);
      const expectedChecksumHex = (await CHISEL.doubleSha256Hex(payloadHex)).slice(0, 8);

      if (checksumHex !== expectedChecksumHex) {
        throw new Error("Invalid Base58Check checksum.");
      }

      return payload;
    };

    CHISEL.base58CheckEncode = async function base58CheckEncode(payloadBytes) {
      const payloadHex = CHISEL.bytesToHex(payloadBytes);
      const checksumHex = (await CHISEL.doubleSha256Hex(payloadHex)).slice(0, 8);
      const checksumBytes = CHISEL.hexToUint8Array(checksumHex);
      const full = CHISEL.concatBytes(payloadBytes, checksumBytes);

      return CHISEL.bytesToBase58(full);
    };

    CHISEL.wifToPrivateKey = async function wifToPrivateKey(wif) {
      const payload = await CHISEL.base58CheckDecode(wif);

      if (payload.length !== 33 && payload.length !== 34) {
        throw new Error("Unexpected WIF payload length.");
      }

      const version = payload[0];
      const isCompressed = payload.length === 34;

      if (version !== RVN_MAINNET_WIF_PREFIX && version !== RVN_TESTNET_WIF_PREFIX) {
        throw new Error("Unsupported WIF network prefix.");
      }

      if (isCompressed && payload[payload.length - 1] !== 1) {
        throw new Error("Invalid compressed WIF flag.");
      }

      const privateKeyBytes = isCompressed ? payload.slice(1, 33) : payload.slice(1, 33);

      return {
        privateKeyHex: CHISEL.bytesToHex(privateKeyBytes),
        compressed: isCompressed,
        network: version === RVN_MAINNET_WIF_PREFIX ? "mainnet" : "testnet"
      };
    };

    CHISEL.privateKeyHexToPublicKeyHex = function privateKeyHexToPublicKeyHex(privateKeyHex, compressed) {
      const ec = new ELLIPTIC.ec(CURVE_NAME);
      const keyPair = ec.keyFromPrivate(CHISEL.normalizeHex(privateKeyHex));

      return keyPair.getPublic(Boolean(compressed), "hex");
    };

    CHISEL.publicKeyHexToAddress = async function publicKeyHexToAddress(publicKeyHex, versionByte) {
      const prefixBytes = new Uint8Array([versionByte]);
      const publicKeyHashHex = await CHISEL.hash160Hex(publicKeyHex);
      const publicKeyHashBytes = CHISEL.hexToUint8Array(publicKeyHashHex);
      const payloadBytes = CHISEL.concatBytes(prefixBytes, publicKeyHashBytes);

      return CHISEL.base58CheckEncode(payloadBytes);
    };

    CHISEL.privateKeyHexToRvnAddress = async function privateKeyHexToRvnAddress(privateKeyHex, compressed) {
      const publicKeyHex = CHISEL.privateKeyHexToPublicKeyHex(privateKeyHex, compressed);

      return CHISEL.publicKeyHexToAddress(publicKeyHex, RVN_MAINNET_P2PKH_PREFIX);
    };

    CHISEL.wifToRvnAccount = async function wifToRvnAccount(wif) {
      const decoded = await CHISEL.wifToPrivateKey(wif);
      const address = await CHISEL.privateKeyHexToRvnAddress(decoded.privateKeyHex, decoded.compressed);

      return {
        wif: wif.trim(),
        privateKeyHex: decoded.privateKeyHex,
        compressed: decoded.compressed,
        network: decoded.network,
        address: address
      };
    };

    CHISEL.signRawTransaction = async function signRawTransaction(rawTxHex, privateKeysHex) {
      const ec = new ELLIPTIC.ec(CURVE_NAME);
      const parsed = CHISEL.parseRawTransaction(rawTxHex);

      if (privateKeysHex.length !== parsed.vins.length) {
        throw new Error("Private key count must match input count.");
      }

      for (let i = 0; i < parsed.vins.length; i++) {
        const privateKeyHex = CHISEL.normalizeHex(privateKeysHex[i]);
        const keyPair = ec.keyFromPrivate(privateKeyHex);
        const publicKeyHex = keyPair.getPublic(true, "hex");
        const lockScriptHex = await CHISEL.buildP2pkhLockScript(privateKeyHex);

        let preimage = parsed.version + CHISEL.varInt(parsed.vins.length);

        parsed.vins.forEach(function appendInput(vin, index) {
          preimage += vin.txidLE + vin.vout;

          if (index === i) {
            preimage += CHISEL.varInt(lockScriptHex.length / 2) + lockScriptHex;
          } else {
            preimage += "00";
          }

          preimage += vin.seq;
        });

        preimage += parsed.outputsAndLock + SIGHASH_ALL_HEX;

        const digestHex = await CHISEL.doubleSha256Hex(preimage);
        const signature = keyPair.sign(digestHex, { canonical: true });
        const derSignatureHex = signature.toDER("hex") + "01";

        parsed.vins[i].scriptSig =
          CHISEL.varInt(derSignatureHex.length / 2) +
          derSignatureHex +
          CHISEL.varInt(publicKeyHex.length / 2) +
          publicKeyHex;
      }

      let finalHex = parsed.version + CHISEL.varInt(parsed.vins.length);

      parsed.vins.forEach(function appendSignedInput(vin) {
        finalHex += vin.txidLE + vin.vout;
        finalHex += CHISEL.varInt(vin.scriptSig.length / 2) + vin.scriptSig;
        finalHex += vin.seq;
      });

      finalHex += parsed.outputsAndLock;

      return finalHex.toLowerCase();
    };

    CHISEL.prototype.signRawTransaction = async function signRawTransaction(rawTxHex, privateKeysHex) {
      return CHISEL.signRawTransaction(rawTxHex, privateKeysHex);
    };
  }

  window.installChiselSigner = installChiselSigner;
})();
