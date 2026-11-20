(function (root) {
  "use strict";
  const panel = document.getElementById("sharedAccountsPanel");
  const list = document.getElementById("sharedAccountsList");
  const checkAll = document.getElementById("checkAllNetworkBalances");
  const funding = document.getElementById("testnetFunding");
  const currency = document.getElementById("currency");
  if (!panel || !list || !checkAll || !funding || !currency) return;
  let accounts = [], signature = "", generation = 0, busy = false, restart = false;

  function text(tag, value) {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
  }

  function updateFunding() {
    funding.replaceChildren();
    const coin = root.CHISEL.coins[currency.value];
    funding.hidden = !coin || !coin.IS_TESTNET;
    if (funding.hidden) return;
    funding.append(text("strong", "Get " + coin.DISPLAY_NAME + " coins"));
    funding.append(text("p", "1. Load your WIF and copy the derived public address above. 2. Open a faucet below and request coins for " + coin.DISPLAY_NAME + ". 3. Return here and press CHECK FUNDS. Chisel also checks while this page is visible."));
    funding.append(text("p", "Test coins have no monetary value. Each test network has separate coins, even when addresses look identical. A faucet needs only your public address; keep your WIF here."));
    for (const entry of coin.FUNDING_LINKS || []) {
      const a = text("a", entry.label);
      a.href = entry.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.marginRight = "1rem";
      funding.append(a);
    }
    funding.append(text("p", "Faucets may require sign-in or a captcha and can temporarily run out of coins. " +
      (coin.CHAIN === "bitcoin" ? "Bitcoin requests must specifically use Testnet4." : "Request BSV testnet coins, which are separate from Bitcoin Testnet4 coins.")));
  }

  async function balances() {
    if (busy || !accounts.length || typeof root.CHISEL_LOOKUP_BALANCE !== "function") return;
    busy = true;
    checkAll.disabled = true;
    const request = generation;
    try {
      // One provider request at a time; this list contains public addresses only.
      for (const item of accounts) {
        if (request !== generation) return;
        item.status.textContent = "Checking…";
        try {
          let timeout, result;
          try {
            result = await Promise.race([root.CHISEL_LOOKUP_BALANCE(item.currency, item.address),
              new Promise(function (_resolve, reject) { timeout = root.setTimeout(function () { reject(new Error("Balance timeout")); }, 15000); })]);
          } finally { root.clearTimeout(timeout); }
          if (request !== generation) return;
          item.status.textContent = result.amount + " " + result.ticker + " · checked " + new Date().toLocaleTimeString();
        } catch (_) {
          if (request !== generation) return;
          item.status.textContent = "Balance unavailable · retry CHECK ALL BALANCES";
        }
      }
    } finally {
      busy = false;
      checkAll.disabled = false;
      if (restart) { restart = false; balances(); }
    }
  }

  function showAccounts(rows) {
    const clean = (rows || []).filter(function (row) {
      return row && root.CHISEL.coins[row.currency] && typeof row.address === "string";
    });
    const nextSignature = JSON.stringify(clean.map(function (row) { return [row.currency, row.network, row.address]; }));
    if (signature === nextSignature) return;
    signature = nextSignature;
    generation += 1;
    accounts = [];
    list.replaceChildren();
    panel.hidden = !clean.length;
    for (const account of clean) {
      const coin = root.CHISEL.coins[account.currency];
      const row = document.createElement("div");
      row.className = "sharedNetworkAccount";
      row.append(text("strong", coin.DISPLAY_NAME));
      const address = text("code", account.address);
      address.style.overflowWrap = "anywhere";
      row.append(address);
      const status = text("span", "Balance not checked");
      status.setAttribute("aria-live", "polite");
      row.append(status);
      const use = text("button", "USE NETWORK");
      use.type = "button";
      use.className = "secondaryButton";
      use.addEventListener("click", function () {
        currency.value = account.currency;
        currency.dispatchEvent(new Event("change", { bubbles:true }));
      });
      row.append(use);
      list.append(row);
      accounts.push({ currency:account.currency, address:account.address, status:status });
    }
    // A new identity replaces the pending queue after its current request completes.
    if (busy) restart = true;
    else balances();
  }

  currency.addEventListener("change", updateFunding);
  checkAll.addEventListener("click", balances);
  root.addEventListener("chisel:identity-accounts", function (event) { showAccounts(event.detail && event.detail.accounts); });
  root.addEventListener("chisel:balance", function (event) {
    const result = event.detail || {};
    const item = accounts.find(function (entry) { return entry.currency === result.currency && entry.address === result.address; });
    if (item) item.status.textContent = result.amount + " " + result.ticker + " · checked " + new Date().toLocaleTimeString();
  });
  root.addEventListener("chisel:balance-api-ready", function () { showAccounts(root.CHISEL_PUBLIC_ACCOUNTS || []); });
  updateFunding();
  showAccounts(root.CHISEL_PUBLIC_ACCOUNTS || []);
})(window);
