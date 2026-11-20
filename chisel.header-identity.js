(function () {
  "use strict";

  // The header describes the loaded public identity, not the independently
  // selected Send currency. Never change the Send network to fix a label.
  const account = document.getElementById("portalPersonalAccount");
  const accountCoin = document.getElementById("portalPersonalAccountCoin");
  const accountAddress = document.getElementById("portalPersonalAccountAddress");
  const badge = document.getElementById("headerAccountCoin");
  const sendSelect = document.getElementById("headerCurrency");
  const sendAddress = document.getElementById("senderAddress");
  const qrButton = document.getElementById("headerAddressQrButton");
  const qrDialog = document.getElementById("senderAddressQrDialog");
  const qrCode = document.getElementById("senderAddressQrCode");
  const qrValue = document.getElementById("senderAddressQrValue");
  const qrTitle = document.getElementById("senderAddressQrTitle");
  const printQrButton = document.getElementById("printSenderAddressQrButton");
  if (printQrButton) {
    printQrButton.addEventListener("click", function () {
      if (qrDialog && qrDialog.open) window.print();
    });
  }
  if (!account || !accountCoin || !accountAddress || !badge || !sendSelect) return;

  function addressContext() {
    const active = window.CHISEL_ACTIVE_ACCOUNT;
    if (active && active.accountOnly && sendSelect.value === active.currency) {
      return { address:active.address, ticker:active.ticker };
    }
    const accountAddressValue = accountAddress && accountAddress.textContent.trim();
    if (account && !account.hidden && accountAddressValue) {
      return { address: accountAddressValue, ticker: accountCoin && accountCoin.textContent.trim() || "Public" };
    }
    const sendAddressValue = sendAddress && sendAddress.value.trim();
    if (sendAddressValue) {
      const option = sendSelect && sendSelect.selectedOptions && sendSelect.selectedOptions[0];
      return { address: sendAddressValue, ticker: option && option.textContent.trim() || "Public" };
    }
    return null;
  }

  function sync() {
    const active = window.CHISEL_ACTIVE_ACCOUNT;
    if (active && active.accountOnly && sendSelect.value === active.currency) {
      badge.textContent = active.ticker;
      badge.hidden = false;
      badge.title = "Selected network: " + active.currency + " / " + active.network;
      sendSelect.hidden = false;
      if (qrButton) qrButton.disabled = typeof window.QRCode !== "function";
      return;
    }
    const loaded = Boolean(account && !account.hidden && accountAddress && accountAddress.textContent.trim());
    const ticker = loaded && accountCoin ? accountCoin.textContent.trim().slice(0, 12) : "";
    const hasAccountCoin = Boolean(ticker);
    badge.textContent = hasAccountCoin ? ticker : "";
    badge.hidden = !hasAccountCoin;
    badge.title = hasAccountCoin
      ? "Loaded public account network: " + ticker + ". Send currency is selected separately in Send."
      : "";
    sendSelect.hidden = loaded;
    if (qrButton) qrButton.disabled = typeof window.QRCode !== "function";
  }

  function showAddressQr() {
    const context = addressContext();
    if (!context || typeof window.QRCode !== "function" || !qrDialog || !qrCode || !qrValue) {
      if (window.chiselActivity) window.chiselActivity("Identity", context ? "Public-address QR is unavailable in this browser." : "Load a public account or derive an address in Send before opening its QR.", "error");
      return;
    }

    if (qrTitle) qrTitle.textContent = context.ticker + " public address";
    qrValue.textContent = context.address;
    qrCode.textContent = "";
    try {
      if (typeof qrDialog.showModal === "function") {
        if (!qrDialog.open) qrDialog.showModal();
      } else {
        qrDialog.setAttribute("open", "");
      }
      new window.QRCode(qrCode, {
        text: context.address,
        width: 320,
        height: 320,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M
      });
    } catch (error) {
      if (typeof qrDialog.close === "function" && qrDialog.open) qrDialog.close();
      else qrDialog.removeAttribute("open");
      if (window.chiselActivity) window.chiselActivity("Identity", "Could not render public address QR", "error");
    }
  }

  if (qrButton) qrButton.addEventListener("click", showAddressQr);
  if (sendAddress) {
    sendAddress.addEventListener("input", sync);
    sendAddress.addEventListener("change", sync);
  }
  if (sendSelect && typeof sendSelect.addEventListener === "function") sendSelect.addEventListener("change", sync);

  new MutationObserver(sync).observe(account, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["hidden"]
  });
  window.addEventListener("pageshow", sync);
  window.addEventListener("chisel:active-account", sync);
  sync();
})();
