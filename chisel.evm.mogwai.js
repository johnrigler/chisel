(function (root) {
  "use strict";
  // Draft-only client adapter. No deployment is assumed or enabled for writes.
  // Works from a static file/IPFS page with an injected ethers v6 object.
  const KINDS = Object.freeze({ ARTIFACT: 1, LOG: 2, THUNDERWORD: 3, PEER: 4 });
  const ABI = Object.freeze([
    "function creator() view returns (address)",
    "function implementation() view returns (address)",
    "function mogwaiProtocol() pure returns (bytes32)",
    "function mapArtifact(string artifact,string body)",
    "function getArtifact(address writer,string artifact) view returns (string body,uint64 revision)",
    "function logRecord(bytes32 format,bytes data)",
    "function publishThunderword(address subject,bytes32 format,bytes data)",
    "function publishThunderwordText(string text,bytes32 format,bytes data)",
    "function thunderwordAddress(string text) pure returns (address)",
    "function decodeThunderword(address subject) pure returns (string)",
    "function thunderwordCount(address subject) view returns (uint64)",
    "function writerSequence(address writer) view returns (uint64)",
    "function sendToPeer(address peer,bytes32 format,bytes data)",
    "function receiveFromPeer(address claimedWriter,bytes32 format,bytes data)",
    "function execute((uint8 kind,bytes data)[] operations)",
    "function predictChildAddress(address author,bytes32 userSalt) view returns (address)",
    "function deployChild(bytes32 userSalt) returns (address)",
    "event ArtifactMapped(address indexed writer,bytes32 indexed artifactKeyHash,uint64 revision,string artifact,string body)",
    "event RecordLogged(address indexed writer,bytes32 indexed format,uint64 sequence,bytes data)",
    "event ThunderwordPublished(address indexed writer,address indexed thunderword,bytes32 indexed format,uint64 sequence,bytes data)",
    "event PeerMessageSent(address indexed writer,address indexed peer,bytes32 indexed format,bytes32 dataHash)",
    "event PeerMessageReceived(address indexed peer,address indexed claimedWriter,bytes32 indexed format,bytes data)",
    "event ChildDeployed(address indexed creator,address indexed child,bytes32 indexed derivedSalt,bytes32 userSalt)"
  ]);
  const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

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

  function bytes(value) {
    if (typeof value !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) {
      throw new Error("Payload must be even-length 0x-prefixed hexadecimal bytes.");
    }
    if ((value.length - 2) / 2 > 24576) throw new Error("Payload exceeds 24 KiB.");
    return value;
  }

  function address(value) {
    if (typeof value !== "string" || !ADDRESS.test(value) || /^0x0{40}$/i.test(value)) {
      throw new Error("A nonzero 20-byte EVM address is required.");
    }
    return value;
  }

  function operation(ethersLib, kind, params) {
    const coder = ethersLib && ethersLib.AbiCoder && ethersLib.AbiCoder.defaultAbiCoder();
    if (!coder) throw new Error("ethers v6 AbiCoder is required.");
    if (!params || typeof params !== "object") throw new Error("Missing operation parameters.");
    if (kind === KINDS.ARTIFACT) {
      if (typeof params.artifact !== "string" || !params.artifact ||
          typeof params.body !== "string") throw new Error("Expected artifact and body strings.");
      return { kind, data: coder.encode(["string", "string"], [params.artifact, params.body]) };
    }
    if (kind === KINDS.LOG) {
      return { kind, data: coder.encode(["bytes32", "bytes"], [params.format, bytes(params.data)]) };
    }
    if (kind === KINDS.THUNDERWORD || kind === KINDS.PEER) {
      const target = address(kind === KINDS.PEER ? params.peer : (params.thunderword || thunderwordAddress(params.text)));
      return { kind, data: coder.encode(["address", "bytes32", "bytes"], [target, params.format, bytes(params.data)]) };
    }
    throw new Error("Unsupported Mogwai operation kind.");
  }

  function batch(ethersLib, operations) {
    if (!Array.isArray(operations) || operations.length < 1 || operations.length > 32) {
      throw new Error("Mogwai batch requires 1-32 operations.");
    }
    return operations.map(entry => operation(ethersLib, entry.kind, entry));
  }

  root.CHISEL_EVM_MOGWAI = Object.freeze({
    ABI, KINDS, thunderwordAddress, decodeThunderword, operation, batch
  });
}(typeof window !== "undefined" ? window : globalThis));
