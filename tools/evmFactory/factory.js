(function (root) {
  "use strict";

  // Static/IPFS-compatible EVM creation workbench. No Hardhat, ethers or npm runtime.
  // It accepts compiled artifacts; Solidity source must be compiled separately.
  const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
  const HASH = /^0x[0-9a-fA-F]{64}$/;
  const MAX_INIT_BYTES = 49152;

  function normalizedHex(value, required, maxBytes) {
    const raw = typeof value === "string" ? value : (value && value.object);
    if (typeof raw !== "string") {
      if (!required) return null;
      throw new Error("Missing contract creation bytecode.");
    }
    const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
    if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 || (required && !hex.length)) {
      throw new Error("Invalid or unlinked bytecode. Compile and link all libraries first.");
    }
    if (maxBytes && hex.length / 2 > maxBytes) {
      throw new Error("Creation bytecode exceeds the 49,152-byte EIP-3860 limit.");
    }
    return "0x" + hex.toLowerCase();
  }

  function collectArtifacts(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Expected a compiled contract JSON object.");
    }
    if (Array.isArray(input.errors) && input.errors.some(e => e.severity === "error")) {
      throw new Error("Compiler JSON contains Solidity errors; inspect and recompile.");
    }
    const entries = [];
    function add(name, source) {
      if (!source || !Array.isArray(source.abi)) return;
      const ctor = source.abi.find(fragment => fragment && fragment.type === "constructor");
      const constructorInputs = ctor && Array.isArray(ctor.inputs) ? ctor.inputs.length : 0;
      const bytecode = source.bytecode || (source.evm && source.evm.bytecode);
      const deployedBytecode = source.deployedBytecode || (source.evm && source.evm.deployedBytecode);
      const immutableReferences = deployedBytecode && typeof deployedBytecode === "object" &&
        deployedBytecode.immutableReferences || source.immutableReferences || null;
      const raw = typeof bytecode === "string" ? bytecode : bytecode && bytecode.object;
      if (!raw || raw === "0x") return; // interfaces and abstract contracts lack deployment bytecode
      entries.push(Object.freeze({
        name,
        abi: source.abi,
        bytecode: normalizedHex(bytecode, true, MAX_INIT_BYTES),
        deployedBytecode: normalizedHex(deployedBytecode, false),
        immutableReferences,
        constructorInputs,
        constructorParameters: ctor && Array.isArray(ctor.inputs) ? ctor.inputs : [],
        declaredCreationSha256: typeof source.bytecodeSha256 === "string" ? source.bytecodeSha256.toLowerCase() : null,
        declaredSourceSha256: typeof source.sourceSha256 === "string" ? source.sourceSha256.toLowerCase() : null,
        evmVersion: source.settings && source.settings.evmVersion || null,
        compiler: typeof input.compiler === "string" ? input.compiler :
          (input.compiler && input.compiler.version) || null
      }));
    }
    if (Array.isArray(input.abi)) {
      add(input.contractName || input.contract_name || "Contract", input);
    } else if (input.contracts && typeof input.contracts === "object") {
      for (const [file, contracts] of Object.entries(input.contracts)) {
        if (!contracts || typeof contracts !== "object") continue;
        for (const [name, value] of Object.entries(contracts)) add(file + ":" + name, value);
      }
    }
    if (!entries.length) throw new Error("No deployable ABI + bytecode found in this JSON.");
    return entries;
  }

  function chainNumber(value) {
    if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
      throw new Error("Wallet returned an invalid chain ID.");
    }
    const id = Number(BigInt(value));
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Unsupported chain ID.");
    return id;
  }

  function expectedChain(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== String(value).trim()) {
      throw new Error("Enter a positive decimal chain ID.");
    }
    return id;
  }

  function decodeHex(hex) {
    const pairs = hex.slice(2).match(/.{2}/g) || [];
    return Uint8Array.from(pairs, pair => parseInt(pair, 16));
  }

  async function sha256(hex) {
    if (!root.crypto || !root.crypto.subtle) throw new Error("WebCrypto requires HTTPS or localhost.");
    const digest = await root.crypto.subtle.digest("SHA-256", decodeHex(hex));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  }


  // ABI encoder implemented in vanilla JavaScript. All offsets are byte offsets
  // from their containing tuple/array head. No wallet or RPC calls occur here.
  function padWord(hex, left = true) {
    if (hex.length > 64) throw new Error("ABI value exceeds 32 bytes.");
    return left ? hex.padStart(64, "0") : hex.padEnd(64, "0");
  }
  function uintWord(n) {
    if (n < 0n || n >= (1n << 256n)) throw new Error("ABI offset or length exceeds uint256.");
    return padWord(n.toString(16));
  }
  function hexBytes(value, label) {
    if (typeof value !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) {
      throw new Error(label + " must be an even-length 0x-prefixed hexadecimal string.");
    }
    return value.slice(2).toLowerCase();
  }
  function dynamicBytes(hex) {
    const length = hex.length / 2;
    return uintWord(BigInt(length)) + hex.padEnd(Math.ceil(length / 32) * 64, "0");
  }
  function arrayType(type) {
    const match = /^(.*)\[([0-9]*)\]$/.exec(type);
    return match ? {base:match[1], count:match[2] === "" ? null : Number(match[2])} : null;
  }
  function isDynamic(param) {
    const arr = arrayType(param.type);
    if (arr) return arr.count === null || isDynamic({...param, type:arr.base});
    if (param.type === "tuple") return (param.components || []).some(isDynamic);
    return param.type === "string" || param.type === "bytes";
  }
  function staticWords(param) {
    if (isDynamic(param)) return 1;
    const arr = arrayType(param.type);
    if (arr) return arr.count * staticWords({...param, type:arr.base});
    if (param.type === "tuple") return (param.components || []).reduce((n, p) => n + staticWords(p), 0);
    return 1;
  }
  function tupleEncode(params, values) {
    if (!Array.isArray(values) || values.length !== params.length) {
      throw new Error("ABI tuple needs exactly " + params.length + " values.");
    }
    const headWords = params.reduce((n, p) => n + staticWords(p), 0);
    const head = [], tail = [];
    let offset = headWords * 32;
    for (let i = 0; i < params.length; i++) {
      const encoded = encodeValue(params[i], values[i]);
      if (isDynamic(params[i])) {
        head.push(uintWord(BigInt(offset)));
        tail.push(encoded);
        offset += encoded.length / 2;
      } else {
        head.push(encoded);
      }
      if (offset > MAX_INIT_BYTES * 3) throw new Error("Constructor arguments exceed the supported size.");
    }
    return head.join("") + tail.join("");
  }
  function integerValue(value, label) {
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
      throw new Error(label + " must be a safe integer or a decimal string.");
    }
    if (typeof value !== "number" && typeof value !== "string") {
      throw new Error(label + " must be an integer.");
    }
    const text = String(value);
    if (!/^-?(?:[0-9]+|0x[0-9a-fA-F]+)$/.test(text)) {
      throw new Error(label + " must be an integer.");
    }
    return BigInt(text);
  }
  function encodeValue(param, value) {
    const type = param.type, label = param.name || type;
    if (typeof type !== "string") throw new Error("Missing ABI parameter type.");
    const arr = arrayType(type);
    if (arr) {
      if (!Array.isArray(value) || value.length > 8192) throw new Error(label + " must be an array of at most 8192 entries.");
      if (arr.count !== null && value.length !== arr.count) throw new Error(label + " must contain exactly " + arr.count + " items.");
      const component = {...param, type:arr.base};
      const contents = tupleEncode(Array(value.length).fill(component), value);
      return arr.count === null ? uintWord(BigInt(value.length)) + contents : contents;
    }
    if (type === "tuple") return tupleEncode(param.components || [], value);
    if (type === "string") {
      if (typeof value !== "string") throw new Error(label + " must be a string.");
      return dynamicBytes(Array.from(new TextEncoder().encode(value), b => b.toString(16).padStart(2, "0")).join(""));
    }
    if (type === "bytes") return dynamicBytes(hexBytes(value, label));
    const fixedBytes = /^bytes([0-9]+)$/.exec(type);
    if (fixedBytes) {
      const size = Number(fixedBytes[1]), hex = hexBytes(value, label);
      if (size < 1 || size > 32 || hex.length !== size * 2) throw new Error(label + " must be exactly " + size + " bytes.");
      return padWord(hex, false);
    }
    if (type === "address") {
      if (typeof value !== "string" || !ADDRESS.test(value)) throw new Error(label + " must be a 20-byte EVM address.");
      return padWord(value.slice(2).toLowerCase());
    }
    if (type === "bool") {
      if (typeof value !== "boolean") throw new Error(label + " must be true or false.");
      return uintWord(value ? 1n : 0n);
    }
    const numberType = /^(u?int)([0-9]*)$/.exec(type);
    if (numberType) {
      const bits = numberType[2] ? Number(numberType[2]) : 256;
      if (bits < 8 || bits > 256 || bits % 8) throw new Error("Unsupported integer ABI type " + type);
      const n = integerValue(value, label);
      if (numberType[1] === "uint") {
        if (n < 0n || n >= (1n << BigInt(bits))) throw new Error(label + " outside " + type + " range.");
        return uintWord(n);
      }
      if (n < -(1n << BigInt(bits - 1)) || n >= (1n << BigInt(bits - 1))) throw new Error(label + " outside " + type + " range.");
      return uintWord(BigInt.asUintN(256, n));
    }
    throw new Error("Unsupported constructor ABI type: " + type);
  }

  function encodeConstructorArgs(artifact, values) {
    const params = artifact && artifact.constructorParameters;
    if (!Array.isArray(params)) throw new Error("Constructor ABI unavailable; reload the compiled artifact.");
    if (!Array.isArray(values) || values.length !== params.length) {
      throw new Error("Constructor requires " + params.length + " JSON values in ABI order.");
    }
    return "0x" + tupleEncode(params, values);
  }

  function creationData(artifact, values = []) {
    if (!artifact || typeof artifact.bytecode !== "string") throw new Error("Load compiled Solidity first.");
    const encoded = encodeConstructorArgs(artifact, values);
    const data = artifact.bytecode + encoded.slice(2);
    if ((data.length - 2) / 2 > MAX_INIT_BYTES) throw new Error("Total creation bytecode plus constructor arguments exceeds 49,152 bytes.");
    return Object.freeze({data, encodedArguments: encoded});
  }

  function providerRequired(provider) {
    if (!provider || typeof provider.request !== "function") {
      throw new Error("Select an injected EIP-1193 wallet.");
    }
    return provider;
  }

  // EIP-3326: only call this on an explicit user action.
  async function switchWalletChain(provider, chainInput) {
    providerRequired(provider);
    const desired = expectedChain(chainInput);
    const before = chainNumber(await provider.request({method: "eth_chainId"}));
    if (before !== desired) {
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{chainId: "0x" + desired.toString(16)}]
        });
      } catch (err) {
        const code = Number(err && err.code);
        if (code === 4001) throw new Error("Wallet network switch rejected.");
        if (code === 4902) throw new Error("Chain " + desired + " is not configured in this wallet. Add it manually, then retry.");
        throw err;
      }
    }
    const after = chainNumber(await provider.request({method: "eth_chainId"}));
    if (after !== desired) throw new Error("Wallet is still on chain " + after + "; expected " + desired + ".");
    return Object.freeze({chainId: after, switched: before !== after});
  }

  async function walletState(provider, desiredChain) {
    providerRequired(provider);
    const chainId = chainNumber(await provider.request({method: "eth_chainId"}));
    if (chainId !== desiredChain) {
      throw new Error("Wallet is on chain " + chainId + "; expected " + desiredChain +
        ". Switch networks in the wallet, then review again.");
    }
    const accounts = await provider.request({method: "eth_accounts"});
    const from = Array.isArray(accounts) ? accounts[0] : null;
    if (typeof from !== "string" || !ADDRESS.test(from)) {
      throw new Error("Connect the wallet first.");
    }
    return {chainId, from};
  }

  function gasNumber(value) {
    if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value) || BigInt(value) === 0n) {
      throw new Error("Wallet returned an invalid gas estimate.");
    }
    return BigInt(value).toString();
  }

  async function reviewDeployment(provider, artifact, chainInput, constructorArgs = []) {
    const desiredChain = expectedChain(chainInput);
    if (!artifact) throw new Error("Load compiled Solidity first.");
    const compiledSha256 = await sha256(artifact.bytecode);
    if (artifact.declaredCreationSha256 && artifact.declaredCreationSha256 !== compiledSha256) {
      throw new Error("Creation bytecode SHA-256 does not match the imported artifact manifest.");
    }
    const {data, encodedArguments} = creationData(artifact, constructorArgs);
    const {from, chainId} = await walletState(provider, desiredChain);
    const transaction = {from, data, value: "0x0"};
    const gasEstimate = gasNumber(await provider.request({
      method: "eth_estimateGas", params: [transaction]
    }));
    const creationSha256 = await sha256(data);
    return Object.freeze({
      artifact, from, chainId, gasEstimate, creationSha256, compiledSha256,
      encodedArgumentBytes: (encodedArguments.length - 2) / 2,
      byteLength: (data.length - 2) / 2,
      transaction: Object.freeze(transaction)
    });
  }

  async function sendReviewed(provider, review) {
    providerRequired(provider);
    if (!review || !review.transaction) throw new Error("Review the deployment first.");
    const state = await walletState(provider, review.chainId);
    if (state.from.toLowerCase() !== review.from.toLowerCase()) {
      throw new Error("Wallet account changed since review.");
    }
    if (await sha256(review.transaction.data) !== review.creationSha256) {
      throw new Error("Creation bytecode differs from reviewed bytes.");
    }
    // Estimate again immediately before requesting the wallet signature.
    gasNumber(await provider.request({method: "eth_estimateGas", params: [review.transaction]}));
    const hash = await provider.request({method: "eth_sendTransaction", params: [review.transaction]});
    if (typeof hash !== "string" || !HASH.test(hash)) {
      throw new Error("Wallet did not return a transaction hash.");
    }
    return Object.freeze({hash, chainId: review.chainId, artifact: review.artifact});
  }


  // Solidity patches constructor-initialized immutables into the deployed
  // runtime. Compare every byte except the exact locations declared by solc.
  // Never infer mutable byte ranges from observed differences.
  function compareRuntime(runtime, compiled, references) {
    if (!compiled) return {status:"unavailable", ignoredBytes:0};
    if (runtime === compiled) return {status:"exact", ignoredBytes:0};
    if (runtime.length !== compiled.length) return {status:"mismatch", ignoredBytes:0};
    if (!references || typeof references !== "object" || Array.isArray(references)) {
      return {status:"mismatch", ignoredBytes:0, immutableReferencesMissing:true};
    }
    const covered = new Uint8Array((runtime.length - 2) / 2);
    let ranges = 0;
    for (const locations of Object.values(references)) {
      if (!Array.isArray(locations)) throw new Error("Malformed Solidity immutableReferences.");
      for (const ref of locations) {
        if (!ref || !Number.isSafeInteger(ref.start) || !Number.isSafeInteger(ref.length) ||
          ref.start < 0 || ref.length <= 0 || ref.length > 256 || ref.start + ref.length > covered.length) {
          throw new Error("Immutable reference lies outside compiled runtime.");
        }
        for (let i=ref.start; i<ref.start+ref.length; i++) {
          if (covered[i]) throw new Error("Overlapping Solidity immutable references.");
          covered[i] = 1;
        }
        ranges++;
      }
    }
    if (!ranges) return {status:"mismatch", ignoredBytes:0, immutableReferencesMissing:true};
    let ignored = 0;
    for (let i=0; i<covered.length; i++) {
      if (covered[i]) {ignored++; continue;}
      if (runtime.slice(2+i*2, 4+i*2) !== compiled.slice(2+i*2, 4+i*2)) {
        return {status:"mismatch", ignoredBytes:ignored};
      }
    }
    return {status:"immutable-adjusted", ignoredBytes:ignored};
  }

  // Read-only M64 getters. Selectors correspond to exact audited Solidity
  // function signatures; no transactions are sent and no keys are requested.
  const M64_SELECTORS = Object.freeze({
    codecVersion:"0x9bad6d4d", dictionaryVersion:"0xa5c0def6",
    primaryCount:"0xe56be999", secondaryCount:"0x2ac237df",
    name:"0x06fdde03", symbol:"0x95d89b41", language:"0xed9978c7",
    mediaType:"0x6abe0c0c", description:"0x7284e416",
    primaryDigest:"0x67718087", definitionDigest:"0x9ab0fb6e",
    digestAtCount:"0xddbbe90b"
  });
  function wordAt(raw, position) {
    if (!/^0x(?:[0-9a-fA-F]{2})*$/.test(raw) || !Number.isSafeInteger(position) ||
      position < 0 || position + 32 > (raw.length - 2)/2) {
      throw new Error("Malformed ABI response.");
    }
    return raw.slice(2 + position*2, 66 + position*2);
  }
  function readUintWord(raw) {return BigInt("0x" + wordAt(raw, 0));}
  function readStringWord(raw) {
    const offset = Number(readUintWord(raw));
    if (!Number.isSafeInteger(offset) || offset < 32) throw new Error("Bad ABI string offset.");
    const length = Number(BigInt("0x" + wordAt(raw,offset)));
    if (!Number.isSafeInteger(length) || length > 4096 ||
      offset + 32 + length > (raw.length - 2)/2) throw new Error("Bad ABI string length.");
    const start = 2 + (offset + 32)*2;
    const data = Uint8Array.from((raw.slice(start,start+length*2).match(/.{2}/g)||[]),x=>parseInt(x,16));
    return new TextDecoder("utf-8",{fatal:true}).decode(data);
  }
  async function inspectM64Dictionary(provider, address, expectedChain = 137) {
    providerRequired(provider);
    if (!ADDRESS.test(address)) throw new Error("Enter a valid M64 contract address.");
    const chain = chainNumber(await provider.request({method:"eth_chainId"}));
    if (chain !== expectedChain) throw new Error("Wallet provider is on chain " + chain + "; expected " + expectedChain + ".");
    const code = normalizedHex(await provider.request({method:"eth_getCode",params:[address,"latest"]}),false);
    if (!code || code==="0x") throw new Error("No runtime bytecode at this address on chain " + chain + ".");
    async function call(name,argument) {
      const data = M64_SELECTORS[name] + (argument===undefined ? "" : uintWord(BigInt(argument)));
      const result = await provider.request({method:"eth_call",params:[{to:address,data},"latest"]});
      if (typeof result!=="string" || !/^0x[0-9a-fA-F]*$/.test(result) || result.length < 66) {
        throw new Error("Contract did not return valid ABI data for " + name + ".");
      }
      return result;
    }
    const state={chainId:chain,address,codeBytes:(code.length-2)/2};
    for (const key of ["codecVersion","dictionaryVersion","primaryCount","secondaryCount"]) {
      const value=readUintWord(await call(key));
      if (value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error(key+" is too large.");
      state[key]=Number(value);
    }
    for (const key of ["name","symbol","language","mediaType","description"]) {
      state[key]=readStringWord(await call(key));
    }
    for (const key of ["primaryDigest","definitionDigest"]) {
      state[key]="0x"+wordAt(await call(key),0).toLowerCase();
    }
    state.baseDigest="0x"+wordAt(await call("digestAtCount",0),0).toLowerCase();
    state.snapshotDigest="0x"+wordAt(await call("digestAtCount",state.secondaryCount),0).toLowerCase();
    state.consistent=state.codecVersion===2 && state.dictionaryVersion===1 &&
      state.primaryCount===62 && state.baseDigest===state.primaryDigest &&
      state.snapshotDigest===state.definitionDigest &&
      state.primaryDigest!=="0x"+"0".repeat(64) && !!state.name && !!state.mediaType;
    return Object.freeze(state);
  }

  async function checkReceipt(provider, pending) {
    providerRequired(provider);
    if (!pending || !HASH.test(pending.hash)) throw new Error("No submitted transaction.");
    const actual = chainNumber(await provider.request({method: "eth_chainId"}));
    if (actual !== pending.chainId) throw new Error("Switch to deployment chain " + pending.chainId + " to check the receipt.");
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt", params: [pending.hash]
    });
    if (!receipt) return {state: "pending", hash: pending.hash};
    if (receipt.status !== "0x1" && receipt.status !== "0x01") {
      return {state: "reverted", hash: pending.hash, block: receipt.blockNumber};
    }
    const address = receipt.contractAddress;
    if (typeof address !== "string" || !ADDRESS.test(address)) {
      throw new Error("Successful transaction did not return a contract address.");
    }
    const code = await provider.request({method: "eth_getCode", params: [address, "latest"]});
    const runtime = normalizedHex(code, false);
    if (!runtime || runtime === "0x") throw new Error("Receipt succeeded but no runtime bytecode was found.");
    const comparison = compareRuntime(runtime, pending.artifact.deployedBytecode,
      pending.artifact.immutableReferences);
    return {
      state: "mined", hash: pending.hash, address, block: receipt.blockNumber,
      runtimeSha256: await sha256(runtime),
      runtimeComparison: comparison,
      runtimeMatch: comparison.status==="exact" || comparison.status==="immutable-adjusted" ?
        true : comparison.status==="mismatch" ? false : null
    };
  }

  root.CHISEL_EVM_FACTORY = Object.freeze({
    collectArtifacts, chainNumber, expectedChain, encodeConstructorArgs, creationData, switchWalletChain, reviewDeployment, sendReviewed, checkReceipt, inspectM64Dictionary, compareRuntime, sha256
  });
}(typeof window !== "undefined" ? window : globalThis));
