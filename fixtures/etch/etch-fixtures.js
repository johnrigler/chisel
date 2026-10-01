(function () {
  window.CHISEL_ETCH_FIXTURES = {
    "litecoin-v276-opreturn": {
      label: "Litecoin v276 OP_RETURN dry-run",
      currency: "litecoin",
      rpcUrl: "litecoinspace,blockcypherLitecoin,blockchairLitecoin",
      explorerUrl: "https://litecoinspace.org/tx/",
      fee: "0.00010000",
      senderWif: "T33ydQRKp4FCW5LCLLUB7deioUMoveiwekdwUwyfRDeGZm76aUjV",
      warning: "Public dummy WIF derived from private key 1. Do not fund this address.",
      utxos: [
        {
          txid: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          vout: 1,
          satoshis: 100000,
          value: 100000,
          amount: 0.001,
          address: "LVuDpNCSSj6pQ7t9Pv6d6sUkLKoqDEVUnJ",
          scriptPubKey: "76a914751e76e8199196d454941c45d1b3a323f1433bd688ac",
          confirmations: 999999,
          fixture: true
        }
      ],
      vin: [
        {
          txid: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          vout: 1
        }
      ],
      vout: {
        "LVuDpNCSSj6pQ7t9Pv6d6sUkLKoqDEVUnJ": 0.001,
        "data": "43484953454c763237362066697874757265"
      },
      expectedRawHex: "0100000001efcdab8967452301efcdab8967452301efcdab8967452301efcdab89674523010100000000ffffffff02a0860100000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac0000000000000000146a1243484953454c76323736206669787475726500000000",
      expectedSignedHex: "0100000001efcdab8967452301efcdab8967452301efcdab8967452301efcdab8967452301010000006b4830450221009eb13bb5b8ccb9b0e8b8d18a071b3a7cfd485a0c9978ce14348beacba506f29f02202871bba9bd0722f9e731f2cb2b6147e7c2650ea1d78e5587aa34f2a9f978d03001210279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ffffffff02a0860100000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac0000000000000000146a1243484953454c76323736206669787475726500000000"
    },
    "litecoin-testnet-v276-opreturn": {
      label: "Litecoin testnet v276 OP_RETURN dry-run",
      currency: "litecoinTestnet",
      rpcUrl: "litecoinspaceTestnet",
      explorerUrl: "https://litecoinspace.org/testnet/tx/",
      fee: "0.00010000",
      senderWif: "cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA",
      warning: "Public Bitcoin-family testnet dummy WIF derived from private key 1. Do not fund with real assets.",
      utxos: [
        {
          txid: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
          vout: 0,
          satoshis: 100000,
          value: 100000,
          amount: 0.001,
          address: "mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r",
          scriptPubKey: "76a914751e76e8199196d454941c45d1b3a323f1433bd688ac",
          confirmations: 999999,
          fixture: true
        }
      ],
      vin: [
        {
          txid: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
          vout: 0
        }
      ],
      vout: {
        "mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r": 0.001,
        "data": "43484953454c7632373620746573746e6574"
      },
      expectedRawHex: "01000000018967452301efcdab8967452301efcdab8967452301efcdab8967452301efcdab0000000000ffffffff02a0860100000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac0000000000000000146a1243484953454c7632373620746573746e657400000000",
      expectedSignedHex: "01000000018967452301efcdab8967452301efcdab8967452301efcdab8967452301efcdab000000006a47304402201381900f5dea15d9c89a4dad1056e93a6f5e5b89ced229c0bb5c1caf2733cc5702206c3d364223cc0fc5bb29992dd8c7ab7e3d39bf7e4a0818b20bd1b1f3b9c87c7801210279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ffffffff02a0860100000000001976a914751e76e8199196d454941c45d1b3a323f1433bd688ac0000000000000000146a1243484953454c7632373620746573746e657400000000"
    }
  };
})();

(function installRecipientAddressScannerBridge() {
  "use strict";

  var STORAGE_KEY = "chisel.pendingRecipientAddress.v1";
  var popup = null;

  function getCurrencyKey() {
    var currency = document.getElementById("currency");
    return currency && currency.value ? currency.value : "litecoin";
  }

  function setStatus(text, isError) {
    var status = document.getElementById("status");
    if (!status) return;
    status.textContent = text;
    if (isError) {
      status.classList.add("error");
    } else {
      status.classList.remove("error");
    }
  }

  function loadRecipientAddress(payload) {
    var field = document.getElementById("spendableAddress");
    var selectedCurrency = getCurrencyKey();

    if (!field || !payload || payload.type !== "chisel.loadRecipientAddress") {
      return false;
    }

    if (!payload.address || typeof payload.address !== "string") {
      setStatus("Recipient scanner returned no public address.", true);
      return false;
    }

    if (payload.currency && payload.currency !== selectedCurrency) {
      setStatus(
        "Scanned address is for " + payload.currency + ", but Etch is using " + selectedCurrency + ".",
        true
      );
      return false;
    }

    field.value = payload.address.trim();
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.focus();
    setStatus("Recipient address scanned. Enter an amount, then add the spendable output.", false);
    return true;
  }

  function readStoredPayload() {
    var raw = null;

    try { raw = sessionStorage.getItem(STORAGE_KEY); } catch (error) {}
    if (!raw) {
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (error) {}
    }
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function clearStoredPayload() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (error) {}
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
  }

  function consumeStoredPayload() {
    var payload = readStoredPayload();
    var url;

    if (payload && loadRecipientAddress(payload)) {
      clearStoredPayload();
    }

    try {
      url = new URL(window.location.href);
      if (url.searchParams.has("loadScannedRecipient")) {
        url.searchParams.delete("loadScannedRecipient");
        history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash);
      }
    } catch (error) {}
  }

  function openRecipientScanner() {
    var url = "addressScan.html?rev=20260912a&currency=" + encodeURIComponent(getCurrencyKey());

    popup = window.open(url, "chiselRecipientAddressScan", "width=900,height=860");
    if (!popup) {
      window.location.href = url;
    }
  }

  function installButton() {
    var spendableTool = document.getElementById("spendableTool");
    var addButton = document.getElementById("addSpendableButton");
    var controls;
    var scanButton;

    if (!spendableTool || !addButton || document.getElementById("scanSpendableAddressButton")) {
      return;
    }

    controls = document.createElement("div");
    controls.className = "actions";

    scanButton = document.createElement("button");
    scanButton.id = "scanSpendableAddressButton";
    scanButton.className = "secondaryButton";
    scanButton.type = "button";
    scanButton.textContent = "SCAN RECIPIENT QR";
    scanButton.title = "Scan a spendable public address from another phone";
    scanButton.addEventListener("click", openRecipientScanner);

    spendableTool.insertBefore(controls, addButton);
    controls.appendChild(scanButton);
    controls.appendChild(addButton);
  }

  window.addEventListener("message", function onRecipientAddressMessage(event) {
    var data = event && event.data;

    if (!data || data.type !== "chisel.loadRecipientAddress") {
      return;
    }

    if (popup && event.source && event.source !== popup) {
      return;
    }

    if (window.location.protocol !== "file:" && event.origin && event.origin !== window.location.origin) {
      return;
    }

    if (loadRecipientAddress(data)) {
      clearStoredPayload();
    }
  });

  installButton();
  setTimeout(consumeStoredPayload, 0);
})();
