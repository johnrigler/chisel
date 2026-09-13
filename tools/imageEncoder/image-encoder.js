(function () {
  "use strict";

  const STORAGE_KEY = "chisel.pendingPayloadAnalyzer.v1";
  const MAX_RASTER_COLS = 1000;
  const MAX_RASTER_ROWS = 4000;
  const imageApi = window.CHISEL_IMAGE;
  const elements = {
    imageFile: document.getElementById("imageFile"),
    v1Parameters: document.getElementById("v1Parameters"),
    applyV1Parameters: document.getElementById("applyV1Parameters"),
    rasterCols: document.getElementById("rasterCols"),
    rasterRows: document.getElementById("rasterRows"),
    lockRasterAspect: document.getElementById("lockRasterAspect"),
    trimTop: document.getElementById("trimTop"),
    trimBottom: document.getElementById("trimBottom"),
    trimLeft: document.getElementById("trimLeft"),
    trimRight: document.getElementById("trimRight"),
    cropReadout: document.getElementById("cropReadout"),
    matte: document.getElementById("matte"),
    smooth: document.getElementById("smooth"),
    previewScale: document.getElementById("previewScale"),
    opReturnAscii: document.getElementById("opReturnAscii"),
    reloadButton: document.getElementById("reloadButton"),
    loadEtchButton: document.getElementById("loadEtchButton"),
    savePngButton: document.getElementById("savePngButton"),
    copyButton: document.getElementById("copyButton"),
    downloadButton: document.getElementById("downloadButton"),
    status: document.getElementById("status"),
    summary: document.getElementById("summary"),
    sourceCanvas: document.getElementById("sourceCanvas"),
    cropCanvas: document.getElementById("cropCanvas"),
    previewCanvas: document.getElementById("previewCanvas"),
    rowText: document.getElementById("rowText"),
    addressText: document.getElementById("addressText")
  };
  const state = {
    palette: null,
    image: null,
    fileName: "",
    rows: [],
    addresses: [],
    payload: null,
    renderTimer: 0,
    renderToken: 0,
    rasterCols: imageApi ? imageApi.COLUMNS : 26,
    rasterRows: imageApi ? imageApi.COLUMNS : 26
  };

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function readInteger(element, fallback) {
    const value = Number(element && element.value);

    return Number.isFinite(value) ? Math.floor(value) : fallback;
  }

  function writeInteger(element, value) {
    element.value = String(Math.floor(value));
  }

  function setStatus(message, kind) {
    elements.status.textContent = message;
    elements.status.dataset.kind = kind || "";
  }

  function setOutputButtons(enabled) {
    elements.loadEtchButton.disabled = !enabled;
    elements.savePngButton.disabled = !enabled;
    elements.copyButton.disabled = !enabled;
    elements.downloadButton.disabled = !enabled;
  }

  function matteRgb() {
    return elements.matte.value === "white" ? [255, 255, 255] : [0, 0, 0];
  }

  function setCropGeometry(rasterCols, rasterRows, left, top, cropHeight) {
    const cols = clamp(Math.floor(Number(rasterCols) || imageApi.COLUMNS), imageApi.COLUMNS, MAX_RASTER_COLS);
    const rows = clamp(Math.floor(Number(rasterRows) || 1), 1, MAX_RASTER_ROWS);
    const maxLeft = cols - imageApi.COLUMNS;
    const normalizedHeight = clamp(Math.floor(Number(cropHeight) || 1), 1, Math.min(rows, imageApi.MAX_ROWS));
    const normalizedLeft = clamp(Math.floor(Number(left) || 0), 0, maxLeft);
    const normalizedTop = clamp(Math.floor(Number(top) || 0), 0, rows - normalizedHeight);

    state.rasterCols = cols;
    state.rasterRows = rows;
    writeInteger(elements.rasterCols, cols);
    writeInteger(elements.rasterRows, rows);
    writeInteger(elements.trimLeft, normalizedLeft);
    writeInteger(elements.trimRight, maxLeft - normalizedLeft);
    writeInteger(elements.trimTop, normalizedTop);
    writeInteger(elements.trimBottom, rows - normalizedTop - normalizedHeight);
    elements.rasterRows.disabled = elements.lockRasterAspect.checked;

    elements.trimLeft.max = String(maxLeft);
    elements.trimRight.max = String(maxLeft);
    elements.trimTop.max = String(rows - 1);
    elements.trimBottom.max = String(rows - 1);

    updateCropReadout();
  }

  function getCropBounds() {
    return imageApi.cropBounds(state.rasterCols, state.rasterRows, {
      top: readInteger(elements.trimTop, 0),
      bottom: readInteger(elements.trimBottom, 0),
      left: readInteger(elements.trimLeft, 0),
      right: readInteger(elements.trimRight, 0)
    });
  }

  function updateCropReadout() {
    try {
      const crop = getCropBounds();

      elements.cropReadout.textContent =
        "Raster " + crop.rasterWidth + "×" + crop.rasterHeight +
        " · trim T" + crop.margins.top +
        " B" + crop.margins.bottom +
        " L" + crop.margins.left +
        " R" + crop.margins.right +
        " · output 26×" + crop.height +
        " · address 2 + 26 + 6";
    } catch (error) {
      elements.cropReadout.textContent = error.message || String(error);
    }
  }

  function resetCropForImage() {
    const rasterCols = imageApi.COLUMNS;
    const ratio = state.image ? state.image.naturalHeight / state.image.naturalWidth : 1;
    const rasterRows = clamp(Math.round(rasterCols * ratio), 1, MAX_RASTER_ROWS);
    const cropHeight = Math.min(rasterRows, imageApi.MAX_ROWS);
    const top = Math.floor((rasterRows - cropHeight) / 2);

    setCropGeometry(rasterCols, rasterRows, 0, top, cropHeight);
  }

  function changeRasterSize(changedDimension) {
    const oldCrop = getCropBounds();
    const oldCenterX = (oldCrop.x + (oldCrop.width / 2)) / oldCrop.rasterWidth;
    const oldCenterY = (oldCrop.y + (oldCrop.height / 2)) / oldCrop.rasterHeight;
    let rasterCols = clamp(readInteger(elements.rasterCols, state.rasterCols), imageApi.COLUMNS, MAX_RASTER_COLS);
    let rasterRows = clamp(readInteger(elements.rasterRows, state.rasterRows), 1, MAX_RASTER_ROWS);

    if (elements.lockRasterAspect.checked && state.image) {
      if (changedDimension === "rows") {
        rasterCols = clamp(Math.round(rasterRows * state.image.naturalWidth / state.image.naturalHeight), imageApi.COLUMNS, MAX_RASTER_COLS);
      }

      rasterRows = clamp(Math.round(rasterCols * state.image.naturalHeight / state.image.naturalWidth), 1, MAX_RASTER_ROWS);
    }

    const cropHeight = Math.min(oldCrop.height, rasterRows, imageApi.MAX_ROWS);
    const left = Math.round((oldCenterX * rasterCols) - (imageApi.COLUMNS / 2));
    const top = Math.round((oldCenterY * rasterRows) - (cropHeight / 2));

    setCropGeometry(rasterCols, rasterRows, left, top, cropHeight);
    scheduleRender(0);
  }

  function changeHorizontalMargin(changedSide) {
    const maximumMargin = state.rasterCols - imageApi.COLUMNS;
    let left = readInteger(elements.trimLeft, 0);
    let right = readInteger(elements.trimRight, 0);

    if (changedSide === "left") {
      left = clamp(left, 0, maximumMargin);
      right = maximumMargin - left;
    } else {
      right = clamp(right, 0, maximumMargin);
      left = maximumMargin - right;
    }

    writeInteger(elements.trimLeft, left);
    writeInteger(elements.trimRight, right);
    updateCropReadout();
    scheduleRender();
  }

  function changeVerticalMargin(changedSide) {
    const rasterRows = state.rasterRows;
    let top = clamp(readInteger(elements.trimTop, 0), 0, rasterRows - 1);
    let bottom = clamp(readInteger(elements.trimBottom, 0), 0, rasterRows - 1);

    if (changedSide === "top") {
      bottom = clamp(bottom, 0, rasterRows - top - 1);
      if (rasterRows - top - bottom > imageApi.MAX_ROWS) {
        bottom = rasterRows - top - imageApi.MAX_ROWS;
      }
    } else {
      top = clamp(top, 0, rasterRows - bottom - 1);
      if (rasterRows - top - bottom > imageApi.MAX_ROWS) {
        top = rasterRows - bottom - imageApi.MAX_ROWS;
      }
    }

    writeInteger(elements.trimTop, top);
    writeInteger(elements.trimBottom, bottom);
    updateCropReadout();
    scheduleRender();
  }

  function nudgeCrop(direction) {
    const crop = getCropBounds();
    let left = crop.x;
    let top = crop.y;

    if (direction === "left" && crop.x > 0) left -= 1;
    if (direction === "right" && crop.margins.right > 0) left += 1;
    if (direction === "up" && crop.y > 0) top -= 1;
    if (direction === "down" && crop.margins.bottom > 0) top += 1;

    setCropGeometry(crop.rasterWidth, crop.rasterHeight, left, top, crop.height);
    scheduleRender(0);
  }

  function applyV1Parameters() {
    if (!state.image) {
      setStatus("Choose the source image before applying V1 parameters.", "bad");
      return;
    }

    try {
      const crop = imageApi.v1CropSetup(
        elements.v1Parameters.value,
        state.image.naturalWidth,
        state.image.naturalHeight
      );

      elements.lockRasterAspect.checked = false;
      setCropGeometry(crop.rasterWidth, crop.rasterHeight, crop.x, crop.y, crop.height);
      scheduleRender(0);
      setStatus(
        "Applied V1 trim values to a " + crop.rasterWidth + "×" + crop.rasterHeight +
        " raster. Output is 26×" + crop.height + ".",
        "good"
      );
    } catch (error) {
      setStatus(error.message || String(error), "bad");
    }
  }

  function updatePreviewScale() {
    const scale = clamp(readInteger(elements.previewScale, 5), 1, 20);

    writeInteger(elements.previewScale, scale);
    if (state.rows.length) {
      imageApi.renderRows(elements.previewCanvas, state.rows, state.palette, scale);
    }
  }

  function clearCanvas(canvas) {
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  function clearOutputs() {
    state.rows = [];
    state.addresses = [];
    state.payload = null;
    elements.rowText.value = "";
    elements.addressText.value = "";
    elements.summary.textContent = state.image ? "Adjust the crop margins." : "Choose an image to begin.";
    setOutputButtons(false);
  }

  function drawCropGuide(sourceCanvas, crop) {
    const canvas = elements.cropCanvas;
    const context = canvas.getContext("2d");
    const lineWidth = Math.max(1, Math.round(Math.min(crop.rasterWidth, crop.rasterHeight) / 180));
    const displayScale = Math.min(10, 500 / crop.rasterWidth, 414 / crop.rasterHeight);

    canvas.width = crop.rasterWidth;
    canvas.height = crop.rasterHeight;
    canvas.style.width = Math.max(1, Math.round(crop.rasterWidth * displayScale)) + "px";
    canvas.style.height = "auto";
    context.drawImage(sourceCanvas, 0, 0);
    context.fillStyle = "rgba(0, 0, 0, 0.70)";
    context.fillRect(0, 0, crop.rasterWidth, crop.y);
    context.fillRect(0, crop.y + crop.height, crop.rasterWidth, crop.margins.bottom);
    context.fillRect(0, crop.y, crop.x, crop.height);
    context.fillRect(crop.x + crop.width, crop.y, crop.margins.right, crop.height);
    context.strokeStyle = "rgb(58, 214, 255)";
    context.lineWidth = lineWidth;
    context.strokeRect(
      crop.x + (lineWidth / 2),
      crop.y + (lineWidth / 2),
      Math.max(1, crop.width - lineWidth),
      Math.max(1, crop.height - lineWidth)
    );
  }

  function rasterizeAndCrop() {
    const crop = getCropBounds();
    const canvas = elements.sourceCanvas;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const matte = matteRgb();

    canvas.width = crop.rasterWidth;
    canvas.height = crop.rasterHeight;
    context.imageSmoothingEnabled = elements.smooth.checked;
    context.imageSmoothingQuality = "low";
    context.fillStyle = "rgb(" + matte.join(",") + ")";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(state.image, 0, 0, state.image.naturalWidth, state.image.naturalHeight, 0, 0, canvas.width, canvas.height);
    drawCropGuide(canvas, crop);

    return {
      crop: crop,
      imageData: context.getImageData(crop.x, crop.y, crop.width, crop.height)
    };
  }

  async function renderCapture() {
    const renderToken = state.renderToken + 1;

    state.renderToken = renderToken;
    updateCropReadout();

    if (!state.palette || !state.image) {
      return;
    }

    try {
      const rasterized = rasterizeAndCrop();
      const crop = rasterized.crop;
      const rows = imageApi.quantizeImageData(rasterized.imageData, state.palette, { matte: matteRgb() });

      imageApi.renderRows(elements.previewCanvas, rows, state.palette, clamp(readInteger(elements.previewScale, 5), 1, 20));
      elements.rowText.value = rows.join("\n");
      elements.addressText.value = "Generating Base58Check addresses…";
      elements.summary.textContent = crop.height + " rows × 26 pixels · generating ordered outputs…";
      setOutputButtons(false);
      setStatus("Quantized locally. Building unique, checksum-valid Digibyte outputs…", "");

      const addresses = await imageApi.rowsToAddresses(rows);

      if (renderToken !== state.renderToken) {
        return;
      }

      const payload = imageApi.buildEtchPayload(addresses, {
        opReturnAscii: elements.opReturnAscii.value
      });

      payload.artifact.sourceName = state.fileName;
      payload.artifact.raster = {
        width: crop.rasterWidth,
        height: crop.rasterHeight
      };
      payload.artifact.trim = crop.margins;
      state.rows = rows;
      state.addresses = addresses;
      state.payload = payload;
      elements.addressText.value = addresses.join("\n");

      const totalDgb = addresses.length * imageApi.DEFAULT_AMOUNT_DGB;

      elements.summary.textContent =
        "Raster " + crop.rasterWidth + "×" + crop.rasterHeight +
        " → crop 26×" + crop.height +
        " · " + addresses.length + " outputs · " + totalDgb.toFixed(8) + " DGB";
      setOutputButtons(true);
      setStatus("Ready. Load the ordered outputs into Etch, then review the transaction before signing.", "good");
    } catch (error) {
      console.error(error);
      clearOutputs();
      setStatus(error.message || String(error), "bad");
    }
  }

  function scheduleRender(delay) {
    window.clearTimeout(state.renderTimer);
    state.renderToken += 1;
    clearOutputs();
    state.renderTimer = window.setTimeout(renderCapture, Number.isFinite(Number(delay)) ? Number(delay) : 140);
  }

  function loadBrowserImage(file) {
    return new Promise(function loadImagePromise(resolve, reject) {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = function onImageLoad() {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = function onImageError() {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("The selected file could not be decoded as an image."));
      };
      image.src = objectUrl;
    });
  }

  async function onImageFileChange() {
    const file = elements.imageFile.files && elements.imageFile.files[0];

    if (!file) {
      state.image = null;
      state.fileName = "";
      clearOutputs();
      clearCanvas(elements.cropCanvas);
      elements.reloadButton.disabled = true;
      elements.applyV1Parameters.disabled = true;
      return;
    }

    try {
      setStatus("Decoding " + file.name + " locally…", "");
      state.image = await loadBrowserImage(file);
      state.fileName = file.name;
      elements.reloadButton.disabled = false;
      elements.applyV1Parameters.disabled = false;
      resetCropForImage();
      scheduleRender(0);
    } catch (error) {
      state.image = null;
      state.fileName = "";
      clearOutputs();
      elements.reloadButton.disabled = true;
      elements.applyV1Parameters.disabled = true;
      setStatus(error.message || String(error), "bad");
    }
  }

  function downloadBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function revokeDownloadUrl() {
      URL.revokeObjectURL(objectUrl);
    }, 0);
  }

  function safeBaseName() {
    const source = state.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");

    return source || "chisel-base57-image";
  }

  async function copyAddresses() {
    if (!state.addresses.length) {
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(state.addresses.join("\n"));
      } else {
        elements.addressText.focus();
        elements.addressText.select();
        document.execCommand("copy");
      }

      setStatus("Copied " + state.addresses.length + " ordered image addresses.", "good");
    } catch (error) {
      setStatus("Copy failed. Select the address list and copy it manually.", "bad");
    }
  }

  function savePreviewPng() {
    if (!state.rows.length) {
      return;
    }

    elements.previewCanvas.toBlob(function saveCanvasBlob(blob) {
      if (blob) {
        downloadBlob(blob, safeBaseName() + "-base57.png");
      }
    }, "image/png");
  }

  function downloadEtchPlan() {
    if (!state.payload) {
      return;
    }

    const blob = new Blob([JSON.stringify(state.payload, null, 2) + "\n"], { type: "application/json" });

    downloadBlob(blob, safeBaseName() + "-etch-plan.json");
  }

  function loadIntoEtch() {
    if (!state.payload) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.payload));

      if (window.opener && !window.opener.closed) {
        const targetOrigin = window.location.origin === "null" ? "*" : window.location.origin;

        window.opener.postMessage({
          type: "chisel.loadArtifactPayload",
          payload: state.payload
        }, targetOrigin);
        window.opener.focus();
        setStatus("Loaded " + state.addresses.length + " image rows into the open Chisel Etch window.", "good");
        return;
      }

      window.location.href = "../../?mode=etch";
    } catch (error) {
      console.error(error);
      setStatus("The Etch handoff failed: " + (error.message || String(error)), "bad");
    }
  }

  async function loadPalette() {
    try {
      const response = await fetch("../../b57.json", { cache: "no-store" });

      if (!response.ok) {
        throw new Error("b57.json failed with HTTP " + response.status + ".");
      }

      state.palette = imageApi.parsePalette(await response.json());
      setStatus("Base57 palette loaded. Choose an image; it will stay on this device.", "good");
    } catch (error) {
      console.error(error);
      setStatus("Could not load the Base57 palette: " + (error.message || String(error)), "bad");
      elements.imageFile.disabled = true;
    }
  }

  function bind() {
    if (!imageApi) {
      setStatus("CHISEL_IMAGE did not load.", "bad");
      return;
    }

    elements.imageFile.addEventListener("change", onImageFileChange);
    elements.reloadButton.addEventListener("click", function reloadPreview() {
      scheduleRender(0);
    });
    elements.applyV1Parameters.addEventListener("click", applyV1Parameters);
    elements.v1Parameters.addEventListener("keydown", function onV1ParametersKeydown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        applyV1Parameters();
      }
    });
    elements.loadEtchButton.addEventListener("click", loadIntoEtch);
    elements.copyButton.addEventListener("click", copyAddresses);
    elements.savePngButton.addEventListener("click", savePreviewPng);
    elements.downloadButton.addEventListener("click", downloadEtchPlan);

    elements.rasterCols.addEventListener("change", function onRasterColsChange() {
      changeRasterSize("cols");
    });
    elements.rasterRows.addEventListener("change", function onRasterRowsChange() {
      changeRasterSize("rows");
    });
    elements.lockRasterAspect.addEventListener("change", function onRasterLockChange() {
      elements.rasterRows.disabled = elements.lockRasterAspect.checked;
      changeRasterSize("cols");
    });

    elements.trimLeft.addEventListener("input", function onTrimLeftInput() {
      if (elements.trimLeft.value !== "") changeHorizontalMargin("left");
    });
    elements.trimRight.addEventListener("input", function onTrimRightInput() {
      if (elements.trimRight.value !== "") changeHorizontalMargin("right");
    });
    elements.trimTop.addEventListener("input", function onTrimTopInput() {
      if (elements.trimTop.value !== "") changeVerticalMargin("top");
    });
    elements.trimBottom.addEventListener("input", function onTrimBottomInput() {
      if (elements.trimBottom.value !== "") changeVerticalMargin("bottom");
    });

    Array.from(document.querySelectorAll("[data-crop-nudge]")).forEach(function bindNudgeButton(button) {
      button.addEventListener("click", function onNudgeClick() {
        nudgeCrop(button.getAttribute("data-crop-nudge"));
      });
    });

    [elements.matte, elements.smooth, elements.opReturnAscii].forEach(function bindRenderControl(element) {
      element.addEventListener("input", function onRenderControlInput() {
        scheduleRender();
      });
      element.addEventListener("change", function onRenderControlChange() {
        scheduleRender(0);
      });
    });

    elements.previewScale.addEventListener("input", updatePreviewScale);
    elements.previewScale.addEventListener("change", updatePreviewScale);

    setCropGeometry(imageApi.COLUMNS, imageApi.COLUMNS, 0, 0, imageApi.COLUMNS);
    clearOutputs();
    loadPalette();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
