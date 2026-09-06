(function () {
  if (!window.CHISEL || typeof CHISEL.getCoin !== "function") return;

  const WATCH_KEY = "chisel.litecoin.pendingTxWatch.v1";
  const RECEIPT_KEY = "chisel.litecoin.lastReceipt.v1";
  const POLL_MS = 15000;
  const PANEL_ID = "litecoinLedgerReceipt";
  const wrapped = {};

  function explorerBase(network) {
    return network === "testnet" ? "https://litecoinspace.org/testnet/" : "https://litecoinspace.org/";
  }

  function explorerUrls(network, txid, blockHash, blockHeight) {
    const base = explorerBase(network);
    return {
      tx: txid ? base + "tx/" + encodeURIComponent(txid) : "",
      block: blockHash ? base + "block/" + encodeURIComponent(blockHash) : "",
      height: blockHeight !== undefined && blockHeight !== null
        ? base + "block-height/" + encodeURIComponent(String(blockHeight))
        : ""
    };
  }

  function normalizeTxid(result) {
    if (typeof result === "string") return result.trim().replace(/^"|"$/g, "");
    if (!result || typeof result !== "object") return "";
    if (typeof result.txid === "string") return result.txid.trim();
    if (typeof result.hash === "string") return result.hash.trim();
    if (result.tx && typeof result.tx.hash === "string") return result.tx.hash.trim();
    if (result.data && typeof result.data.transaction_hash === "string") return result.data.transaction_hash.trim();
    return "";
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {}
  }

  function load(key) {
    try {
      const text = localStorage.getItem(key);
      return text ? JSON.parse(text) : null;
    } catch (error) {
      return null;
    }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch (error) {}
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function link(url, text) {
    if (!url) return escapeHtml(text);
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(text) + "</a>";
  }

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    const sendResult = document.getElementById("sendResultJson");
    if (!sendResult || !sendResult.parentNode) return null;

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "compactHint";
    panel.style.marginTop = "12px";
    panel.style.whiteSpace = "normal";
    sendResult.parentNode.appendChild(panel);
    return panel;
  }

  function render(receipt) {
    const panel = ensurePanel();
    if (!panel || !receipt) return;

    const urls = receipt.urls || explorerUrls(receipt.network, receipt.txid, receipt.blockHash, receipt.blockHeight);
    const lines = [
      "<strong>Litecoin ledger receipt</strong>",
      "tx: " + link(urls.tx, receipt.txid || "(unknown)"),
      "state: " + escapeHtml(receipt.state || "watching")
    ];

    if (receipt.blockHeight !== undefined && receipt.blockHeight !== null) {
      lines.push("block height: " + link(urls.height, receipt.blockHeight));
    }
    if (receipt.blockHash) lines.push("block: " + link(urls.block, receipt.blockHash));
    if (Number.isInteger(receipt.txIndex) && receipt.txIndex >= 0) {
      lines.push("transaction position: " + receipt.txIndex + " (zero-based)");
    }
    if (receipt.locator) lines.push("<strong>compact locator: " + escapeHtml(receipt.locator) + "</strong>");
    if (receipt.confirmations !== undefined && receipt.confirmations !== null) {
      lines.push("confirmations observed: " + escapeHtml(receipt.confirmations));
    }
    if (receipt.error) lines.push("last tracker error: " + escapeHtml(receipt.error));

    panel.innerHTML = lines.join("<br>");
  }

  function providerFor(network) {
    return CHISEL.getProvider(network === "testnet" ? "litecoinspaceTestnet" : "litecoinspace");
  }

  async function inspect(txid, network) {
    network = network === "testnet" ? "testnet" : "mainnet";
    const provider = providerFor(network);
    const tx = await provider.getTransaction(txid);
    const status = tx && tx.status ? tx.status : {};

    if (!status.confirmed) {
      return {
        chain: network === "testnet" ? "TLTC" : "LTC",
        network: network,
        txid: txid,
        confirmed: false,
        state: "mempool",
        urls: explorerUrls(network, txid)
      };
    }

    const blockHash = status.block_hash;
    const blockHeight = Number(status.block_height);
    const txids = await CHISEL.fetchJson(provider.baseUrl + "/block/" + encodeURIComponent(blockHash) + "/txids");
    const txIndex = Array.isArray(txids) ? txids.indexOf(txid) : -1;
    let confirmations = null;

    try {
      const tip = Number(await provider.getTip());
      if (Number.isFinite(tip) && Number.isFinite(blockHeight)) confirmations = tip - blockHeight + 1;
    } catch (error) {}

    return {
      chain: network === "testnet" ? "TLTC" : "LTC",
      network: network,
      txid: txid,
      confirmed: true,
      state: txIndex >= 0 ? "confirmed-position-known" : "confirmed-position-pending",
      blockHash: blockHash,
      blockHeight: blockHeight,
      txIndex: txIndex,
      locator: txIndex >= 0 ? String(blockHeight) + ":" + String(txIndex) : "",
      confirmations: confirmations,
      blockTime: status.block_time,
      urls: explorerUrls(network, txid, blockHash, blockHeight)
    };
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function follow(txid, options) {
    const opts = options || {};
    const network = opts.network === "testnet" ? "testnet" : "mainnet";
    const pollMs = Math.max(3000, Number(opts.pollMs || POLL_MS));
    const watch = {
      chain: network === "testnet" ? "TLTC" : "LTC",
      network: network,
      txid: txid,
      confirmed: false,
      state: "watching",
      startedAt: new Date().toISOString(),
      urls: explorerUrls(network, txid)
    };

    save(WATCH_KEY, watch);
    render(watch);

    while (true) {
      try {
        const receipt = await inspect(txid, network);
        render(receipt);
        if (typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent("chisel:ledger-receipt", { detail: receipt }));
        }
        if (receipt.confirmed && receipt.txIndex >= 0) {
          receipt.completedAt = new Date().toISOString();
          save(RECEIPT_KEY, receipt);
          remove(WATCH_KEY);
          return receipt;
        }
        save(WATCH_KEY, Object.assign({}, watch, receipt));
      } catch (error) {
        const retry = Object.assign({}, watch, {
          state: "watching-retry",
          error: error && error.message ? error.message : String(error)
        });
        save(WATCH_KEY, retry);
        render(retry);
      }
      await sleep(pollMs);
    }
  }

  function start(txid, network) {
    if (!/^[0-9a-f]{64}$/i.test(String(txid || ""))) return;
    setTimeout(function () {
      follow(String(txid), { network: network }).catch(function (error) {
        render({
          network: network,
          txid: String(txid),
          state: "watch-failed",
          error: error && error.message ? error.message : String(error),
          urls: explorerUrls(network, String(txid))
        });
      });
    }, 0);
  }

  function patchCoin(name, network) {
    let coin;
    try { coin = CHISEL.getCoin(name); } catch (error) { return; }
    if (!coin || wrapped[name] || typeof coin.sendRawTransaction !== "function") return;

    const original = coin.sendRawTransaction.bind(coin);
    coin.sendRawTransaction = async function trackedSendRawTransaction(client, values, signedHex) {
      const result = await original(client, values, signedHex);
      const txid = normalizeTxid(result && (result.txid || result.result || result));
      const urls = explorerUrls(network, txid);

      if (txid) {
        result.txid = txid;
        result.result = txid;
        result.txUrl = urls.tx;
        result.tracking = "watching-for-block-position";
        start(txid, network);
      }
      return result;
    };

    coin.getExplorerUrls = function (txid, blockHash, blockHeight) {
      return explorerUrls(network, txid, blockHash, blockHeight);
    };
    coin.inspectTransactionReceipt = function (txid) { return inspect(txid, network); };
    coin.followTransaction = function (txid, options) {
      return follow(txid, Object.assign({}, options || {}, { network: network }));
    };
    coin.DRIVER_VERSION = (coin.DRIVER_VERSION || "") + "+ledger-receipt";
    wrapped[name] = true;
  }

  function resume() {
    const pending = load(WATCH_KEY);
    if (pending && pending.txid) {
      start(pending.txid, pending.network || "mainnet");
      return;
    }
    const last = load(RECEIPT_KEY);
    if (last) render(last);
  }

  patchCoin("litecoin", "mainnet");
  patchCoin("litecoinTestnet", "testnet");

  window.CHISEL_LITECOIN_RECEIPT = {
    inspect: inspect,
    follow: follow,
    getExplorerUrls: explorerUrls,
    resume: resume
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", resume, { once: true });
  } else {
    resume();
  }
})();
