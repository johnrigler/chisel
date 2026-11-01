(function (root) {
  "use strict";

  const TXID = /^[0-9a-f]{64}$/;
  const COINS = ["litecoin", "litecoinTestnet", "digibyte", "ravencoin", "bitcoin", "dogecoin", "ecash", "evm"];

  // Share only public, credential-free file URLs. Local API configuration and
  // unrelated URL parameters must never be copied into a record link.
  function publicDataUrl(value, base) {
    if (!value) return "";
    try {
      const url = new URL(value, base);
      const host = url.hostname.toLowerCase();
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash ||
          /^(?:localhost|.*\.localhost|.*\.local|0\.0\.0\.0|127\..*|10\..*|192\.168\..*|169\.254\..*|172\.(?:1[6-9]|2\d|3[01])\..*|\[.*\])$/.test(host)) return "";
      return url.href;
    } catch (_) { return ""; }
  }

  function parseRoute(value) {
    const url = new URL(value), params = url.searchParams;
    if (!params.has("txid")) return null;
    const txid = String(params.get("txid") || "").replace(/^0x/i, "").toLowerCase();
    const coin = root.CHISEL_PORTAL_STORE.normalizeCoinName(params.get("coin"));
    if (!TXID.test(txid) || !COINS.includes(coin)) throw new Error("Record URL needs a supported currency and a 64-hex TXID.");
    const source = coin === "evm" && /^(?:evmGomez|evmJethro|other)$/.test(params.get("source")) ? params.get("source") : "";
    const chain = coin === "evm" && /^\d{1,15}$/.test(params.get("chain")) ? params.get("chain") : "";
    return {coin: coin, txid: txid, sourceId: source, chainId: chain, dataUrl: publicDataUrl(params.get("data"), url.href)};
  }

  function recordUrl(row, base, dataUrl) {
    const store = root.CHISEL_PORTAL_STORE, coin = store.canonicalCoinForRow(row);
    const txid = String(row.txid || "").replace(/^0x/i, "").toLowerCase();
    if (!COINS.includes(coin) || !TXID.test(txid)) return "";
    const url = new URL(base);
    url.search = "";
    url.hash = "";
    url.searchParams.set("mode", "portal");
    url.searchParams.set("coin", coin);
    url.searchParams.set("txid", txid);
    if (coin === "evm") {
      const source = store.sourceIdForRow(row), chain = String(row.index && row.index.chainId || "");
      if (/^(?:evmGomez|evmJethro|other)$/.test(source)) url.searchParams.set("source", source);
      if (/^\d{1,15}$/.test(chain)) url.searchParams.set("chain", chain);
    }
    const source = publicDataUrl(dataUrl, base);
    if (source) url.searchParams.set("data", source);
    return url.href;
  }

  function exportRecord(row, url, source) {
    const summary = row.summary || {}, presentation = {};
    ["title", "primaryUrl", "opReturnText", "mediaCards", "blockTime", "blockHeight"].forEach(function (field) {
      if (summary[field] !== undefined) presentation[field] = summary[field];
    });
    const tx = row.raw && (row.raw.tx || row.raw), candidateOutputs = tx && (tx.vout || tx.outputs);
    const outputs = Array.isArray(candidateOutputs) ? candidateOutputs : [];
    const payloads = outputs.map(function (output, index) {
      const payload = root.CHISEL_PORTAL_PAYLOAD.fromOutput(output);
      return payload && Object.assign({output: output.n == null ? index : output.n}, payload);
    }).filter(Boolean);
    if (payloads.length) presentation.opReturnText = payloads.map(function (payload) { return payload.text; }).filter(Boolean).join("\n");
    return {schema: "chisel-record-v1", coin: root.CHISEL_PORTAL_STORE.canonicalCoinForRow(row), txid: row.txid,
      url: url, sourceUrl: source || "", summary: presentation, opReturn: payloads, raw: row.raw || null};
  }

  function createController(options) {
    const deps = options, doc = deps.document || root.document, state = deps.state;
    const get = function (id) { return doc.querySelector("#" + id); };
    let current = null, sequence = 0, bound = false, snapshot = null, lastRender = null;
    const active = function () { return !!current; };

    function refresh(force) {
      if (!current) return;
      const row = deps.find(current) || current.row;
      if (!row) return;
      current.row = row;
      const content = get("portalRecordContent"), source = deps.sourceUrl(row);
      const page = get("portalRecordPage");
      if (page) page.classList.toggle("isAwaitingLedger", !!row.publication && row.publication.ledgerState !== "seen");
      const url = recordUrl(row, root.location.href, source);
      const signature = [row, row.raw, row.summary, row.loadError, row.publication && row.publication.ledgerState];
      if (content && (force || !lastRender || signature.some(function (value, i) { return value !== lastRender[i]; }))) {
        try { deps.render(content, row); }
        catch (error) {
          content.textContent = "Record display failed: " + (error.message || String(error));
          deps.status(content.textContent, true);
        }
        lastRender = signature;
      }
      const link = get("portalRecordUrl");
      if (link) { link.href = url; link.textContent = url; }
      const json = get("portalRecordSource");
      if (json) { json.hidden = !source; if (source) json.href = source; }
      const download = get("portalRecordDownload");
      if (download) download.disabled = !row.raw;
      const status = get("portalRecordStatus");
      if (status) status.textContent = row.loadError || (!row.raw ? "Reading transaction…" : "");
    }

    function show() {
      const list = get("portalListView"), page = get("portalRecordPage");
      if (list) list.hidden = true;
      if (page) page.hidden = false;
    }

    function rememberList() {
      if (snapshot) return;
      const list = get("portalTransactionList");
      snapshot = {url: root.location.href, page: state.portalPage, scrollY: root.scrollY || 0,
        listScroll: list && list.scrollTop || 0, focus: doc.activeElement};
    }

    async function open(route, row, push) {
      rememberList();
      const token = ++sequence;
      current = Object.assign({}, route, {row: row || deps.placeholder(route)});
      lastRender = null;
      show();
      if (push && root.history) {
        try { root.history.pushState({chiselRecord: true}, "", recordUrl(current.row, root.location.href, deps.sourceUrl(current.row))); }
        catch (_) { /* The copyable link still works when local-file history is unavailable. */ }
      }
      refresh(true);
      const heading = get("portalRecordHeading");
      if (heading && heading.focus) heading.focus({preventScroll: true});
      const page = get("portalRecordPage");
      if (page && page.scrollIntoView) page.scrollIntoView({block: "start"});
      try {
        const resolved = await deps.resolve(route, current.row);
        if (token !== sequence || !current) return null;
        current.row = resolved;
        refresh(true);
        return resolved;
      } catch (error) {
        if (token !== sequence || !current) return null;
        current.row.loadError = error.message || String(error);
        refresh(true);
        deps.status(current.row.loadError, true);
        return current.row;
      }
    }

    function returnToList() {
      sequence += 1;
      current = null;
      lastRender = null;
      const list = get("portalListView"), page = get("portalRecordPage");
      if (page) page.hidden = true;
      if (list) list.hidden = false;
      if (snapshot) {
        state.portalPage = snapshot.page;
        const stream = get("portalTransactionList");
        if (stream) stream.scrollTop = snapshot.listScroll;
        if (snapshot.focus && snapshot.focus.focus) snapshot.focus.focus({preventScroll: true});
        if (root.scrollTo) root.scrollTo({top: snapshot.scrollY, behavior: "instant"});
        snapshot = null;
      }
      if (deps.onReturn) deps.onReturn();
    }

    function back() {
      if (root.history && root.history.state && root.history.state.chiselRecord && snapshot) root.history.back();
      else {
        const url = new URL(snapshot ? snapshot.url : root.location.href);
        ["txid", "data", "source", "chain"].forEach(function (key) { url.searchParams.delete(key); });
        if (root.history) { try { root.history.replaceState(null, "", url.href); } catch (_) {} }
        returnToList();
      }
    }

    function openFromUrl() {
      try {
        const route = parseRoute(root.location.href);
        if (!route) { if (current) returnToList(); return Promise.resolve(null); }
        return open(route, deps.find(route), false);
      } catch (error) { deps.status(error.message, true); return Promise.resolve(null); }
    }

    function bind() {
      if (bound) return Promise.resolve(null);
      bound = true;
      const backButton = get("portalRecordBack"), copy = get("portalRecordCopyLink"), download = get("portalRecordDownload");
      if (backButton) backButton.onclick = back;
      if (copy) copy.onclick = function () {
        if (!current) return;
        deps.copy(recordUrl(current.row, root.location.href, deps.sourceUrl(current.row)), copy).catch(function (error) { deps.status(error.message, true); });
      };
      if (download) download.onclick = function () {
        if (!current || !current.row.raw) return;
        const source = deps.sourceUrl(current.row), url = recordUrl(current.row, root.location.href, source);
        const blob = new Blob([JSON.stringify(exportRecord(current.row, url, source), null, 2)], {type: "application/json"});
        const objectUrl = URL.createObjectURL(blob), link = doc.createElement("a");
        link.href = objectUrl;
        link.download = "chisel-" + current.coin + "-" + current.txid + ".json";
        link.click();
        root.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
      };
      root.addEventListener("popstate", openFromUrl);
      return openFromUrl();
    }

    return {active: active, refresh: refresh, bind: bind, back: back, openFromUrl: openFromUrl,
      openRow: function (row) {
        const route = parseRoute(recordUrl(row, root.location.href, deps.sourceUrl(row)));
        return open(route, row, true);
      }};
  }

  root.CHISEL_PORTAL_RECORD = {publicDataUrl: publicDataUrl, parseRoute: parseRoute, recordUrl: recordUrl,
    exportRecord: exportRecord, createController: createController};
})(window);
