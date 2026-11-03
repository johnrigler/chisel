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
      const raw = typeof bytecode === "string" ? bytecode : bytecode && bytecode.object;
      if (!raw || raw === "0x") return; // interfaces and abstract contracts lack deployment bytecode
      entries.push(Object.freeze({
        name,
        abi: source.abi,
        bytecode: normalizedHex(bytecode, true, MAX_INIT_BYTES),
        deployedBytecode: normalizedHex(
          source.deployedBytecode || (source.evm && source.evm.deployedBytecode), false),
        constructorInputs,
        declaredCreationSha256: typeof source.bytecodeSha256 === "string" ? source.bytecodeSha256.toLowerCase() : null,
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

  function providerRequired(provider) {
    if (!provider || typeof provider.request !== "function") {
      throw new Error("Select an injected EIP-1193 wallet.");
    }
    return provider;
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

  async function reviewDeployment(provider, artifact, chainInput) {
    const desiredChain = expectedChain(chainInput);
    if (!artifact || artifact.constructorInputs !== 0) {
      throw new Error("This workbench deploys only zero-argument constructors. Compile a wrapper or use an ABI constructor encoder for other contracts.");
    }
    const {from, chainId} = await walletState(provider, desiredChain);
    const transaction = {from, data: artifact.bytecode, value: "0x0"};
    const gasEstimate = gasNumber(await provider.request({
      method: "eth_estimateGas", params: [transaction]
    }));
    const creationSha256 = await sha256(artifact.bytecode);
    if (artifact.declaredCreationSha256 && artifact.declaredCreationSha256 !== creationSha256) {
      throw new Error("Creation bytecode SHA-256 does not match the imported artifact manifest.");
    }
    return Object.freeze({
      artifact, from, chainId, gasEstimate, creationSha256,
      byteLength: (artifact.bytecode.length - 2) / 2,
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
    const expected = pending.artifact.deployedBytecode;
    return {
      state: "mined", hash: pending.hash, address, block: receipt.blockNumber,
      runtimeSha256: await sha256(runtime),
      // Equality is strong evidence for this RPC; a mismatch may indicate immutables,
      // library linking, a different deployment or chain-specific transformations.
      runtimeMatch: expected ? runtime === expected : null
    };
  }

  root.CHISEL_EVM_FACTORY = Object.freeze({
    collectArtifacts, chainNumber, expectedChain, reviewDeployment, sendReviewed, checkReceipt, sha256
  });
}(typeof window !== "undefined" ? window : globalThis));
