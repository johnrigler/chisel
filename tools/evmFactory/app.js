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
  let walletStatusRequest = 0;

  function show(id, message) { $(id).textContent = String(message); }
  function error(id, err) { show(id, "ERROR: " + (err && err.message || String(err))); }
  function invalidate() {
    ++revision;
    reviewed = null;
    $("deploy").disabled = true;
    $("reviewedBytecode").value = "";
    show("reviewStatus", "Review invalidated. Review current contract, chain and wallet again.");
  }
  function wallet() {
    const n = Number($("wallet").value);
    if (!$("wallet").value || !Number.isInteger(n) || !wallets[n]) {
      throw new Error("Select an injected wallet.");
    }
    return wallets[n].provider;
  }
  async function refreshWalletStatus(provider) {
    const request = ++walletStatusRequest;
    if (!provider) {
      show("walletStatus", "Select an injected wallet.");
      return;
    }
    try {
      const chainId = api.chainNumber(await provider.request({method: "eth_chainId"}));
      const accounts = await provider.request({method: "eth_accounts"});
      if (request !== walletStatusRequest || provider !== activeWallet()) return;
      const account = Array.isArray(accounts) && accounts[0] || "(not connected)";
      show("walletStatus", "Wallet account: " + account +
        "\nCurrent chain ID: " + chainId +
        "\nExpected chain ID: " + ($("chain").value.trim() || "(enter chain ID)"));
    } catch (err) {
      if (request === walletStatusRequest && provider === activeWallet()) error("walletStatus", err);
    }
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
        if (provider !== activeWallet()) return;
        invalidate();
        void refreshWalletStatus(provider);
      });
      provider.on("chainChanged", () => {
        if (provider !== activeWallet()) return;
        invalidate();
        void refreshWalletStatus(provider);
      });
    }
    if (provider === activeWallet()) void refreshWalletStatus(provider);
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

  function selectedContract() {
    return artifacts[Number($("contract").value)];
  }
  function constructorValues() {
    const selected = selectedContract();
    if (!selected) throw new Error("Load compiled Solidity first.");
    if (!selected.constructorInputs) return [];
    const raw = $("constructorArgs").value.trim();
    if (!raw || raw.length > 512 * 1024) throw new Error("Enter a JSON array of constructor values (maximum 512 KiB).");
    let values;
    try { values = JSON.parse(raw); } catch (e) { throw new Error("Invalid constructor JSON: " + e.message); }
    if (!Array.isArray(values)) throw new Error("Constructor arguments must be a JSON array in ABI order.");
    return values;
  }
  function updateConstructorPreview() {
    const selected = selectedContract();
    $("loadSeed").disabled = !selected || !matchesM64Seed(selected);
    if (!selected) { show("constructorStatus", "Load an artifact to inspect constructor parameters."); return; }
    const params = selected.constructorParameters || [];
    if (!params.length) { show("constructorStatus", "No constructor arguments. Bytecode is ready for review."); return; }
    try {
      const encoded = api.creationData(selected, constructorValues());
      show("constructorStatus", "Constructor arguments encoded: " +
        ((encoded.encodedArguments.length - 2) / 2) + " bytes\n" +
        "Total deployment data: " + ((encoded.data.length - 2) / 2) +
        " bytes\nNo wallet transaction has been requested.");
    } catch (err) { show("constructorStatus", "Not ready: " + err.message); }
  }
  function matchesM64Seed(selected) {
    if (!selected || !selected.name.endsWith("M64SymbolDictionary")) return false;
    const types = (selected.constructorParameters || []).map(p => p.type);
    return JSON.stringify(types) === JSON.stringify([
      "string", "string", "string", "string", "string", "bytes[]", "bytes[]", "uint32[]"
    ]);
  }
  async function renderArtifact() {
    invalidate();
    const selected = selectedContract();
    if (!selected) {
      $("bytecode").value = "";
      show("artifactStatus", "No deployable contract selected.");
      updateConstructorPreview();
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
        "EVM target: " + (selected.evmVersion || "not supplied"),
        "Source SHA-256 (manifest, not source-verified): " + (selected.declaredSourceSha256 || "not supplied"),
        "Creation bytes: " + ((selected.bytecode.length - 2) / 2),
        "Creation SHA-256: " + digest,
        "Manifest SHA-256: " + (selected.declaredCreationSha256 || "not supplied"),
        "Manifest comparison: " + (selected.declaredCreationSha256 ?
          (selected.declaredCreationSha256 === digest ? "MATCH" : "MISMATCH - deployment blocked") : "not applicable"),
        "Constructor arguments: " + selected.constructorInputs,
        "Compiled runtime: " + (selected.deployedBytecode ? "provided" : "not provided"),
        selected.constructorInputs ? "Enter the constructor arguments below before review." :
          "Eligible for gas estimation and wallet review."
      ].join("\n"));
    } catch (err) { error("artifactStatus", err); }
    $("constructorSignature").textContent = (selected.constructorParameters || [])
      .map((p, i) => String(i + 1) + ". " + (p.name || "(unnamed)") + " : " + p.type).join("\n") ||
      "This constructor takes no arguments.";
    updateConstructorPreview();
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
    $("constructorArgs").value = "";
    void renderArtifact();
  }

  $("file").addEventListener("change", async () => {
    const file = $("file").files && $("file").files[0];
    invalidate();
    const token = revision;
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Compiler JSON exceeds 8 MiB.");
      const data = JSON.parse(await file.text());
      if (revision === token) loadJSON(data);
    } catch (err) { if (revision === token) { artifacts = []; $("contract").disabled = true; error("artifactStatus", err); } }
  });

  async function loadBundled(url, description) {
    invalidate();
    const token = revision;
    show("artifactStatus", "Loading " + description + " from this repository...");
    try {
      const response = await fetch(url, {cache: "no-store"});
      if (!response.ok) throw new Error(description + " unavailable (HTTP " + response.status +
        "). For Chisel, run: python3 contracts/build-chisel.py, then commit contracts/compiled/Chisel.json.");
      const data = await response.json();
      if (revision === token) loadJSON(data);
    } catch (err) { if (revision === token) error("artifactStatus", err); }
  }

  $("bundledChisel").addEventListener("click", () => {
    void loadBundled("../../contracts/compiled/Chisel.json", "Chisel compiled artifact");
  });
  $("bundled").addEventListener("click", () => {
    void loadBundled("../../contracts/compiled/M64Dictionary.json", "M64 Dictionary");
  });

  $("contract").addEventListener("change", () => {
    $("constructorArgs").value = "";
    void renderArtifact();
  });
  $("constructorArgs").addEventListener("input", () => {
    invalidate();
    updateConstructorPreview();
  });
  $("loadSeed").addEventListener("click", () => {
    invalidate();
    try {
      const selected = selectedContract();
      if (!matchesM64Seed(selected)) throw new Error("The selected contract does not match the M64 symbol dictionary constructor.");
      if (!window.ChiselM64Native6DarkStarSeed) throw new Error("Dark Star seed script is unavailable.");
      const seed = window.ChiselM64Native6DarkStarSeed.create();
      const hex = bytes => "0x" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      const values = [
        "M64 JavaScript Dictionary", "M64", "javascript", seed.descriptor.mediaType,
        seed.descriptor.description,
        seed.primary.map(hex), seed.secondary.map(item => hex(item.packed)),
        seed.secondary.map(item => item.symbolCount)
      ];
      $("constructorArgs").value = JSON.stringify(values, null, 2);
      updateConstructorPreview();
    } catch (err) { error("constructorStatus", err); }
  });
  $("chain").addEventListener("input", () => {
    invalidate();
    void refreshWalletStatus(activeWallet());
  });
  $("wallet").addEventListener("change", () => {
    invalidate();
    void refreshWalletStatus(activeWallet());
  });
  $("refresh").addEventListener("click", discover);
  $("connect").addEventListener("click", async () => {
    invalidate();
    try {
      const provider = wallet();
      const accounts = await provider.request({method: "eth_requestAccounts"});
      if (!Array.isArray(accounts) || !accounts[0]) throw new Error("Wallet returned no account.");
      await refreshWalletStatus(provider);
    } catch (err) { error("walletStatus", err); }
  });
  $("switchChain").addEventListener("click", async () => {
    if ($("switchChain").disabled) return;
    invalidate();
    let provider = null;
    $("switchChain").disabled = true;
    try {
      provider = wallet();
      const desired = api.expectedChain($("chain").value);
      show("walletStatus", "Requesting chain " + desired + " in the selected wallet. Approve there.");
      const result = await api.switchWalletChain(provider, String(desired));
      if (provider !== activeWallet()) return;
      await refreshWalletStatus(provider);
      show("reviewStatus", result.switched ?
        "Wallet switched to chain " + result.chainId + ". Review the contract again before deployment." :
        "Wallet already on chain " + result.chainId + ". Review the contract before deployment.");
    } catch (err) {
      if (!provider || provider === activeWallet()) error("walletStatus", err);
    } finally {
      $("switchChain").disabled = false;
    }
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
      const review = await api.reviewDeployment(provider, contract, $("chain").value, constructorValues());
      if (token !== revision) return;
      reviewed = {provider, review};
      $("reviewedBytecode").value = review.transaction.data;
      $("deploy").disabled = false;
      show("reviewStatus", [
        "REVIEWED, NOT SUBMITTED",
        "Contract: " + contract.name,
        "Account: " + review.from,
        "Chain ID: " + review.chainId,
        "Compiled creation SHA-256: " + review.compiledSha256,
        "ABI-encoded constructor bytes: " + review.encodedArgumentBytes,
        "Final creation bytes: " + review.byteLength,
        "Final creation SHA-256: " + review.creationSha256,
        "Estimated gas units: " + review.gasEstimate,
        "To address: none (new contract)",
        "Native value: 0",
        "Full final creation bytecode including arguments is displayed below.",
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
