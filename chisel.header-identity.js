(function () {
  "use strict";

  // The header describes the loaded public identity, not the independently
  // selected Send currency. Never change the Send network to fix a label.
  const account = document.getElementById("portalPersonalAccount");
  const accountCoin = document.getElementById("portalPersonalAccountCoin");
  const accountAddress = document.getElementById("portalPersonalAccountAddress");
  const badge = document.getElementById("headerAccountCoin");
  const sendSelect = document.getElementById("headerCurrency");
  if (!account || !accountCoin || !accountAddress || !badge || !sendSelect) return;

  function sync() {
    const loaded = !account.hidden && Boolean(accountAddress.textContent.trim());
    const ticker = loaded ? accountCoin.textContent.trim().slice(0, 12) : "";
    const hasAccountCoin = Boolean(ticker);
    badge.textContent = hasAccountCoin ? ticker : "";
    badge.hidden = !hasAccountCoin;
    badge.title = hasAccountCoin
      ? "Loaded public account network: " + ticker + ". Send currency is selected separately in Send."
      : "";
    sendSelect.hidden = hasAccountCoin;
  }

  new MutationObserver(sync).observe(account, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden"]
  });
  window.addEventListener("pageshow", sync);
  sync();
})();
