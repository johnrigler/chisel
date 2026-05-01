(function () {
  //
  // Constants
  //
  const REQUIRED_HEX_LENGTH = 64;
  const QR_FPS = 10;
  const QR_BOX = 250;
  const STATUS_IDLE = "Ready to scan QR fragments.";
  const STATUS_COMPLETE = "Hex private key assembled.";
  const STATUS_INVALID = "Scanned value is not valid hex.";
  const STATUS_DUPLICATE = "Duplicate fragment ignored.";

  //
  // Elements
  //
  const elems = {
    target: document.querySelector("#target"),
    middle: document.querySelector("#middle"),
    footer: document.querySelector("#footer")
  };

  //
  // State
  //
  const state = {
    scanner: null,
    fragments: [],
    lastResult: "",
    hexPrivateKey: "",
    isComplete: false
  };

  //
  // DOM setters
  //
  function setLayout() {
    elems.target.innerHTML = [
      '<section id="qrHexKeyReader">',
      '  <div id="qr-reader" style="width: 500px; max-width: 100%;"></div>',
      '  <div id="qrControls" style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">',
      '    <button id="clearScansButton" type="button">CLEAR</button>',
      '    <button id="stopScannerButton" type="button">STOP</button>',
      '  </div>',
      '  <div id="qr-reader-results" style="margin-top: 12px;"></div>',
      '</section>'
    ].join("");

    elems.results = document.querySelector("#qr-reader-results");
    elems.clearScansButton = document.querySelector("#clearScansButton");
    elems.stopScannerButton = document.querySelector("#stopScannerButton");
  }

  function setStatus(message) {
    elems.results.innerHTML = "<strong>Status:</strong> " + escapeHtml(message);
  }

  function setFragments() {
    const items = state.fragments.map(function mapFragment(fragment, index) {
      return "<li><code>" + escapeHtml(fragment) + "</code> <small>(" + fragment.length + " hex)</small></li>";
    }).join("");

    elems.middle.innerHTML = [
      "<h3>Scanned fragments</h3>",
      "<ol>",
      items || "<li>No fragments scanned yet.</li>",
      "</ol>"
    ].join("");
  }

  function setHexPrivateKey() {
    const remaining = Math.max(REQUIRED_HEX_LENGTH - state.hexPrivateKey.length, 0);

    elems.footer.innerHTML = [
      "<h3>Hex private key</h3>",
      "<p><code>" + escapeHtml(state.hexPrivateKey) + "</code></p>",
      "<p><strong>Length:</strong> " + state.hexPrivateKey.length + " / " + REQUIRED_HEX_LENGTH + "</p>",
      "<p><strong>Remaining:</strong> " + remaining + "</p>",
      '<div id="derivedWallet"></div>'
    ].join("");

    elems.derivedWallet = document.querySelector("#derivedWallet");
  }

  function setDerivedWallet(address) {
    if (!elems.derivedWallet) {
      return;
    }

    elems.derivedWallet.innerHTML = [
      "<hr>",
      "<p><strong>Derived address:</strong> <code>" + escapeHtml(address) + "</code></p>"
    ].join("");
  }

  function setInvalidFragment(fragment) {
    setStatus(STATUS_INVALID + " " + fragment);
  }

  function render() {
    setFragments();
    setHexPrivateKey();

    if (state.isComplete) {
      setStatus(STATUS_COMPLETE);
      renderDerivedWallet();
      return;
    }

    setStatus(STATUS_IDLE);
  }

  //
  // Validators
  //
  function isHex(value) {
    return /^[0-9a-fA-F]+$/.test(value);
  }

  function isValidHexFragment(value) {
    return typeof value === "string" && value.length > 0 && isHex(value);
  }

  //
  // Formatters
  //
  function normalizeFragment(value) {
    return value.trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();
  }

  function escapeHtml(string) {
    return String(string)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  //
  // State setters
  //
  function clearScans() {
    state.fragments = [];
    state.lastResult = "";
    state.hexPrivateKey = "";
    state.isComplete = false;
    render();
  }

  function addFragment(fragment) {
    state.fragments.push(fragment);
    state.hexPrivateKey = state.fragments.join("").slice(0, REQUIRED_HEX_LENGTH);
    state.isComplete = state.hexPrivateKey.length === REQUIRED_HEX_LENGTH;
    render();
  }

  //
  // Wallet rendering
  //
  function renderDerivedWallet() {
    if (!state.isComplete || typeof ethers === "undefined") {
      return;
    }

    try {
      const wallet = new ethers.Wallet(state.hexPrivateKey);
      setDerivedWallet(wallet.address);
    } catch (error) {
      if (elems.derivedWallet) {
        elems.derivedWallet.innerHTML = "<p><strong>Wallet error:</strong> " + escapeHtml(error.message || String(error)) + "</p>";
      }
    }
  }

  //
  // Scanner controls
  //
  async function stopScanner() {
    if (!state.scanner) {
      return;
    }

    try {
      await state.scanner.clear();
    } catch (error) {
      console.warn(error);
    }
  }

  function createScanner() {
    return new Html5QrcodeScanner("qr-reader", {
      fps: QR_FPS,
      qrbox: QR_BOX
    });
  }

  //
  // DOM listeners
  //
  function onScanSuccess(decodedText) {
    const normalized = normalizeFragment(decodedText);

    if (normalized === state.lastResult) {
      setStatus(STATUS_DUPLICATE);
      return;
    }

    state.lastResult = normalized;

    if (!isValidHexFragment(normalized)) {
      setInvalidFragment(decodedText);
      return;
    }

    if (state.isComplete) {
      return;
    }

    addFragment(normalized);

    if (state.isComplete) {
      stopScanner();
    }
  }

  function onClickClearScansButton() {
    clearScans();
  }

  function onClickStopScannerButton() {
    stopScanner();
  }

  function addEventListeners() {
    elems.clearScansButton.onclick = onClickClearScansButton;
    elems.stopScannerButton.onclick = onClickStopScannerButton;
  }

  //
  // Init
  //
  function init() {
    setLayout();
    clearScans();
    addEventListeners();

    state.scanner = createScanner();
    state.scanner.render(onScanSuccess);
  }

  init();
})();
