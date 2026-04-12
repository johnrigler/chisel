(function () {
  //
  // Constants
  //
  const APP_NAME = "chisel";
  const APP_VERSION = "2.1.0";
  const DEFAULT_RPC_URL = "https://rigler.org:8769/";
  const DEFAULT_FEE_RVN = "0.002";
  const SATOSHIS_PER_RVN = 100000000;
  const STATUS_IDLE = "Idle";
  const STATUS_WORKING = "Building, signing, decoding, and sending...";
  const STATUS_DONE = "Transaction sent successfully.";
  const ENTER_KEY = "Enter";

  //
  // Elements
  //
  const elems = {
    senderWif: document.querySelector("#senderWif"),
    feeRvn: document.querySelector("#feeRvn"),
    opReturnAscii: document.querySelector("#opReturnAscii"),
    opReturnHex: document.querySelector("#opReturnHex"),
    rpcUrl: document.querySelector("#rpcUrl"),
    senderAddress: document.querySelector("#senderAddress"),
    utxoCount: document.querySelector("#utxoCount"),
    spendTotalRvn: document.querySelector("#spendTotalRvn"),
    changeRvn: document.querySelector("#changeRvn"),
    sendButton: document.querySelector("#sendButton"),
    status: document.querySelector("#status"),
    version: document.querySelector("#version"),
    accountJson: document.querySelector("#accountJson"),
    utxoJson: document.querySelector("#utxoJson"),
    vinJson: document.querySelector("#vinJson"),
    voutJson: document.querySelector("#voutJson"),
    buildPayloadJson: document.querySelector("#buildPayloadJson"),
    rawHex: document.querySelector("#rawHex"),
    decodedUnsignedJson: document.querySelector("#decodedUnsignedJson"),
    signedHex: document.querySelector("#signedHex"),
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

  function normalizeUTXO(utxo) {
    return {
      txid: utxo.txid,
      vout: utxo.vout !== undefined ? utxo.vout : utxo.outputIndex,
      satoshis: Number(utxo.satoshis)
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

  function rvnToSatoshis(rvn) {
    return Math.round(Number(rvn) * SATOSHIS_PER_RVN);
  }

  function satoshisToRVN(satoshis) {
    return satoshis / SATOSHIS_PER_RVN;
  }

  function formatRvn(value) {
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

  function getFormValues() {
    return {
      rpcUrl: elems.rpcUrl.value.trim(),
      senderWif: elems.senderWif.value.trim(),
      feeSatoshis: rvnToSatoshis(elems.feeRvn.value),
      opReturnHex: resolveOpReturnHex()
    };
  }

  function buildSendBackVout(address, changeSatoshis, opReturnHex) {
    const vout = {
      [address]: satoshisToRVN(changeSatoshis)
    };

    if (opReturnHex) {
      vout.data = opReturnHex;
    }

    return vout;
  }

  //
  // RPC
  //
  async function getRpcClient(rpcUrl) {
    const rvn = new CHISEL(rpcUrl);
    await rvn.load();
    return rvn;
  }

  async function getAddressUtxos(rpcUrl, address) {
    const rvn = await getRpcClient(rpcUrl);
    return rvn.address.getaddressutxos(address);
  }

  async function createRawTransaction(rpcUrl, vin, vout) {
    const rvn = await getRpcClient(rpcUrl);
    return rvn.tx.createrawtransaction(vin, vout);
  }

  async function decodeRawTransaction(rpcUrl, rawHex) {
    const rvn = await getRpcClient(rpcUrl);
    return rvn.tx.decoderawtransaction(rawHex);
  }

  async function sendRawTransaction(rpcUrl, signedHex) {
    const rvn = await getRpcClient(rpcUrl);
    return rvn.tx.sendrawtransaction(signedHex);
  }

  //
  // DOM setters
  //
  function setDefaults() {
    setInputValue(elems.rpcUrl, DEFAULT_RPC_URL);
    setInputValue(elems.feeRvn, DEFAULT_FEE_RVN);
    setInputValue(elems.senderAddress, "");
    setInputValue(elems.utxoCount, "");
    setInputValue(elems.spendTotalRvn, "");
    setInputValue(elems.changeRvn, "");
    setAppVersion();
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
    setInputValue(elems.spendTotalRvn, formatRvn(satoshisToRVN(totalSatoshis)));
    setInputValue(elems.changeRvn, formatRvn(satoshisToRVN(changeSatoshis)));
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
    renderJsonBlock(elems.sendPayloadJson, state.sendPayload);
    renderJsonBlock(elems.sendResultJson, state.sendResult);
  }

  function setAppVersion() {
    elems.version.textContent = APP_NAME + " v" + APP_VERSION;
  }

  //
  // Flow
  //
  async function buildAndSendTransaction() {
    const values = getFormValues();

    if (!values.senderWif) {
      throw new Error("Sender WIF is required.");
    }

    if (!values.rpcUrl) {
      throw new Error("RPC URL is required.");
    }

    if (values.feeSatoshis <= 0) {
      throw new Error("Fee must be greater than zero.");
    }

    const account = await CHISEL.ravencoin.wifToAccount(values.senderWif);
    const senderAddress = account.address;

    const rawUtxos = await getAddressUtxos(values.rpcUrl, account.address);
    const utxos = rawUtxos.map(normalizeUTXO);
    setUtxosJson(utxos);

    if (utxos.length === 0) {
      throw new Error("No UTXOs found for the derived address.");
    }

    const vin = buildVin(utxos);
    setVinJson(vin);

    const totalSatoshis = sumSatoshis(utxos);
    const changeSatoshis = totalSatoshis - values.feeSatoshis;

    if (changeSatoshis <= 0) {
      throw new Error("Not enough balance to pay the fee.");
    }

    setTotals(totalSatoshis, changeSatoshis);

    const vout = buildSendBackVout(account.address, changeSatoshis, values.opReturnHex);
    setVoutJson(vout);

    const buildPayload = {
      method: "createrawtransaction",
      params: [vin, vout]
    };
    setBuildPayloadJson(buildPayload);

    const rawHex = await createRawTransaction(values.rpcUrl, vin, vout);
    setRawHex(rawHex);

    const decodedUnsigned = await decodeRawTransaction(values.rpcUrl, rawHex);
    setDecodedUnsignedJson(decodedUnsigned);
/*
	  //
    const privateKeysHex = vin.map(function mapVinToPrivateKey() {
      return account.privateKeyHex;
    });

    const signedHex = await CHISEL.signRawTransaction(rawHex, privateKeysHex);


	  */

const signingInputs = vin.map(function mapVinToSigningInput() {
  return {
    privateKeyHex: account.privateKeyHex,
    compressed: account.compressed
  };
});

const signedHex = await CHISEL.signRawTransaction(rawHex, signingInputs);

    setSignedHex(signedHex);

    const sendPayload = {
      method: "sendrawtransaction",
      params: [signedHex]
    };
    setSendPayloadJson(sendPayload);

    const sendResult = await sendRawTransaction(values.rpcUrl, signedHex);
    setSendResultJson(sendResult);
  }

  //
  // DOM listeners
  //
  async function onClickSendButton() {
    try {
      clearOutputs();
      setLoading(true);
      setStatus(STATUS_WORKING, false);
      await buildAndSendTransaction();
      setStatus(STATUS_DONE, false);
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

  function addEventListeners() {
    elems.sendButton.onclick = onClickSendButton;
    elems.senderWif.onkeydown = onKeydownSenderWif;
  }

  //
  // Init
  //
  setDefaults();
  addEventListeners();
  console.log(elems);
  render();
})();
