(function () {
  "use strict";

  // The header describes the loaded public identity, not the independently
  // selected Send currency. Never change the Send network to fix a label.
  const account = document.getElementById("portalPersonalAccount");
  const accountCoin = document.getElementById("portalPersonalAccountCoin");
  const accountAddress = document.getElementById("portalPersonalAccountAddress");
  const badge = document.getElementById("headerAccountCoin");
  const sendSelect = document.getElementById("headerCurrency");
  const qrButton = document.getElementById("headerAddressQrButton");
  const qrDialog = document.getElementById("senderAddressQrDialog");
  const qrCode = document.getElementById("senderAddressQrCode");
  const qrValue = document.getElementById("senderAddressQrValue");
  const qrTitle = document.getElementById("senderAddressQrTitle");
  if (!account || !accountCoin || !accountAddress || !badge || !sendSelect) return;

  function sync() {
    const address = accountAddress.textContent.trim();
    const loaded = !account.hidden && Boolean(address);
    const ticker = loaded ? accountCoin.textContent.trim().slice(0, 12) : "";
    const hasAccountCoin = Boolean(ticker);
    badge.textContent = hasAccountCoin ? ticker : "";
    badge.hidden = !hasAccountCoin;
    badge.title = hasAccountCoin
      ? "Loaded public account network: " + ticker + ". Send currency is selected separately in Send."
      : "";
    sendSelect.hidden = hasAccountCoin;
    if (qrButton) qrButton.disabled = !loaded || !address || typeof window.QRCode !== "function";
  }

  function showAddressQr() {
    const address = accountAddress.textContent.trim();
    if (account.hidden || !address || typeof window.QRCode !== "function" ||
        !qrDialog || !qrCode || !qrValue) return;

    if (qrTitle) qrTitle.textContent = (accountCoin.textContent.trim() || "Public") + " address";
    qrValue.textContent = address;
    qrCode.textContent = "";
    try {
      if (typeof qrDialog.showModal === "function") {
        if (!qrDialog.open) qrDialog.showModal();
      } else {
        qrDialog.setAttribute("open", "");
      }
      new window.QRCode(qrCode, {
        text: address,
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
