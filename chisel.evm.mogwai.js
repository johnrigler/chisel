(function (root) {
  "use strict";
  // Static/IPFS-friendly Mogwai V3 client. This module does not connect or
  // send transactions. Review encoded calldata and native value in Chisel.
  const ABI = Object.freeze([
    "function creator() view returns (address)",
    "function mapArtifact(string artifact,string body)",
    "function getArtifact(address writer,string artifact) view returns (string body,uint64 revision)",
    "function logRecord(bytes32 format,bytes data)",
    "function distribute((address recipient,uint256 amount)[] payments) payable",
    "function distributeChecked((address recipient,uint256 amount)[] payments) payable",
    "function execute(string artifact,string body,(address recipient,uint256 amount)[] payments,bytes32 logFormat,bytes logData) payable",
    "function pendingRefunds(address writer) view returns (uint256)",
    "function withdrawRefund()",
    "event ArtifactMapped(address indexed writer,bytes32 indexed artifactKeyHash,uint64 revision,string artifact,string body)",
    "event RecordLogged(address indexed writer,bytes32 indexed format,bytes data)",
    "event TransferResult(address indexed writer,address indexed recipient,uint256 indexed index,uint256 amount,uint8 status)",
    "event RefundCredited(address indexed writer,uint256 amount)",
    "event RefundWithdrawn(address indexed writer,uint256 amount)"
  ]);
  const TRANSFER_STATUS = Object.freeze({
    UNFUNDED: 0, FAILED_CALL: 1, SUCCEEDED: 2
  });
  const ZERO_FORMAT = "0x" + "00".repeat(32);
  const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
  const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
  const UINT256_MAX = (1n << 256n) - 1n;

  function thunderwordAddress(text) {
    if (typeof text !== "string" || !/^[\x20-\x7e]{1,20}$/.test(text)) {
      throw new Error("Thunderword must be 1-20 printable ASCII characters.");
    }
    const hex = Array.from(text, char => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    return "0x" + hex.padEnd(40, "0");
  }

  function decodeThunderword(subject) {
    if (!ADDRESS.test(subject)) throw new Error("Expected a 20-byte hex address.");
    const bytes = subject.slice(2).match(/../g);
    let result = "", padded = false;
    bytes.forEach(hex => {
      const value = parseInt(hex, 16);
      if (!value) padded = true;
      else {
        if (padded || value < 32 || value > 126) throw new Error("Not a v1 printable Thunderword address.");
        result += String.fromCharCode(value);
      }
    });
    if (!result) throw new Error("Empty Thunderword address.");
    return result;
  }

  function byteString(value) {
    if (typeof value !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) {
      throw new Error("Log data must be even-length 0x-prefixed hexadecimal bytes.");
    }
    return value;
  }

  function uint256(value) {
    if (typeof value !== "bigint" &&
        (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))) {
      throw new Error("Amount must be a nonnegative integer in wei (decimal string or BigInt).");
    }
    const number = BigInt(value);
    if (number < 0n || number > UINT256_MAX) throw new Error("Amount exceeds uint256 bounds.");
    return number;
  }

  function payments(value, strict) {
    if (!Array.isArray(value)) throw new Error("Payments must be an array of recipient/amount pairs.");
    return value.map((item, index) => {
      if (!item || typeof item !== "object" || !ADDRESS.test(item.recipient)) {
        throw new Error("Payment " + index + " requires a 20-byte recipient address.");
      }
      const amount = uint256(item.amountWei === undefined ? item.amount : item.amountWei);
      if (strict && (item.recipient.toLowerCase() === "0x" + "00".repeat(20) || amount === 0n)) {
        throw new Error("Checked payments require a nonzero address and amount.");
      }
      return Object.freeze({recipient: item.recipient, amount});
    });
  }

  function prepare(functionName, params = {}) {
    const artifact = params.artifact === undefined ? "" : params.artifact;
    const body = params.body === undefined ? "" : params.body;
    if (typeof artifact !== "string" || typeof body !== "string") {
      throw new Error("Artifact and body must be strings.");
    }
    const logFormat = params.logFormat === undefined ? ZERO_FORMAT : params.logFormat;
    const logData = byteString(params.logData === undefined ? "0x" : params.logData);
    if (!BYTES32.test(logFormat)) throw new Error("Log format must be a bytes32 hex value.");
    const strict = functionName === "distributeChecked";
    const entries = payments(params.payments === undefined ? [] : params.payments, strict);
    const total = entries.reduce((sum, entry) => sum + entry.amount, 0n);
    const supplied = params.valueWei === undefined ? total : uint256(params.valueWei);
    if (strict && total !== supplied) {
      throw new Error("Checked transfer value must equal the sum of payment amounts.");
    }
    let args, valueWei;
    if (functionName === "execute") {
      args = [artifact, body, entries, logFormat, logData];
      valueWei = supplied;
    } else if (functionName === "distribute" || strict) {
      args = [entries];
      valueWei = supplied;
    } else if (functionName === "mapArtifact") {
      args = [artifact, body];
      valueWei = 0n;
    } else if (functionName === "logRecord") {
      args = [logFormat, logData];
      valueWei = 0n;
    } else if (functionName === "withdrawRefund") {
      args = [];
      valueWei = 0n;
    } else {
      throw new Error("Unsupported Mogwai write method.");
    }
    return Object.freeze({
      functionName, args, valueWei,
      value: "0x" + valueWei.toString(16),
      paymentTotalWei: total,
      payments: entries
    });
  }

  function encode(ethersLib, functionName, params) {
    if (!ethersLib || typeof ethersLib.Interface !== "function") {
      throw new Error("ethers v6 Interface is required to encode Mogwai calldata.");
    }
    const prepared = prepare(functionName, params);
    const data = new ethersLib.Interface(ABI).encodeFunctionData(functionName, prepared.args);
    return Object.freeze({...prepared, data});
  }

  root.CHISEL_EVM_MOGWAI = Object.freeze({
    ABI, TRANSFER_STATUS, ZERO_FORMAT,
    thunderwordAddress, decodeThunderword, payments, prepare, encode
  });
}(typeof window !== "undefined" ? window : globalThis));
