(function () {
  "use strict";

  var STORAGE_KEY = "chisel.pendingRecipientAddress.v1";
  var button = document.getElementById("scanSpendableAddressButton");
  var addressInput = document.getElementById("spendableAddress");
  var currencySelect = document.getElementById("currency");

  if (!button || !addressInput || !currencySelect) {
    return;
  }

  function emitInputEvents(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setCurrency(currency) {
    var option;

    if (!currency || currencySelect.value === currency) {
      return;
    }

    option = currencySelect.querySelector('option[value="' + String(currency).replace(/"/g, "\\\"") + '"]');
    if (!option) {
      return;
    }

    currencySelect.value = currency;
    emitInputEvents(currencySelect);
  }

  function applyRecipientPayload(data) {
    var address;

    if (!data || data.type !== "chisel.loadRecipientAddress") {
      return false;
    }

    address = String(data.address || "").trim();
    if (!address) {
      return false;
    }

    setCurrency(data.currency);
    addressInput.value = address;
    emitInputEvents(addressInput);
    addressInput.focus();
    return true;
  }

  function removeStoredPayload() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (error) {}
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
  }

  function readStoredPayload(storage) {
    var raw;
    var parsed;

    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return null;
    }

    return parsed;
  }

  function consumeStoredPayload() {
    var payload = readStoredPayload(sessionStorage) || readStoredPayload(localStorage);

    if (!payload) {
      return;
    }

    if (applyRecipientPayload(payload)) {
      removeStoredPayload();
    }
  }

  function openAddressScanner() {
    var url = "addressScan.html?rev=20260912a&currency=" + encodeURIComponent(currencySelect.value || "litecoin");
    var popup = window.open(url, "chiselAddressScan", "width=900,height=860");

    if (!popup) {
      window.location.href = url;
    }
  }

  button.addEventListener("click", openAddressScanner);

  window.addEventListener("message", function (event) {
    var localOrigin = window.location.origin;

    if (event.origin !== localOrigin && !(event.origin === "null" && localOrigin === "null")) {
      return;
    }

    if (applyRecipientPayload(event.data)) {
      removeStoredPayload();
    }
  });

  consumeStoredPayload();
})();
