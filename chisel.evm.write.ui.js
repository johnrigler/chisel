(function (root) {
  "use strict";
  const $ = function (id) { return root.document.getElementById(id); };
  const registry = root.CHISEL_EVM_CONTRACTS;
  const writerApi = root.CHISEL_EVM_WRITE;
  const deploymentId = "jethro.polygon.137";
  if (!registry || !writerApi || !root.ethers) {
    $("jethroWriteStatus").textContent = "EVM writer unavailable. Check the local scripts and ethers library.";
    $("jethroWriteStatus").className = "status bad";
    return;
  }

  const profile = registry.descriptor(deploymentId);
  const writer = writerApi.createWriter({registry, ethers: root.ethers});
  const wallets = [];
  let connection = null, latest = null;

  function status(message, kind) {
    $("jethroWriteStatus").textContent = message;
    $("jethroWriteStatus").className = "status" + (kind ? " " + kind : "");
  }

  function invalidate(message) {
    writer.invalidate();
    $("jethroSendBtn").disabled = true;
    $("jethroReview").textContent = "No reviewed calldata.";
    if (message) status(message, "warn");
  }

  function addWallet(provider, name, id) {
    if (!provider || typeof provider.request !== "function" ||
        wallets.some(function (item) { return item.provider === provider; })) return;
    const entry = {provider, name: String(name || "Injected EVM wallet").slice(0, 80),
      id: String(id || "wallet-" + wallets.length)};
    if (wallets.some(function (item) { return item.id === entry.id; })) entry.id += "-" + wallets.length;
    wallets.push(entry);
    if (typeof provider.on === "function") {
      provider.on("accountsChanged", function () {
        connection = null; invalidate("Wallet account changed. Reconnect and review again.");
      });
      provider.on("chainChanged", function () {
        connection = null; invalidate("Wallet network changed. Reconnect and review again.");
      });
    }
  }

  function renderWallets() {
    const select = $("jethroWallet");
    const previous = select.value;
    select.replaceChildren();
    wallets.forEach(function (wallet) {
      const option = root.document.createElement("option");
      option.value = wallet.id;
      option.textContent = wallet.name;
      select.appendChild(option);
    });
    if (!wallets.length) {
      const empty = root.document.createElement("option");
      empty.value = "";
      empty.textContent = "No injected wallet detected";
      select.appendChild(empty);
    } else if (wallets.some(function (wallet) { return wallet.id === previous; })) {
      select.value = previous;
    }
  }

  function selectedWallet() {
    const wallet = wallets.find(function (item) { return item.id === $("jethroWallet").value; });
    if (!wallet) throw new Error("No injected wallet available. Open Chisel from a wallet-enabled browser.");
    return wallet;
  }

  function discover() {
    if (root.backpack && root.backpack.ethereum) addWallet(root.backpack.ethereum, "Backpack", "backpack");
    if (root.ethereum) addWallet(root.ethereum, "Injected wallet", "injected");
    renderWallets();
    root.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  root.addEventListener("eip6963:announceProvider", function (event) {
    const detail = event.detail || {};
    if (!detail.provider) return;
    addWallet(detail.provider, detail.info && detail.info.name, detail.info && detail.info.uuid);
    renderWallets();
  });

  $("jethroInterface").value = profile.contractInterface.id + " · " + profile.contractInterface.abi[0];
  $("jethroDeployment").value = profile.deployment.address + " · Polygon (137)";
  $("jethroContractLink").href = "https://polygonscan.com/address/" + profile.deployment.address;
  $("jethroContractLink").rel = "noopener noreferrer";
  $("jethroContractLink").target = "_blank";

  $("jethroRefreshWalletsBtn").addEventListener("click", discover);
  $("jethroWallet").addEventListener("change", function () {
    connection = null; invalidate("Wallet selection changed. Connect and review again.");
  });

  $("jethroConnectBtn").addEventListener("click", async function () {
    try {
      const wallet = selectedWallet();
      invalidate();
      connection = null;
      const connected = await writer.connect(wallet.provider);
      connection = {wallet, from: connected.from, chainId: connected.chainId};
      $("jethroWalletStatus").textContent = wallet.name + " · " + connected.from + " · chain " + connected.chainId;
      status(connected.chainId === profile.deployment.chainId
        ? "Connected to Polygon. Enter Jethro artifact and body, then review."
        : "Wrong chain. Click Switch to Polygon, then reconnect.", connected.chainId === 137 ? "ok" : "warn");
    } catch (error) {
      status(error.message || String(error), "bad");
    }
  });

  $("jethroSwitchChainBtn").addEventListener("click", async function () {
    try {
      const wallet = selectedWallet();
      invalidate();
      connection = null;
      await wallet.provider.request({method: "wallet_switchEthereumChain", params: [{chainId: "0x89"}]});
      status("Polygon selected. Reconnect the wallet and review again.", "ok");
    } catch (error) {
      status("Could not switch to Polygon (137): " + (error.message || String(error)), "bad");
    }
  });

  for (const id of ["jethroArtifact", "jethroBody"]) {
    $(id).addEventListener("input", function () { invalidate("Content changed. Review the new calldata before sending."); });
  }

  $("jethroReviewBtn").addEventListener("click", async function () {
    try {
      if (!connection || connection.wallet !== selectedWallet()) {
        throw new Error("Connect your wallet before reviewing.");
      }
      invalidate();
      const review = await writer.prepare(connection.wallet.provider, {
        deploymentId, artifact: $("jethroArtifact").value, body: $("jethroBody").value
      });
      $("jethroReview").textContent = JSON.stringify({
        chainId: review.chainId, contract: review.to, from: review.from,
        interface: review.interfaceId, implementation: review.implementationId,
        function: review.functionSignature, artifact: review.artifact, body: review.body,
        valueWei: "0", utf8Bytes: review.byteLength, estimatedGasUnits: review.gasEstimate,
        calldata: review.data, deployedCodeHash: review.codeHash
      }, null, 2);
      $("jethroSendBtn").disabled = false;
      status("Simulation passed and gas was estimated. Review the exact calldata and address. The wallet will ask for separate approval.", "ok");
    } catch (error) {
      $("jethroSendBtn").disabled = true;
      status(error.message || String(error), "bad");
    }
  });

  $("jethroSendBtn").addEventListener("click", async function () {
    this.disabled = true;
    try {
      const wallet = selectedWallet();
      if (!connection || connection.wallet !== wallet || !writer.review) throw new Error("A new review is required.");
      const submitted = await writer.submit(wallet.provider, writer.review);
      latest = {wallet, ...submitted};
      $("jethroReceiptBtn").disabled = false;
      const link = $("jethroTxLink");
      link.href = "https://polygonscan.com/tx/" + submitted.hash;
      link.textContent = submitted.hash;
      link.hidden = false;
      status("Submitted to wallet/RPC: " + submitted.hash + "\nNot yet confirmed in a block. Check the receipt.", "warn");
    } catch (error) {
      status(error.message || String(error), "bad");
    }
  });

  $("jethroReceiptBtn").addEventListener("click", async function () {
    try {
      if (!latest || selectedWallet() !== latest.wallet) throw new Error("Select the wallet used to submit this transaction.");
      const receipt = await writer.receipt(latest.wallet.provider, latest.hash, latest.chainId, latest.to);
      status(receipt.state === "pending" ? "Transaction still pending in wallet RPC: " + receipt.hash :
        receipt.state === "confirmed" ? "Transaction confirmed in block " + receipt.blockNumber + ": " + receipt.hash :
        "Transaction was mined but reverted in block " + receipt.blockNumber + ": " + receipt.hash,
      receipt.state === "confirmed" ? "ok" : receipt.state === "reverted" ? "bad" : "warn");
    } catch (error) {
      status(error.message || String(error), "bad");
    }
  });

  discover();
}(window));
