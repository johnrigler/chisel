(function () {
  "use strict";

  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  // Exact legacy MacDougal substitution table.
  // Each glyph in MACDOUGAL maps to the Base58 glyph at the same index in B58.
  const MACDOUGAL = '123456789abcdefghjklmnpqrstuvwxyz!)0(=/\\,i;?\"_o}{@+|*.: -~';

  // Current working readable grammar layer.
  // This is intentionally separate from the exact MACDOUGAL table above.
  const GRAMMAR = Object.freeze({
    SPACE: "x",
    TITLE_SPACE: "q",
    HYPHEN: "y",
    APOSTROPHE: "t",
    PERIOD: "v",
    COLON: "w",
    LEFT_PAREN: "b",
    RIGHT_PAREN: "d",
    PADDING: "z",
    NEWLINE: "+",
    REFERENCE: "/"
  });

  const SEEDS = [
    0, 3, 5, 7, 10, 12, 15, 17, 20, 22, 25,
    27, 30, 32, 35, 37, 40, 42, 45, 48, 50,
    53, 55, 58, 60, 63, 65, 68, 70, 73, 76,
    78, 80, 83, 85, 88, 91, 93, 96, 98, 101,
    103, 106, 108, 111, 113, 116, 118, 121,
    123, 126, 128, 131, 134, 136, 139, 141, 144
  ];

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, function mapByte(byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  function hexToBytes(hex) {
    const normalized = String(hex).trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();

    assert(normalized.length % 2 === 0, "Invalid hex length.");

    const bytes = new Uint8Array(normalized.length / 2);

    for (let i = 0; i < normalized.length; i += 2) {
      bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
    }

    return bytes;
  }

  function concatBytes() {
    const arrays = Array.from(arguments);
    const totalLength = arrays.reduce(function reduceLength(total, array) {
      return total + array.length;
    }, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;

    arrays.forEach(function appendArray(array) {
      merged.set(array, offset);
      offset += array.length;
    });

    return merged;
  }

  async function sha256Bytes(bytes) {
    const cryptoObject = window.crypto || globalThis.crypto;

    assert(cryptoObject && cryptoObject.subtle, "crypto.subtle is required for SHA-256.");

    const hashBuffer = await cryptoObject.subtle.digest("SHA-256", bytes);

    return new Uint8Array(hashBuffer);
  }

  async function doubleSha256Bytes(bytes) {
    return sha256Bytes(await sha256Bytes(bytes));
  }

  function base58ToBytes(value) {
    const normalized = String(value).trim();

    assert(normalized.length > 0, "Base58 value is required.");

    let bytes = [0];

    for (const character of normalized) {
      const characterIndex = B58.indexOf(character);

      assert(characterIndex !== -1, "Invalid Base58 character: " + character);

      let carry = characterIndex;

      for (let i = bytes.length - 1; i >= 0; i -= 1) {
        const current = bytes[i] * 58 + carry;
        bytes[i] = current & 255;
        carry = current >> 8;
      }

      while (carry > 0) {
        bytes.unshift(carry & 255);
        carry >>= 8;
      }
    }

    let leadingZeroCount = 0;

    for (const character of normalized) {
      if (character === "1") {
        leadingZeroCount += 1;
      } else {
        break;
      }
    }

    if (leadingZeroCount > 0) {
      bytes = new Array(leadingZeroCount).fill(0).concat(bytes);
    }

    return new Uint8Array(bytes);
  }

  function bytesToBase58(bytes) {
    if (!bytes.length) {
      return "";
    }

    let digits = [0];

    for (const byte of bytes) {
      let carry = byte;

      for (let i = digits.length - 1; i >= 0; i -= 1) {
        const current = digits[i] * 256 + carry;
        digits[i] = current % 58;
        carry = Math.floor(current / 58);
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
      return B58[digit];
    }).join("");

    return output;
  }

  function base58DecodeUnchecked(value, versionBytes) {
    const decoded = base58ToBytes(value);
    let leadingBase58ZeroCount = 0;

    for (let i = 0; i < value.length - 1; i += 1) {
      if (value[i] === B58[0]) {
        leadingBase58ZeroCount += 1;
      } else {
        break;
      }
    }

    let buffer = decoded;

    if (leadingBase58ZeroCount > 0) {
      const pad = new Uint8Array(versionBytes.length * leadingBase58ZeroCount);

      for (let i = 0; i < leadingBase58ZeroCount; i += 1) {
        pad.set(versionBytes, i * versionBytes.length);
      }

      buffer = concatBytes(pad, decoded);
    }

    assert(buffer.length >= 5, "Decoded Base58 value is too short.");

    return buffer.slice(1, buffer.length - 4);
  }

  async function base58CheckEncode(payloadBytes, versionBytes) {
    const versionedPayload = concatBytes(versionBytes, payloadBytes);
    const checksum = (await doubleSha256Bytes(versionedPayload)).slice(0, 4);
    const addressBytes = concatBytes(versionedPayload, checksum);

    return bytesToBase58(addressBytes);
  }

  function getVersionBytes(prefix) {
    const normalizedPrefix = String(prefix || "");

    assert(normalizedPrefix.length > 0, "Prefix is required.");

    const seedIndex = B58.indexOf(normalizedPrefix[0]);

    assert(seedIndex !== -1, "Prefix first character is not Base58: " + normalizedPrefix[0]);
    assert(seedIndex < SEEDS.length, "No seed for prefix character: " + normalizedPrefix[0]);

    return new Uint8Array([SEEDS[seedIndex]]);
  }

  function isBase58(character) {
    return B58.indexOf(character) !== -1;
  }

  function isBase64(character) {
    return B64.indexOf(character) !== -1;
  }

  function tableEncodeMacDougal(text) {
    return Array.from(String(text || "")).map(function mapCharacter(character) {
      const mappedIndex = MACDOUGAL.indexOf(character);
      let mapped = mappedIndex === -1 ? character : B58[mappedIndex];

      if (character === "I") {
        mapped = "i";
      }

      if (character === "O") {
        mapped = "o";
      }

      assert(isBase58(mapped), "Character cannot be encoded as Base58: " + character);

      return mapped;
    }).join("");
  }

  function encodeMacDougal(text) {
    return tableEncodeMacDougal(text);
  }

  function encodeReadableMacDougal(text, options) {
    const settings = Object.assign({
      preserveCase: true,
      apostropheGlyph: GRAMMAR.APOSTROPHE,
      titleSpaceGlyph: GRAMMAR.TITLE_SPACE
    }, options || {});

    let output = "";

    for (const rawCharacter of String(text || "")) {
      let character = rawCharacter;

      if (character === " " || character === "\t") {
        output += GRAMMAR.SPACE;
        continue;
      }

      if (character === "\r") {
        continue;
      }

      if (character === "\n") {
        output += GRAMMAR.NEWLINE;
        continue;
      }

      if (character === "-") {
        output += GRAMMAR.HYPHEN;
        continue;
      }

      if (character === "'") {
        output += settings.apostropheGlyph;
        continue;
      }

      if (character === ".") {
        output += GRAMMAR.PERIOD;
        continue;
      }

      if (character === ":") {
        output += GRAMMAR.COLON;
        continue;
      }

      if (character === "(") {
        output += GRAMMAR.LEFT_PAREN;
        continue;
      }

      if (character === ")") {
        output += GRAMMAR.RIGHT_PAREN;
        continue;
      }

      if (character === "/" || character === "+") {
        output += character;
        continue;
      }

      if (character === "I") {
        output += "i";
        continue;
      }

      if (character === "O") {
        output += "o";
        continue;
      }

      if (character === "0") {
        output += "o";
        continue;
      }

      if (character === "l") {
        output += "L";
        continue;
      }

      if (!settings.preserveCase && /[a-zA-Z]/.test(character)) {
        character = character.toUpperCase();
      }

      assert(isBase64(character), "Character cannot be encoded as Base64-MacDougal: " + rawCharacter);

      output += character;
    }

    return output;
  }

  function titleSpaceReadableMacDougal(text) {
    const words = String(text || "").split(/(\s+)/);
    let output = "";
    let previousWasSpace = false;

    words.forEach(function encodePart(part, index) {
      if (part.length === 0) {
        return;
      }

      if (/^\s+$/.test(part)) {
        previousWasSpace = true;
        return;
      }

      if (output.length > 0) {
        const startsUpper = /^[A-Z]/.test(part);
        output += startsUpper ? GRAMMAR.TITLE_SPACE : GRAMMAR.SPACE;
      }

      output += encodeReadableMacDougal(part, { preserveCase: true });
      previousWasSpace = false;
    });

    return output;
  }

  function makeValidBase64(text) {
    let output = String(text || "");

    for (const character of output) {
      assert(isBase64(character), "Not a Base64 glyph: " + character);
    }

    while (output.length % 4 !== 0) {
      output += GRAMMAR.PADDING;
    }

    return output;
  }

  function base64ToBytes(base64) {
    const normalized = makeValidBase64(base64);
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  function base64MacDougalToHex(text) {
    return bytesToHex(base64ToBytes(text));
  }

  function getOpReturnStats(text, maxBytes) {
    const base64 = makeValidBase64(text);
    const bytes = base64ToBytes(base64);
    const hex = bytesToHex(bytes);
    const limit = Number.isFinite(Number(maxBytes)) ? Number(maxBytes) : 80;

    return {
      input: String(text || ""),
      base64: base64,
      hex: hex,
      usedBytes: bytes.length,
      maxBytes: limit,
      remainingBytes: limit - bytes.length,
      usedHexChars: hex.length,
      maxHexChars: limit * 2,
      remainingHexChars: (limit * 2) - hex.length,
      overLimit: bytes.length > limit
    };
  }

  function parseMacDougalReference(token) {
    const normalized = String(token || "");

    if (/^[0-9]+$/.test(normalized)) {
      return {
        type: "local-vout",
        vout: parseInt(normalized, 10)
      };
    }

    let match = normalized.match(/^([0-9]+)v([0-9]+)v([0-9]+)$/);

    if (match) {
      return {
        type: "same-chain-utxo",
        height: parseInt(match[1], 10),
        txIndex: parseInt(match[2], 10),
        vout: parseInt(match[3], 10)
      };
    }

    match = normalized.match(/^([A-Za-z0-9]+)w([0-9]+)v([0-9]+)v([0-9]+)$/);

    if (match) {
      return {
        type: "cross-chain-utxo",
        chain: match[1],
        height: parseInt(match[2], 10),
        txIndex: parseInt(match[3], 10),
        vout: parseInt(match[4], 10)
      };
    }

    match = normalized.match(/^([A-Za-z0-9]+)w([0-9]+)v([0-9]+)d$/);

    if (match) {
      return {
        type: "evm-data",
        chain: match[1],
        block: parseInt(match[2], 10),
        txIndex: parseInt(match[3], 10)
      };
    }

    match = normalized.match(/^([A-Za-z0-9]+)w([0-9]+)v([0-9]+)l([0-9]+)$/);

    if (match) {
      return {
        type: "evm-log",
        chain: match[1],
        block: parseInt(match[2], 10),
        txIndex: parseInt(match[3], 10),
        logIndex: parseInt(match[4], 10)
      };
    }

    return {
      type: "unknown",
      raw: normalized
    };
  }

  function tokenizeBase64MacDougal(text) {
    const source = String(text || "");
    const tokens = [];

    for (let i = 0; i < source.length; i += 1) {
      const character = source[i];

      if (character === GRAMMAR.REFERENCE) {
        const close = source.indexOf(GRAMMAR.REFERENCE, i + 1);

        if (close !== -1) {
          const refToken = source.slice(i + 1, close);
          tokens.push({
            type: "reference",
            raw: refToken,
            ref: parseMacDougalReference(refToken)
          });
          i = close;
          continue;
        }
      }

      if (character === GRAMMAR.NEWLINE) {
        tokens.push({ type: "newline" });
      } else if (character === GRAMMAR.SPACE) {
        tokens.push({ type: "space" });
      } else if (character === GRAMMAR.TITLE_SPACE) {
        tokens.push({ type: "title-space" });
      } else if (character === GRAMMAR.HYPHEN) {
        tokens.push({ type: "text", value: "-" });
      } else if (character === GRAMMAR.APOSTROPHE) {
        tokens.push({ type: "text", value: "'" });
      } else if (character === GRAMMAR.PERIOD) {
        tokens.push({ type: "text", value: "." });
      } else if (character === GRAMMAR.COLON) {
        tokens.push({ type: "text", value: ":" });
      } else if (character === GRAMMAR.LEFT_PAREN) {
        tokens.push({ type: "text", value: "(" });
      } else if (character === GRAMMAR.RIGHT_PAREN) {
        tokens.push({ type: "text", value: ")" });
      } else if (character === GRAMMAR.PADDING) {
        tokens.push({ type: "padding" });
      } else {
        tokens.push({ type: "text", value: character });
      }
    }

    return tokens;
  }

  function renderBase64MacDougal(text, resolver) {
    const tokens = tokenizeBase64MacDougal(text);
    let output = "";
    let capitalizeNext = false;

    tokens.forEach(function renderToken(token) {
      if (token.type === "newline") {
        output += "\n";
        capitalizeNext = false;
        return;
      }

      if (token.type === "space") {
        output += " ";
        capitalizeNext = false;
        return;
      }

      if (token.type === "title-space") {
        output += " ";
        capitalizeNext = true;
        return;
      }

      if (token.type === "padding") {
        return;
      }

      if (token.type === "reference") {
        if (typeof resolver === "function") {
          output += resolver(token.ref, token.raw);
        } else {
          output += "[" + token.raw + "]";
        }
        capitalizeNext = false;
        return;
      }

      if (token.type === "text") {
        let value = token.value;

        if (capitalizeNext && /^[a-zA-Z]$/.test(value)) {
          value = value.toUpperCase();
          capitalizeNext = false;
        }

        output += value;
      }
    });

    return output;
  }

  async function generate(prefix, body) {
    const normalizedPrefix = String(prefix || "");
    const encodedBody = encodeMacDougal(body || "");
    const message = normalizedPrefix + encodedBody;

    assert(message.length <= 28, "Unspendable prefix + body is too long. Maximum pre-checksum length is 28 Base58 characters.");

    const versionBytes = getVersionBytes(normalizedPrefix);
    const stem28 = message.padEnd(28, "z");
    const fakeAddress = stem28.padEnd(34, "X");
    const payloadBytes = base58DecodeUnchecked(fakeAddress, versionBytes);

    return base58CheckEncode(payloadBytes, versionBytes);
  }

  async function inspect(prefix, body) {
    const encodedBody = encodeMacDougal(body || "");
    const address = await generate(prefix, body || "");

    return {
      prefix: String(prefix || ""),
      body: String(body || ""),
      encodedBody: encodedBody,
      stem28: (String(prefix || "") + encodedBody).padEnd(28, "z"),
      address: address
    };
  }

  const base64MacDougal = {
    B64: B64,
    GRAMMAR: GRAMMAR,
    encode: encodeReadableMacDougal,
    encodeTitleSpace: titleSpaceReadableMacDougal,
    makeValidBase64: makeValidBase64,
    toBytes: base64ToBytes,
    toHex: base64MacDougalToHex,
    getOpReturnStats: getOpReturnStats,
    tokenize: tokenizeBase64MacDougal,
    render: renderBase64MacDougal,
    parseReference: parseMacDougalReference
  };

  const api = {
    B58: B58,
    B64: B64,
    MACDOUGAL: MACDOUGAL,
    GRAMMAR: GRAMMAR,
    SEEDS: SEEDS.slice(),
    encodeMacDougal: encodeMacDougal,
    tableEncodeMacDougal: tableEncodeMacDougal,
    encodeReadableMacDougal: encodeReadableMacDougal,
    titleSpaceReadableMacDougal: titleSpaceReadableMacDougal,
    generate: generate,
    inspect: inspect,
    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes,
    base58ToBytes: base58ToBytes,
    bytesToBase58: bytesToBase58,
    base64MacDougal: base64MacDougal
  };

  window.CHISEL_UNSPENDABLE = api;

  if (window.CHISEL) {
    window.CHISEL.unspendable = api;
  }

  window.unspendable = generate;
  window.un = generate;
})();
