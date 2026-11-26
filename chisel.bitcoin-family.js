(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const card = $("portalPersonalAccount"), label = $("portalPersonalAccountLabel"),
    address = $("portalPersonalAccountAddress"), explorer = $("portalPersonalAccountExplorer"),
    family = $("portalBitcoinFamily"), button = $("portalBitcoinFamilyCheck");
  if (!card || !label || !address || !explorer || !family || !button) return;
  const ledgers = [
    {key:"bitcoin", ticker:"BTC", explorer:"https://mempool.space/address/"},
    {key:"bsv", ticker:"BSV", explorer:"https://whatsonchain.com/address/"},
    {key:"bitcoincash", ticker:"BCH", explorer:"https://blockchair.com/bitcoin-cash/address/"}
  ];
  let current = "", request = 0;
  function getContext() {
    const key = card.dataset.currency, value = address.textContent.trim();
    if (card.hidden || !["bitcoin","bsv","bitcoincash"].includes(key) || !/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(value)) return null;
    return {key, address:value};
  }
  function activeLedger(context) {
    const selected = Array.from(document.querySelectorAll(".portalFilterBar input[type=checkbox]:checked"));
    if (selected.length === 1) {
      if (selected[0].id === "portalFilterBsv") return ledgers[1];
      if (selected[0].id === "portalFilterBitcoin") return ledgers[0];
    }
    return ledgers.find(ledger => ledger.key === context.key) || ledgers[0];
  }
  function text(node,value) { if (node && node.textContent !== value) node.textContent = value; }
  function sync() {
    const context = getContext();
    if (family.hidden !== !context) family.hidden = !context;
    if (!context) {
      if (current) { current = ""; request++; button.disabled = false; }
      if (explorer.textContent.startsWith("VERIFY ADDRESS · ")) text(explorer,"VERIFY ADDRESS");
      return;
    }
    if (current !== context.address) {
      current = context.address; request++; button.disabled = false;
      for (const ledger of ledgers) text($("familyBalance"+ledger.ticker), "Not checked");
    }
    text(label,"Bitcoin-family account (BTC / BSV / BCH)");
    for (const ledger of ledgers) {
      const link = $("familyExplorer"+ledger.ticker);
      const href = ledger.explorer + encodeURIComponent(context.address);
      if (link.getAttribute("href") !== href) link.href = href;
    }
    const selected = activeLedger(context);
    const href = selected.explorer + encodeURIComponent(context.address);
    if (explorer.getAttribute("href") !== href) explorer.href = href;
    explorer.target = "_blank";
    explorer.rel = "noopener noreferrer";
    if (explorer.style.display !== "inline-flex") explorer.style.display = "inline-flex";
    text(explorer,"VERIFY ADDRESS · "+selected.ticker);
  }
  async function bchBalance(value) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("https://api.blockchair.com/bitcoin-cash/dashboards/address/"+encodeURIComponent(value), {
        signal:controller.signal, credentials:"omit", referrerPolicy:"no-referrer"
      });
      if (!response.ok) throw Error("BCH provider returned HTTP "+response.status);
      const result = await response.json();
      const entries = Object.values(result.data || {});
      if (result.context?.code !== 200 || entries.length !== 1) throw Error("Unexpected BCH response");
      const balance = entries[0]?.address?.balance;
      if (!Number.isSafeInteger(balance) || balance < 0) throw Error("Invalid BCH balance");
      return (balance/100000000).toFixed(8)+" BCH";
    } finally { clearTimeout(timer); }
  }
  async function balance(ledger,value) {
    if (ledger.key === "bitcoincash") return bchBalance(value);
    const coin = window.CHISEL?.coins?.[ledger.key];
    if (!coin || typeof coin.getAddressBalance !== "function") throw Error("Ledger reader unavailable");
    const data = await coin.getAddressBalance(null,{},value);
    if (data.address !== value || data.chain !== ledger.key || data.network !== "mainnet" || !Number.isSafeInteger(data.totalSats)) throw Error("Invalid ledger response");
    return (data.totalSats/100000000).toFixed(8)+" "+ledger.ticker;
  }
  button.addEventListener("click",async function () {
    const context = getContext();
    if (!context) return;
    const id = ++request;
    button.disabled = true;
    for (const ledger of ledgers) text($("familyBalance"+ledger.ticker),"Checking…");
    try {
      const decoded = await window.CHISEL.base58CheckDecode(context.address);
      if (decoded.length !== 21 || decoded[0] !== 0) throw Error("Not a legacy mainnet P2PKH address");
      if (id !== request) return;
      await Promise.all(ledgers.map(async ledger => {
        let result;
        try { result = await balance(ledger,context.address); }
        catch (_) { result = "Unavailable — verify in explorer"; }
        if (id === request) text($("familyBalance"+ledger.ticker),result);
      }));
    } catch (_) {
      if (id === request) for (const ledger of ledgers) text($("familyBalance"+ledger.ticker),"Address validation failed");
    } finally { if (id === request) button.disabled = false; }
  });
  // Read the current filters at click time, including programmatic "only BSV" changes.
  explorer.addEventListener("click",sync);
  document.addEventListener("change",sync);
  document.addEventListener("click",() => setTimeout(sync,0));
  new MutationObserver(sync).observe(card,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["hidden","data-currency"]});
  sync();
})();
