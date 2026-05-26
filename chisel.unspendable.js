(function () {
  "use strict";

  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const MACDOUGAL = '123456789abcdefghjklmnpqrstuvwxyz!)0(=/\\,i;?\"_o}{@+|*.: -~';
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

  function encodeMacDougal(text) {
    return Array.from(String(text || "")).map(function mapCharacter(character) {
      const mappedIndex = MACDOUGAL.indexOf(character);
      let mapped = mappedIndex === -1 ? character : B58[mappedIndex];

      if (character === "I") {
        mapped = "i";
      }

      if (character === "O") {
        mapped = "o";
      }

      if (character === "'") {
        mapped = "y";
      }

      assert(B58.indexOf(mapped) !== -1, "Character cannot be encoded as Base58: " + character);

      return mapped;
    }).join("");
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


  async function scanSecondCharacterSpace(first, options) {
    const normalizedFirst = String(first || "").charAt(0);
    const scanOptions = options || {};
    const suffix = scanOptions.suffix === undefined ? "x" : String(scanOptions.suffix);
    const phrase = scanOptions.phrase || "domo arigato";
    const seconds = scanOptions.seconds && scanOptions.seconds.length
      ? scanOptions.seconds
      : B58.split("");
    const rows = [];
    const valid = [];
    const invalid = [];

    assert(normalizedFirst, "First character is required for second-character scan.");

    for (let i = 0; i < seconds.length; i += 1) {
      const second = String(seconds[i] || "").charAt(0);

      if (!second) {
        continue;
      }

      const prefix = normalizedFirst + second + suffix;
      let address = "";
      let error = "";
      let passed = false;

      try {
        address = await generate(prefix, phrase);
        passed = address.indexOf(prefix) === 0;
      } catch (exception) {
        error = exception && exception.message ? exception.message : String(exception);
      }

      const row = {
        first: normalizedFirst,
        second: second,
        suffix: suffix,
        prefix: prefix,
        phrase: phrase,
        address: address,
        passed: passed,
        error: error
      };

      rows.push(row);

      if (passed) {
        valid.push(second);
      } else {
        invalid.push(second);
      }
    }

    return {
      first: normalizedFirst,
      suffix: suffix,
      phrase: phrase,
      tested: rows.length,
      valid: valid,
      invalid: invalid,
      rows: rows
    };
  }

  async function testAllSecondCharacters(first, options) {
    return scanSecondCharacterSpace(first || "L", options);
  }

  async function testLoop(cases) {
    const testCases = cases && cases.length ? cases : [
      { name: "ravencoin", first: "R", seconds: ["A", "B", "C", "D", "E"], phrase: "domo arigato", requireAllPassed: true },
      { name: "digibyte", first: "D", seconds: ["A", "B", "C", "D", "E"], phrase: "domo arigato", requireAllPassed: true },
      { name: "litecoin", first: "L", seconds: B58.split(""), phrase: "domo arigato", requireAllPassed: false },
      { name: "litecoinTestnet", first: "T", seconds: B58.split(""), phrase: "domo arigato", requireAllPassed: false }
    ];
    const results = [];

    for (let i = 0; i < testCases.length; i += 1) {
      const testCase = testCases[i];
      const scan = await scanSecondCharacterSpace(testCase.first, {
        suffix: testCase.suffix || "x",
        phrase: testCase.phrase || "test",
        seconds: testCase.seconds
      });

      scan.rows.forEach(function appendRow(row) {
        results.push({
          name: testCase.name || scan.first,
          prefix: row.prefix,
          phrase: row.phrase,
          address: row.address,
          passed: row.passed,
          error: row.error
        });
      });

      if (testCase.requireAllPassed !== false && scan.invalid.length) {
        throw new Error("Unspendable test failed for " + testCase.name + ": " + scan.invalid.join(","));
      }
    }

    return results;
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

  const api = {
    B58: B58,
    MACDOUGAL: MACDOUGAL,
    SEEDS: SEEDS.slice(),
    encodeMacDougal: encodeMacDougal,
    generate: generate,
    inspect: inspect,
    testLoop: testLoop,
    scanSecondCharacterSpace: scanSecondCharacterSpace,
    testAllSecondCharacters: testAllSecondCharacters,
    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes,
    base58ToBytes: base58ToBytes,
    bytesToBase58: bytesToBase58
  };

  window.CHISEL_UNSPENDABLE = api;

  if (window.CHISEL) {
    window.CHISEL.unspendable = api;
  }

  window.unspendable = generate;
  window.un = generate;
})();
