import { createPrintPreview } from '../../ctp500-preview.js?v=20261017-menu1';
import { ctp500ConnectPrinter, ctp500PreparePrint, ctp500BeginPrintSession } from '../../ctp500-print.js?v=20261016-print4';
import { createKeyReceipt } from './key-receipt.js?v=20261016-print4';

(function () {
  const STORAGE_KEY = "chisel.keyPrint.records.v1";
  const HANDOFF_KEY = "chisel.keyPrint.handoff.v1";
  const currencySelect = document.getElementById("currencySelect");
  const keyInput = document.getElementById("keyInput");
  const recordLabel = document.getElementById("recordLabel");
  const status = document.getElementById("status");
  const previewImage = document.getElementById("previewImage");
  const previewWrap = document.getElementById("previewWrap");
  const downloadLink = document.getElementById("downloadLink");
  const openLink = document.getElementById("openLink");
  const returnToScanner = document.getElementById("returnToScanner");
  const storedList = document.getElementById("storedList");
  const qrScratch = document.getElementById("qrScratch");

  let currentPacket = null;
  let previewTurns = 0;
  let scannerReturn = null;
  let printer = null, preparedJob = null, previewSource = null, busy = false;
  const connectBleButton = document.getElementById("connectBleButton");
  const connectSerialButton = document.getElementById("connectSerialButton");
  const disconnectPrinterButton = document.getElementById("disconnectPrinterButton");
  const directPrintButton = document.getElementById("directPrintButton");
  const printerConnection = document.getElementById("printerConnection");
  const printerStatus = document.getElementById("printerStatus");
  const printMode = document.getElementById("printMode");
  const imageFile = document.getElementById("imageFile");
  const previewSummary = document.getElementById("previewSummary");
  const emptySheet = document.getElementById("emptySheet");
  const nextStep = document.getElementById("nextStep");
  const printDetails = document.getElementById("printDetails");
  const printProgress = document.getElementById("printProgress");
  const keyChoice = document.getElementById("keyChoice");
  const imageChoice = document.getElementById("imageChoice");
  const keyFields = document.getElementById("keyFields");
  const imageFields = document.getElementById("imageFields");
  const deriveButton = document.getElementById("deriveButton");
  const saveButton = document.getElementById("saveButton");
  const connectionHelp = document.getElementById("connectionHelp");
  const connectionError = document.getElementById("connectionError");
  let contentMode = "key", printing = false;

  function updatePrinterControls() {
    const connected = !!printer?.connected;
    const canBle = !!(globalThis.isSecureContext && navigator.bluetooth);
    const canSerial = !!(globalThis.isSecureContext && navigator.serial);
    connectBleButton.disabled = busy || !canBle || connected;
    connectSerialButton.disabled = busy || !canSerial || connected;
    connectBleButton.classList.toggle("hidden", !canBle || connected);
    connectSerialButton.classList.toggle("hidden", !canSerial || connected);
    connectSerialButton.classList.toggle("primary", !canBle);
    connectSerialButton.classList.toggle("secondary", canBle);
    connectSerialButton.textContent = canBle ? "Use Serial (Chromebook)" : "Connect printer";
    disconnectPrinterButton.disabled = busy || !printer;
    disconnectPrinterButton.classList.toggle("hidden", !connected);
    directPrintButton.disabled = busy || !connected || !preparedJob;
    directPrintButton.textContent = printing ? "Printing…" : "Print";
    saveButton.disabled = busy || contentMode !== "key" || !currentPacket;
    deriveButton.classList.toggle("next-action", !preparedJob && contentMode === "key");
    connectBleButton.classList.toggle("next-action", !!preparedJob && !connected && canBle);
    connectSerialButton.classList.toggle("next-action", !!preparedJob && !connected && !canBle && canSerial);
    directPrintButton.classList.toggle("next-action", !!preparedJob && connected);
    document.getElementById("contentSection").classList.toggle("current-step", !preparedJob);
    document.getElementById("printerSection").classList.toggle("current-step", !!preparedJob && !connected && (canBle || canSerial));
    document.getElementById("printSection").classList.toggle("current-step", !!preparedJob && (connected || (!canBle && !canSerial)));
    printerConnection.textContent = connected ? "Connected to " + printer.label + "." : "Printer not connected.";
    printerConnection.classList.toggle("ok", connected);
    connectionHelp.textContent = connected ? "You can use this connection for more prints."
      : canBle ? "Choose Teal Printer from the Bluetooth list. You only need to connect once."
      : canSerial ? "Pair the printer in system Bluetooth settings, then choose it here."
      : "This browser can save images. Direct printing requires Bluetooth or Serial support on HTTPS or localhost.";
    nextStep.textContent = printing ? "Keep this page open until the transfer finishes."
      : busy ? "Please wait…"
      : !preparedJob ? "Complete step 1 to continue."
      : connected ? "Ready to print. Keep this page open while printing."
      : canBle || canSerial ? "Connect your printer in step 2, then press Print."
      : "Use Save image, or open this page in a browser that supports direct printing.";
  }

  function goToStep(id) {
    const section = document.getElementById(id);
    const heading = section.querySelector("h2");
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    section.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function continueToPrinter() {
    goToStep(printer?.connected || !(globalThis.isSecureContext && (navigator.bluetooth || navigator.serial)) ? "printSection" : "printerSection");
  }

  function selectContent(mode) {
    if (contentMode === mode) return;
    contentMode = mode;
    keyChoice.setAttribute("aria-pressed", String(mode === "key"));
    imageChoice.setAttribute("aria-pressed", String(mode === "image"));
    keyFields.classList.toggle("hidden", mode !== "key");
    imageFields.classList.toggle("hidden", mode !== "image");
    imageFile.value = "";
    clearPreview();
    setStatus(mode === "key" ? "Paste your private key, then press Continue." : "Choose an image to continue.");
  }

  async function run(action) {
    if (busy) return;
    busy = true;
    document.querySelectorAll("input, select, textarea, button").forEach(node => { node.disabled = true; });
    updatePrinterControls();
    try { return await action(); }
    catch (error) { setStatus(error.message || String(error), "bad"); }
    finally {
      busy = false;
      document.querySelectorAll("input, select, textarea, button").forEach(node => { node.disabled = false; });
      updatePrinterControls();
    }
  }

  function clearPreview() {
    preparedJob = null; previewSource = null; previewTurns = 0;
    document.getElementById("previewActions").classList.add("hidden");
    previewWrap.classList.add("hidden");
    emptySheet.classList.remove("hidden");
    previewImage.removeAttribute("src");
    downloadLink.removeAttribute("href"); openLink.removeAttribute("href");
    downloadLink.classList.add("hidden"); openLink.classList.add("hidden");
    previewSummary.textContent = "Prepare a key receipt or choose an image in step 1.";
    printDetails.textContent = "CTP500 · 384 dots wide.";
    printProgress.classList.add("hidden"); printProgress.value = 0;
    printerStatus.textContent = "";
    updatePrinterControls();
  }

  function showPreview(canvas, source) {
    if (!preparedJob) previewTurns = source === "key" ? 3 : 0;
    const job = ctp500PreparePrint(canvas, { mode: printMode.value });
    const dataUrl = job.canvas.toDataURL("image/png");
    preparedJob = job; previewSource = source;
    downloadLink.href = dataUrl;
    renderPreview();
    document.getElementById("previewActions").classList.remove("hidden");
    previewWrap.classList.remove("hidden");
    emptySheet.classList.add("hidden");
    downloadLink.download = source === "key" ? "chisel-key-print.png" : "chisel-image-print.png";
    downloadLink.classList.remove("hidden"); openLink.classList.remove("hidden");
    previewSummary.textContent = source === "key" ? "Private WIF and receiving address, with a fold line." : "Your image is ready.";
    printDetails.textContent = "384 × " + job.canvas.height + " dots · " + job.bytes.length.toLocaleString() + " bytes."
      + (job.mode === "fast" ? " BLE estimate: " + Math.ceil(job.bytes.length / 800) + " s at 800 bytes/s; actual speed varies." : "");
    printerStatus.textContent = "";
    updatePrinterControls();
  }

  function renderPreview() {
    if (!preparedJob) return;
    const src = createPrintPreview(preparedJob.canvas, previewTurns).toDataURL("image/png");
    previewImage.src = src;
    openLink.href = src;
  }
  document.getElementById("rotatePreview").addEventListener("click", () => {
    if (busy || !preparedJob) return;
    previewTurns = (previewTurns + 1) % 4;
    renderPreview();
  });

  async function connectPrinter(transport) {
    connectionError.textContent = "";
    if (printer) await printer.disconnect();
    printer = null;
    updatePrinterControls();
    let next;
    try { next = await ctp500ConnectPrinter({ transport }); }
    catch (error) {
      connectionError.textContent = "Could not connect: " + (error.message || String(error));
      throw error;
    }
    printer = next;
    printer.device?.addEventListener("gattserverdisconnected", () => {
      if (printer === next) {
        updatePrinterControls();
        if (!busy) printerStatus.textContent = "Bluetooth disconnected. Reconnect before printing.";
      }
    });
    printerStatus.textContent = "";
    updatePrinterControls();
    if (preparedJob) goToStep("printSection");
  }

  async function printCurrentImage() {
    if (!printer?.connected || !preparedJob) throw new Error("Choose what to print and connect a printer first.");
    const job = preparedJob;
    const started = performance.now();
    let updated = -Infinity;
    printing = true;
    const finishSession = ctp500BeginPrintSession();
    printProgress.value = 0; printProgress.classList.remove("hidden");
    printerStatus.textContent = "Sending to " + printer.label + "…";
    updatePrinterControls();
    try {
      const result = await printer.write(job.bytes, (sent, total) => {
        const now = performance.now();
        if (now - updated > 400 || sent === total) {
          printProgress.value = sent / total * 100;
          printerStatus.textContent = "Sending: " + Math.round(sent / total * 100) + "% · " + ((now - started) / 1000).toFixed(1) + " s";
          updated = now;
        }
      }, { mode: job.mode });
      const seconds = result.elapsedMs / 1000;
      printProgress.value = 100;
      printerStatus.textContent = "Sent to printer in " + seconds.toFixed(1) + " s. Check the paper. You can print again.";
    } catch (error) {
      printerStatus.textContent = "Print transfer failed after " + (error.transferStats?.bytes || 0) + " bytes. No automatic retry. Restart the printer before trying again. " + error.message;
      try { await printer?.disconnect(); } catch {}
      printer = null;
      throw error;
    } finally {
      printing = false;
      await finishSession();
    }
  }

  keyChoice.addEventListener("click", () => selectContent("key"));
  imageChoice.addEventListener("click", () => selectContent("image"));
  connectBleButton.addEventListener("click", () => run(() => connectPrinter("ble")));
  connectSerialButton.addEventListener("click", () => run(() => connectPrinter("serial")));
  disconnectPrinterButton.addEventListener("click", () => run(async () => {
    await printer?.disconnect(); printer = null;
    printerStatus.textContent = "Printer disconnected.";
  }));
  directPrintButton.addEventListener("click", () => run(printCurrentImage));
  printMode.addEventListener("change", () => run(() => {
    if (preparedJob) showPreview(preparedJob.canvas, previewSource);
  }));
  imageFile.addEventListener("change", () => run(async () => {
    const file = imageFile.files?.[0];
    if (!file) return;
    clearPreview();
    const bitmap = await createImageBitmap(file);
    try { showPreview(bitmap, "image"); }
    finally { bitmap.close(); }
    setStatus("Image ready.", "ok");
    continueToPrinter();
  }));
  window.addEventListener("pagehide", () => { Promise.resolve(printer?.disconnect()).catch(() => {}); });
  updatePrinterControls();

  function setStatus(message, className) {
    status.className = className || "";
    status.textContent = message || "";
  }

  function normalizeHex(value) {
    return String(value || "").trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();
  }

  function getCoin() {
    return CHISEL.getCoin(currencySelect.value);
  }

  function getWifPrefix(coin) {
    if (typeof coin.WIF_PREFIX === "number") {
      return coin.WIF_PREFIX;
    }

    if (coin.NAME === "litecoin") {
      return 176;
    }

    if (coin.NAME === "litecoinTestnet") {
      return 239;
    }

    return 128;
  }

  async function privateHexToWif(privateKeyHex, coin, compressed) {
    const prefix = getWifPrefix(coin);
    const prefixBytes = new Uint8Array([prefix]);
    const keyBytes = CHISEL.hexToUint8Array(privateKeyHex);
    const flagBytes = compressed ? new Uint8Array([1]) : new Uint8Array([]);

    return CHISEL.base58CheckEncode(CHISEL.concatBytes(prefixBytes, keyBytes, flagBytes));
  }

  async function parseInputToWifAndHex(raw, coin) {
    const text = String(raw || "").trim();
    const possibleHex = normalizeHex(text);

    if (/^[0-9a-f]{64}$/.test(possibleHex)) {
      const wif = await privateHexToWif(possibleHex, coin, true);
      return {
        inputType: "private-hex",
        wif: wif,
        privateKeyHex: possibleHex,
        compressed: true
      };
    }

    const account = await coin.wifToAccount(text);
    return {
      inputType: "wif",
      wif: text,
      privateKeyHex: account.privateKeyHex,
      compressed: account.compressed
    };
  }

  async function derivePacket() {
    const coin = getCoin();

    if (!coin || typeof coin.wifToAccount !== "function") {
      throw new Error("Selected currency does not expose wifToAccount().");
    }

    const parsed = await parseInputToWifAndHex(keyInput.value, coin);
    const account = await coin.wifToAccount(parsed.wif);
    const compressedPublicKeyHex = CHISEL.privateKeyHexToPublicKeyHex(account.privateKeyHex, true);
    const uncompressedPublicKeyHex = CHISEL.privateKeyHexToPublicKeyHex(account.privateKeyHex, false);
    const createdAt = new Date().toISOString();
    const label = String(recordLabel.value || "").trim() || "Chisel key packet";

    currentPacket = {
      schema: "chisel-key-instaprint-v1",
      chiselVersion: "2.6.4",
      createdAt: createdAt,
      label: label,
      currency: coin.NAME,
      displayName: coin.DISPLAY_NAME,
      ticker: coin.TICKER,
      network: account.network || "mainnet",
      inputType: parsed.inputType,
      wif: parsed.wif,
      privateKeyHex: account.privateKeyHex,
      compressed: account.compressed,
      address: account.address,
      compressedAddress: account.compressedAddress,
      uncompressedAddress: account.uncompressedAddress,
      compressedPublicKeyHex: compressedPublicKeyHex,
      uncompressedPublicKeyHex: uncompressedPublicKeyHex,
      warning: "This object contains private key material if wif/privateKeyHex are present."
    };

    setStatus("Key loaded for " + currentPacket.displayName + ".", "ok");
    return currentPacket;
  }

  function makeQrCanvas(text, size) {
    qrScratch.innerHTML = "";
    const qr = new QRCode(qrScratch, {
      text: String(text), width: size, height: size, correctLevel: QRCode.CorrectLevel.M
    });
    // Render whole modules and at least four quiet modules on every side.
    // Do not rescale an antialiased QR from the old 576-dot PNG layout.
    const matrix = qr._oQRCode;
    const count = matrix.getModuleCount();
    const dots = Math.floor(size / (count + 8));
    if (dots < 1) throw new Error("QR content does not fit the printer width.");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000";
    const origin = Math.floor((size - count * dots) / 2);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (matrix.isDark(row, col)) ctx.fillRect(origin + col * dots, origin + row * dots, dots, dots);
      }
    }
    return canvas;
  }

  async function createImage() {
    const packet = currentPacket || await derivePacket();
    const canvas = createKeyReceipt(packet, { makeQrCanvas });
    showPreview(canvas, "key");
    setStatus("Foldable key receipt ready.", "ok");
  }

  function readRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (error) {
      return [];
    }
  }

  function writeRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function renderStoredList() {
    const records = readRecords();
    storedList.innerHTML = "";

    if (!records.length) {
      storedList.innerHTML = "<p class=\"muted\">No saved keys.</p>";
      return;
    }

    records.forEach(function renderRecord(record, index) {
      const row = document.createElement("div");
      row.className = "storedRow";

      const title = document.createElement("div");
      title.textContent = record.label + " | " + record.displayName + " | " + record.address;

      const load = document.createElement("button");
      load.type = "button";
      load.textContent = "Use key";
      load.addEventListener("click", () => run(async () => {
        selectContent("key");
        clearPreview();
        currentPacket = record;
        currencySelect.value = record.currency;
        recordLabel.value = record.label;
        keyInput.value = record.wif || record.privateKeyHex || "";
        await createImage();
        continueToPrinter();
      }));

      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Delete";
      del.addEventListener("click", function deleteRecord() {
        const next = readRecords();
        next.splice(index, 1);
        writeRecords(next);
        renderStoredList();
      });

      row.appendChild(title);
      row.appendChild(load);
      row.appendChild(del);
      storedList.appendChild(row);
    });
  }

  async function saveCurrentPacket() {
    const packet = currentPacket || await derivePacket();
    const records = readRecords();
    records.unshift(packet);
    writeRecords(records.slice(0, 50));
    renderStoredList();
    setStatus("Key saved on this device.", "ok");
  }

  async function loadHandoffIfPresent() {
    let handoff = null;
    try {
      handoff = JSON.parse(localStorage.getItem(HANDOFF_KEY) || "null");
    } catch (error) {
      handoff = null;
    }

    if (!handoff || !handoff.privateKeyHex) {
      return false;
    }

    // One-shot transfer from the scanner. The generated image can still be
    // downloaded or explicitly saved, but the transport record is removed.
    localStorage.removeItem(HANDOFF_KEY);

    if (handoff.returnUrl) {
      scannerReturn = {
        returnUrl:handoff.returnUrl,
        resourcePublicKey:handoff.resourcePublicKey || ""
      };
      returnToScanner.href = handoff.returnUrl;
      returnToScanner.classList.remove("hidden");
    }

    if (handoff.currency && Array.from(currencySelect.options).some(function hasCurrency(option) {
      return option.value === handoff.currency;
    })) {
      currencySelect.value = handoff.currency;
    }

    recordLabel.value = handoff.label || "Chisel scanned key";
    keyInput.value = handoff.privateKeyHex;
    currentPacket = null;

    await derivePacket();
    await createImage();
    if (handoff.resourcePublicKey) {
      try {
        const visits = JSON.parse(sessionStorage.getItem("chisel.broadcast.instaprintVisited.v1") || "{}");
        visits[handoff.resourcePublicKey] = {
          visitedAt:new Date().toISOString(),
          pngReady:true
        };
        sessionStorage.setItem("chisel.broadcast.instaprintVisited.v1",JSON.stringify(visits));
      } catch (error) {}
    }

    setStatus("Scanned key loaded. Your receipt is ready.", "ok");
    continueToPrinter();
    return true;
  }

  function populateCurrencies() {
    const coins = CHISEL.getCoins().filter(function supportsWif(coin) {
      return typeof coin.wifToAccount === "function";
    });

    currencySelect.innerHTML = "";
    coins.forEach(function addOption(coin) {
      const option = document.createElement("option");
      option.value = coin.NAME;
      option.textContent = coin.DISPLAY_NAME + " (" + coin.TICKER + ")";
      currencySelect.appendChild(option);
    });
  }

  deriveButton.addEventListener("click", () => run(async () => {
    clearPreview(); await derivePacket(); await createImage();
    continueToPrinter();
  }));
  saveButton.addEventListener("click", () => run(saveCurrentPacket));
  document.getElementById("clearInputButton").addEventListener("click", () => {
    keyInput.value = ""; currentPacket = null; clearPreview();
    setStatus("Input cleared.");
  });
  [keyInput, recordLabel].forEach(input => input.addEventListener("input", () => {
    currentPacket = null;
    if (previewSource === "key") clearPreview();
    else updatePrinterControls();
  }));

  returnToScanner.addEventListener("click", function onReturnToScanner(event) {
    if (!scannerReturn || !scannerReturn.returnUrl) return;
    event.preventDefault();
    window.location.href = scannerReturn.returnUrl;
  });

  document.getElementById("refreshStoredButton").addEventListener("click", renderStoredList);
  document.getElementById("clearStoredButton").addEventListener("click", function onClearStored() {
    localStorage.removeItem(STORAGE_KEY);
    renderStoredList();
    setStatus("Saved keys cleared.");
  });

  currencySelect.addEventListener("change", () => run(async () => {
    if (currentPacket?.privateKeyHex) keyInput.value = currentPacket.privateKeyHex;
    currentPacket = null;
    if (previewSource === "key") clearPreview();
    if (keyInput.value.trim()) await derivePacket();
  }));

  populateCurrencies();
  renderStoredList();
  run(() => loadHandoffIfPresent().then(function onHandoff(loaded) {
    if (!loaded) {
      setStatus("Paste your private key and press Continue, or choose Image or photo.");
    }
  }).catch(function onHandoffError(error) {
    setStatus("Scanner handoff failed: " + (error.message || String(error)), "bad");
  }));
})();
