(function () {
  //
  // Constants
  //
  const APP_NAME = "chisel";
  const APP_VERSION = "2.3.7c";
  const DEFAULT_CURRENCY_KEY = "ravencoin";
  const STATUS_IDLE = "Idle";
  const STATUS_DONE = "Transaction sent successfully.";
  const ENTER_KEY = "Enter";
  console.log(APP_VERSION)

  //
  // Currency registry
  //
  const CURRENCY_DEFINITIONS = {
    ravencoin: {
      key: "ravencoin",
      label: "Ravencoin",
      aliases: ["ravencoin", "Ravencoin", "rvn", "RVN"]
    },
    digibyte: {
      key: "digibyte",
      label: "Digibyte",
      aliases: ["digibyte", "Digibyte", "dgb", "DGB"]
    },
    litecoinTestnet: {
      key: "litecoinTestnet",
      label: "Litecoin Testnet",
      aliases: ["litecoinTestnet", "litecoin-testnet", "Litecoin Testnet", "tltc", "TLTC"]
    }
  };

  //
  // Elements
  //
  const elems = {
    currency: document.querySelector("#currency"),
    senderWif: document.querySelector("#senderWif"),
    feeRvn: document.querySelector("#feeRvn"),
    feeLabel: document.querySelector("#feeLabel"),
    opReturnAscii: document.querySelector("#opReturnAscii"),
    opReturnHex: document.querySelector("#opReturnHex"),
    rpcUrl: document.querySelector("#rpcUrl"),
    rpcUrlLabel: document.querySelector("#rpcUrlLabel"),
    explorerUrl: document.querySelector("#explorerUrl"),
    explorerUrlLabel: document.querySelector("#explorerUrlLabel"),
    senderAddress: document.querySelector("#senderAddress"),
    utxoCount: document.querySelector("#utxoCount"),
    spendTotalRvn: document.querySelector("#spendTotalRvn"),
    spendTotalLabel: document.querySelector("#spendTotalLabel"),
    changeRvn: document.querySelector("#changeRvn"),
    changeLabel: document.querySelector("#changeLabel"),
    sendButton: document.querySelector("#sendButton"),
    status: document.querySelector("#status"),
    version: document.querySelector("#version"),
    heroTitle: document.querySelector("#heroTitle"),
    heroText: document.querySelector("#heroText"),
    currencyHelp: document.querySelector("#currencyHelp"),
    accountJson: document.querySelector("#accountJson"),
    utxoJson: document.querySelector("#utxoJson"),
    vinJson: document.querySelector("#vinJson"),
    voutJson: document.querySelector("#voutJson"),
    buildPayloadJson: document.querySelector("#buildPayloadJson"),
    rawHex: document.querySelector("#rawHex"),
    decodedUnsignedJson: document.querySelector("#decodedUnsignedJson"),
    signedHex: document.querySelector("#signedHex"),
    decodedSignedJson: document.querySelector("#decodedSignedJson"),
    sendPayloadJson: document.querySelector("#sendPayloadJson"),
    sendResultJson: document.querySelector("#sendResultJson")
  };

  //
  // State
  //
  const state = {
    isLoading: false,
    isError: false,
    status: STATUS_IDLE,
    account: null,
    utxos: null,
    vin: null,
    vout: null,
    feeWasManuallyEdited: false,
    lastSuggestedFeeValue: "",
    buildPayload: null,
    rawHex: "",
    decodedUnsigned: null,
    signedHex: "",
    decodedSigned: null,
    sendPayload: null,
    sendResult: null
  };

  //
  // Currency helpers
  //
  function getSelectedCurrencyKey() {
    return elems.currency.value;
  }

  function isFeeInputUsingSuggestedValue() {
  return elems.feeRvn.value === "" || elems.feeRvn.value === state.lastSuggestedFeeValue;
}

 function tryGetCoinFromChisel(key) {
   if (typeof CHISEL === "undefined" || typeof CHISEL.getCoin !== "function") {
      return null;
    }

    try {
      const coin = CHISEL.getCoin(key);

      if (!coin) {
        return null;
      }

      return coin;
    } catch (error) {
      return null;
    }
  }

  function tryGetCoinFromAliases(aliases) {
    for (let i = 0; i < aliases.length; i += 1) {
      const coin = tryGetCoinFromChisel(aliases[i]);

      if (coin) {
        return coin;
      }
    }

    return null;
  }

  function tryBuildCoinFromGlobal(key) {
    switch (key) {
      case "ravencoin":
        if (typeof RAVENCOIN === "function") {
          return new RAVENCOIN();
        }
        break;

      case "digibyte":
        if (typeof DIGIBYTE === "function") {
          return new DIGIBYTE();
        }
        break;

      case "litecoinTestnet":
        if (typeof LITECOIN_TESTNET === "function") {
          return new LITECOIN_TESTNET();
        }
        break;

      default:
        break;
    }

    return null;
  }

  function resolveCoin(key) {
    const definition = CURRENCY_DEFINITIONS[key];

    if (!definition) {
      throw new Error("Unknown currency: " + key);
    }

    const chiselCoin = tryGetCoinFromAliases(definition.aliases);

    if (chiselCoin) {
      return chiselCoin;
    }

    const globalCoin = tryBuildCoinFromGlobal(key);

    if (globalCoin) {
      return globalCoin;
    }

    throw new Error("Currency is not available yet: " + definition.label);
  }

  function isCurrencyAvailable(key) {
    try {
      return Boolean(resolveCoin(key));
    } catch (error) {
      return false;
    }
  }

  function getAvailableCurrencyKeys() {
    return Object.keys(CURRENCY_DEFINITIONS).filter(function filterCurrencyKey(key) {
      return isCurrencyAvailable(key);
    });
  }

  function getDefaultCurrencyKey() {
    const availableKeys = getAvailableCurrencyKeys();

    if (availableKeys.indexOf(DEFAULT_CURRENCY_KEY) >= 0) {
      return DEFAULT_CURRENCY_KEY;
    }

    if (availableKeys.length > 0) {
      return availableKeys[0];
    }

    return DEFAULT_CURRENCY_KEY;
  }

function getCoin() {
  return CHISEL.getCoin(elems.currency.value || DEFAULT_CURRENCY_KEY);
}

  function getCoinName() {
    return getCoin().NAME;
  }

// Digibyte specific

function isTooLongMempoolChainError(message) {
  return /too-long-mempool-chain|too many unconfirmed ancestors/i.test(String(message || ""));
}

// Ravencoin specific
//
function isMempoolConflictChainError(message) {
  return /txn-mempool-conflict/i.test(String(message || ""));
}


  //
  // Generic helpers
  //
  function setInputValue(elem, value) {
    elem.value = value;
  }

  function showElem(elem) {
    elem.classList.remove("hide");
  }

  function hideElem(elem) {
    elem.classList.add("hide");
  }

  function escapeHtml(string) {
    return String(string)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatJsonSyntax(value) {
    const json = JSON.stringify(value, null, 2);

    return escapeHtml(json)
      .replace(
        /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"\s*:?)|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
        function replaceToken(match) {
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              return '<span class="json-key">' + match + "</span>";
            }

            return '<span class="json-string">' + match + "</span>";
          }

          if (match === "true" || match === "false") {
            return '<span class="json-boolean">' + match + "</span>";
          }

          if (match === "null") {
            return '<span class="json-null">' + match + "</span>";
          }

          return '<span class="json-number">' + match + "</span>";
        }
      )
      .replace(/([{}\[\],:])/g, '<span class="json-punctuation">$1</span>');
  }

  function normalizeHex(hex) {
    return String(hex).trim().replace(/^0x/i, "").replace(/\s+/g, "");
  }

  function isHex(value) {
    return /^[0-9a-fA-F]*$/.test(value);
  }

  function stringToHex(string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(string);

    return Array.from(bytes, function mapByte(byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

function setFeeUnitsValue(feeUnits) {
  const coin = getCoin();
  const feeValue = coin.unitsToCoin(Number(feeUnits)).toFixed(8);

  elems.feeRvn.value = feeValue;
  elems.feeRvn.dispatchEvent(new Event("input", { bubbles: true }));
  elems.feeRvn.dispatchEvent(new Event("change", { bubbles: true }));
}



  function resolveOpReturnHex() {
    const ascii = elems.opReturnAscii.value.trim();
    const hex = normalizeHex(elems.opReturnHex.value);

    if (ascii && hex) {
      throw new Error("Use either OP_RETURN ASCII or OP_RETURN HEX, not both.");
    }

    if (ascii) {
      return stringToHex(ascii);
    }

    if (hex) {
      if (!isHex(hex)) {
        throw new Error("OP_RETURN HEX contains non-hex characters.");
      }

      if (hex.length % 2 !== 0) {
        throw new Error("OP_RETURN HEX must have an even number of characters.");
      }

      return hex.toLowerCase();
    }

    return "";
  }

  function getFormValues() {
    const coin = getCoin();

    return {
      rpcUrl: elems.rpcUrl.value.trim(),
      explorerUrl: elems.explorerUrl.value.trim(),
      senderWif: elems.senderWif.value.trim(),
      feeUnits: coin.coinToUnits(elems.feeRvn.value),
      opReturnHex: resolveOpReturnHex()
    };
  }

function getResolvedOpReturnHexForFee() {
  const ascii = elems.opReturnAscii.value.trim();
  const hex = normalizeHex(elems.opReturnHex.value);

  if (ascii && hex) {
    return "";
  }

  if (ascii) {
    return stringToHex(ascii);
  }

  if (hex && isHex(hex) && hex.length % 2 === 0) {
    return hex.toLowerCase();
  }

  return "";
}

  function buildSendBackVout(address, changeUnits, opReturnHex) {
    const coin = getCoin();
    const vout = {
      [address]: coin.unitsToCoin(changeUnits)
    };

    if (opReturnHex) {
      vout.data = opReturnHex;
    }

    return vout;
  }

  //
  // DOM setters
  //
  function setAppVersion() {
    elems.version.textContent = APP_NAME + " v" + APP_VERSION;
  }

function setCurrencyOptions() {
  const coins = CHISEL.getCoins();

  elems.currency.innerHTML = "";

  coins.forEach(function appendCoinOption(coin) {
    const option = document.createElement("option");

    option.value = coin.NAME;
    option.textContent = coin.DISPLAY_NAME || coin.NAME;

    elems.currency.append(option);
  });

  elems.currency.value = DEFAULT_CURRENCY_KEY;
}

function setCurrencyForm() {

  console.log("setCurrencyForm currency =", elems.currency.value);
  console.log("installed coins =", CHISEL.getCoins().map(function mapCoin(coin) {
    return coin.NAME;
  }));

  const currencyKey = elems.currency.value || DEFAULT_CURRENCY_KEY;
  const coin = CHISEL.getCoin(currencyKey);

  elems.heroTitle.textContent = coin.HERO_TITLE || coin.DISPLAY_NAME || coin.NAME;
  elems.heroText.textContent = coin.HERO_TEXT || "";
  elems.currencyHelp.textContent = coin.HELP_TEXT || "";
  elems.feeLabel.textContent = "Fee (" + coin.TICKER + ")";
  elems.spendTotalLabel.textContent = "Spend total (" + coin.TICKER + ")";
  elems.changeLabel.textContent = "Send-back amount (" + coin.TICKER + ")";
  elems.rpcUrlLabel.textContent = coin.REQUIRES_EXPLORER ? "RPC URL" : "RPC / API URL";

 // setInputValue(elems.feeRvn, coin.DEFAULT_FEE || "");
  setSuggestedFeeValue();
  setInputValue(elems.rpcUrl, coin.DEFAULT_RPC_URL || "");
  setInputValue(elems.explorerUrl, coin.DEFAULT_EXPLORER_URL || "");

  if (coin.REQUIRES_EXPLORER) {
    showElem(elems.explorerUrl);
    showElem(elems.explorerUrlLabel);
    elems.explorerUrlLabel.textContent = "Explorer URL";
  } else {
    hideElem(elems.explorerUrl);
    hideElem(elems.explorerUrlLabel);
  }

  if (coin.MIN_FEE) {
    elems.currencyHelp.textContent =
      (coin.HELP_TEXT || "") +
      " Minimum enforced fee floor: " +
      coin.unitsToCoin(coin.MIN_FEE).toFixed(8) +
      " " +
      coin.TICKER +
      ".";
  }

  render();
}

  function setStatusMessage(message, isError) {
    state.status = message;
    state.isError = Boolean(isError);
    render();
  }

  function setLoadingState(isLoading) {
    state.isLoading = Boolean(isLoading);
    render();
  }

  function setAccountData(account) {
    state.account = account;
    setInputValue(elems.senderAddress, account.address);
    render();
  }

  function setUtxoData(utxos) {
    const coin = getCoin();

    state.utxos = utxos;
    setInputValue(elems.utxoCount, String(utxos.length));
    setInputValue(elems.spendTotalRvn, coin.unitsToCoin(CHISEL.sumUtxoSatoshis(utxos)).toFixed(8));
    render();
  }

  function setVinData(vin) {
    state.vin = vin;
    render();
  }

  function setVoutData(vout) {
    state.vout = vout;
    render();
  }

  function setBuildPayloadData(buildPayload) {
    state.buildPayload = buildPayload;
    render();
  }

  function setRawHexData(rawHex) {
    state.rawHex = rawHex;
    render();
  }

  function setDecodedUnsignedData(decodedUnsigned) {
    state.decodedUnsigned = decodedUnsigned;
    render();
  }

  function setSignedHexData(signedHex) {
    state.signedHex = signedHex;
    render();
  }

  function setDecodedSignedData(decodedSigned) {
    state.decodedSigned = decodedSigned;
    render();
  }

  function setSendPayloadData(sendPayload) {
    state.sendPayload = sendPayload;
    render();
  }

  function setSendResultData(sendResult) {
    state.sendResult = sendResult;
    render();
  }

  function setChangeData(changeUnits) {
    const coin = getCoin();
    setInputValue(elems.changeRvn, coin.unitsToCoin(changeUnits).toFixed(8));
    render();
  }

function xxxxxxxxxxsetSuggestedFeeValue(force) {
  const coin = getCoin();
  const defaultFeeUnits = coin.coinToUnits(coin.DEFAULT_FEE);
  let suggestedFeeUnits = defaultFeeUnits;

  if (coin.NAME === "digibyte") {
    const opReturnHex = getResolvedOpReturnHexForFee();
    const computedFeeUnits = coin.getRequiredFeeUnits(defaultFeeUnits, {
      opReturnHex: opReturnHex
    });

    if (Number.isFinite(computedFeeUnits) && computedFeeUnits > 0) {
      suggestedFeeUnits = Math.max(defaultFeeUnits, Number(computedFeeUnits));
    }
  }

  const suggestedFeeValue = coin.unitsToCoin(suggestedFeeUnits).toFixed(8);
  const shouldUpdateInput =
    Boolean(force) ||
    elems.feeRvn.value === "" ||
    elems.feeRvn.value === state.lastSuggestedFeeValue;

  state.lastSuggestedFeeValue = suggestedFeeValue;

  if (shouldUpdateInput) {
    elems.feeRvn.value = suggestedFeeValue;
  }
}

function setSuggestedFeeValue(force) {
  const coin = getCoin();
  const defaultFeeUnits = coin.coinToUnits(coin.DEFAULT_FEE);
  const opReturnHex = getResolvedOpReturnHexForFee();
  let suggestedFeeUnits = defaultFeeUnits;

  if (typeof coin.getRequiredFeeUnits === "function") {
    const computedFeeUnits = coin.getRequiredFeeUnits(defaultFeeUnits, {
      opReturnHex: opReturnHex
    });

    if (Number.isFinite(computedFeeUnits) && computedFeeUnits > 0) {
      suggestedFeeUnits = Math.max(defaultFeeUnits, Number(computedFeeUnits));
    }
  }

  const suggestedFeeValue = coin.unitsToCoin(suggestedFeeUnits).toFixed(8);
  const shouldUpdateInput =
    Boolean(force) ||
    elems.feeRvn.value === "" ||
    elems.feeRvn.value === state.lastSuggestedFeeValue;

  state.lastSuggestedFeeValue = suggestedFeeValue;

  if (shouldUpdateInput) {
    elems.feeRvn.value = suggestedFeeValue;
  }
}

function clearOutputs() {
    state.account = null;
    state.utxos = null;
    state.vin = null;
    state.vout = null;
    state.buildPayload = null;
    state.rawHex = "";
    state.decodedUnsigned = null;
    state.signedHex = "";
    state.decodedSigned = null;
    state.sendPayload = null;
    state.sendResult = null;

    setInputValue(elems.senderAddress, "");
    setInputValue(elems.utxoCount, "");
    setInputValue(elems.spendTotalRvn, "");
    setInputValue(elems.changeRvn, "");

    render();
  }

  function renderJsonBlock(elem, value) {
    if (value === null || value === undefined || value === "") {
      elem.textContent = "";
      return;
    }

    elem.innerHTML = formatJsonSyntax(value);
  }

  function renderHexBlock(elem, value) {
    elem.textContent = value || "";
  }

  function render() {
    elems.sendButton.disabled = state.isLoading;
    elems.status.textContent = state.status;
    elems.status.className = state.isError ? "error" : "";

    renderJsonBlock(elems.accountJson, state.account);
    renderJsonBlock(elems.utxoJson, state.utxos);
    renderJsonBlock(elems.vinJson, state.vin);
    renderJsonBlock(elems.voutJson, state.vout);
    renderJsonBlock(elems.buildPayloadJson, state.buildPayload);
    renderHexBlock(elems.rawHex, state.rawHex);
    renderJsonBlock(elems.decodedUnsignedJson, state.decodedUnsigned);
    renderHexBlock(elems.signedHex, state.signedHex);
    renderJsonBlock(elems.decodedSignedJson, state.decodedSigned);
    renderJsonBlock(elems.sendPayloadJson, state.sendPayload);
    renderJsonBlock(elems.sendResultJson, state.sendResult);
  }

  //
  // Validators
  //
  function validateBuildSignSendValues(coin, values) {
    if (!values.senderWif) {
      throw new Error("Sender WIF is required.");
    }

    if (!values.rpcUrl) {
      throw new Error("RPC URL is required.");
    }

    if (coin.REQUIRES_EXPLORER && !values.explorerUrl) {
      throw new Error("Explorer URL is required for " + coin.DISPLAY_NAME + ".");
    }

    if (values.feeUnits <= 0) {
      throw new Error("Fee must be greater than zero.");
    }
  }

  //
  // Flow
  //
//

function extractSuggestedFeeFromErrorMessage(message) {
  const normalizedMessage = String(message || "");
  const match = normalizedMessage.match(/min relay fee not met,\s*(\d+)\s*<\s*(\d+)/i);

  if (!match) {
    return null;
  }

  return Number(match[2]);
}

function setFeeValue(feeValue) {
  elems.feeRvn.value = feeValue;
  elems.feeRvn.dispatchEvent(new Event("input", { bubbles: true }));
  elems.feeRvn.dispatchEvent(new Event("change", { bubbles: true }));
}


  async function buildTransactionContext() {
    const coin = getCoin();
    const values = getFormValues();

    validateBuildSignSendValues(coin, values);

    const client = new CHISEL(values.rpcUrl);
    await client.load();

    const requiredFeeUnits = coin.getRequiredFeeUnits
      ? coin.getRequiredFeeUnits(values.feeUnits, values)
      : values.feeUnits;

    setStatusMessage("Deriving " + coin.TICKER + " account from WIF...", false);
    const account = await coin.wifToAccount(values.senderWif);

    setAccountData({
      currency: coin.NAME,
      ticker: coin.TICKER,
      network: account.network,
      compressed: account.compressed,
      address: account.address,
      compressedAddress: account.compressedAddress,
      uncompressedAddress: account.uncompressedAddress,
      privateKeyHex: account.privateKeyHex
    });

    setStatusMessage("Fetching UTXOs for " + account.address + "...", false);
    const rawUtxos = await coin.getAddressUtxos(client, values, account.address);
    const utxos = rawUtxos.map(CHISEL.normalizeUTXO);
    setUtxoData(utxos);

    if (utxos.length === 0) {
      throw new Error("No UTXOs found for the derived address.");
    }

    const vin = CHISEL.buildVin(utxos);
    setVinData(vin);

    const totalUnits = CHISEL.sumUtxoSatoshis(utxos);
    const changeUnits = totalUnits - requiredFeeUnits;

    if (changeUnits <= 0) {
      throw new Error("Not enough balance to pay the fee.");
    }

    setChangeData(changeUnits);

    const vout = buildSendBackVout(account.address, changeUnits, values.opReturnHex);
    setVoutData(vout);

    setBuildPayloadData({
      method: "createrawtransaction",
      currency: coin.NAME,
      params: [vin, vout],
      requestedFeeUnits: values.feeUnits,
      appliedFeeUnits: requiredFeeUnits
    });

    setStatusMessage("Creating raw transaction...", false);
    const rawHex = await coin.createRawTransaction(client, values, vin, vout);
    setRawHexData(rawHex);

    setStatusMessage("Decoding unsigned raw transaction...", false);
    const decodedUnsigned = await coin.decodeRawTransaction(client, values, rawHex);
    setDecodedUnsignedData(decodedUnsigned);

    return {
      coin,
      values,
      client,
      account,
      utxos,
      vin,
      vout,
      requiredFeeUnits,
      rawHex,
      signedHex: null
    };
  }

  async function signTransactionContext(context) {
    const signingInputs = context.vin.map(function mapSigningInput() {
      return {
        privateKeyHex: context.account.privateKeyHex,
        compressed: context.account.compressed
      };
    });

    setStatusMessage("Signing raw transaction locally...", false);
    const signedHex = await context.coin.signRawTransaction(context.rawHex, signingInputs);
    setSignedHexData(signedHex);

    setStatusMessage("Decoding signed raw transaction...", false);
    const decodedSigned = await context.coin.decodeRawTransaction(context.client, context.values, signedHex);
    setDecodedSignedData(decodedSigned);

    setSendPayloadData({
      method: "sendrawtransaction",
      currency: context.coin.NAME,
      params: [signedHex]
    });

    context.signedHex = signedHex;

    return context;
  }

  async function sendTransactionContext(context) {
    setStatusMessage("Broadcasting signed transaction...", false);
    const sendResult = await context.coin.sendRawTransaction(context.client, context.values, context.signedHex);
    setSendResultData(sendResult);

    return context;
  }

  async function runBuildSignDecodeSend() {
    const context = await buildTransactionContext();
    await signTransactionContext(context);
    await sendTransactionContext(context);
    setStatusMessage(STATUS_DONE, false);

    return context;
  }

  //
  // DOM listeners
  //

async function onClickSendButton() {
  try {
    clearOutputs();
    setLoadingState(true);
    await runBuildSignDecodeSend();
  } catch (error) {
    const errorMessage = error && error.message ? error.message : String(error);
    const requiredFeeUnits = extractSuggestedFeeFromErrorMessage(errorMessage);

    if (requiredFeeUnits !== null) {
      try {
        setFeeUnitsValue(requiredFeeUnits);
        setStatusMessage(
          "Retrying with updated fee: " + getCoin().unitsToCoin(requiredFeeUnits).toFixed(8),
          false
        );

        clearOutputs();
        await runBuildSignDecodeSend();
        return;
      } catch (retryError) {
        console.error(retryError);
        setStatusMessage(retryError.message || String(retryError), true);
        return;
      }
    }

	  //// 
	  //

if (isTooLongMempoolChainError(errorMessage)) {
  setStatusMessage(
    "Broadcast rejected: too many unconfirmed ancestors. Wait for confirmation or use an older confirmed UTXO.",
    true
  );
  return;
}

if (isMempoolConflictChainError(errorMessage)) {
  setStatusMessage(
  "Transaction is still in memory pool. Wait for confirmation or use an older confirmed UTXO.",
     true
  );
return;
}


	  //
	  /////

    console.error(error);
    setStatusMessage(errorMessage, true);
  } finally {
    setLoadingState(false);
  }
}

  function onKeydownSenderWif(event) {
    if (event.key !== ENTER_KEY) {
      return;
    }

    event.preventDefault();
    onClickSendButton();
  }

  function onChangeCurrency() {
    clearOutputs();
    setStatusMessage(STATUS_IDLE, false);
    setCurrencyForm();
  }

function onInputOpReturnAscii() {
  setSuggestedFeeValue();
}

function onInputOpReturnHex() {
  setSuggestedFeeValue();
}


  //
  // Console tools
  //
  function setSenderWifValue(wif) {
    elems.senderWif.value = wif;
    elems.senderWif.dispatchEvent(new Event("input", { bubbles: true }));
    elems.senderWif.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setCurrencyValue(currencyKey) {
    elems.currency.value = currencyKey;
    elems.currency.dispatchEvent(new Event("change", { bubbles: true }));
  }

  window.loadWifAndSend = function loadWifAndSend(wif) {
    if (!wif) {
      throw new Error("WIF is required.");
    }

    setSenderWifValue(wif);
    elems.sendButton.click();
  };

  window.loadCurrencyWifAndSend = function loadCurrencyWifAndSend(currencyKey, wif) {
    if (!currencyKey) {
      throw new Error("Currency key is required.");
    }

    if (!wif) {
      throw new Error("WIF is required.");
    }

    setCurrencyValue(currencyKey);
    setSenderWifValue(wif);
    elems.sendButton.click();
  };

  //
  // Init
  //

function init() {
  try {
    setAppVersion();
    setCurrencyOptions();
    setCurrencyForm();
    setStatusMessage(STATUS_IDLE, false);

    elems.sendButton.onclick = onClickSendButton;
    elems.senderWif.onkeydown = onKeydownSenderWif;
    elems.currency.onchange = onChangeCurrency;
    elems.opReturnAscii.oninput = onInputOpReturnAscii;
    elems.opReturnHex.oninput = onInputOpReturnHex;

    render();
  } catch (error) {
    console.error(error);
    setStatusMessage(error.message || String(error), true);
  }
}

  init();

  window.getCoin = getCoin;
  window.getCoinName = getCoinName;
  window.runBuildSignDecodeSend = runBuildSignDecodeSend;
  window.buildTransactionContext = buildTransactionContext;
  window.signTransactionContext = signTransactionContext;
  window.sendTransactionContext = sendTransactionContext;
})();
