(function (root) {
  "use strict";

  const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
  const TX_HASH = /^0x[0-9a-fA-F]{64}$/;
  const HEX = /^0x(?:[0-9a-fA-F]{2})*$/;

  function chainNumber(value) {
    if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) throw new Error("Wallet returned an invalid chain ID.");
    const number = Number(BigInt(value));
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error("Wallet returned an unsupported chain ID.");
    return number;
  }

  function cleanAddress(address, ethersLib) {
    if (!ADDRESS.test(String(address || ""))) throw new Error("Wallet returned an invalid account.");
    return ethersLib && typeof ethersLib.getAddress === "function"
      ? ethersLib.getAddress(address) : address;
  }

  function deployedCode(code, ethersLib) {
    if (!HEX.test(String(code || "")) || /^0x(?:00)*$/i.test(code)) {
      throw new Error("No usable contract bytecode at the selected deployment address on this chain.");
    }
    if (!ethersLib || typeof ethersLib.keccak256 !== "function") {
      throw new Error("ethers code hashing is unavailable.");
    }
    return ethersLib.keccak256(code);
  }

  function createWriter(options) {
    const deps = options || {};
    const registry = deps.registry;
    const ethersLib = deps.ethers;
    if (!registry || typeof registry.buildCall !== "function") throw new Error("EVM contract registry is required.");
    let currentReview = null;
    let revision = 0;
    let submitting = false;

    function invalidate() {
      revision += 1;
      currentReview = null;
    }

    async function requireChain(provider, chainId) {
      if (!provider || typeof provider.request !== "function") throw new Error("Choose an injected EVM wallet.");
      const actual = chainNumber(await provider.request({method: "eth_chainId"}));
      if (actual !== chainId) throw new Error("Wrong wallet chain: select Polygon mainnet (137), not " + actual + ".");
      return actual;
    }

    async function accountFromWallet(provider, expected) {
      const accounts = await provider.request({method: "eth_accounts"});
      const from = Array.isArray(accounts) && accounts.length ? cleanAddress(accounts[0], ethersLib) : "";
      if (!from) throw new Error("Connect the wallet before reviewing the transaction.");
      if (expected && from.toLowerCase() !== expected.toLowerCase()) {
        throw new Error("Wallet account changed. Review the transaction again.");
      }
      return from;
    }

    async function connect(provider) {
      invalidate();
      if (!provider || typeof provider.request !== "function") throw new Error("Choose an injected EVM wallet.");
      const accounts = await provider.request({method: "eth_requestAccounts"});
      if (!Array.isArray(accounts) || !accounts.length) throw new Error("Wallet connection did not return an account.");
      const from = cleanAddress(accounts[0], ethersLib);
      const chainId = chainNumber(await provider.request({method: "eth_chainId"}));
      return {from, chainId};
    }

    async function prepare(provider, params) {
      if (submitting) throw new Error("A transaction is already being submitted.");
      invalidate();
      const token = revision;
      const input = params || {};
      // Preserve the original Jethro caller shape while supporting explicit
      // ABI-function and positional argument sets for additional contracts.
      const functionName = input.functionName || (input.deploymentId === "jethro.polygon.137" ? "mapArtifact" : "");
      const args = Array.isArray(input.args) ? input.args : [input.artifact, input.body];
      const call = registry.buildCall(ethersLib, input.deploymentId, functionName, args);
      const from = await accountFromWallet(provider);
      await requireChain(provider, call.chainId);
      const codeHash = deployedCode(await provider.request({method: "eth_getCode", params: [call.to, "latest"]}), ethersLib);
      const tx = {from, to: call.to, data: call.data, value: call.value};
      // Neither simulation nor gas estimation submits a transaction.
      try {
        await provider.request({method: "eth_call", params: [tx, "latest"]});
      } catch (error) {
        throw new Error("Contract simulation failed: " + (error && error.message || String(error)));
      }
      let gas;
      try {
        gas = await provider.request({method: "eth_estimateGas", params: [tx]});
      } catch (error) {
        throw new Error("Gas estimation failed: " + (error && error.message || String(error)));
      }
      if (!/^0x[0-9a-f]+$/i.test(String(gas || "")) || BigInt(gas) === 0n) {
        throw new Error("Wallet returned an invalid gas estimate.");
      }
      if (token !== revision) throw new Error("Inputs or wallet changed during review; review again.");
      const review = Object.freeze({
        ...call, from, gasEstimate: BigInt(gas).toString(), codeHash,
        // Only kept in memory; never persisted to a FileProxy record.
        reviewedAt: new Date().toISOString()
      });
      currentReview = {provider, review};
      return review;
    }

    async function submit(provider, review) {
      if (submitting) throw new Error("A transaction is already being submitted.");
      if (!currentReview || currentReview.provider !== provider || currentReview.review !== review) {
        throw new Error("Review is stale. Review the current calldata before sending.");
      }
      submitting = true;
      try {
        const token = revision;
        await accountFromWallet(provider, review.from);
        await requireChain(provider, review.chainId);
        const nowHash = deployedCode(await provider.request({
          method: "eth_getCode", params: [review.to, "latest"]
        }), ethersLib);
        if (nowHash !== review.codeHash) throw new Error("Contract bytecode changed since review.");
        if (token !== revision) throw new Error("Review invalidated by a wallet or input change.");
        const tx = {from: review.from, to: review.to, data: review.data, value: review.value};
        try {
          await provider.request({method: "eth_call", params: [tx, "latest"]});
        } catch (error) {
          throw new Error("Final simulation failed: " + (error && error.message || String(error)));
        }
        if (token !== revision) throw new Error("Review invalidated before wallet confirmation.");
        // Only this method can initiate a wallet transaction, after review.
        const hash = await provider.request({method: "eth_sendTransaction", params: [tx]});
        if (!TX_HASH.test(String(hash || ""))) throw new Error("Wallet did not return a valid transaction hash.");
        invalidate();
        return Object.freeze({hash, from: review.from, to: review.to, chainId: review.chainId, submitted: true});
      } finally {
        submitting = false;
      }
    }

    async function receipt(provider, hash, chainId, to) {
      if (!TX_HASH.test(String(hash || ""))) throw new Error("A valid transaction hash is required.");
      await requireChain(provider, chainId);
      const found = await provider.request({method: "eth_getTransactionReceipt", params: [hash]});
      if (!found) return {state: "pending", hash};
      if (String(found.transactionHash || "").toLowerCase() !== hash.toLowerCase() ||
          String(found.to || "").toLowerCase() !== String(to).toLowerCase()) {
        throw new Error("RPC returned a mismatched transaction receipt.");
      }
      if (!/^0x[0-9a-f]+$/i.test(String(found.blockNumber || ""))) {
        throw new Error("RPC returned a receipt without a block number.");
      }
      const successful = found.status === "0x1" || found.status === "0x01";
      const failed = found.status === "0x0" || found.status === "0x00";
      if (!successful && !failed) throw new Error("RPC returned an unknown execution status.");
      return {state: successful ? "confirmed" : "reverted", hash, blockNumber: Number(BigInt(found.blockNumber))};
    }

    return Object.freeze({connect, prepare, submit, receipt, invalidate,
      get review() { return currentReview && currentReview.review || null; },
      get submitting() { return submitting; }
    });
  }

  root.CHISEL_EVM_WRITE = Object.freeze({createWriter, chainNumber, cleanAddress});
}(typeof window !== "undefined" ? window : globalThis));
