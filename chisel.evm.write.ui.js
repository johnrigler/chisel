(function (root) {
  "use strict";
  const $ = function (id) { return root.document.getElementById(id); };
  const registry = root.CHISEL_EVM_CONTRACTS;
  const writerApi = root.CHISEL_EVM_WRITE;
  if (!registry || !writerApi || !root.ethers) {
    for (const id of ["jethroWriteStatus", "gomezWriteStatus", "chiselWriteStatus"]) {
      const el = $(id);
      if (el) {
        el.textContent = "EVM writer unavailable. Check the local scripts and ethers library.";
        el.className = "status bad";
      }
    }
    return;
  }

  // One wallet discovery service and one panel controller per contract. The
  // same vetted writer handles preflight, account checks and wallet approval.
  const wallets = [], panels = [];
  const CHISEL = root.CHISEL_EVM_CHISEL;

  function parseChiselPayments(raw) {
    return String(raw || "").split(/\r?\n/).map(function (line) { return line.trim(); })
      .filter(Boolean).map(function (line, index) {
        const pieces = line.split(/[\s,]+/).filter(Boolean);
        if (pieces.length !== 2) {
          throw new Error("Payment line " + (index + 1) + " must contain recipient,amountWei.");
        }
        return {recipient: pieces[0], amountWei: pieces[1]};
      });
  }

  const configurations = [
    {
      prefix: "jethro", deploymentId: "jethro.polygon.137",
      fields: ["Artifact", "Body"],
      parameters: function (get) {
        return {deploymentId: "jethro.polygon.137", functionName: "mapArtifact",
          args: [get("Artifact").value, get("Body").value]};
      },
      display: function (review) { return {artifact: review.artifact, body: review.body}; }
    },
    {
      prefix: "chisel", deploymentId: "chisel.polygon.137",
      fields: ["Method", "Artifact", "Body", "LogFormat", "LogData", "Payments"],
      parameters: function (get) {
        const fn = get("Method").value;
        const hasDictionary = fn === "mapArtifact" || fn === "execute";
        const hasLog = fn === "logRecord" || fn === "execute";
        const hasPayments = fn === "execute" || fn === "distribute" || fn === "distributeChecked";
        return {
          deploymentId: "chisel.polygon.137",
          functionName: fn,
          args: {
            artifact: hasDictionary ? get("Artifact").value : "",
            body: hasDictionary ? get("Body").value : "",
            logFormat: hasLog ? get("LogFormat").value.trim() : CHISEL.ZERO_FORMAT,
            logData: hasLog ? get("LogData").value.trim() : "0x",
            payments: hasPayments ? parseChiselPayments(get("Payments").value) : []
          }
        };
      },
      display: function (review) {
        return {
          artifact: review.artifact, body: review.body,
          logFormat: review.logFormat, logData: review.logData,
          payments: review.payments, paymentTotalWei: review.paymentTotalWei,
          paymentSemantics: review.functionName === "distributeChecked"
            ? "Atomic: reverts all payments if any fails."
            : ["distribute", "execute"].includes(review.functionName)
              ? "Best effort: inspect TransferResult events per recipient; failure may refund."
              : undefined
        };
      }
    },
    {
      prefix: "gomez", deploymentId: "gomez.polygon.137",
      fields: ["Message", ...Array.from({length: 4}, (_, i) => ["Receiver" + (i + 1), "Amount" + (i + 1)]).flat()],
      parameters: function (get) {
        const args = [get("Message").value];
        for (let i = 1; i <= 4; i += 1) args.push(get("Receiver" + i).value.trim(), get("Amount" + i).value.trim());
        return {deploymentId: "gomez.polygon.137", functionName: "tell", args};
      },
      display: function (review) {
        return {message: review.message, receivers: review.receivers,
          amounts: review.amounts, amountUnits: "Raw uint256 values (meaning depends on deployed Solidity)"};
      }
    }
  ];

  function addWallet(provider, name, id) {
    if (!provider || typeof provider.request !== "function" ||
        wallets.some(function (entry) { return entry.provider === provider; })) return;
    const item = {
      provider, name: String(name || "Injected EVM wallet").slice(0, 80),
      id: String(id || "wallet-" + wallets.length)
    };
    if (wallets.some(function (entry) { return entry.id === item.id; })) item.id += "-" + wallets.length;
    wallets.push(item);
    if (typeof provider.on === "function") {
      provider.on("accountsChanged", function () {
        panels.forEach(function (panel) { panel.disconnect("Wallet account changed. Reconnect and review again."); });
      });
      provider.on("chainChanged", function () {
        panels.forEach(function (panel) { panel.disconnect("Wallet network changed. Reconnect and review again."); });
      });
      provider.on("disconnect", function () {
        panels.forEach(function (panel) { panel.disconnect("Wallet disconnected. Reconnect and review again."); });
      });
    }
  }

  function discover() {
    if (root.backpack && root.backpack.ethereum) addWallet(root.backpack.ethereum, "Backpack", "backpack");
    if (root.ethereum) addWallet(root.ethereum, "Injected wallet", "injected");
    panels.forEach(function (panel) { panel.renderWallets(); });
    root.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  root.addEventListener("eip6963:announceProvider", function (event) {
    const detail = event.detail || {};
    if (!detail.provider) return;
    addWallet(detail.provider, detail.info && detail.info.name, detail.info && detail.info.uuid);
    panels.forEach(function (panel) { panel.renderWallets(); });
  });

  function createPanel(config) {
    const get = function (suffix) { return $(config.prefix + suffix); };
    const profile = registry.descriptor(config.deploymentId);
    const writer = writerApi.createWriter({registry, ethers: root.ethers});
    let connection = null, latest = null, revision = 0;
    const label = profile.deployment.name;

    function status(message, kind) {
      get("WriteStatus").textContent = message;
      get("WriteStatus").className = "status" + (kind ? " " + kind : "");
    }

    function invalidate(message) {
      revision += 1;
      writer.invalidate();
      get("SendBtn").disabled = true;
      get("Review").textContent = "No reviewed calldata.";
      if (message) status(message, "warn");
    }

    function disconnect(message) {
      connection = null;
      get("WalletStatus").textContent = "Wallet not connected. Etherscan API key is not used for signing.";
      invalidate(message);
    }

    function renderWallets() {
      const select = get("Wallet");
      const previous = select.value;
      select.replaceChildren();
      wallets.forEach(function (wallet) {
        const option = root.document.createElement("option");
        option.value = wallet.id;
        option.textContent = wallet.name;
        select.appendChild(option);
      });
      if (!wallets.length) {
        const option = root.document.createElement("option");
        option.value = "";
        option.textContent = "No injected wallet detected";
        select.appendChild(option);
      } else if (wallets.some(function (wallet) { return wallet.id === previous; })) {
        select.value = previous;
      }
    }

    function selectedWallet() {
      const wallet = wallets.find(function (item) { return item.id === get("Wallet").value; });
      if (!wallet) throw new Error("No injected wallet available. Open Chisel from a wallet-enabled browser.");
      return wallet;
    }

    get("Interface").value = profile.contractInterface.id + " · " + profile.contractInterface.abi[0];
    get("Deployment").value = profile.deployment.address + " · Polygon (" + profile.deployment.chainId + ")";
    get("ContractLink").href = "https://polygonscan.com/address/" + profile.deployment.address;
    get("ContractLink").rel = "noopener noreferrer";
    get("ContractLink").target = "_blank";

    get("RefreshWalletsBtn").addEventListener("click", discover);
    get("Wallet").addEventListener("change", function () {
      disconnect("Wallet selection changed. Connect and review again.");
    });

    get("ConnectBtn").addEventListener("click", async function () {
      try {
        const wallet = selectedWallet();
        disconnect();
        const token = revision;
        const connected = await writer.connect(wallet.provider);
        if (token !== revision || selectedWallet() !== wallet) return;
        connection = {wallet, from: connected.from, chainId: connected.chainId};
        get("WalletStatus").textContent = wallet.name + " · " + connected.from + " · chain " + connected.chainId;
        status(connected.chainId === profile.deployment.chainId
          ? "Connected to Polygon. Enter " + label + " arguments, then review."
          : "Wrong chain. Click Switch to Polygon, then reconnect.",
        connected.chainId === profile.deployment.chainId ? "ok" : "warn");
      } catch (error) { status(error.message || String(error), "bad"); }
    });

    get("SwitchChainBtn").addEventListener("click", async function () {
      try {
        const wallet = selectedWallet();
        disconnect();
        await wallet.provider.request({method: "wallet_switchEthereumChain", params: [{chainId: "0x89"}]});
        status("Polygon selected. Reconnect the wallet and review again.", "ok");
      } catch (error) {
        status("Could not switch to Polygon (137): " + (error.message || String(error)), "bad");
      }
    });

    config.fields.forEach(function (suffix) {
      get(suffix).addEventListener("input", function () {
        invalidate("Content changed. Review the new calldata before sending.");
      });
    });

    get("ReviewBtn").addEventListener("click", async function () {
      try {
        const wallet = selectedWallet();
        if (!connection || connection.wallet !== wallet) throw new Error("Connect your wallet before reviewing.");
        invalidate();
        const token = revision;
        const review = await writer.prepare(wallet.provider, config.parameters(get));
        if (token !== revision || !connection || connection.wallet !== wallet) return;
        get("Review").textContent = JSON.stringify({
          chainId: review.chainId, contract: review.to, from: review.from,
          interface: review.interfaceId, implementation: review.implementationId,
          function: review.functionSignature, ...config.display(review),
          nativeValueWei: review.nativeValueWei || "0", utf8Bytes: review.byteLength,
          estimatedGasUnits: review.gasEstimate, calldata: review.data,
          deployedCodeHash: review.codeHash
        }, null, 2);
        get("SendBtn").disabled = false;
        status("Simulation passed and gas was estimated. Inspect calldata and contract before wallet approval.", "ok");
      } catch (error) {
        get("SendBtn").disabled = true;
        status(error.message || String(error), "bad");
      }
    });

    get("SendBtn").addEventListener("click", async function () {
      get("SendBtn").disabled = true;
      try {
        const wallet = selectedWallet();
        if (!connection || connection.wallet !== wallet || !writer.review) throw new Error("A new review is required.");
        const submitted = await writer.submit(wallet.provider, writer.review);
        latest = {wallet, ...submitted};
        get("ReceiptBtn").disabled = false;
        const link = get("TxLink");
        link.href = "https://polygonscan.com/tx/" + submitted.hash;
        link.textContent = submitted.hash;
        link.hidden = false;
        status("Submitted to wallet/RPC: " + submitted.hash +
          "\nNot yet confirmed in a block. Check the receipt.", "warn");
      } catch (error) { status(error.message || String(error), "bad"); }
    });

    get("ReceiptBtn").addEventListener("click", async function () {
      try {
        if (!latest || selectedWallet() !== latest.wallet) {
          throw new Error("Select the wallet used to submit this transaction.");
        }
        const receipt = await writer.receipt(latest.wallet.provider, latest.hash, latest.chainId, latest.to);
        status(receipt.state === "pending" ? "Transaction still pending in wallet RPC: " + receipt.hash :
          receipt.state === "confirmed" ? "Transaction confirmed in block " + receipt.blockNumber + ": " + receipt.hash :
          "Transaction was mined but reverted in block " + receipt.blockNumber + ": " + receipt.hash,
        receipt.state === "confirmed" ? "ok" : receipt.state === "reverted" ? "bad" : "warn");
      } catch (error) { status(error.message || String(error), "bad"); }
    });

    return Object.freeze({disconnect, renderWallets, invalidate});
  }

  configurations.forEach(function (config) { panels.push(createPanel(config)); });

  function updateChiselFields() {
    const method = $("chiselMethod").value;
    $("chiselDictionaryFields").hidden = method !== "mapArtifact" && method !== "execute";
    $("chiselLogFields").hidden = method !== "logRecord" && method !== "execute";
    $("chiselPaymentsFields").hidden = !["distribute", "distributeChecked", "execute"].includes(method);
    const preview = $("chiselValuePreview");
    if ($("chiselPaymentsFields").hidden) {
      preview.textContent = "Native value: 0 wei.";
      return;
    }
    try {
      const entries = parseChiselPayments($("chiselPayments").value);
      if (entries.length > 32) throw new Error("Maximum 32 payments.");
      let total = 0n;
      entries.forEach(function (item, index) {
        if (!/^(0|[1-9][0-9]*)$/.test(item.amountWei)) {
          throw new Error("Payment line " + (index + 1) + " must contain decimal wei.");
        }
        total += BigInt(item.amountWei);
      });
      preview.textContent = "Native value: " + total.toString() + " wei (" +
        entries.length + " payment" + (entries.length === 1 ? "" : "s") + ").";
    } catch (error) { preview.textContent = error.message || String(error); }
  }

  $("chiselMethod").addEventListener("change", function () {
    panels[0].invalidate("Chisel function changed. Review the new calldata before sending.");
    updateChiselFields();
  });
  $("chiselPayments").addEventListener("input", updateChiselFields);
  updateChiselFields();
  discover();
}(window));
