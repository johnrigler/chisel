(function () {
  const DRAFT_STORAGE_KEY = "chisel.manualEtchDraft.v1";
  const DEMO_STATE_KEY = "chisel.demoMode.v1";

  function $(id) {
    return document.getElementById(id);
  }

  function value(id) {
    const el = $(id);
    return el && el.value ? String(el.value).trim() : "";
  }

  function setValue(id, text) {
    const el = $(id);
    if (el) el.value = text == null ? "" : String(text);
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms || 0);
    });
  }

  function getFixtureKeys() {
    return Object.keys(window.CHISEL_ETCH_FIXTURES || {});
  }

  function getDefaultFixtureKey() {
    const keys = getFixtureKeys();
    if (keys.indexOf("litecoin-v276-opreturn") >= 0) return "litecoin-v276-opreturn";
    return keys[0] || "";
  }

  function getDefaultFixture() {
    const key = getDefaultFixtureKey();
    return {
      key: key,
      fixture: key ? window.CHISEL_ETCH_FIXTURES[key] : null
    };
  }

  function setFixtureSelect(key) {
    const select = $("etchFixtureSelect");
    if (!select) throw new Error("Etch fixture select is missing.");
    select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function assertEqual(actual, expected, label) {
    if (actual !== expected) {
      throw new Error(label + " mismatch. Expected " + expected + " but got " + actual + ".");
    }
  }

  function parseJsonBox(id) {
    const text = value(id);
    assert(text, id + " is empty.");
    return JSON.parse(text);
  }

  function makeLog(outputId) {
    const output = $(outputId);
    const lines = [];

    function render() {
      if (output) output.textContent = lines.join("\n");
    }

    return {
      reset: function reset(title) {
        lines.length = 0;
        if (title) lines.push(title);
        render();
      },
      pass: function pass(message) {
        lines.push("PASS: " + message);
        render();
      },
      fail: function fail(message) {
        lines.push("FAIL: " + message);
        render();
      },
      skip: function skip(message) {
        lines.push("SKIP: " + message);
        render();
      },
      info: function info(message) {
        lines.push("INFO: " + message);
        render();
      },
      text: function text() {
        return lines.join("\n");
      }
    };
  }

  async function loadFixtureForTest(log) {
    const selected = getDefaultFixture();
    assert(selected.fixture, "No Etch fixtures are installed.");
    setFixtureSelect(selected.key);
    await window.loadSelectedEtchFixture();
    await sleep(0);
    log.pass("Loaded fixture: " + (selected.fixture.label || selected.key));
    return selected;
  }

  async function runEtchFixtureTest(log) {
    const selected = await loadFixtureForTest(log);
    const fixture = selected.fixture;
    const vin = parseJsonBox("manualVinJson");
    const vout = parseJsonBox("manualVoutJson");

    assert(Array.isArray(vin) && vin.length === fixture.vin.length, "VIN JSON did not load the expected fixture inputs.");
    assert(vout && typeof vout === "object" && !Array.isArray(vout), "VOUT JSON did not load as an object.");
    log.pass("VIN/VOUT JSON parsed from fixture.");

    setValue("manualRawHex", "");
    setValue("manualSignedHex", "");
    await window.createRawFromManualJson();
    await sleep(0);
    assertEqual(value("manualRawHex"), fixture.expectedRawHex, "Unsigned raw hex");
    log.pass("createrawtransaction equivalent generated expected unsigned raw hex.");

    await window.signRawFromManualHex();
    await sleep(0);
    assertEqual(value("manualSignedHex"), fixture.expectedSignedHex, "Signed raw hex");
    log.pass("signrawtransactionwithkey equivalent generated expected signed raw hex.");

    const rpc = await window.exportRpcCommandsToManualBox();
    const rpcText = value("manualRpcCommands") || String(rpc || "");
    assert(rpcText.indexOf("createrawtransaction") >= 0, "RPC export lacks createrawtransaction.");
    assert(rpcText.indexOf("signrawtransactionwithkey") >= 0, "RPC export lacks signrawtransactionwithkey.");
    assert(rpcText.indexOf("sendrawtransaction") >= 0, "RPC export lacks sendrawtransaction.");
    assert(rpcText.indexOf(fixture.expectedSignedHex) >= 0, "RPC export does not include signed hex.");
    log.pass("RPC command export generated create/sign/send commands.");

    return selected;
  }

  async function runDraftSaveRestoreTest(log) {
    const selected = await loadFixtureForTest(log);
    const fixture = selected.fixture;
    const sentinel = "SELFTEST-WIF-SENTINEL-DO-NOT-SAVE";

    setValue("manualScratchJson", JSON.stringify({ selfTest: true, savedAt: "fixture-draft-check" }, null, 2));
    await window.saveManualDraft();
    const stored = window.localStorage ? window.localStorage.getItem(DRAFT_STORAGE_KEY) : "";
    assert(stored, "No draft was written to localStorage.");
    assert(stored.indexOf(fixture.senderWif) < 0, "Draft contains fixture WIF.");
    const parsed = JSON.parse(stored);
    assert(parsed.senderWifSaved === false, "Draft does not explicitly mark senderWifSaved=false.");
    log.pass("Manual draft saved without WIF material.");

    setValue("senderWif", sentinel);
    setValue("manualScratchJson", "{}");
    await window.restoreManualDraft();
    assertEqual(value("senderWif"), sentinel, "Sender WIF after draft restore");
    log.pass("Manual draft restore does not overwrite the current WIF field.");

    setValue("senderWif", fixture.senderWif || "");
    return selected;
  }

  async function runSendLockTest(log) {
    await runEtchFixtureTest(log);
    const gate = $("confirmManualBroadcast");
    if (gate) gate.checked = false;

    let locked = false;
    try {
      await window.sendSignedRawFromManualHex();
    } catch (error) {
      locked = /locked|confirmation/i.test(error.message || String(error));
    }

    assert(locked, "SEND SIGNED RAW did not stop when the broadcast confirmation box was unchecked.");
    log.pass("SEND SIGNED RAW is locked without explicit confirmation.");
  }

  async function runPortalBootTest(log) {
    assert(window.CHISEL_PORTAL, "window.CHISEL_PORTAL is not installed.");
    assert(window.CHISEL_PORTAL.state, "Portal state is not exposed.");

    if (!window.CHISEL_PORTAL.state.portalRows || window.CHISEL_PORTAL.state.portalRows.length === 0) {
      if (typeof window.CHISEL_PORTAL.loadEmbeddedStaticDataset === "function") {
        window.CHISEL_PORTAL.loadEmbeddedStaticDataset();
        await sleep(50);
      }
    }

    const rows = (window.CHISEL_PORTAL.state.portalRows || []).length;
    assert(rows > 0, "Portal has no rows after embedded static dataset load.");
    log.pass("Portal booted and has " + rows + " bundled/static row(s).");

    const root = $("portalStream") || $("portalTransactionList") || document.querySelector(".portalStream");
    if (root) log.pass("Portal stream container exists in DOM.");
    else log.skip("Portal stream container selector changed; state check passed.");
  }

  async function runPortalUiTest(log) {
    const api = window.CHISEL_PORTAL;
    assert(api, "window.CHISEL_PORTAL is not installed.");
    assert(!$("portalAutoSaveFetchedTxs"), "Obsolete auto-save checkbox is still visible.");
    assert(!$("portalLocalCoin"), "Obsolete coin-folder control is still visible.");
    assert(!$("portalLoadSelectedLocalButton"), "Obsolete selected-local control is still visible.");
    assertEqual($("portalLoadLocalTxidsButton").textContent.trim(), "LOAD UTXO DATA", "Local UTXO button");
    assertEqual($("portalLoadEvmCatalogButton").textContent.trim(), "LOAD EVM DATA", "Local EVM button");
    log.pass("Portal local-data controls are unambiguous.");

    const txid = "a".repeat(64);
    const vinAddress = "LcudkPQzLuuqsnzHSmJ7iLREaHStvPKRVb";
    const imageLine = "SN" + "A".repeat(26) + "ABCDEF";
    const entry = { coin: "litecoin", ticker: "LTC", name: "Litecoin", label: "Litecoin" };
    const raw = {
      txid: txid,
      vin: [{ address: vinAddress }],
      vout: Array.from({ length: 48 }, function (_unused, index) {
        return { n: index, value: 0, scriptPubKey: { type: "pubkeyhash", addresses: [imageLine] } };
      })
    };
    const row = {
      key: "litecoin:" + txid,
      txid: txid,
      coin: "litecoin",
      index: entry,
      raw: raw,
      summary: api.extractSummary(raw, entry)
    };
    const oldConfig = api.state.config;
    const container = document.createElement("div");
    try {
      api.state.config = Object.assign({}, oldConfig, { inlineImageExpandedScale: 12, saveDiscoveredLinks: false });
      api.appendPortalInlineDetails(container, row);
    } finally {
      api.state.config = oldConfig;
    }

    assert(container.querySelector(".portalExpandedBody"), "Expanded Base57 grid is missing.");
    assert(container.querySelector(".portalInlineImageSide"), "Expanded Base57 data column is missing.");
    assertEqual(container.querySelector(".portalInlineImageCanvas").width, 26 * 12, "Expanded Base57 width");
    assertEqual(container.querySelector(".portalInlineImageCanvas").height, 48 * 12, "Expanded Base57 height");
    assertEqual(container.querySelector(".portalVinAddress").textContent, vinAddress, "VIN rabbit-trail address");
    assert(!container.querySelector(".portalAnnotationEmpty").open, "Empty local annotation is expanded.");
    log.pass("Expanded Base57 media, right-side data, VIN lookup, and collapsed empty notes are present.");

    assertEqual(api.displayTitleForRow({ txid: txid, coin: "litecoin", index: entry, summary: { title: "https://youtu.be/abcdefghi", primaryUrl: "https://youtu.be/abcdefghi" } }), "YouTube", "URL display title");
    assertEqual(api.displayTitleForRow({ txid: txid, coin: "litecoin", index: entry, summary: { title: "dkPQ Luuqsn HSmJ7ILREaHSt" } }), "transaction aaaaaaaaaa…aaaaaaaaaa", "Encoded display title");
    assertEqual(api.displayTitleForRow({ txid: txid, coin: "litecoin", index: entry, summary: { title: "Ddddddddddddddddddddddddddd" } }), "transaction aaaaaaaaaa…aaaaaaaaaa", "Repeated address display title");
    assertEqual(api.displayTitleForRow({ txid: txid, coin: "evm", sourceId: "evmGomez", index: entry, summary: { title: '<iframe src="https://www.youtube.com/embed/abcdefghi"></iframe>' } }), "YouTube", "HTML media display title");
    assertEqual(api.displayTitleForRow({ txid: txid, coin: "evm", sourceId: "evmGomez", index: entry, summary: { title: '<table><iframe src="https://www.youtube.com/embed/abcdefghi" title="truncated' } }), "YouTube", "Truncated HTML media display title");
    assertEqual(api.displayTitleForRow({ txid: txid, coin: "evm", sourceId: "evmGomez", index: entry, summary: { title: "<pre>Readable record text" } }), "Readable record text", "HTML text display title");
    assertEqual(api.displayTitleForRow({ txid: txid, coin: "evm", sourceId: "evmGomez", index: entry, summary: { title: "<a href=https://example.com/story>Useful article</a>" } }), "Useful article", "HTML anchor display title");
    assertEqual(api.displayTitleForRow({ txid: txid, coin: "litecoin", index: entry, summary: { title: "Eyes of the World" } }), "Eyes of the World", "Human display title");
    assertEqual(api.extractInputAddresses({ inputs: [{ recipient: vinAddress }] })[0], vinAddress, "Alternate VIN shape");
    log.pass("Portal title normalization and VIN extraction passed.");
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(path + " failed with HTTP " + response.status);
    return response.json();
  }

  async function runPortalStaticDataCharacterizationTest(log) {
    const api = window.CHISEL_PORTAL_STATIC_DATA;
    assert(api, "Portal static-data boundary is not installed.");
    assertEqual(api.joinDataPath("./data-bundled/", "transactions/example.json"), "./data-bundled/transactions/example.json", "Relative static path");
    assertEqual(api.joinDataPath("https://gateway.example/ipfs/QmRoot/", "https://other.example/record.json"), "https://other.example/record.json", "Absolute static path");
    assertEqual(api.joinDataPath("", "ipfs/QmRoot/record.json"), "ipfs/QmRoot/record.json", "IPFS-style relative path");
    log.pass("Static path resolution preserves relative, absolute, and IPFS-style paths.");

    const txid = "A".repeat(64);
    const dataset = { transactions: [{ txid: txid, coin: "litecoin", path: "transactions/example.json", summary: { title: "fixture" } }, { txid: "not-a-txid" }] };
    const before = JSON.stringify(dataset);
    const normalizer = api.createNormalizer({
      normalizeCoinName: function (value) { return String(value || "").toLowerCase(); },
      tickerForCoin: function (coin) { return coin === "litecoin" ? "LTC" : ""; },
      getCoinIndexByCoinName: function () { return null; },
      shortTxid: function (value) { return String(value).slice(0, 10); }
    });
    const rows = normalizer.normalizeStaticDatasetRows(dataset, { baseUrl: "./data-bundled/", sourceLabel: "characterization", sourceBadge: "bundled", remoteBaseUrls: ["https://gateway.example/ipfs/QmRoot/"] });
    assertEqual(JSON.stringify(dataset), before, "Static normalization input");
    assertEqual(rows.length, 1, "Normalized static row count");
    assertEqual(rows[0].txid, txid.toLowerCase(), "Normalized txid");
    assertEqual(rows[0].staticRawPath, "transactions/example.json", "Normalized raw path");
    assertEqual(rows[0].staticRemoteBaseUrls[0], "https://gateway.example/ipfs/QmRoot/", "Normalized remote base path");
    log.pass("Static normalization is pure and retains the existing row schema/defaults.");

    const transportCalls = [];
    const transport = api.createTransport({
      fetch: async function (url) {
        transportCalls.push(url);
        if (url === "primary.json") return { ok: false, status: 404 };
        if (url === "fallback/record.json") return { ok: true, status: 200, json: async function () { return { txid: "fixture" }; } };
        return { ok: false, status: 500 };
      },
      crypto: null
    });
    let fetchError = "";
    try { await transport.fetchJsonNoStore("missing.json"); } catch (error) { fetchError = error.message || String(error); }
    assertEqual(fetchError, "missing.json failed with HTTP 500.", "Static fetch error");
    const raw = await transport.fetchStaticRawFromRow({ staticRawUrl: "primary.json", staticRawPath: "record.json", staticRemoteBaseUrls: ["fallback/"], staticSource: "bundled", coin: "litecoin" });
    assertEqual(raw.url, "fallback/record.json", "Static raw fallback URL");
    assertEqual(transportCalls.slice(-2).join(","), "primary.json,fallback/record.json", "Static raw fallback order");
    log.pass("Static transport preserves no-store error text and raw fallback ordering.");

    const validationTransport = api.createTransport({
      fetch: async function (url) {
        if (url === "manifest.json") return { ok: true, status: 200, json: async function () { return { baseUrl: "bundle/", hashes: { "record.json": "sha256-deadbeef" } }; } };
        if (url === "bundle/record.json") return { ok: true, status: 200, arrayBuffer: async function () { return new Uint8Array([1, 2, 3]).buffer; } };
        return { ok: false, status: 404 };
      },
      crypto: null
    });
    const reports = await validationTransport.validateStaticDataset(["manifest.json"]);
    assertEqual(reports.length, 1, "Static validation report count");
    assert(reports[0].ok === true && reports[0].checks[0].ok === "crypto.subtle unavailable", "Static validation must retain the crypto-unavailable report behavior.");
    log.pass("Static validation retains report-only error and crypto-unavailable behavior.");
  }

  async function runDataBundledLinksTest(log) {
    if (window.location.protocol === "file:") {
      log.skip("data-bundled link fetch skipped under file://. Serve this directory with python3 -m http.server for HTTP fetch validation.");
      assert(window.CHISEL_PORTAL_STARTER_DATA && Array.isArray(window.CHISEL_PORTAL_STARTER_DATA.transactions), "Embedded portal starter data is missing.");
      log.pass("Embedded portal starter data is present without HTTP fetch.");
      return;
    }

    const index = await fetchJson("data-bundled/index/transactions.index.json");
    const transactions = Array.isArray(index.transactions) ? index.transactions : [];
    assert(transactions.length > 0, "transactions.index.json has no transactions.");
    log.pass("transactions.index.json loaded with " + transactions.length + " transaction entrie(s).");

    const missing = [];
    for (let i = 0; i < transactions.length; i += 1) {
      const row = transactions[i];
      if (!row || !row.path) continue;
      try {
        const response = await fetch(row.path, { cache: "no-store" });
        if (!response.ok) missing.push(row.path + " HTTP " + response.status);
      } catch (error) {
        missing.push(row.path + " " + (error.message || String(error)));
      }
    }

    if (missing.length) {
      throw new Error("Missing indexed transaction JSON path(s): " + missing.slice(0, 5).join("; ") + (missing.length > 5 ? " ..." : ""));
    }

    log.pass("All indexed data-bundled transaction JSON paths fetched cleanly.");

    if (window.CHISEL_PORTAL && typeof window.CHISEL_PORTAL.validateStaticDataset === "function") {
      const reports = await window.CHISEL_PORTAL.validateStaticDataset();
      const bad = (reports || []).filter(function (report) { return report.error || report.ok === false; });
      assert(bad.length === 0, "Portal static dataset hash validation reported an error.");
      log.pass("Portal static dataset hash validation completed.");
    }
  }

  async function runAllSelfTests() {
    const log = makeLog("selfTestOutput");
    log.reset("Chisel browser self-test");
    try {
      await runPortalStaticDataCharacterizationTest(log);
      await runPortalBootTest(log);
      await runPortalUiTest(log);
      await runDataBundledLinksTest(log);
      await runEtchFixtureTest(log);
      await runDraftSaveRestoreTest(log);
      await runSendLockTest(log);
      log.pass("All requested self-tests completed. No live broadcast attempted.");
    } catch (error) {
      log.fail(error.message || String(error));
      console.error(error);
    }
  }

  function bindSelfTestButton(id, title, fn) {
    const button = $(id);
    if (!button) return;
    button.onclick = async function onSelfTestClick() {
      const log = makeLog("selfTestOutput");
      log.reset(title);
      try {
        await fn(log);
        log.pass("Complete.");
      } catch (error) {
        log.fail(error.message || String(error));
        console.error(error);
      }
    };
  }

  const demoSteps = [
    {
      title: "Start",
      mode: "start",
      run: async function (log) {
        log.info("Start page: explain browser-local signing, static data, and satellites.");
      }
    },
    {
      title: "Portal",
      mode: "portal",
      run: async function (log) {
        if (window.CHISEL_PORTAL && typeof window.CHISEL_PORTAL.loadEmbeddedStaticDataset === "function") {
          window.CHISEL_PORTAL.loadEmbeddedStaticDataset();
          await sleep(50);
          const rows = (window.CHISEL_PORTAL.state && window.CHISEL_PORTAL.state.portalRows || []).length;
          log.info("Portal opened with " + rows + " bundled/static row(s). Use this as the reader-first opening.");
        } else {
          log.info("Portal API was not available yet; open Portal manually.");
        }
      }
    },
    {
      title: "Load Etch fixture",
      mode: "etch",
      run: async function (log) {
        const selected = await loadFixtureForTest(log);
        log.info("Loaded " + (selected.fixture.label || selected.key) + ". This is a dry-run dummy WIF fixture.");
      }
    },
    {
      title: "Create raw hex",
      mode: "etch",
      run: async function (log) {
        await window.createRawFromManualJson();
        log.info("Unsigned raw hex is now in the manual Etch box.");
      }
    },
    {
      title: "Sign locally",
      mode: "etch",
      run: async function (log) {
        await window.signRawFromManualHex();
        log.info("Signed raw hex was created locally. No live send was attempted.");
      }
    },
    {
      title: "Export RPC",
      mode: "etch",
      run: async function (log) {
        await window.exportRpcCommandsToManualBox();
        log.info("RPC command export is ready: createrawtransaction, signrawtransactionwithkey, sendrawtransaction.");
      }
    },
    {
      title: "Tools",
      mode: "tools",
      run: async function (log) {
        log.info("Tools are satellites: QR scanner, labels, legacy decoder, fileProxy docs, and ritual support.");
      }
    }
  ];

  function setDemoStepVisual(index) {
    Array.from(document.querySelectorAll("#demoStepList [data-demo-step]")).forEach(function (item) {
      item.classList.toggle("active", Number(item.getAttribute("data-demo-step")) === index);
    });
  }

  function saveDemoIndex(index) {
    try { window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify({ index: index })); } catch (error) {}
  }

  function loadDemoIndex() {
    try {
      const raw = window.localStorage.getItem(DEMO_STATE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Number(parsed && parsed.index) || 0;
    } catch (error) {
      return 0;
    }
  }

  async function runDemoStep(index) {
    const log = makeLog("demoModeOutput");
    const safeIndex = Math.max(0, Math.min(index, demoSteps.length - 1));
    const step = demoSteps[safeIndex];
    log.reset("Demo step " + (safeIndex + 1) + " / " + demoSteps.length + ": " + step.title);
    setDemoStepVisual(safeIndex);
    saveDemoIndex(safeIndex);

    try {
      if (typeof window.setGuiMode === "function") window.setGuiMode(step.mode);
      await step.run(log);
      log.pass("Demo step ready.");
    } catch (error) {
      log.fail(error.message || String(error));
      console.error(error);
    }
  }

  function bindDemoMode() {
    const start = $("demoStartButton");
    const next = $("demoNextButton");
    const reset = $("demoResetButton");
    if (start) start.onclick = function () { runDemoStep(0); };
    if (next) next.onclick = function () { runDemoStep(loadDemoIndex() + 1); };
    if (reset) reset.onclick = function () {
      try { window.localStorage.removeItem(DEMO_STATE_KEY); } catch (error) {}
      setDemoStepVisual(-1);
      const output = $("demoModeOutput");
      if (output) output.textContent = "Demo mode reset.";
      if (typeof window.setGuiMode === "function") window.setGuiMode("start");
    };
    setDemoStepVisual(loadDemoIndex());
  }

  function bind() {
    const all = $("selfTestAllButton");
    if (all) all.onclick = runAllSelfTests;
    bindSelfTestButton("selfTestEtchButton", "Etch fixture test", runEtchFixtureTest);
    bindSelfTestButton("selfTestDataButton", "data-bundled link test", runDataBundledLinksTest);
    bindSelfTestButton("selfTestPortalButton", "Portal boot test", runPortalBootTest);
    bindSelfTestButton("selfTestDraftButton", "Manual draft save/restore test", runDraftSaveRestoreTest);
    bindSelfTestButton("selfTestSendLockButton", "Manual SEND lock test", runSendLockTest);
    bindDemoMode();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  window.CHISEL_SELFTEST = {
    runAllSelfTests: runAllSelfTests,
    runPortalStaticDataCharacterizationTest: function () { return runPortalStaticDataCharacterizationTest(makeLog("selfTestOutput")); },
    runEtchFixtureTest: function () { return runEtchFixtureTest(makeLog("selfTestOutput")); },
    runDataBundledLinksTest: function () { return runDataBundledLinksTest(makeLog("selfTestOutput")); },
    runPortalBootTest: function () { return runPortalBootTest(makeLog("selfTestOutput")); },
    runPortalUiTest: function () { return runPortalUiTest(makeLog("selfTestOutput")); },
    runDraftSaveRestoreTest: function () { return runDraftSaveRestoreTest(makeLog("selfTestOutput")); },
    runSendLockTest: function () { return runSendLockTest(makeLog("selfTestOutput")); },
    runDemoStep: runDemoStep
  };
})();
