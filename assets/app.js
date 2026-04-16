(function () {
  //
  // Constants
  //
  const APP_NAME = "chisel";
  const APP_VERSION = "2.2.7";
  const DEFAULT_CURRENCY = "ravencoin";
  const SATOSHIS_PER_COIN = 100000000;
  const STATUS_IDLE = "Idle";
  const STATUS_DONE = "Transaction sent successfully.";
  const ENTER_KEY = "Enter";
  const REQUEST_TIMEOUT_MS = 20000;
  const JSON_RPC_VERSION = "1.0";
  const MIN_DIGIBYTE_FEE_SATOSHIS = 20000;

  const CURRENCIES = {
    ravencoin: {
      key: "ravencoin",
      name: "Ravencoin",
      ticker: "RVN",
      namespace: "ravencoin",
      defaultRpcUrl: "https://rigler.org:8769/",
      defaultExplorerUrl: "",
      defaultFee: "0.002",
      heroTitle: "One-step Ravencoin send-back + broadcast",
      heroText:
        "Paste one Ravencoin WIF, optionally add OP_RETURN data, and broadcast a self-send consolidation transaction. Your private key is only used locally in this session and never sent to the remote API.",
      helpText:
        "Ravencoin uses the RPC/API server directly for UTXOs, create, decode, and send."
    },
    digibyte: {
      key: "digibyte",
      name: "Digibyte",
      ticker: "DGB",
      namespace: "digibyte",
      defaultRpcUrl: "https://secretbeachsolutions.com:8443/",
      defaultExplorerUrl: "https://digiexplorer.info",
      defaultFee: "0.0002",
      heroTitle: "One-step Digibyte send-back + broadcast",
      heroText:
        "Paste one Digibyte WIF, optionally add OP_RETURN data, and broadcast a self-send consolidation transaction. Your private key is only used locally in this session and never sent to the remote API.",
      helpText:
        "Digibyte uses the explorer transaction-history endpoint to derive spendable UTXOs locally, then uses the RPC server for create, decode, and send."
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
    status: STATUS_IDLE,
    error: false,
    account: null,
    utxos: null,
    vin: null,
    vout: null,
    buildPayload: null,
    rawHex: "",
    decodedUnsigned: null,
    signedHex: "",
    decodedSigned: null,
    sendPayload: null,
    sendResult: null,
    spendTotalSatoshis: 0,
    changeSatoshis: 0
  };

  //
  // Helpers
  //
  function setInputValue(elem, value) {
    elem.value = value;
  }

  function hide(elem) {
    elem.classList.add("hide");
  }

  function show(elem) {
    elem.classList.remove("hide");
  }

  function getCurrencyKey() {
    return elems.currency.value;
  }

  function isRavencoinCurrency() {
    return getCurrencyKey() === "ravencoin";
  }

  function isDigibyteCurrency() {
    return getCurrencyKey() === "digibyte";
  }

  function getCurrencyConfig() {
    const currencyKey = getCurrencyKey();
    const currency = CURRENCIES[currencyKey];

    if (!currency) {
      throw new Error("Unsupported currency selected.");
    }

    return currency;
  }

  function getCurrencyPlugin() {
    const namespace = getCurrencyConfig().namespace;
    const plugin = CHISEL[namespace];

    if (!plugin) {
      throw new Error("Currency plugin is not installed: " + namespace);
    }

    return plugin;
  }

  async function getAccountFromWif(wif) {
    const plugin = getCurrencyPlugin();

    if (!plugin.wifToAccount) {
      throw new Error("wifToAccount() is not available for " + getCurrencyConfig().name + ".");
    }

    return plugin.wifToAccount(wif);
  }

  function normalizeUTXO(utxo) {
    return {
      txid: utxo.txid,
      vout: utxo.vout !== undefined ? utxo.vout : utxo.outputIndex,
      satoshis: Number(utxo.satoshis),
      scriptPubKey: utxo.scriptPubKey || utxo.scriptpubkey || "",
      address: utxo.address || ""
    };
  }

  function buildVin(utxos) {
    return utxos.map(function mapUTXOToVin(utxo) {
      return {
        txid: utxo.txid,
        vout: utxo.vout
      };
    });
  }

  function sumSatoshis(utxos) {
    return utxos.reduce(function reduceSatoshis(total, utxo) {
      return total + Number(utxo.satoshis);
    }, 0);
  }

  function coinToSatoshis(amount) {
    return Math.round(Number(amount) * SATOSHIS_PER_COIN);
  }

  function satoshisToCoin(satoshis) {
    return satoshis / SATOSHIS_PER_COIN;
  }

  function formatCoin(value) {
    return Number(value).toFixed(8);
  }

  function stringToHex(string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(string);

    return Array.from(bytes, function mapByteToHex(byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  function normalizeHex(hex) {
    return hex.trim().replace(/^0x/i, "").replace(/\s+/g, "");
  }

  function isHex(value) {
    return /^[0-9a-fA-F]*$/.test(value);
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

  function escapeHtml(string) {
    return String(string)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatJsonSyntax(value) {
    const json = JSON.stringify(value, null, 2);

    return escapeHtml(json).replace(
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
    ).replace(/([{}\[\],:])/g, '<span class="json-punctuation">$1</span>');
  }

  function withTimeout(promise, label) {
    return Promise.race([
      promise,
      new Promise(function onTimeout(_, reject) {
        window.setTimeout(function rejectTimeout() {
          reject(new Error(label + " timed out after " + REQUEST_TIMEOUT_MS + "ms."));
        }, REQUEST_TIMEOUT_MS);
      })
    ]);
  }

  function getFormValues() {
    return {
      currency: getCurrencyKey(),
      rpcUrl: elems.rpcUrl.value.trim(),
      explorerUrl: elems.explorerUrl.value.trim(),
      senderWif: elems.senderWif.value.trim(),
      feeSatoshis: coinToSatoshis(elems.feeRvn.value),
      opReturnHex: resolveOpReturnHex()
    };
  }

  function getRequiredFeeSatoshis(feeSatoshis) {
    if (!isDigibyteCurrency()) {
      return feeSatoshis;
    }

    return Math.max(feeSatoshis, MIN_DIGIBYTE_FEE_SATOSHIS);
  }

  function buildSendBackVout(address, changeSatoshis, opReturnHex) {
    const vout = {
      [address]: satoshisToCoin(changeSatoshis)
    };

    if (opReturnHex) {
      vout.data = opReturnHex;
    }

    return vout;
  }

  function getJsonRpcRequestId(method) {
    return APP_NAME + "-" + method + "-" + Date.now();
  }

  async function callJsonRpcMethod(rpcUrl, method, params) {
    const response = await withTimeout(
      fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: JSON_RPC_VERSION,
          id: getJsonRpcRequestId(method),
          method: method,
          params: params
        })
      }),
      method
    );

    let data = null;
    let text = "";

    try {
      data = await response.json();
    } catch (jsonError) {
      try {
        text = await response.text();
      } catch (textError) {
        text = "";
      }
    }

    if (data && data.error) {
      const errorCode = data.error.code !== undefined ? " (" + data.error.code + ")" : "";
      const errorMessage = data.error.message || JSON.stringify(data.error);
      throw new Error(method + errorCode + ": " + errorMessage);
    }

    if (!response.ok) {
      if (text) {
        throw new Error(method + " failed with HTTP " + response.status + ": " + text);
      }

      throw new Error(method + " failed with HTTP " + response.status + ".");
    }

    if (!data) {
      throw new Error(method + " returned an unreadable response.");
    }

    return data.result;
  }

  //
  // RPC
  //
  async function getRpcClient(rpcUrl) {
    const client = new CHISEL(rpcUrl);
    await withTimeout(client.load(), "RPC client load");
    return client;
  }

  async function getRavencoinAddressUtxos(rpcUrl, address) {
    const client = await getRpcClient(rpcUrl);

    if (!client.address || !client.address.getaddressutxos) {
      throw new Error("This Ravencoin RPC server does not support address.getaddressutxos().");
    }

    return withTimeout(client.address.getaddressutxos(address), "getaddressutxos");
  }

  async function fetchDigibyteAddressTransactions(explorerUrl, address) {
    const url = CHISEL.digibyte.buildExplorerAddressTxsUrl(explorerUrl, address);
    const response = await withTimeout(fetch(url), "Digibyte address tx fetch");

    if (!response.ok) {
      throw new Error("Digibyte explorer request failed with HTTP " + response.status + ".");
    }

    return response.json();
  }

  async function getAddressUtxos(values, address) {
    if (isDigibyteCurrency()) {
      const transactions = await fetchDigibyteAddressTransactions(values.explorerUrl, address);

      if (!Array.isArray(transactions)) {
        throw new Error("Digibyte explorer returned an unexpected response.");
      }

      return CHISEL.digibyte.deriveAddressUtxosFromTransactions(transactions, address);
    }

    return getRavencoinAddressUtxos(values.rpcUrl, address);
  }

  async function createRawTransaction(rpcUrl, vin, vout) {
    if (isDigibyteCurrency()) {
      return callJsonRpcMethod(rpcUrl, "createrawtransaction", [vin, vout]);
    }

    const client = await getRpcClient(rpcUrl);

    if (!client.tx || !client.tx.createrawtransaction) {
      throw new Error("This RPC server does not support tx.createrawtransaction().");
    }

    return withTimeout(client.tx.createrawtransaction(vin, vout), "createrawtransaction");
  }

  async function decodeRawTransaction(rpcUrl, rawHex) {
    if (isDigibyteCurrency()) {
      return callJsonRpcMethod(rpcUrl, "decoderawtransaction", [rawHex]);
    }

    const client = await getRpcClient(rpcUrl);

    if (!client.tx || !client.tx.decoderawtransaction) {
      throw new Error("This RPC server does not support tx.decoderawtransaction().");
    }

    return withTimeout(client.tx.decoderawtransaction(rawHex), "decoderawtransaction");
  }

  async function sendRawTransaction(rpcUrl, signedHex) {
    if (isDigibyteCurrency()) {
      return callJsonRpcMethod(rpcUrl, "sendrawtransaction", [signedHex]);
    }

    const client = await getRpcClient(rpcUrl);

    if (!client.tx || !client.tx.sendrawtransaction) {
      throw new Error("This RPC server does not support tx.sendrawtransaction().");
    }

    return withTimeout(client.tx.sendrawtransaction(signedHex), "sendrawtransaction");
  }

  //
  // DOM setters
  //
  function setAppVersion() {
    elems.version.textContent = APP_NAME + " v" + APP_VERSION;
  }

  function setCurrencyText() {
    const currency = getCurrencyConfig();
    const ticker = currency.ticker;

    elems.heroTitle.textContent = currency.heroTitle;
    elems.heroText.textContent = currency.heroText;
    elems.currencyHelp.textContent = currency.helpText;
    elems.feeLabel.textContent = "Fee (" + ticker + ")";
    elems.spendTotalLabel.textContent = "Spend total (" + ticker + ")";
    elems.changeLabel.textContent = "Send-back amount (" + ticker + ")";

    if (isDigibyteCurrency()) {
      elems.currencyHelp.textContent =
        currency.helpText + " Minimum enforced fee floor: " + formatCoin(satoshisToCoin(MIN_DIGIBYTE_FEE_SATOSHIS)) + " " + ticker + ".";
    }
  }

  function setCurrencyUrls() {
    const currency = getCurrencyConfig();

    if (isDigibyteCurrency()) {
      elems.rpcUrlLabel.textContent = "RPC URL";
      show(elems.explorerUrl);
      show(elems.explorerUrlLabel);
      setInputValue(elems.rpcUrl, currency.defaultRpcUrl);
      setInputValue(elems.explorerUrl, currency.defaultExplorerUrl);
      return;
    }

    elems.rpcUrlLabel.textContent = "RPC / API URL";
    hide(elems.explorerUrl);
    hide(elems.explorerUrlLabel);
    setInputValue(elems.rpcUrl, currency.defaultRpcUrl);
    setInputValue(elems.explorerUrl, currency.defaultExplorerUrl);
  }

  function setDefaults() {
    setInputValue(elems.currency, DEFAULT_CURRENCY);
    setInputValue(elems.senderAddress, "");
    setInputValue(elems.utxoCount, "");
    setInputValue(elems.spendTotalRvn, "");
    setInputValue(elems.changeRvn, "");
    setAppVersion();
    setCurrencyText();
    setCurrencyUrls();
    setInputValue(elems.feeRvn, CURRENCIES[DEFAULT_CURRENCY].defaultFee);
    render();
  }

  function setLoading(isLoading) {
    state.isLoading = isLoading;
    render();
  }

  function setStatus(status, error) {
    state.status = status;
    state.error = Boolean(error);
    render();
  }

  function setAccountJson(account) {
    state.account = account;
    setInputValue(elems.senderAddress, account.address);
    render();
  }

  function setUtxosJson(utxos) {
    state.utxos = utxos;
    setInputValue(elems.utxoCount, String(utxos.length));
    render();
  }

  function setVinJson(vin) {
    state.vin = vin;
    render();
  }

  function setVoutJson(vout) {
    state.vout = vout;
    render();
  }

  function setBuildPayloadJson(payload) {
    state.buildPayload = payload;
    render();
  }

  function setRawHex(rawHex) {
    state.rawHex = rawHex;
    render();
  }

  function setDecodedUnsignedJson(decoded) {
    state.decodedUnsigned = decoded;
    render();
  }

  function setSignedHex(signedHex) {
    state.signedHex = signedHex;
    render();
  }

  function setDecodedSignedJson(decoded) {
    state.decodedSigned = decoded;
    render();
  }

  function setSendPayloadJson(payload) {
    state.sendPayload = payload;
    render();
  }

  function setSendResultJson(result) {
    state.sendResult = result;
    render();
  }

  function setTotals(totalSatoshis, changeSatoshis) {
    state.spendTotalSatoshis = totalSatoshis;
    state.changeSatoshis = changeSatoshis;
    setInputValue(elems.spendTotalRvn, formatCoin(satoshisToCoin(totalSatoshis)));
    setInputValue(elems.changeRvn, formatCoin(satoshisToCoin(changeSatoshis)));
    render();
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
    state.spendTotalSatoshis = 0;
    state.changeSatoshis = 0;

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
    elems.status.className = state.error ? "error" : "";

    renderJsonBlock(elems.accountJson, state.account);
    renderJsonBlock(elems.utxoJson, state.utxos);
    renderJsonBlock(elems.vinJson, state.vin);
    renderJsonBlock(elems.voutJson, state.vout);
    renderJsonBlock(elems.buildPayloadJson, state.buildPayload);
    renderHexBlock(elems.rawHex, state.rawHex);
    renderJsonBlock(elems.decodedUnsignedJson, state.decodedUnsigned);
    renderHexBlock(elems.signedHex, state.signedHex);

    if (elems.decodedSignedJson) {
      renderJsonBlock(elems.decodedSignedJson, state.decodedSigned);
    }

    renderJsonBlock(elems.sendPayloadJson, state.sendPayload);
    renderJsonBlock(elems.sendResultJson, state.sendResult);
  }

  //
  // Flow
  //
  async function buildAndSendTransaction() {
    const values = getFormValues();
    const currency = getCurrencyConfig();
    const requiredFeeSatoshis = getRequiredFeeSatoshis(values.feeSatoshis);

    if (!values.senderWif) {
      throw new Error("Sender WIF is required.");
    }

    if (!values.rpcUrl) {
      throw new Error("RPC URL is required.");
    }

    if (isDigibyteCurrency() && !values.explorerUrl) {
      throw new Error("Explorer URL is required for Digibyte.");
    }

    if (values.feeSatoshis <= 0) {
      throw new Error("Fee must be greater than zero.");
    }

    if (requiredFeeSatoshis !== values.feeSatoshis) {
      setStatus(
        "Adjusted " + currency.ticker + " fee to minimum relay floor of " +
          formatCoin(satoshisToCoin(requiredFeeSatoshis)) + " " + currency.ticker + "...",
        false
      );
    }

    setStatus("Deriving " + currency.ticker + " account from WIF...", false);
    const account = await getAccountFromWif(values.senderWif);

    setAccountJson({
      currency: currency.key,
      ticker: currency.ticker,
      network: account.network,
      compressed: account.compressed,
      address: account.address,
      compressedAddress: account.compressedAddress,
      uncompressedAddress: account.uncompressedAddress,
      privateKeyHex: account.privateKeyHex
    });

    setStatus("Fetching UTXOs for " + account.address + "...", false);
    const rawUtxos = await getAddressUtxos(values, account.address);
    const utxos = rawUtxos.map(normalizeUTXO);
    setUtxosJson(utxos);

    if (utxos.length === 0) {
      throw new Error("No UTXOs found for the derived address.");
    }

    const vin = buildVin(utxos);
    setVinJson(vin);

    const totalSatoshis = sumSatoshis(utxos);
    const changeSatoshis = totalSatoshis - requiredFeeSatoshis;

    if (changeSatoshis <= 0) {
      throw new Error("Not enough balance to pay the fee.");
    }

    setTotals(totalSatoshis, changeSatoshis);

    const vout = buildSendBackVout(account.address, changeSatoshis, values.opReturnHex);
    setVoutJson(vout);

    const buildPayload = {
      method: "createrawtransaction",
      currency: currency.key,
      params: [vin, vout],
      requestedFeeSatoshis: values.feeSatoshis,
      appliedFeeSatoshis: requiredFeeSatoshis
    };
    setBuildPayloadJson(buildPayload);

    setStatus("Creating raw transaction...", false);
    const rawHex = await createRawTransaction(values.rpcUrl, vin, vout);
    setRawHex(rawHex);

    setStatus("Decoding unsigned raw transaction...", false);
    const decodedUnsigned = await decodeRawTransaction(values.rpcUrl, rawHex);
    setDecodedUnsignedJson(decodedUnsigned);

    const signingInputs = vin.map(function mapVinToSigningInput() {
      return {
        privateKeyHex: account.privateKeyHex,
        compressed: account.compressed
      };
    });

    setStatus("Signing raw transaction locally...", false);
    const signedHex = await CHISEL.signRawTransaction(rawHex, signingInputs);
    setSignedHex(signedHex);

    setStatus("Decoding signed raw transaction...", false);
    const decodedSigned = await decodeRawTransaction(values.rpcUrl, signedHex);
    setDecodedSignedJson(decodedSigned);

    const sendPayload = {
      method: "sendrawtransaction",
      currency: currency.key,
      params: [signedHex]
    };
    setSendPayloadJson(sendPayload);

    setStatus("Broadcasting signed transaction...", false);
    const sendResult = await sendRawTransaction(values.rpcUrl, signedHex);
    setSendResultJson(sendResult);

    setStatus(STATUS_DONE, false);
  }

  //
  // DOM listeners
  //
  async function onClickSendButton() {
    try {
      clearOutputs();
      setLoading(true);
      await buildAndSendTransaction();
    } catch (error) {
      console.error(error);
      setStatus(error.message || String(error), true);
    } finally {
      setLoading(false);
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
    setCurrencyText();
    setCurrencyUrls();
    setInputValue(elems.feeRvn, getCurrencyConfig().defaultFee);
    setStatus(STATUS_IDLE, false);
    render();
  }

  function addEventListeners() {
    elems.sendButton.onclick = onClickSendButton;
    elems.senderWif.onkeydown = onKeydownSenderWif;
    elems.currency.onchange = onChangeCurrency;
  }

  //
  // Init
  //
  setDefaults();
  addEventListeners();
  render();
})();
