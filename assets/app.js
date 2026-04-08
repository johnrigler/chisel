(function () {
  //
  // Constants
  //
  const APP_NAME = "chisel";
  const APP_VERSION = "2.1.0";
  const DEFAULT_RPC_URL = "https://rigler.org:8769/";
  const DEFAULT_ADDRESS = "RM5u7Qbe4sLdUnrgKQLBKvreCMRDb5FySU";
  const DEFAULT_FEE_RVN = "0.0005";
  const DEFAULT_MODE = "rvn";
  const DEFAULT_ASSET_QUANTITY = "1";
  const SATOSHIS_PER_RVN = 100000000;
  const STATUS_IDLE = "Idle";
  const STATUS_LOADING = "Building transaction...";
  const STATUS_LOADING_WIF = "Loading WIF account...";
  const STATUS_LOADING_UTXOS = "Loading UTXOs...";
  const STATUS_DONE = "Transaction built and decoded successfully.";
  const ENTER_KEY = "Enter";

  //
  // Elements
  //
  const elems = {
    rpcUrl: document.querySelector("#rpcUrl"),
    mode: document.querySelector("#mode"),
    senderAddress: document.querySelector("#senderAddress"),
    senderWif: document.querySelector("#senderWif"),
    feeRvn: document.querySelector("#feeRvn"),
    utxoJson: document.querySelector("#utxoJson"),
    opReturnAscii: document.querySelector("#opReturnAscii"),
    opReturnHex: document.querySelector("#opReturnHex"),
    assetName: document.querySelector("#assetName"),
    assetQuantity: document.querySelector("#assetQuantity"),
    assetToAddress: document.querySelector("#assetToAddress"),
    assetChangeAddress: document.querySelector("#assetChangeAddress"),
    assetIpfsHash: document.querySelector("#assetIpfsHash"),
    createAndDecodeButton: document.querySelector("#createAndDecodeButton"),
    status: document.querySelector("#status"),
    vinJson: document.querySelector("#vinJson"),
    voutJson: document.querySelector("#voutJson"),
    rpcPayloadJson: document.querySelector("#rpcPayloadJson"),
    rawHex: document.querySelector("#rawHex"),
    decodedJson: document.querySelector("#decodedJson"),
    version: document.querySelector("#version")
  };

  //
  // State
  //
  const state = {
    isLoading: false,
    status: STATUS_IDLE,
    error: false,
    vinJson: "",
    voutJson: "",
    rpcPayloadJson: "",
    rawHex: "",
    decodedJson: "",
    senderAccount: null
  };

  //
  // Helpers
  //
  function setInputValue(elem, value) {
    if (!elem) {
      return;
    }

    elem.value = value;
  }

  function normalizeUTXO(utxo) {
    return {
      txid: utxo.txid,
      vout: utxo.vout !== undefined ? utxo.vout : utxo.outputIndex,
      satoshis: utxo.satoshis
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
      return total + utxo.satoshis;
    }, 0);
  }

  function rvnToSatoshis(rvn) {
    return Math.round(Number(rvn) * SATOSHIS_PER_RVN);
  }

  function satoshisToRVN(satoshis) {
    return satoshis / SATOSHIS_PER_RVN;
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

  function resolveGenericOpReturnHex() {
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

  function buildRvnVout(address, changeSatoshis, opReturnHex) {
    const vout = {
      [address]: satoshisToRVN(changeSatoshis)
    };

    if (opReturnHex) {
      vout.data = opReturnHex;
    }

    return vout;
  }

  function getFormValues() {
    return {
      rpcUrl: elems.rpcUrl.value.trim(),
      mode: elems.mode.value,
      senderAddress: elems.senderAddress.value.trim(),
      senderWif: elems.senderWif ? elems.senderWif.value.trim() : "",
      feeSatoshis: rvnToSatoshis(elems.feeRvn.value),
      genericOpReturnHex: resolveGenericOpReturnHex(),
      assetName: elems.assetName.value.trim(),
      assetQuantity: elems.assetQuantity.value.trim(),
      assetToAddress: elems.assetToAddress.value.trim(),
      assetChangeAddress: elems.assetChangeAddress.value.trim(),
      assetIpfsHash: elems.assetIpfsHash.value.trim()
    };
  }

  function getRpcClient(rpcUrl) {
    return new CHISEL(rpcUrl);
  }

  //
  // RPC
  //
  async function getAddressUtxos(rpcUrl, address) {
    const rvn = getRpcClient(rpcUrl);
    await rvn.load();
    return rvn.address.getaddressutxos(address);
  }

  async function createRvnRawTransaction(rpcUrl, vin, vout) {
    const rvn = getRpcClient(rpcUrl);
    await rvn.load();
    return rvn.tx.createrawtransaction(vin, vout);
  }

  async function createAssetTransferTransaction(values) {
    const rvn = getRpcClient(values.rpcUrl);
    await rvn.load();

    return rvn.asset.transfer(
      values.assetName,
      Number(values.assetQuantity),
      values.assetToAddress,
      "",
      0,
      values.assetChangeAddress,
      values.assetChangeAddress,
      values.assetIpfsHash
    );
  }

  async function decodeRawTransaction(rpcUrl, rawHex) {
    const rvn = getRpcClient(rpcUrl);
    await rvn.load();
    return rvn.tx.decoderawtransaction(rawHex);
  }

  //
  // DOM setters
  //
  function setDefaultInputs() {
    setInputValue(elems.rpcUrl, DEFAULT_RPC_URL);
    setInputValue(elems.mode, DEFAULT_MODE);
    setInputValue(elems.senderAddress, DEFAULT_ADDRESS);
    setInputValue(elems.senderWif, "");
    setInputValue(elems.feeRvn, DEFAULT_FEE_RVN);
    setInputValue(elems.utxoJson, "Will populate for RVN mode.");
    setInputValue(elems.opReturnAscii, "");
    setInputValue(elems.opReturnHex, "");
    setInputValue(elems.assetName, "");
    setInputValue(elems.assetQuantity, DEFAULT_ASSET_QUANTITY);
    setInputValue(elems.assetToAddress, DEFAULT_ADDRESS);
    setInputValue(elems.assetChangeAddress, DEFAULT_ADDRESS);
    setInputValue(elems.assetIpfsHash, "");
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

  function setVinJson(value) {
    state.vinJson = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    render();
  }

  function setVoutJson(value) {
    state.voutJson = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    render();
  }

  function setRpcPayloadJson(value) {
    state.rpcPayloadJson = JSON.stringify(value, null, 2);
    render();
  }

  function setRawHex(rawHex) {
    state.rawHex = rawHex;
    render();
  }

  function setDecodedJson(decoded) {
    state.decodedJson = JSON.stringify(decoded, null, 2);
    render();
  }

  function setUtxoJson(value) {
    setInputValue(
      elems.utxoJson,
      typeof value === "string" ? value : JSON.stringify(value, null, 2)
    );
  }

  function setSenderAccount(account) {
    state.senderAccount = account;
    setInputValue(elems.senderAddress, account.address);

    if (!elems.assetToAddress.value.trim() || elems.assetToAddress.value === DEFAULT_ADDRESS) {
      setInputValue(elems.assetToAddress, account.address);
    }

    if (!elems.assetChangeAddress.value.trim() || elems.assetChangeAddress.value === DEFAULT_ADDRESS) {
      setInputValue(elems.assetChangeAddress, account.address);
    }

    render();
  }

  function clearSenderAccount() {
    state.senderAccount = null;
    render();
  }

  function clearOutput() {
    state.vinJson = "";
    state.voutJson = "";
    state.rpcPayloadJson = "";
    state.rawHex = "";
    state.decodedJson = "";
    render();
  }

  function render() {
    elems.createAndDecodeButton.disabled = state.isLoading;
    elems.status.textContent = state.status;
    elems.status.className = state.error ? "error" : "";
    elems.vinJson.textContent = state.vinJson;
    elems.voutJson.textContent = state.voutJson;
    elems.rpcPayloadJson.textContent = state.rpcPayloadJson;
    elems.rawHex.textContent = state.rawHex;
    elems.decodedJson.textContent = state.decodedJson;
  }

  function setAppVersion() {
    elems.version.textContent = APP_NAME + " v" + APP_VERSION;
  }

  //
  // Account bootstrap
  //
  async function loadSenderAccountFromWif() {
    const wif = elems.senderWif ? elems.senderWif.value.trim() : "";

    if (!wif) {
      clearSenderAccount();
      return null;
    }

    const account = await CHISEL.wifToRvnAccount(wif);
    setSenderAccount(account);

    return account;
  }

  async function loadSenderUtxos() {
    const values = getFormValues();

    if (!values.senderAddress) {
      setUtxoJson("Will populate for RVN mode.");
      return [];
    }

    const rawUtxos = await getAddressUtxos(values.rpcUrl, values.senderAddress);
    const utxos = rawUtxos.map(normalizeUTXO);

    setUtxoJson(utxos);

    return utxos;
  }

  async function startFromSenderWif() {
    setStatus(STATUS_LOADING_WIF, false);
    await loadSenderAccountFromWif();
    setStatus(STATUS_LOADING_UTXOS, false);
    await loadSenderUtxos();
    setStatus(STATUS_IDLE, false);
  }

  //
  // DOM listeners
  //
  async function onClickCreateAndDecode() {
    try {
      clearOutput();
      setLoading(true);
      setStatus(STATUS_LOADING, false);

      if (elems.senderWif && elems.senderWif.value.trim()) {
        await loadSenderAccountFromWif();
      }

      const values = getFormValues();

      if (values.mode === "rvn") {
        const rawUtxos = await getAddressUtxos(values.rpcUrl, values.senderAddress);
        const utxos = rawUtxos.map(normalizeUTXO);
        const vin = buildVin(utxos);
        const totalSatoshis = sumSatoshis(utxos);
        const changeSatoshis = totalSatoshis - values.feeSatoshis;

        if (changeSatoshis <= 0) {
          throw new Error("Not enough balance to pay the fee.");
        }

        const vout = buildRvnVout(values.senderAddress, changeSatoshis, values.genericOpReturnHex);

        setUtxoJson(utxos);
        setVinJson(vin);
        setVoutJson(vout);
        setRpcPayloadJson({
          method: "createrawtransaction",
          params: [vin, vout]
        });

        const rawHex = await createRvnRawTransaction(values.rpcUrl, vin, vout);
        setRawHex(rawHex);

        const decoded = await decodeRawTransaction(values.rpcUrl, rawHex);
        setDecodedJson(decoded);
      }

      if (values.mode === "asset-transfer") {
        const payload = {
          method: "transfer",
          params: [
            values.assetName,
            Number(values.assetQuantity),
            values.assetToAddress,
            "",
            0,
            values.assetChangeAddress,
            values.assetChangeAddress,
            values.assetIpfsHash
          ]
        };

        setUtxoJson("(asset RPC builds inputs on node side)");
        setVinJson("(built by transfer RPC)");
        setVoutJson("(built by transfer RPC)");
        setRpcPayloadJson(payload);

        const rawHex = await createAssetTransferTransaction(values);
        setRawHex(rawHex);

        const decoded = await decodeRawTransaction(values.rpcUrl, rawHex);
        setDecodedJson(decoded);
      }

      setStatus(STATUS_DONE, false);
    } catch (error) {
      console.error(error);
      setStatus(error.message || String(error), true);
    } finally {
      setLoading(false);
    }
  }

  async function onBlurSenderWif() {
    try {
      if (!elems.senderWif.value.trim()) {
        clearSenderAccount();
        setStatus(STATUS_IDLE, false);
        setUtxoJson("Will populate for RVN mode.");
        return;
      }

      setLoading(true);
      await startFromSenderWif();
    } catch (error) {
      console.error(error);
      clearSenderAccount();
      setStatus(error.message || String(error), true);
    } finally {
      setLoading(false);
    }
  }

  async function onKeydownSenderWif(event) {
    if (event.key !== ENTER_KEY) {
      return;
    }

    event.preventDefault();
    await onBlurSenderWif();
  }

  async function onBlurSenderAddress() {
    try {
      if (!elems.senderAddress.value.trim()) {
        setUtxoJson("Will populate for RVN mode.");
        return;
      }

      setLoading(true);
      setStatus(STATUS_LOADING_UTXOS, false);
      await loadSenderUtxos();
      setStatus(STATUS_IDLE, false);
    } catch (error) {
      console.error(error);
      setStatus(error.message || String(error), true);
    } finally {
      setLoading(false);
    }
  }

  function addEventListeners() {
    elems.createAndDecodeButton.onclick = onClickCreateAndDecode;

    if (elems.senderWif) {
      elems.senderWif.onblur = onBlurSenderWif;
      elems.senderWif.onkeydown = onKeydownSenderWif;
    }

    elems.senderAddress.onblur = onBlurSenderAddress;
  }

  //
  // Init
  //
  setDefaultInputs();
  addEventListeners();
  render();
  setAppVersion();

  window.CHISEL_APP_STATE = state;
})();
