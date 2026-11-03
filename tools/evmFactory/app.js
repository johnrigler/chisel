(function () {
  "use strict";
  const api = window.CHISEL_EVM_FACTORY;
  const $ = id => document.getElementById(id);
  const wallets = [];
  let artifacts = [];
  let reviewed = null;
  let pending = null;
  let revision = 0;
  let busy = false;

  function show(id, message) { $(id).textContent = String(message); }
  function error(id, err) { show(id, "ERROR: " + (err && err.message || String(err))); }
  function invalidate() {
    ++revision;
    reviewed = null;
    $("deploy").disabled = true;
    show("reviewStatus", "Review invalidated. Review current contract, chain and wallet again.");
  }
  function wallet() {
    const n = Number($("wallet").value);
    if (!$("wallet").value || !Number.isInteger(n) || !wallets[n]) {
      throw new Error("Select an injected wallet.");
    }
    return wallets[n].provider;
  }
  function addWallet(provider, name) {
    if (!provider || typeof provider.request !== "function" ||
      wallets.some(item => item.provider === provider)) return;
    const index = wallets.push({provider, name}) - 1;
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = name;
    if ($("wallet").options.length === 1 && !$("wallet").options[0].value) $("wallet").replaceChildren();
    $("wallet").append(option);
    if (wallets.length === 1) $("wallet").value = "0";
    if (typeof provider.on === "function") {
      provider.on("accountsChanged", () => {
        if (provider === activeWallet()) invalidate();
        show("walletStatus", "Wallet account changed. Reconnect and review.");
      });
      provider.on("chainChanged", () => {
        if (provider === activeWallet()) invalidate();
        show("walletStatus", "Wallet network changed. Review again.");
      });
    }
  }
  function activeWallet() {
    const index = Number($("wallet").value);
    return $("wallet").value && wallets[index] ? wallets[index].provider : null;
  }
  function discover() {
    if (window.ethereum) addWallet(window.ethereum, "Injected wallet (legacy)");
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    if (!wallets.length) show("walletStatus", "No injected wallet found. Artifact inspection still works.");
  }
  window.addEventListener("eip6963:announceProvider", event => {
    const detail = event.detail;
    if (detail && detail.provider) addWallet(detail.provider, (detail.info && detail.info.name) || "EIP-6963 wallet");
  });

  async function renderArtifact() {
    invalidate();
    const selected = artifacts[Number($("contract").value)];
    if (!selected) {
      $("bytecode").value = "";
      show("artifactStatus", "No deployable contract selected.");
      return;
    }
    $("bytecode").value = selected.bytecode;
    const token = revision;
    try {
      const digest = await api.sha256(selected.bytecode);
      if (token !== revision) return;
      show("artifactStatus", [
        "Contract: " + selected.name,
        "Compiler label (unverified): " + (selected.compiler || "not supplied"),
        "Creation bytes: " + ((selected.bytecode.length - 2) / 2),
        "Creation SHA-256: " + digest,
        "Constructor arguments: " + selected.constructorInputs,
        "Compiled runtime: " + (selected.deployedBytecode ? "provided" : "not provided"),
        selected.constructorInputs ? "DEPLOYMENT BLOCKED: constructor arguments are not supported." :
          "Eligible for gas estimation and wallet review."
      ].join("\n"));
    } catch (err) { error("artifactStatus", err); }
  }

  function loadJSON(data) {
    artifacts = api.collectArtifacts(data);
    $("contract").replaceChildren();
    artifacts.forEach((entry, i) => {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = entry.name;
      $("contract").append(option);
    });
    $("contract").disabled = false;
    $("contract").value = "0";
    void renderArtifact();
  }

  $("file").addEventListener("change", async () => {
    const file = $("file").files && $("file").files[0];
    invalidate();
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Compiler JSON exceeds 8 MiB.");
      loadJSON(JSON.parse(await file.text()));
    } catch (err) { artifacts = []; $("contract").disabled = true; error("artifactStatus", err); }
  });

  $("bundled").addEventListener("click", async () => {
    invalidate();
    try {
      const response = await fetch("../m64Artifact/contracts/M64Dictionary.compiled.json", {cache: "no-store"});
      if (!response.ok) throw new Error("Bundled artifact unavailable: HTTP " + response.status);
      loadJSON(await response.json());
    } catch (err) { error("artifactStatus", err); }
  });

  $("contract").addEventListener("change", renderArtifact);
  $("chain").addEventListener("input", invalidate);
  $("wallet").addEventListener("change", invalidate);
  $("refresh").addEventListener("click", discover);
  $("connect").addEventListener("click", async () => {
    invalidate();
    try {
      const provider = wallet();
      const accounts = await provider.request({method: "eth_requestAccounts"});
      if (!Array.isArray(accounts) || !accounts[0]) throw new Error("Wallet returned no account.");
      const chain = api.chainNumber(await provider.request({method: "eth_chainId"}));
      show("walletStatus", "Wallet account: " + accounts[0] + "\nCurrent chain ID: " + chain);
    } catch (err) { error("walletStatus", err); }
  });
  $("review").addEventListener("click", async () => {
    if (busy) return;
    invalidate();
    const token = revision;
    try {
      const provider = wallet();
      const contract = artifacts[Number($("contract").value)];
      if (!contract) throw new Error("Load compiled Solidity first.");
      show("reviewStatus", "Estimating contract creation gas. No transaction is being submitted.");
      const review = await api.reviewDeployment(provider, contract, $("chain").value);
      if (token !== revision) return;
      reviewed = {provider, review};
      $("deploy").disabled = false;
      show("reviewStatus", [
        "REVIEWED, NOT SUBMITTED",
        "Contract: " + contract.name,
        "Account: " + review.from,
        "Chain ID: " + review.chainId,
        "Creation bytes: " + review.byteLength,
        "Creation SHA-256: " + review.creationSha256,
        "Estimated gas units: " + review.gasEstimate,
        "To address: none (new contract)",
        "Native value: 0",
        "Exact creation bytecode is displayed above.",
        "Approve only if these details match the intended deployment."
      ].join("\n"));
    } catch (err) { if (token === revision) error("reviewStatus", err); }
  });

  $("deploy").addEventListener("click", async () => {
    if (busy || !reviewed || reviewed.provider !== activeWallet()) return;
    busy = true;
    $("deploy").disabled = true;
    const selected = reviewed;
    reviewed = null;
    try {
      show("deploymentStatus", "Rechecking chain, wallet account and gas; then asking wallet approval.");
      const sent = await api.sendReviewed(selected.provider, selected.review);
      pending = {provider: selected.provider, ...sent};
      $("receipt").disabled = false;
      show("deploymentStatus", "SUBMITTED, NOT YET CONFIRMED\nTransaction hash: " +
        sent.hash + "\nChain ID: " + sent.chainId +
        "\nUse Check transaction receipt to verify execution and deployed code.");
    } catch (err) { error("deploymentStatus", err); }
    finally { busy = false; invalidate(); }
  });

  $("receipt").addEventListener("click", async () => {
    if (!pending) return;
    try {
      const result = await api.checkReceipt(pending.provider, pending);
      if (result.state === "pending") {
        show("deploymentStatus", "Still pending: " + result.hash);
      } else if (result.state === "reverted") {
        show("deploymentStatus", "MINED AND REVERTED. Gas may have been charged.\nHash: " + result.hash + "\nBlock: " + result.block);
      } else {
        const comparison = result.runtimeMatch === true ? "matches compiled runtime exactly" :
          result.runtimeMatch === false ? "DIFFERS from compiled runtime; investigate immutables, linking or mismatched build" :
          "no compiled runtime supplied for comparison";
        show("deploymentStatus", [
          "MINED, RUNTIME CODE PRESENT",
          "Hash: " + result.hash,
          "Contract: " + result.address,
          "Chain ID: " + pending.chainId,
          "Block: " + result.block,
          "Runtime SHA-256: " + result.runtimeSha256,
          "Runtime comparison: " + comparison,
          "Verify this contract independently before registering it in Chisel."
        ].join("\n"));
      }
    } catch (err) { error("deploymentStatus", err); }
  });

  discover();
}());
