import { ctp500ConnectPrinter, ctp500PreparePrint } from '../../ctp500-print.js?v=20261016-print1';

(function () {
  const STORAGE_KEY = "chisel.keyPrint.records.v1";
  const HANDOFF_KEY = "chisel.keyPrint.handoff.v1";
  const currencySelect = document.getElementById("currencySelect");
  const keyInput = document.getElementById("keyInput");
  const recordLabel = document.getElementById("recordLabel");
  const includePrivate = document.getElementById("includePrivate");
  const includePrivateHex = document.getElementById("includePrivateHex");
  const includePublic = document.getElementById("includePublic");
  const includeManifest = document.getElementById("includeManifest");
  const status = document.getElementById("status");
  const packetOutput = document.getElementById("packetOutput");
  const previewImage = document.getElementById("previewImage");
  const downloadLink = document.getElementById("downloadLink");
  const openLink = document.getElementById("openLink");
  const returnToScanner = document.getElementById("returnToScanner");
  const storedList = document.getElementById("storedList");
  const qrScratch = document.getElementById("qrScratch");

  let currentPacket = null;
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

  function updatePrinterControls() {
    const connected = !!printer?.connected;
    connectBleButton.disabled = busy || !globalThis.isSecureContext || !navigator.bluetooth || (connected && printer.transport === "ble");
    connectSerialButton.disabled = busy || !globalThis.isSecureContext || !navigator.serial || (connected && printer.transport === "serial");
    disconnectPrinterButton.disabled = busy || !printer;
    directPrintButton.disabled = busy || !connected || !preparedJob;
    printerConnection.textContent = connected ? "Connected: " + printer.label + " (" + (printer.transport === "ble" ? "Bluetooth" : "Serial") + ")." : "Printer disconnected.";
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
    preparedJob = null; previewSource = null;
    previewImage.removeAttribute("src");
    downloadLink.removeAttribute("href"); openLink.removeAttribute("href");
    downloadLink.classList.add("hidden"); openLink.classList.add("hidden");
    previewSummary.textContent = "Create a key preview or choose an image.";
    printerStatus.textContent = "";
    updatePrinterControls();
  }

  function showPreview(canvas, source) {
    const job = ctp500PreparePrint(canvas, { mode: printMode.value });
    const dataUrl = job.canvas.toDataURL("image/png");
    preparedJob = job; previewSource = source;
    previewImage.src = dataUrl; downloadLink.href = dataUrl; openLink.href = dataUrl;
    downloadLink.download = source === "key" ? "chisel-key-print.png" : "chisel-image-print.png";
    downloadLink.classList.remove("hidden"); openLink.classList.remove("hidden");
    previewSummary.textContent = "384 × " + job.canvas.height + " dots · " + job.bytes.length.toLocaleString() + " bytes."
      + (job.mode === "fast" ? " BLE estimate: " + Math.ceil(job.bytes.length / 800) + " s at 800 bytes/s; actual speed varies." : "");
    printerStatus.textContent = "Preview ready. Nothing has been printed.";
    updatePrinterControls();
  }

  async function connectPrinter(transport) {
    if (printer) await printer.disconnect();
    printer = null;
    updatePrinterControls();
    const next = await ctp500ConnectPrinter({ transport });
    printer = next;
    printer.device?.addEventListener("gattserverdisconnected", () => {
      if (printer === next) {
        updatePrinterControls();
        if (!busy) printerStatus.textContent = "Bluetooth disconnected. Reconnect before printing.";
      }
    });
    printerStatus.textContent = "Connected. The same connection can be used for repeated prints.";
    updatePrinterControls();
  }

  async function printPreview() {
    if (!printer?.connected || !preparedJob) throw new Error("Connect a printer and create a preview first.");
    const job = preparedJob;
    const started = performance.now();
    let updated = -Infinity;
    printerStatus.textContent = "Sending preview to " + printer.label + "…";
    try {
      const result = await printer.write(job.bytes, (sent, total) => {
        const now = performance.now();
        if (now - updated > 400 || sent === total) {
          printerStatus.textContent = "Sending: " + Math.round(sent / total * 100) + "% · " + sent + "/" + total + " bytes · " + ((now - started) / 1000).toFixed(1) + " s";
          updated = now;
        }
      }, { mode: job.mode });
      const seconds = result.elapsedMs / 1000;
      printerStatus.textContent = "Sent " + result.bytes + " bytes in " + seconds.toFixed(1) + " s (" + Math.round(result.bytes / Math.max(seconds, .001)) + " bytes/s). Check the paper. Ready for another print.";
    } catch (error) {
      printerStatus.textContent = "Print transfer failed after " + (error.transferStats?.bytes || 0) + " bytes. No automatic retry. Restart the printer before trying again. " + error.message;
      try { await printer?.disconnect(); } catch {}
      printer = null;
      throw error;
    }
  }

  connectBleButton.addEventListener("click", () => run(() => connectPrinter("ble")));
  connectSerialButton.addEventListener("click", () => run(() => connectPrinter("serial")));
  disconnectPrinterButton.addEventListener("click", () => run(async () => {
    await printer?.disconnect(); printer = null;
    printerStatus.textContent = "Printer disconnected.";
  }));
  directPrintButton.addEventListener("click", () => run(printPreview));
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
    setStatus("Image preview ready for printing or PNG export.", "ok");
  }));
  window.addEventListener("pagehide", () => { Promise.resolve(printer?.disconnect()).catch(() => {}); });
  if (!globalThis.isSecureContext) printerStatus.textContent = "Use HTTPS or localhost to connect a printer.";
  else if (!navigator.bluetooth && !navigator.serial) printerStatus.textContent = "This browser can export PNGs. Direct printing needs a browser with Web Bluetooth or Web Serial.";
  updatePrinterControls();

  function setStatus(message, className) {
    status.className = className || "";
    status.textContent = message || "";
  }

  function normalizeHex(value) {
    return String(value || "").trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();
  }

  function chunkText(value, size) {
    const text = String(value || "");
    const chunks = [];

    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }

    return chunks.join("\n");
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

    packetOutput.textContent = JSON.stringify(currentPacket, null, 2);
    setStatus("Derived packet for " + currentPacket.displayName + " address " + currentPacket.address + ".", "ok");
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

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const value = String(text || "");
    const hardLines = value.split("\n");
    let cursorY = y;

    hardLines.forEach(function drawHardLine(line) {
      let current = "";

      for (let i = 0; i < line.length; i += 1) {
        const test = current + line[i];
        if (ctx.measureText(test).width > maxWidth && current) {
          ctx.fillText(current, x, cursorY);
          cursorY += lineHeight;
          current = line[i];
        } else {
          current = test;
        }
      }

      ctx.fillText(current, x, cursorY);
      cursorY += lineHeight;
    });

    return cursorY;
  }

  function measureWrappedText(ctx, text, maxWidth, lineHeight) {
    const probe = document.createElement("canvas");
    const probeCtx = probe.getContext("2d");
    probeCtx.font = ctx.font;
    let lines = 0;

    String(text || "").split("\n").forEach(function countHardLine(line) {
      let current = "";

      for (let i = 0; i < line.length; i += 1) {
        const test = current + line[i];
        if (probeCtx.measureText(test).width > maxWidth && current) {
          lines += 1;
          current = line[i];
        } else {
          current = test;
        }
      }
      lines += 1;
    });

    return lines * lineHeight;
  }

  function addSection(sections, title, text, qrText, options) {
    options = options || {};
    sections.push({
      title: title,
      text: String(text || ""),
      qrText: qrText || text,
      secret: !!options.secret,
      foldAfter: !!options.foldAfter
    });
  }

  async function createImage() {
    const packet = currentPacket || await derivePacket();
    const width = 384;
    const margin = 24;
    const qrSize = Math.min(280, width - margin * 2);
    const lineHeight = 18;
    const sections = [];
    const manifest = JSON.stringify({
      schema: packet.schema,
      label: packet.label,
      currency: packet.currency,
      network: packet.network,
      address: packet.address,
      compressed: packet.compressed,
      createdAt: packet.createdAt
    }, null, 2);

    addSection(sections, "CHISEL KEY PACKET", packet.label + "\n" + packet.displayName + " / " + packet.network + "\n" + packet.createdAt, manifest);

    if (includePrivateHex.checked) {
      addSection(
        sections,
        "SECRET: PRIVATE HEX",
        "KEEP COVERED\n" + chunkText(packet.privateKeyHex, 32),
        packet.privateKeyHex,
        { secret: true, foldAfter: !includePrivate.checked }
      );
    }

    if (includePrivate.checked) {
      addSection(
        sections,
        "SECRET: PRIVATE WIF",
        "KEEP COVERED\n" + chunkText(packet.wif, 32),
        packet.wif,
        { secret: true, foldAfter: true }
      );
    }

    if (includePublic.checked) {
      addSection(sections, "ADDRESS", chunkText(packet.address, 32), packet.address);
      addSection(sections, "COMPRESSED PUBLIC KEY", chunkText(packet.compressedPublicKeyHex, 32), packet.compressedPublicKeyHex);
    }

    if (includeManifest.checked) {
      addSection(sections, "PUBLIC MANIFEST", manifest, manifest);
    }

    const measureCanvas = document.createElement("canvas");
    const measureCtx = measureCanvas.getContext("2d");
    measureCtx.font = "16px ui-monospace, Menlo, Consolas, monospace";

    let height = margin;
    sections.forEach(function measureSection(section) {
      measureCtx.font = "bold 20px ui-monospace, Menlo, Consolas, monospace";
      height += measureWrappedText(measureCtx, section.title, width - margin * 2, 24) + 10;
      height += qrSize + 12;
      measureCtx.font = "16px ui-monospace, Menlo, Consolas, monospace";
      height += measureWrappedText(measureCtx, section.text, width - margin * 2, lineHeight);
      height += 24;
      if (section.foldAfter) {
        height += 56;
      }
    });
    height += margin;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    ctx.font = "bold 20px ui-monospace, Menlo, Consolas, monospace";

    let y = margin;
    sections.forEach(function drawSection(section) {
      const sectionTop = y;
      ctx.font = "bold 20px ui-monospace, Menlo, Consolas, monospace";
      const titleHeight = measureWrappedText(ctx, section.title, width - margin * 2, 24);

      if (section.secret) {
        ctx.save();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 7]);
        ctx.strokeRect(8, y - 8, width - 16, titleHeight + 14);
        ctx.restore();
      }

      ctx.font = "bold 20px ui-monospace, Menlo, Consolas, monospace";
      y = wrapCanvasText(ctx, section.title, margin, y, width - margin * 2, 24) + 10;

      const qrCanvas = makeQrCanvas(section.qrText, qrSize);
      ctx.drawImage(qrCanvas, Math.floor((width - qrSize) / 2), y, qrSize, qrSize);
      y += qrSize + 12;

      ctx.font = "16px ui-monospace, Menlo, Consolas, monospace";
      y = wrapCanvasText(ctx, section.text, margin, y, width - margin * 2, lineHeight);
      y += 24;

      if (section.secret) {
        ctx.save();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.strokeRect(8, sectionTop - 10, width - 16, y - sectionTop + 4);
        ctx.restore();
      }

      if (section.foldAfter) {
        ctx.save();
        ctx.setLineDash([12, 8]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(8, y + 10);
        ctx.lineTo(width - 8, y + 10);
        ctx.stroke();
        ctx.restore();

        ctx.font = "bold 15px ui-monospace, Menlo, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.fillText("FOLD HERE TO HIDE SECRET", width / 2, y + 20);
        ctx.fillText("CLIP CLOSED", width / 2, y + 37);
        ctx.textAlign = "left";
        y += 56;
      }
    });

    showPreview(canvas, "key");
    setStatus("Created key preview: " + width + " × " + height + " pixels.", "ok");
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
      storedList.innerHTML = "<p class=\"muted\">No stored key packets.</p>";
      return;
    }

    records.forEach(function renderRecord(record, index) {
      const row = document.createElement("div");
      row.className = "storedRow";

      const title = document.createElement("div");
      title.textContent = record.label + " | " + record.displayName + " | " + record.address;

      const load = document.createElement("button");
      load.type = "button";
      load.textContent = "Load";
      load.addEventListener("click", function loadRecord() {
        clearPreview();
        currentPacket = record;
        currencySelect.value = record.currency;
        recordLabel.value = record.label;
        keyInput.value = record.wif || record.privateKeyHex || "";
        packetOutput.textContent = JSON.stringify(record, null, 2);
        setStatus("Loaded stored packet: " + record.label + ".", "ok");
      });

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
    setStatus("Saved packet to this browser origin.", "ok");
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

    setStatus("Scanner handoff loaded. Preview is ready to print or export. Return to the scanned-key list when finished.", "ok");
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

  document.getElementById("deriveButton").addEventListener("click", () => run(async () => {
    clearPreview(); await derivePacket();
  }));
  document.getElementById("printButton").addEventListener("click", () => run(createImage));
  document.getElementById("saveButton").addEventListener("click", () => run(saveCurrentPacket));
  document.getElementById("clearInputButton").addEventListener("click", () => {
    keyInput.value = ""; packetOutput.textContent = ""; currentPacket = null; clearPreview();
    setStatus("Input cleared.");
  });
  [keyInput, recordLabel].forEach(input => input.addEventListener("input", () => {
    currentPacket = null; packetOutput.textContent = "";
    if (previewSource === "key") clearPreview();
  }));
  [includePrivate, includePrivateHex, includePublic, includeManifest].forEach(input => input.addEventListener("change", () => {
    if (previewSource === "key") clearPreview();
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
    setStatus("Stored packets cleared.");
  });

  currencySelect.addEventListener("change", () => run(async () => {
    if (currentPacket?.privateKeyHex) keyInput.value = currentPacket.privateKeyHex;
    currentPacket = null; packetOutput.textContent = "";
    if (previewSource === "key") clearPreview();
    if (keyInput.value.trim()) await derivePacket();
  }));

  populateCurrencies();
  renderStoredList();
  run(() => loadHandoffIfPresent().then(function onHandoff(loaded) {
    if (!loaded) {
      setStatus("Ready. Paste a WIF or 64-hex private key. Private material prints first so it can be folded over and clipped closed.");
    }
  }).catch(function onHandoffError(error) {
    setStatus("Scanner handoff failed: " + (error.message || String(error)), "bad");
  }));
})();
