(function () {
  //
  // Constants
  //
  const APP_NAME = "chisel";
  const APP_VERSION = "2.7.8";
  const DEFAULT_CURRENCY_KEY = "litecoin";
  const STATUS_IDLE = "Idle";
  const STATUS_DONE = "Transaction sent successfully.";
  const ENTER_KEY = "Enter";
  const MANUAL_DRAFT_STORAGE_KEY = "chisel.manualEtchDraft.v1";

  const LITECOIN_UNSPENDABLE_MODIFIERS = [
    "K", "L", "M", "N", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "a", "b", "c", "d", "e", "f", "g", "h"
  ];
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
    litecoin: {
      key: "litecoin",
      label: "Litecoin",
      aliases: ["litecoin", "Litecoin", "ltc", "LTC"]
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
    ipfsField: document.querySelector("#ipfsField"),
    recipientRows: document.querySelector("#recipientRows"),
    addRecipientButton: document.querySelector("#addRecipientButton"),
    unspendableKind: document.querySelector("#unspendableKind"),
    unspendablePhrase: document.querySelector("#unspendablePhrase"),
    unspendableAmount: document.querySelector("#unspendableAmount"),
    addUnspendableButton: document.querySelector("#addUnspendableButton"),
    spendableAddress: document.querySelector("#spendableAddress"),
    spendableAmount: document.querySelector("#spendableAmount"),
    addSpendableButton: document.querySelector("#addSpendableButton"),
    commonAddressSelect: document.querySelector("#commonAddressSelect"),
    addCommonAddressButton: document.querySelector("#addCommonAddressButton"),
    recipientTotalRvn: document.querySelector("#recipientTotalRvn"),
    recipientTotalLabel: document.querySelector("#recipientTotalLabel"),
    estimatedCostRvn: document.querySelector("#estimatedCostRvn"),
    estimatedCostLabel: document.querySelector("#estimatedCostLabel"),
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
    prepareDraftButton: document.querySelector("#prepareDraftButton"),
    utxoToVinButton: document.querySelector("#utxoToVinButton"),
    createRawButton: document.querySelector("#createRawButton"),
    signRawButton: document.querySelector("#signRawButton"),
    sendRawButton: document.querySelector("#sendRawButton"),
    loadManualFromReviewButton: document.querySelector("#loadManualFromReviewButton"),
    etchFixtureSelect: document.querySelector("#etchFixtureSelect"),
    loadEtchFixtureButton: document.querySelector("#loadEtchFixtureButton"),
    saveManualDraftButton: document.querySelector("#saveManualDraftButton"),
    restoreManualDraftButton: document.querySelector("#restoreManualDraftButton"),
    clearManualDraftButton: document.querySelector("#clearManualDraftButton"),
    exportRpcCommandsButton: document.querySelector("#exportRpcCommandsButton"),
    confirmManualBroadcast: document.querySelector("#confirmManualBroadcast"),
    manualUtxoJson: document.querySelector("#manualUtxoJson"),
    manualVinJson: document.querySelector("#manualVinJson"),
    manualVoutJson: document.querySelector("#manualVoutJson"),
    manualRawHex: document.querySelector("#manualRawHex"),
    manualSignedHex: document.querySelector("#manualSignedHex"),
    manualRpcCommands: document.querySelector("#manualRpcCommands"),
    manualScratchJson: document.querySelector("#manualScratchJson"),
    wifScanButton: document.querySelector("#wifScanButton"),
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
    sendResult: null,
    manualContext: null
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

      case "litecoin":
        if (window.LITECOIN && typeof CHISEL !== "undefined" && typeof CHISEL.getCoin === "function") {
          return CHISEL.getCoin("litecoin");
        }
        break;

      case "litecoinTestnet":
        if (typeof CHISEL !== "undefined" && typeof CHISEL.getCoin === "function") {
          return CHISEL.getCoin("litecoinTestnet");
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


function getRecipientRows() {
  if (!elems.recipientRows) {
    return [];
  }

  return Array.from(elems.recipientRows.querySelectorAll(".recipientRow"));
}

function getRecipientRowValues() {
  return getRecipientRows().map(function mapRecipientRow(row) {
    const addressInput = row.querySelector(".recipientAddress");
    const amountInput = row.querySelector(".recipientAmount");

    return {
      row: row,
      address: addressInput ? addressInput.value.trim() : "",
      amountText: amountInput ? amountInput.value.trim() : "",
      outputType: row.getAttribute("data-output-type") || "standard",
      note: row.getAttribute("data-note") || ""
    };
  });
}

function getRecipientDraftsForFee() {
  return getRecipientRowValues().filter(function filterRecipientDraft(rowValues) {
    return rowValues.address !== "" || rowValues.amountText !== "";
  });
}

function getRecipientDraftCountForFee() {
  return getRecipientDraftsForFee().length;
}

function parseRecipients() {
  const coin = getCoin();
  const seenAddresses = {};

  return getRecipientRowValues()
    .filter(function filterBlankRecipient(rowValues) {
      return rowValues.address !== "" || rowValues.amountText !== "";
    })
    .map(function mapRecipient(rowValues, index) {
      const rowNumber = index + 1;

      if (!rowValues.address) {
        throw new Error("Recipient " + rowNumber + " is missing an address.");
      }

      if (!rowValues.amountText) {
        throw new Error("Recipient " + rowNumber + " is missing an amount.");
      }

      const amountNumber = Number(rowValues.amountText);

      if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
        throw new Error("Recipient " + rowNumber + " amount must be greater than zero.");
      }

      if (seenAddresses[rowValues.address]) {
        throw new Error("Duplicate recipient address: " + rowValues.address);
      }

      seenAddresses[rowValues.address] = true;

      return {
        address: rowValues.address,
        amount: amountNumber,
        amountUnits: coin.coinToUnits(rowValues.amountText),
        outputType: rowValues.outputType,
        note: rowValues.note
      };
    });
}

function getLooseRecipientTotalUnits() {
  const coin = getCoin();

  return getRecipientRowValues().reduce(function reduceRecipientTotal(total, rowValues) {
    const amountNumber = Number(rowValues.amountText);

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return total;
    }

    return total + coin.coinToUnits(rowValues.amountText);
  }, 0);
}

function sumRecipientUnits(recipients) {
  return recipients.reduce(function reduceRecipientUnits(total, recipient) {
    return total + Number(recipient.amountUnits);
  }, 0);
}

function updateRecipientCostPreview() {
  const coin = getCoin();
  const recipientTotalUnits = getLooseRecipientTotalUnits();
  const feeUnits = coin.coinToUnits(elems.feeRvn.value || "0");
  const estimatedCostUnits = recipientTotalUnits + feeUnits;

  if (elems.recipientTotalRvn) {
    elems.recipientTotalRvn.value = coin.unitsToCoin(recipientTotalUnits).toFixed(8);
  }

  if (elems.estimatedCostRvn) {
    elems.estimatedCostRvn.value = coin.unitsToCoin(estimatedCostUnits).toFixed(8);
  }
}

function createRecipientRow(address, amount, options) {
  options = options || {};
  const row = document.createElement("div");
  const addressInput = document.createElement("input");
  const amountInput = document.createElement("input");
  const removeButton = document.createElement("button");

  row.className = options.outputType === "unspendable" ? "recipientRow unspendableRecipient" : "recipientRow";
  row.setAttribute("data-output-type", options.outputType || "standard");
  row.setAttribute("data-note", options.note || "");

  addressInput.className = "recipientAddress";
  addressInput.type = "text";
  addressInput.placeholder = "recipient address";
  addressInput.spellcheck = false;
  addressInput.value = address || "";

  amountInput.className = "recipientAmount";
  amountInput.type = "number";
  amountInput.min = "0";
  amountInput.step = "0.00000001";
  amountInput.placeholder = "amount";
  amountInput.value = amount || "";

  removeButton.className = "removeRecipientButton";
  removeButton.type = "button";
  removeButton.textContent = "X";

  addressInput.oninput = function onRecipientAddressInput() {
    setSuggestedFeeValue();
  };

  amountInput.oninput = function onRecipientAmountInput() {
    setSuggestedFeeValue();
  };

  removeButton.onclick = function onRemoveRecipient() {
    row.remove();
    setSuggestedFeeValue();
  };

  row.append(addressInput, amountInput, removeButton);

  return row;
}

function addRecipientRow(address, amount, options) {
  elems.recipientRows.append(createRecipientRow(address, amount, options));
  setSuggestedFeeValue();
}


function isLitecoinCurrencyKey(currencyKey) {
  return currencyKey === "litecoin" || currencyKey === "litecoinTestnet";
}

function getUnspendableModifierOptions() {
  const currencyKey = getSelectedCurrencyKey() || DEFAULT_CURRENCY_KEY;
  const coin = getCoin();

  // Do not depend only on the coin plugin here. This pulldown is a GUI control,
  // so make Litecoin explicit and deterministic even if a stale coin object or
  // browser cache is in play. The set was discovered by scanning all 58 L?x
  // Base58 second-character candidates.
  if (isLitecoinCurrencyKey(currencyKey)) {
    return LITECOIN_UNSPENDABLE_MODIFIERS.map(function mapLitecoinModifier(modifier) {
      return { value: modifier, label: modifier + " - Litecoin L?x valid" };
    });
  }

  if (coin.UNSPENDABLE_MODIFIERS && coin.UNSPENDABLE_MODIFIERS.length) {
    return coin.UNSPENDABLE_MODIFIERS.map(function mapModifier(modifier) {
      return { value: String(modifier), label: String(modifier) + " - chain-safe modifier" };
    });
  }

  return [
    { value: "A", label: "A - person / name" },
    { value: "B", label: "B - transport / source" },
    { value: "C", label: "C - subject / title" },
    { value: "D", label: "D - IPFS first half" },
    { value: "E", label: "E - IPFS second half" }
  ];
}

function setUnspendableKindOptions() {
  if (!elems.unspendableKind) {
    return;
  }

  const previousValue = elems.unspendableKind.value;
  const options = getUnspendableModifierOptions();
  const preferredValue = options.some(function hasPrevious(option) {
    return option.value === previousValue;
  }) ? previousValue : options[0].value;

  elems.unspendableKind.innerHTML = "";

  options.forEach(function appendUnspendableOption(optionData) {
    const option = document.createElement("option");

    option.value = optionData.value;
    option.textContent = optionData.label;

    elems.unspendableKind.append(option);
  });

  elems.unspendableKind.value = preferredValue;
  elems.unspendableKind.setAttribute("data-currency", getSelectedCurrencyKey() || DEFAULT_CURRENCY_KEY);
}

function getUnspendableFirstCharacter() {
  const coin = getCoin();

  if (coin.NAME === "ravencoin") {
    return "R";
  }

  if (coin.NAME === "digibyte") {
    return "D";
  }

  return String(coin.UNSPENDABLE_PREFIX || "R").charAt(0) || "R";
}

function getDefaultUnspendableAmount() {
  const coin = getCoin();

  if (coin.NAME === "ravencoin") {
    return "0.002";
  }

  if (coin.NAME === "digibyte") {
    return "0.00001";
  }

  return coin.DEFAULT_BURN_AMOUNT || "0.00001";
}

function setDefaultUnspendableAmount(force) {
  if (!elems.unspendableAmount) {
    return;
  }

  if (force || !elems.unspendableAmount.value) {
    elems.unspendableAmount.value = getDefaultUnspendableAmount();
  }
}

async function addUnspendableRecipientFromTool() {
  const second = elems.unspendableKind ? elems.unspendableKind.value : "C";
  const phrase = elems.unspendablePhrase ? elems.unspendablePhrase.value.trim() : "";
  const amount = elems.unspendableAmount ? elems.unspendableAmount.value.trim() : "";
  const prefix = getUnspendableFirstCharacter() + second + "x";
  let address;

  if (!phrase) {
    throw new Error("Unspendable phrase is required.");
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error("Unspendable burn amount must be greater than zero.");
  }

  if (!window.CHISEL_UNSPENDABLE || typeof window.CHISEL_UNSPENDABLE.generate !== "function") {
    throw new Error("chisel.unspendable.js is required before unspendable addresses can be generated.");
  }

  address = await window.CHISEL_UNSPENDABLE.generate(prefix, phrase);
  addRecipientRow(address, amount, {
    outputType: "unspendable",
    note: prefix + " " + phrase
  });
  elems.unspendablePhrase.value = "";
}

function addSpendableRecipientFromTool() {
  const address = elems.spendableAddress ? elems.spendableAddress.value.trim() : "";
  const amount = elems.spendableAmount ? elems.spendableAmount.value.trim() : "";

  if (!address) {
    throw new Error("Spendable recipient address is required.");
  }

  if (!amount || Number(amount) <= 0) {
    throw new Error("Spendable recipient amount must be greater than zero.");
  }

  addRecipientRow(address, amount, {
    outputType: "standard",
    note: "spendable recipient"
  });

  if (elems.spendableAddress) elems.spendableAddress.value = "";
  if (elems.spendableAmount) elems.spendableAmount.value = "";
}

function addCommonAddressFromTool() {
  const select = elems.commonAddressSelect;
  const option = select && select.options ? select.options[select.selectedIndex] : null;
  const address = select ? select.value : "";
  const amount = option ? option.getAttribute("data-amount") || getDefaultUnspendableAmount() : getDefaultUnspendableAmount();

  if (!address) {
    throw new Error("Choose a suggested address first.");
  }

  addRecipientRow(address, amount, {
    outputType: "unspendable",
    note: option ? option.textContent : "suggested address"
  });
}

function clearRecipientRows() {
  elems.recipientRows.innerHTML = "";
  setSuggestedFeeValue();
}

function rejectRecipientsUsingChangeAddress(recipients, changeAddress) {
  recipients.forEach(function rejectMatchingRecipient(recipient) {
    if (recipient.address === changeAddress) {
      throw new Error("Recipient address duplicates the send-back/change address: " + changeAddress);
    }
  });
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

  function resolveIpfsField() {
    const value = elems.ipfsField ? elems.ipfsField.value.trim() : "";

    if (!value) {
      return "";
    }

    if (/\s/.test(value)) {
      throw new Error("IPFS field cannot contain whitespace.");
    }

    return value;
  }

  function getFormValues() {
    const coin = getCoin();
    const recipients = parseRecipients();
    const ipfsField = resolveIpfsField();

    return {
      rpcUrl: elems.rpcUrl.value.trim(),
      explorerUrl: elems.explorerUrl.value.trim(),
      senderWif: elems.senderWif.value.trim(),
      feeUnits: coin.coinToUnits(elems.feeRvn.value),
      opReturnHex: resolveOpReturnHex(),
      ipfsField: ipfsField,
      hasIpfsField: Boolean(ipfsField),
      recipients: recipients,
      extraRecipientCount: recipients.length
    };
  }

  function getTransportValues() {
    const coin = getCoin();

    return {
      rpcUrl: elems.rpcUrl ? elems.rpcUrl.value.trim() : "",
      explorerUrl: elems.explorerUrl ? elems.explorerUrl.value.trim() : "",
      senderWif: elems.senderWif ? elems.senderWif.value.trim() : "",
      feeUnits: coin.coinToUnits(elems.feeRvn && elems.feeRvn.value ? elems.feeRvn.value : "0"),
      opReturnHex: "",
      ipfsField: "",
      hasIpfsField: false,
      recipients: [],
      extraRecipientCount: 0
    };
  }

  function validateTransportValues(coin, values) {
    if (!values.rpcUrl && !coin.USES_THIRD_PARTY_PROVIDERS) {
      throw new Error("RPC URL is required.");
    }

    if (coin.REQUIRES_EXPLORER && !values.explorerUrl) {
      throw new Error("Explorer URL is required for " + coin.DISPLAY_NAME + ".");
    }
  }

  async function makeClientForValues(coin, values) {
    const client = coin.USES_THIRD_PARTY_PROVIDERS ? null : new CHISEL(values.rpcUrl);

    if (client) {
      await client.load();
    }

    return client;
  }

  function parseManualJsonTextarea(elem, label) {
    const text = elem && elem.value ? elem.value.trim() : "";

    if (!text) {
      throw new Error(label + " is empty.");
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(label + " is not valid JSON: " + (error.message || String(error)));
    }
  }

  function getManualHex(elem, label) {
    const text = elem && elem.value ? elem.value.trim() : "";
    const normalized = normalizeHex(text);

    if (!normalized) {
      throw new Error(label + " is empty.");
    }

    if (!isHex(normalized) || normalized.length % 2 !== 0) {
      throw new Error(label + " must be even-length hex.");
    }

    return normalized.toLowerCase();
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

  function buildSendBackVout(address, changeUnits, opReturnHex, ipfsField, recipients) {
    const coin = getCoin();
    const vout = {
      [address]: coin.unitsToCoin(changeUnits)
    };

    recipients.forEach(function appendRecipientVout(recipient) {
      vout[recipient.address] = coin.unitsToCoin(recipient.amountUnits);
    });

    if (opReturnHex) {
      vout.data = opReturnHex;
    }

    if (ipfsField) {
      vout.ipfs = ipfsField;
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
  elems.recipientTotalLabel.textContent = "Recipient total (" + coin.TICKER + ")";
  elems.estimatedCostLabel.textContent = "Recipients + fee (" + coin.TICKER + ")";
  elems.rpcUrlLabel.textContent = coin.USES_THIRD_PARTY_PROVIDERS ? "Provider list" : (coin.REQUIRES_EXPLORER ? "RPC URL" : "RPC / API URL");

 // setInputValue(elems.feeRvn, coin.DEFAULT_FEE || "");
  setSuggestedFeeValue(true);
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

  setUnspendableKindOptions();
  setDefaultUnspendableAmount(true);
  updateRecipientCostPreview();
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
      opReturnHex: opReturnHex,
      extraRecipientCount: getRecipientDraftCountForFee(),
      hasIpfsField: Boolean(elems.ipfsField && elems.ipfsField.value.trim())
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

  updateRecipientCostPreview();
}

function setSuggestedFeeValue(force) {
  const coin = getCoin();
  const defaultFeeUnits = coin.coinToUnits(coin.DEFAULT_FEE);
  const opReturnHex = getResolvedOpReturnHexForFee();
  let suggestedFeeUnits = defaultFeeUnits;

  if (typeof coin.getRequiredFeeUnits === "function") {
    const computedFeeUnits = coin.getRequiredFeeUnits(defaultFeeUnits, {
      opReturnHex: opReturnHex,
      extraRecipientCount: getRecipientDraftCountForFee(),
      hasIpfsField: Boolean(elems.ipfsField && elems.ipfsField.value.trim())
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

  updateRecipientCostPreview();
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
    updateRecipientCostPreview();

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

  function setManualTextareaValue(elem, value) {
    if (!elem) {
      return;
    }

    if (value === null || value === undefined || value === "") {
      elem.value = "";
      return;
    }

    if (typeof value === "string") {
      elem.value = value;
      return;
    }

    elem.value = JSON.stringify(value, null, 2);
  }

  function setManualJsonValue(elem, value) {
    setManualTextareaValue(elem, value);
  }

  function setManualHexValue(elem, value) {
    setManualTextareaValue(elem, value || "");
  }

  function compactJson(value) {
    return JSON.stringify(value === undefined ? null : value);
  }

  function shellSingleQuote(value) {
    return "'" + String(value || "").replace(/'/g, "'\\''") + "'";
  }

  function textAreaValue(elem) {
    return elem && elem.value ? elem.value.trim() : "";
  }

  function getManualWorkspace() {
    return {
      version: APP_VERSION,
      savedAt: new Date().toISOString(),
      currency: elems.currency ? elems.currency.value : "",
      rpcUrl: elems.rpcUrl ? elems.rpcUrl.value : "",
      explorerUrl: elems.explorerUrl ? elems.explorerUrl.value : "",
      fee: elems.feeRvn ? elems.feeRvn.value : "",
      senderWifSaved: false,
      note: "WIF is intentionally not saved in manual Etch drafts.",
      manualUtxoJson: elems.manualUtxoJson ? elems.manualUtxoJson.value : "",
      manualVinJson: elems.manualVinJson ? elems.manualVinJson.value : "",
      manualVoutJson: elems.manualVoutJson ? elems.manualVoutJson.value : "",
      manualRawHex: elems.manualRawHex ? elems.manualRawHex.value : "",
      manualSignedHex: elems.manualSignedHex ? elems.manualSignedHex.value : "",
      manualRpcCommands: elems.manualRpcCommands ? elems.manualRpcCommands.value : "",
      manualScratchJson: elems.manualScratchJson ? elems.manualScratchJson.value : ""
    };
  }

  function setManualWorkspace(workspace) {
    const data = workspace && typeof workspace === "object" ? workspace : {};

    if (data.currency) setCurrencyValue(data.currency);
    if (elems.rpcUrl && data.rpcUrl !== undefined) elems.rpcUrl.value = data.rpcUrl || "";
    if (elems.explorerUrl && data.explorerUrl !== undefined) elems.explorerUrl.value = data.explorerUrl || "";
    if (elems.feeRvn && data.fee !== undefined) elems.feeRvn.value = data.fee || "";
    if (elems.manualUtxoJson) elems.manualUtxoJson.value = data.manualUtxoJson || "";
    if (elems.manualVinJson) elems.manualVinJson.value = data.manualVinJson || "";
    if (elems.manualVoutJson) elems.manualVoutJson.value = data.manualVoutJson || "";
    if (elems.manualRawHex) elems.manualRawHex.value = data.manualRawHex || "";
    if (elems.manualSignedHex) elems.manualSignedHex.value = data.manualSignedHex || "";
    if (elems.manualRpcCommands) elems.manualRpcCommands.value = data.manualRpcCommands || "";
    if (elems.manualScratchJson) elems.manualScratchJson.value = data.manualScratchJson || "";
    if (elems.confirmManualBroadcast) elems.confirmManualBroadcast.checked = false;

    updateRecipientCostPreview();
  }

  function saveManualDraft() {
    const workspace = getManualWorkspace();
    window.localStorage.setItem(MANUAL_DRAFT_STORAGE_KEY, JSON.stringify(workspace));
    setStatusMessage("Saved manual Etch draft to localStorage. WIF was not saved.", false);
  }

  function restoreManualDraft() {
    const text = window.localStorage.getItem(MANUAL_DRAFT_STORAGE_KEY);
    if (!text) throw new Error("No saved manual Etch draft found in localStorage.");
    setManualWorkspace(JSON.parse(text));
    setStatusMessage("Restored manual Etch draft from localStorage. WIF was not restored.", false);
  }

  function clearManualEditors() {
    [
      elems.manualUtxoJson,
      elems.manualVinJson,
      elems.manualVoutJson,
      elems.manualRawHex,
      elems.manualSignedHex,
      elems.manualRpcCommands,
      elems.manualScratchJson
    ].forEach(function clearManualEditor(elem) {
      if (elem) elem.value = "";
    });
    if (elems.confirmManualBroadcast) elems.confirmManualBroadcast.checked = false;
    setStatusMessage("Cleared manual Etch pipeline boxes.", false);
  }

  function validateVinJson(vin) {
    if (!Array.isArray(vin) || vin.length === 0) {
      throw new Error("VIN JSON must be a non-empty array.");
    }

    vin.forEach(function validateVinRow(row, index) {
      if (!row || typeof row !== "object") {
        throw new Error("VIN row " + index + " must be an object.");
      }
      if (!/^[0-9a-f]{64}$/i.test(String(row.txid || ""))) {
        throw new Error("VIN row " + index + " has an invalid txid.");
      }
      if (!Number.isInteger(Number(row.vout)) || Number(row.vout) < 0) {
        throw new Error("VIN row " + index + " has an invalid vout.");
      }
    });
  }

  function validateVoutJson(vout) {
    if (!vout || typeof vout !== "object" || Array.isArray(vout)) {
      throw new Error("VOUT JSON must be an object mapping address/data/ipfs keys to values.");
    }

    const keys = Object.keys(vout);
    if (!keys.length) {
      throw new Error("VOUT JSON must contain at least one output.");
    }

    keys.forEach(function validateVoutKey(key) {
      const value = vout[key];
      if (key === "data") {
        const hex = normalizeHex(String(value || ""));
        if (hex && (!isHex(hex) || hex.length % 2 !== 0)) {
          throw new Error("VOUT data field must be even-length hex.");
        }
        return;
      }
      if (key === "ipfs") {
        if (!String(value || "").trim()) {
          throw new Error("VOUT ipfs field cannot be empty.");
        }
        return;
      }
      if (!String(key || "").trim()) {
        throw new Error("VOUT contains an empty output key.");
      }
      if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
        throw new Error("VOUT amount for " + key + " must be greater than zero.");
      }
    });
  }

  function buildRpcCommandText() {
    let vin = null;
    let vout = null;
    const rawHex = textAreaValue(elems.manualRawHex);
    const signedHex = textAreaValue(elems.manualSignedHex);
    const lines = [];

    if (elems.manualVinJson && elems.manualVinJson.value.trim()) {
      vin = parseManualJsonTextarea(elems.manualVinJson, "VIN JSON");
      validateVinJson(vin);
    }

    if (elems.manualVoutJson && elems.manualVoutJson.value.trim()) {
      vout = parseManualJsonTextarea(elems.manualVoutJson, "VOUT JSON");
      validateVoutJson(vout);
    }

    lines.push("# Chisel Etch manual pipeline");
    lines.push("# Currency: " + getCoin().DISPLAY_NAME);
    lines.push("# WIF is intentionally redacted. Replace <WIF> only in a trusted shell.");

    if (vin && vout) {
      lines.push("createrawtransaction " + shellSingleQuote(compactJson(vin)) + " " + shellSingleQuote(compactJson(vout)));
    } else {
      lines.push("# createrawtransaction requires VIN JSON and VOUT JSON");
    }

    if (rawHex) {
      lines.push("signrawtransactionwithkey " + shellSingleQuote(rawHex) + " '[\"<WIF>\"]'");
    } else {
      lines.push("# signrawtransactionwithkey requires unsigned raw hex");
    }

    if (signedHex) {
      lines.push("sendrawtransaction " + shellSingleQuote(signedHex));
    } else {
      lines.push("# sendrawtransaction requires signed raw hex");
    }

    return lines.join("\n");
  }

  function exportRpcCommandsToManualBox() {
    const text = buildRpcCommandText();
    if (elems.manualRpcCommands) elems.manualRpcCommands.value = text;
    setStatusMessage("Exported RPC-style commands from the current manual Etch boxes.", false);
    return text;
  }

  function populateEtchFixtureSelect() {
    if (!elems.etchFixtureSelect) return;
    const fixtures = window.CHISEL_ETCH_FIXTURES || {};
    Object.keys(fixtures).forEach(function addFixtureOption(key) {
      const fixture = fixtures[key];
      const option = document.createElement("option");
      option.value = key;
      option.textContent = fixture.label || key;
      elems.etchFixtureSelect.appendChild(option);
    });
  }

  function loadSelectedEtchFixture() {
    if (!elems.etchFixtureSelect || !elems.etchFixtureSelect.value) {
      throw new Error("Choose an Etch fixture first.");
    }

    const fixtures = window.CHISEL_ETCH_FIXTURES || {};
    const fixture = fixtures[elems.etchFixtureSelect.value];

    if (!fixture) {
      throw new Error("Unknown Etch fixture: " + elems.etchFixtureSelect.value);
    }

    if (fixture.currency) setCurrencyValue(fixture.currency);
    if (elems.rpcUrl && fixture.rpcUrl !== undefined) elems.rpcUrl.value = fixture.rpcUrl || "";
    if (elems.explorerUrl && fixture.explorerUrl !== undefined) elems.explorerUrl.value = fixture.explorerUrl || "";
    if (elems.feeRvn && fixture.fee !== undefined) elems.feeRvn.value = fixture.fee || "";
    if (elems.senderWif && fixture.senderWif !== undefined) elems.senderWif.value = fixture.senderWif || "";

    setManualJsonValue(elems.manualUtxoJson, fixture.utxos || []);
    setManualJsonValue(elems.manualVinJson, fixture.vin || []);
    setManualJsonValue(elems.manualVoutJson, fixture.vout || {});
    setManualHexValue(elems.manualRawHex, fixture.expectedRawHex || "");
    setManualHexValue(elems.manualSignedHex, fixture.expectedSignedHex || "");
    setManualJsonValue(elems.manualScratchJson, {
      fixture: elems.etchFixtureSelect.value,
      label: fixture.label || "",
      warning: fixture.warning || "",
      expectedRawHex: fixture.expectedRawHex || "",
      expectedSignedHex: fixture.expectedSignedHex || ""
    });
    exportRpcCommandsToManualBox();
    if (elems.confirmManualBroadcast) elems.confirmManualBroadcast.checked = false;
    updateRecipientCostPreview();
    setStatusMessage("Loaded Etch fixture: " + (fixture.label || elems.etchFixtureSelect.value) + ". Broadcast remains locked.", false);
  }

  function render() {
    elems.sendButton.disabled = state.isLoading;
    [
      elems.prepareDraftButton,
      elems.utxoToVinButton,
      elems.createRawButton,
      elems.signRawButton,
      elems.sendRawButton,
      elems.loadManualFromReviewButton,
      elems.loadEtchFixtureButton,
      elems.saveManualDraftButton,
      elems.restoreManualDraftButton,
      elems.clearManualDraftButton,
      elems.exportRpcCommandsButton
    ].forEach(function toggleManualButton(button) {
      if (button) {
        button.disabled = state.isLoading;
      }
    });
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

    if (!values.rpcUrl && !coin.USES_THIRD_PARTY_PROVIDERS) {
      throw new Error("RPC URL is required.");
    }

    if (coin.REQUIRES_EXPLORER && !values.explorerUrl) {
      throw new Error("Explorer URL is required for " + coin.DISPLAY_NAME + ".");
    }

    if (values.ipfsField && !coin.SUPPORTS_IPFS_FIELD) {
      throw new Error("IPFS field is not enabled for " + coin.DISPLAY_NAME + ".");
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

function getMinimumRequiredFeeUnits(coin, values) {
  const defaultFeeUnits = coin.coinToUnits(coin.DEFAULT_FEE);

  if (typeof coin.getRequiredFeeUnits !== "function") {
    return defaultFeeUnits;
  }

  const requiredFeeUnits = coin.getRequiredFeeUnits(defaultFeeUnits, values);

  if (!Number.isFinite(requiredFeeUnits) || requiredFeeUnits <= 0) {
    return defaultFeeUnits;
  }

  return Math.max(defaultFeeUnits, Number(requiredFeeUnits));
}


  async function prepareTransactionDraftFromForm() {
    const coin = getCoin();
    const values = getFormValues();

    validateBuildSignSendValues(coin, values);

    const client = await makeClientForValues(coin, values);
    const minimumRequiredFeeUnits = getMinimumRequiredFeeUnits(coin, values);
    const requiredFeeUnits = Math.max(values.feeUnits, minimumRequiredFeeUnits);

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

    setStatusMessage("Fetching UTXOs for " + account.address + (coin.USES_THIRD_PARTY_PROVIDERS ? " via providers..." : "..."), false);
    const rawUtxos = await coin.getAddressUtxos(client, values, account.address);
    const utxos = rawUtxos.map(CHISEL.normalizeUTXO);
    setUtxoData(utxos);
    rejectRecipientsUsingChangeAddress(values.recipients, account.address);

    if (utxos.length === 0) {
      throw new Error("No UTXOs found for the derived address.");
    }

    const vin = CHISEL.buildVin(utxos);
    setVinData(vin);

    const totalUnits = CHISEL.sumUtxoSatoshis(utxos);
    const recipientTotalUnits = sumRecipientUnits(values.recipients);
    const changeUnits = totalUnits - recipientTotalUnits - requiredFeeUnits;

    if (changeUnits <= 0) {
      throw new Error("Not enough balance to pay the fee.");
    }

    setChangeData(changeUnits);

    const vout = buildSendBackVout(account.address, changeUnits, values.opReturnHex, values.ipfsField, values.recipients);
    setVoutData(vout);

    setBuildPayloadData({
      method: "createrawtransaction",
      currency: coin.NAME,
      params: [vin, vout],
      requestedFeeUnits: values.feeUnits,
      minimumRequiredFeeUnits: minimumRequiredFeeUnits,
      appliedFeeUnits: requiredFeeUnits,
      ipfsField: values.ipfsField,
      hasIpfsField: values.hasIpfsField,
      recipientTotalUnits: recipientTotalUnits,
      recipientTotal: coin.unitsToCoin(recipientTotalUnits),
      recipients: values.recipients
    });

    return {
      coin: coin,
      values: values,
      client: client,
      account: account,
      utxos: utxos,
      vin: vin,
      vout: vout,
      requiredFeeUnits: requiredFeeUnits,
      rawHex: null,
      signedHex: null
    };
  }

  async function createRawFromContext(context) {
    setStatusMessage(context.coin.USES_THIRD_PARTY_PROVIDERS ? "Creating raw transaction locally..." : "Creating raw transaction...", false);
    const rawHex = await context.coin.createRawTransaction(context.client, context.values, context.vin, context.vout);
    setRawHexData(rawHex);

    setStatusMessage(context.coin.USES_THIRD_PARTY_PROVIDERS ? "Decoding unsigned raw transaction locally..." : "Decoding unsigned raw transaction...", false);
    const decodedUnsigned = await context.coin.decodeRawTransaction(context.client, context.values, rawHex);
    setDecodedUnsignedData(decodedUnsigned);

    context.rawHex = rawHex;

    return context;
  }

  async function buildTransactionContext() {
    const context = await prepareTransactionDraftFromForm();
    await createRawFromContext(context);
    return context;
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

    setStatusMessage(context.coin.USES_THIRD_PARTY_PROVIDERS ? "Decoding signed raw transaction locally..." : "Decoding signed raw transaction...", false);
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
    setStatusMessage(context.coin.USES_THIRD_PARTY_PROVIDERS ? "Broadcasting signed transaction through providers..." : "Broadcasting signed transaction...", false);
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

  function loadManualEditorsFromState() {
    setManualJsonValue(elems.manualUtxoJson, state.utxos);
    setManualJsonValue(elems.manualVinJson, state.vin);
    setManualJsonValue(elems.manualVoutJson, state.vout);
    setManualHexValue(elems.manualRawHex, state.rawHex);
    setManualHexValue(elems.manualSignedHex, state.signedHex);
    setManualJsonValue(elems.manualScratchJson, state.buildPayload || state.sendPayload || null);
    try { exportRpcCommandsToManualBox(); } catch (error) {}
  }

  async function prepareManualDraftFromForm() {
    const context = await prepareTransactionDraftFromForm();
    state.manualContext = context;
    loadManualEditorsFromState();
    setStatusMessage("Prepared VIN and VOUT. You can edit the JSON before creating raw hex.", false);
    return context;
  }

  function normalizeManualUtxoPayload(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && Array.isArray(payload.utxos)) {
      return payload.utxos;
    }

    if (payload && Array.isArray(payload.unspent_outputs)) {
      return payload.unspent_outputs;
    }

    if (payload && Array.isArray(payload.vin) && payload.vin.every(function hasTxid(row) { return row && row.txid; })) {
      return payload.vin;
    }

    throw new Error("UTXO JSON must be an array, {utxos:[...]}, {unspent_outputs:[...]}, or a tx-like object with vin.");
  }

  function buildVinFromManualUtxoJson() {
    const payload = parseManualJsonTextarea(elems.manualUtxoJson, "UTXO JSON");
    const utxos = normalizeManualUtxoPayload(payload).map(CHISEL.normalizeUTXO);
    const vin = CHISEL.buildVin(utxos);
    validateVinJson(vin);

    setUtxoData(utxos);
    setVinData(vin);
    setManualJsonValue(elems.manualVinJson, vin);
    try { exportRpcCommandsToManualBox(); } catch (error) {}
    setStatusMessage("Built VIN from pasted UTXO JSON.", false);

    return vin;
  }

  async function createRawFromManualJson() {
    const coin = getCoin();
    const values = getTransportValues();
    validateTransportValues(coin, values);

    const vin = parseManualJsonTextarea(elems.manualVinJson, "VIN JSON");
    const vout = parseManualJsonTextarea(elems.manualVoutJson, "VOUT JSON");
    validateVinJson(vin);
    validateVoutJson(vout);
    const client = await makeClientForValues(coin, values);
    const context = {
      coin: coin,
      values: values,
      client: client,
      account: state.account,
      utxos: state.utxos,
      vin: vin,
      vout: vout,
      rawHex: null,
      signedHex: null
    };

    setVinData(vin);
    setVoutData(vout);
    setBuildPayloadData({
      method: "createrawtransaction",
      currency: coin.NAME,
      source: "manual-json-editor",
      params: [vin, vout]
    });

    await createRawFromContext(context);
    state.manualContext = context;
    setManualHexValue(elems.manualRawHex, context.rawHex);
    exportRpcCommandsToManualBox();
    setStatusMessage("Created unsigned raw transaction from pasted JSON.", false);

    return context;
  }

  async function signRawFromManualHex() {
    const coin = getCoin();
    const values = getTransportValues();
    const rawHex = getManualHex(elems.manualRawHex, "Unsigned raw transaction hex");
    const vin = elems.manualVinJson && elems.manualVinJson.value.trim() ? parseManualJsonTextarea(elems.manualVinJson, "VIN JSON") : state.vin;

    if (!values.senderWif) {
      throw new Error("Sender WIF is required to sign raw hex. It is not required for SEND SIGNED RAW.");
    }

    validateVinJson(vin);

    validateTransportValues(coin, values);
    const client = await makeClientForValues(coin, values);

    setStatusMessage("Deriving signing account from WIF...", false);
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

    const context = {
      coin: coin,
      values: values,
      client: client,
      account: account,
      utxos: state.utxos,
      vin: vin,
      vout: state.vout,
      rawHex: rawHex,
      signedHex: null
    };

    setVinData(vin);
    setRawHexData(rawHex);
    await signTransactionContext(context);
    state.manualContext = context;
    setManualHexValue(elems.manualSignedHex, context.signedHex);
    exportRpcCommandsToManualBox();
    setStatusMessage("Signed raw transaction locally. Review the signed hex before sending.", false);

    return context;
  }

  async function sendSignedRawFromManualHex() {
    if (!elems.confirmManualBroadcast || !elems.confirmManualBroadcast.checked) {
      throw new Error("SEND SIGNED RAW is locked. Check the broadcast confirmation box after inspecting the signed hex.");
    }

    const coin = getCoin();
    const values = getTransportValues();
    validateTransportValues(coin, values);

    const signedHex = getManualHex(elems.manualSignedHex, "Signed raw transaction hex");
    const client = await makeClientForValues(coin, values);
    const context = {
      coin: coin,
      values: values,
      client: client,
      account: state.account,
      utxos: state.utxos,
      vin: state.vin,
      vout: state.vout,
      rawHex: state.rawHex,
      signedHex: signedHex
    };

    setSignedHexData(signedHex);
    setSendPayloadData({
      method: "sendrawtransaction",
      currency: coin.NAME,
      source: "manual-signed-hex-editor",
      params: [signedHex]
    });
    await sendTransactionContext(context);
    state.manualContext = context;
    exportRpcCommandsToManualBox();
    setStatusMessage(STATUS_DONE, false);

    return context;
  }

  async function runManualStep(stepFn) {
    try {
      setLoadingState(true);
      await stepFn();
    } catch (error) {
      console.error(error);
      setStatusMessage(error.message || String(error), true);
    } finally {
      setLoadingState(false);
    }
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

function onInputIpfsField() {
  setSuggestedFeeValue();
}

function onInputFee() {
  updateRecipientCostPreview();
}

function onClickAddRecipientButton() {
  addRecipientRow("", "");
}

function onClickAddSpendableButton() {
  try {
    addSpendableRecipientFromTool();
    setStatusMessage("Spendable output added.", false);
  } catch (error) {
    console.error(error);
    setStatusMessage(error.message || String(error), true);
  }
}

async function onClickAddUnspendableButton() {
  try {
    await addUnspendableRecipientFromTool();
    setStatusMessage("Unspendable burn/index output added.", false);
  } catch (error) {
    console.error(error);
    setStatusMessage(error.message || String(error), true);
  }
}

function onClickAddCommonAddressButton() {
  try {
    addCommonAddressFromTool();
    setStatusMessage("Suggested burn/index output added.", false);
  } catch (error) {
    console.error(error);
    setStatusMessage(error.message || String(error), true);
  }
}



  //
  // GUI mode shell
  //
  const MODE_HINTS = {
    start: "Start mode explains what Chisel proves: browser-local signing, chain-native graph/indexing, and static or local ledger resources.",
    etch: "Etch mode builds UTXO transactions. Use RUN ALL for the old one-pass path or the manual pipeline to stop after each raw-transaction step.",
    review: "Review mode exposes the transaction spine: account, UTXOs, VIN, VOUT, raw hex, signed hex, and broadcast result.",
    portal: "Portal mode is the default Chisel-aware block explorer view over Thunderword indexes and transaction semantics.",
    tools: "Tools mode links to QR/WIF scanning, label generation, legacy decoding, and support utilities without crowding the etcher."
  };

  function normalizeMode(value) {
    if (value === "origin" || value === "start") {
      return "start";
    }

    if (value === "broadcast" || value === "etch") {
      return "etch";
    }

    if (value === "review" || value === "portal" || value === "tools") {
      return value;
    }

    if (value === "decode") {
      return "tools";
    }

    return "portal";
  }

  function setGuiMode(mode) {
    const normalizedMode = normalizeMode(mode);
    const buttons = Array.from(document.querySelectorAll("[data-mode-target]"));
    const modeHint = document.querySelector("#modeHint");

    document.body.dataset.mode = normalizedMode;

    buttons.forEach(function markModeButton(button) {
      button.classList.toggle("active", button.dataset.modeTarget === normalizedMode);
    });

    if (modeHint) {
      modeHint.textContent = MODE_HINTS[normalizedMode] || MODE_HINTS.portal;
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", normalizedMode);
      window.history.replaceState(null, "", url.toString());
    } catch (error) {
      // Non-fatal. Some local/file contexts may not allow URL mutation.
    }
  }

  function bindGuiModeShell() {
    const buttons = Array.from(document.querySelectorAll("[data-mode-target]"));
    let initialMode = "portal";

    try {
      initialMode = new URL(window.location.href).searchParams.get("mode") || "portal";
    } catch (error) {
      initialMode = "portal";
    }

    buttons.forEach(function bindModeButton(button) {
      button.onclick = function onModeButtonClick() {
        setGuiMode(button.dataset.modeTarget);
      };
    });

    setGuiMode(initialMode);
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
    const normalized = String(currencyKey || "").trim();
    const keys = Object.keys(CURRENCY_DEFINITIONS);
    let matchedKey = normalized;
    let i;
    let j;

    for (i = 0; i < keys.length; i += 1) {
      const definition = CURRENCY_DEFINITIONS[keys[i]];

      if (definition.key === normalized || definition.label === normalized) {
        matchedKey = definition.key;
        break;
      }

      for (j = 0; j < definition.aliases.length; j += 1) {
        if (String(definition.aliases[j]).toLowerCase() === normalized.toLowerCase()) {
          matchedKey = definition.key;
          break;
        }
      }

      if (matchedKey === definition.key) {
        break;
      }
    }

    elems.currency.value = matchedKey || DEFAULT_CURRENCY_KEY;
    elems.currency.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function getPendingQrPayload() {
    let raw = "";

    try {
      raw = window.sessionStorage.getItem("chisel.pendingQrScan") || window.localStorage.getItem("chisel.pendingQrScan") || "";
    } catch (error) {
      raw = "";
    }

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function clearPendingQrPayload() {
    try {
      window.sessionStorage.removeItem("chisel.pendingQrScan");
      window.localStorage.removeItem("chisel.pendingQrScan");
    } catch (error) {}
  }

  function loadPendingQrPayload(payload, sourceLabel) {
    if (!payload || !payload.wif) {
      return false;
    }

    if (payload.currency) {
      setCurrencyValue(payload.currency);
    }

    setSenderWifValue(payload.wif);
    clearOutputs();
    setStatusMessage("Loaded scanned WIF from " + (sourceLabel || "QR scanner") + ". Review, then send.", false);

    if (payload.autosend) {
      elems.sendButton.click();
    }

    return true;
  }

  function loadPendingQrPayloadFromStorage() {
    const payload = getPendingQrPayload();

    if (loadPendingQrPayload(payload, "browser storage")) {
      clearPendingQrPayload();
    }
  }

  function handleQrScannerMessage(event) {
    if (event.origin !== window.location.origin) {
      return;
    }

    const data = event.data || {};

    if (data.type !== "chisel.loadWif") {
      return;
    }

    loadPendingQrPayload({
      currency: data.currency,
      wif: data.wif,
      autosend: false
    }, "scanner window");
  }

  function openQrScanner() {
    const url = "qrScan.html?currency=" + encodeURIComponent(elems.currency.value || DEFAULT_CURRENCY_KEY);
    const popup = window.open(url, "chiselQrScan", "width=980,height=860");

    if (!popup) {
      window.location.href = url;
    }
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
    bindGuiModeShell();
    populateEtchFixtureSelect();

    elems.sendButton.onclick = onClickSendButton;
    elems.senderWif.onkeydown = onKeydownSenderWif;
    elems.currency.onchange = onChangeCurrency;
    elems.currency.addEventListener("change", setUnspendableKindOptions);
    elems.opReturnAscii.oninput = onInputOpReturnAscii;
    elems.opReturnHex.oninput = onInputOpReturnHex;
    if (elems.ipfsField) {
      elems.ipfsField.oninput = onInputIpfsField;
    }
    elems.feeRvn.oninput = onInputFee;
    elems.addRecipientButton.onclick = onClickAddRecipientButton;
    if (elems.addSpendableButton) {
      elems.addSpendableButton.onclick = onClickAddSpendableButton;
    }
    if (elems.addUnspendableButton) {
      elems.addUnspendableButton.onclick = onClickAddUnspendableButton;
    }
    if (elems.addCommonAddressButton) {
      elems.addCommonAddressButton.onclick = onClickAddCommonAddressButton;
    }

    if (elems.prepareDraftButton) {
      elems.prepareDraftButton.onclick = function onClickPrepareDraftButton() {
        runManualStep(prepareManualDraftFromForm);
      };
    }

    if (elems.utxoToVinButton) {
      elems.utxoToVinButton.onclick = function onClickUtxoToVinButton() {
        runManualStep(function manualUtxoToVinStep() {
          buildVinFromManualUtxoJson();
          return Promise.resolve();
        });
      };
    }

    if (elems.createRawButton) {
      elems.createRawButton.onclick = function onClickCreateRawButton() {
        runManualStep(createRawFromManualJson);
      };
    }

    if (elems.signRawButton) {
      elems.signRawButton.onclick = function onClickSignRawButton() {
        runManualStep(signRawFromManualHex);
      };
    }

    if (elems.sendRawButton) {
      elems.sendRawButton.onclick = function onClickSendRawButton() {
        runManualStep(sendSignedRawFromManualHex);
      };
    }

    if (elems.loadManualFromReviewButton) {
      elems.loadManualFromReviewButton.onclick = function onClickLoadManualFromReviewButton() {
        loadManualEditorsFromState();
        setStatusMessage("Loaded current review values into the manual pipeline boxes.", false);
      };
    }

    if (elems.loadEtchFixtureButton) {
      elems.loadEtchFixtureButton.onclick = function onClickLoadEtchFixtureButton() {
        runManualStep(function manualLoadFixtureStep() {
          loadSelectedEtchFixture();
          return Promise.resolve();
        });
      };
    }

    if (elems.saveManualDraftButton) {
      elems.saveManualDraftButton.onclick = function onClickSaveManualDraftButton() {
        runManualStep(function manualSaveDraftStep() {
          saveManualDraft();
          return Promise.resolve();
        });
      };
    }

    if (elems.restoreManualDraftButton) {
      elems.restoreManualDraftButton.onclick = function onClickRestoreManualDraftButton() {
        runManualStep(function manualRestoreDraftStep() {
          restoreManualDraft();
          return Promise.resolve();
        });
      };
    }

    if (elems.clearManualDraftButton) {
      elems.clearManualDraftButton.onclick = function onClickClearManualDraftButton() {
        clearManualEditors();
      };
    }

    if (elems.exportRpcCommandsButton) {
      elems.exportRpcCommandsButton.onclick = function onClickExportRpcCommandsButton() {
        runManualStep(function manualExportRpcStep() {
          exportRpcCommandsToManualBox();
          return Promise.resolve();
        });
      };
    }

    if (elems.confirmManualBroadcast) {
      elems.confirmManualBroadcast.onchange = render;
    }

    if (elems.wifScanButton) {
      elems.wifScanButton.onclick = openQrScanner;
    }

    window.addEventListener("message", handleQrScannerMessage);
    loadPendingQrPayloadFromStorage();

    updateRecipientCostPreview();
    render();
  } catch (error) {
    console.error(error);
    setStatusMessage(error.message || String(error), true);
  }
}

  init();

  window.setGuiMode = setGuiMode;
  window.getCoin = getCoin;
  window.getCoinName = getCoinName;
  window.runBuildSignDecodeSend = runBuildSignDecodeSend;
  window.prepareTransactionDraftFromForm = prepareTransactionDraftFromForm;
  window.createRawFromManualJson = createRawFromManualJson;
  window.signRawFromManualHex = signRawFromManualHex;
  window.sendSignedRawFromManualHex = sendSignedRawFromManualHex;
  window.buildVinFromManualUtxoJson = buildVinFromManualUtxoJson;
  window.exportRpcCommandsToManualBox = exportRpcCommandsToManualBox;
  window.loadSelectedEtchFixture = loadSelectedEtchFixture;
  window.saveManualDraft = saveManualDraft;
  window.restoreManualDraft = restoreManualDraft;
  window.addRecipient = addRecipientRow;
  window.addUnspendableRecipientFromTool = addUnspendableRecipientFromTool;
  window.clearRecipients = clearRecipientRows;
  window.buildTransactionContext = buildTransactionContext;
  window.signTransactionContext = signTransactionContext;
  window.sendTransactionContext = sendTransactionContext;
})();
