(function (root) {
  "use strict";

  const TXID = /^[0-9a-f]{64}$/;
  const COINS = ["litecoin", "litecoinTestnet", "digibyte", "ravencoin", "bitcoin", "bsv", "bsvTestnet", "dogecoin", "ecash", "evm"];

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

  const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const BASE58_ID = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  function encodeTxid(value) {
    const hex = String(value || "").replace(/^0x/i, "").toLowerCase();
    if (!TXID.test(hex)) throw new Error("Expected a 32-byte transaction ID.");
    let n = BigInt("0x" + hex), encoded = "", zeros = 0;
    while (hex.slice(zeros * 2, zeros * 2 + 2) === "00") zeros++;
    while (n > 0n) { encoded = BASE58[Number(n % 58n)] + encoded; n /= 58n; }
    return "1".repeat(zeros) + encoded;
  }
  function decodeTxid(value) {
    if (typeof value !== "string" || !BASE58_ID.test(value)) throw new Error("Invalid Base58 transaction ID.");
    let n = 0n;
    for (const char of value) n = n * 58n + BigInt(BASE58.indexOf(char));
    if (n >= (1n << 256n)) throw new Error("Base58 transaction ID exceeds 32 bytes.");
    const hex = n.toString(16).padStart(64, "0");
    if (encodeTxid(hex) !== value) throw new Error("Noncanonical Base58 transaction ID.");
    return hex;
  }

  // A bare Base58 fragment is distinct from the older query-based format.
  function compactRecordUrl(row, base, qualify) {
    const coin = root.CHISEL_PORTAL_STORE.canonicalCoinForRow(row);
    const txid = String(row.txid || "").replace(/^0x/i, "").toLowerCase();
    if (!COINS.includes(coin) || !TXID.test(txid)) return "";
    const url = new URL(base);
    url.search = ""; url.hash = "";
    // Only the established Pages directory is known to have this redirect.
    // Preserve arbitrary static/IPFS gateway paths.
    if (url.origin === "https://johnrigler.github.io" && /^\/chisel(?:\/index\.html|\/)?$/.test(url.pathname)) url.pathname = "/chisel";
    if (qualify) url.searchParams.set("coin", coin);
    url.hash = encodeTxid(txid);
    return url.href;
  }

  function parseRoute(value) {
    const url = new URL(value), params = url.searchParams;
    const fragment = url.hash.slice(1);
    const compact = !params.has("txid") && BASE58_ID.test(fragment) && (!params.has("mode") || params.get("mode") === "portal");
    if (!params.has("txid") && !compact) return null;
    const txid = compact ? decodeTxid(fragment) : String(params.get("txid") || "").replace(/^0x/i, "").toLowerCase();
    const coin = root.CHISEL_PORTAL_STORE.normalizeCoinName(params.get("coin"));
    if (!TXID.test(txid) || ((!compact || params.has("coin")) && !COINS.includes(coin))) throw new Error("Record URL needs a valid TXID and, if specified, a supported currency.");
    const source = coin === "evm" && /^(?:evmGomez|evmJethro|evmPolygonThunderword|other)$/.test(params.get("source")) ? params.get("source") : "";
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
      if (/^(?:evmGomez|evmJethro|evmPolygonThunderword|other)$/.test(source)) url.searchParams.set("source", source);
      if (/^\d{1,15}$/.test(chain)) url.searchParams.set("chain", chain);
    }
    const source = publicDataUrl(dataUrl, base);
    if (source) url.searchParams.set("data", source);
    return url.href;
  }

  function facebookShareUrl(row, fileProxyBase, annotation, pageMetadata) {
    const store = root.CHISEL_PORTAL_STORE, coin = store.canonicalCoinForRow(row);
    const txid = String(row.txid || "").replace(/^0x/i, "").toLowerCase();
    if (!COINS.includes(coin) || !TXID.test(txid)) throw new Error("This record has no supported public share identity.");
    const base = new URL(String(fileProxyBase || ""));
    if (base.protocol !== "https:" || base.username || base.password) throw new Error("Facebook previews require a public HTTPS FileProxy URL.");
    base.pathname = base.pathname.replace(/\/+$/, "") + "/chisel-share";
    base.search = ""; base.hash = "";
    const metadata = annotation && annotation.metadata && typeof annotation.metadata === "object" ? annotation.metadata : {};
    pageMetadata = pageMetadata && typeof pageMetadata === "object" ? pageMetadata : {};
    const summary = row.summary || {};
    const cards = Array.isArray(summary.mediaCards) ? summary.mediaCards : [];
    const title = String(metadata.title || pageMetadata.title || summary.title || (coin.toUpperCase() + " record " + txid.slice(0,12))).trim().slice(0,200);
    const description = String(annotation && annotation.note || pageMetadata.description || summary.opReturnText || summary.primaryUrl ||
      (summary.title ? "Public ledger record: " + summary.title : coin.toUpperCase() + " transaction " + txid)).trim().slice(0,500);
    const image = String(metadata.image || pageMetadata.image || (cards[0] && (cards[0].thumbnailUrl || cards[0].image)) || "").trim();
    base.searchParams.set("coin", coin);
    base.searchParams.set("txid", txid);
    base.searchParams.set("title", title);
    base.searchParams.set("description", description);
    if (/^https:\/\//i.test(image)) base.searchParams.set("image", image);
    if (coin === "evm") {
      const chain = String(row.index && row.index.chainId || "");
      const source = store.sourceIdForRow(row);
      if (/^\d{1,15}$/.test(chain)) base.searchParams.set("chain", chain);
      if (/^(?:evmGomez|evmJethro|evmPolygonThunderword|other)$/.test(source)) base.searchParams.set("source", source);
    }
    return base.href;
  }
  function exportRecord(row, url, source, annotation) {
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
      url: url, sourceUrl: source || "", summary: presentation, opReturn: payloads, notes: annotation || null, raw: row.raw || null};
  }

  const SAVED_VIEWS_KEY = "chisel.portal.savedViews.v1";
  function savedViews() {
    try {
      const value = root.localStorage && JSON.parse(root.localStorage.getItem(SAVED_VIEWS_KEY) || "[]");
      return Array.isArray(value) ? value.filter(function (item) {
        return item && typeof item.key === "string" && typeof item.url === "string";
      }) : [];
    } catch (_) { return []; }
  }
  function savedViewKey(row) {
    const store = root.CHISEL_PORTAL_STORE, coin = store.canonicalCoinForRow(row);
    const txid = String(row.txid || "").replace(/^0x/i, "").toLowerCase();
    const chain = String(row.index && row.index.chainId || "");
    return [coin, txid, coin === "evm" ? store.sourceIdForRow(row) : "", coin === "evm" ? chain : ""].join(":");
  }
  function isSavedView(row) {
    return savedViews().some(function (item) { return item.key === savedViewKey(row); });
  }
  function saveView(row, url) {
    const key = savedViewKey(row), views = savedViews().filter(function (item) { return item.key !== key; });
    views.unshift({key: key, url: url, title: String(row.summary && row.summary.title || "").trim().slice(0, 200),
      savedAt: new Date().toISOString()});
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views.slice(0, 100)));
      return true;
    } catch (_) { return false; }
  }
  function removeSavedView(row) {
    const key = savedViewKey(row);
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews().filter(function (item) { return item.key !== key; })));
      return true;
    } catch (_) { return false; }
  }

  function createController(options) {
    const deps = options, doc = deps.document || root.document, state = deps.state;
    const get = function (id) { return doc.querySelector("#" + id); };
    let current = null, sequence = 0, bound = false, snapshot = null, lastRender = null;
    const active = function () { return !!current; };

    function refresh(force) {
      if (!current || current.lookup) return;
      const row = deps.find(current) || current.row;
      if (!row) return;
      current.row = row;
      const content = get("portalRecordContent"), source = deps.sourceUrl(row) ||
        publicDataUrl(current.dataUrl || row.staticRawUrl, root.location.href);
      const page = get("portalRecordPage");
      if (page) page.classList.toggle("isAwaitingLedger", root.CHISEL_PORTAL_STORE.ledgerDisplayState(row) === "awaiting-ledger");
      const url = recordUrl(row, root.location.href, source);
      const signature = [row, row.raw, row.summary, row.loadError, row.publication && row.publication.ledgerState,
        row.ledgerObserved, row.annotationRevision];
      if (content && (force || !lastRender || signature.some(function (value, i) { return value !== lastRender[i]; }))) {
        try { deps.render(content, row); }
        catch (error) {
          content.textContent = "Record display failed: " + (error.message || String(error));
          deps.status(content.textContent, true);
        }
        lastRender = signature;
      }
      const saveButton = get("portalRecordSaveView");
      if (saveButton) {
        const saved = isSavedView(row);
        saveButton.setAttribute("aria-pressed", saved ? "true" : "false");
        saveButton.setAttribute("aria-label", saved ? "Remove saved page view" : "Save this page view");
        saveButton.title = saved ? "Remove saved page view from this browser" : "Save this page view to this browser";
      }
      const json = get("portalRecordSource");
      if (json) { json.hidden = !source; if (source) json.href = source; }
      const download = get("portalRecordDownload");
      if (download) download.disabled = !row.raw;
      const status = get("portalRecordStatus");
      if (status) status.textContent = row.loadError || (!row.raw ? "Reading transaction…" : "");
      if (deps.onRefresh) deps.onRefresh(row);
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

    function setRecordControls(visible) {
      ["portalRecordSaveView", "portalRecordCopyLink", "portalRecordCopyQualifiedLink", "portalRecordFacebookLink",
        "portalRecordDownload", "portalRecordSource", "portalRecordExplore"].forEach(function (id) {
        const node = get(id); if (node) node.hidden = !visible;
      });
    }

    async function openUnqualified(route) {
      rememberList();
      const token = ++sequence;
      current = Object.assign({}, route, {lookup: true});
      lastRender = null;
      show();
      setRecordControls(false);
      const content = get("portalRecordContent"), status = get("portalRecordStatus");
      if (content) content.textContent = "";
      if (status) status.textContent = "Searching transaction catalogs across currencies…";
      let matches = [];
      try { matches = await deps.lookup(route); }
      catch (error) {
        if (token === sequence && status) status.textContent = "Catalog lookup failed: " + (error.message || String(error));
        return null;
      }
      if (token !== sequence || !current) return null;
      if (matches.length === 1) {
        const row = matches[0];
        const qualified = parseRoute(recordUrl(row, root.location.href, deps.sourceUrl(row)));
        return open(qualified, row, false);
      }
      if (status) status.textContent = matches.length ? matches.length + " matching ledger records in the available catalogs." :
        "Transaction not found in the available catalogs. Try a currency-qualified link or refresh the catalogs.";
      if (content) {
        matches.forEach(function (row) {
          const section = doc.createElement("section"), title = doc.createElement("a");
          const store = root.CHISEL_PORTAL_STORE, coin = store.canonicalCoinForRow(row);
          title.href = recordUrl(row, root.location.href, deps.sourceUrl(row));
          title.textContent = (store.tickerForCoin(coin) || coin) + " · " + (row.summary && row.summary.title || row.txid);
          title.onclick = function (event) {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            open(parseRoute(title.href), row, true);
          };
          section.appendChild(title);
          const detail = doc.createElement("p");
          detail.textContent = String(row.summary && (row.summary.opReturnText || row.summary.primaryUrl) || row.txid);
          section.appendChild(detail);
          content.appendChild(section);
        });
      }
      return matches;
    }

    async function open(route, row, push) {
      rememberList();
      const token = ++sequence;
      current = Object.assign({}, route, {row: row || deps.placeholder(route)});
      if (deps.onOpen) deps.onOpen(current.row);
      lastRender = null;
      show();
      setRecordControls(true);
      if (push && root.history) {
        try { root.history.pushState({chiselRecord: true}, "", recordUrl(current.row, root.location.href, deps.sourceUrl(current.row))); }
        catch (_) { /* The copyable link still works when local-file history is unavailable. */ }
      }
      refresh(true);
      const saveButton = get("portalRecordSaveView");
      if (saveButton && saveButton.focus) saveButton.focus({preventScroll: true});
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
        if (BASE58_ID.test(url.hash.slice(1))) { url.hash = ""; url.searchParams.delete("coin"); }
        if (root.history) { try { root.history.replaceState(null, "", url.href); } catch (_) {} }
        returnToList();
      }
    }

    function openFromUrl() {
      try {
        const route = parseRoute(root.location.href);
        if (!route) { if (current) returnToList(); return Promise.resolve(null); }
        return route.coin ? open(route, deps.find(route), false) : openUnqualified(route);
      } catch (error) { deps.status(error.message, true); return Promise.resolve(null); }
    }

    function bind() {
      if (bound) return Promise.resolve(null);
      bound = true;
      const backButton = get("portalRecordBack"), copy = get("portalRecordCopyLink"), facebook = get("portalRecordFacebookLink"), download = get("portalRecordDownload");
      const saveButton = get("portalRecordSaveView");
      if (saveButton) saveButton.onclick = function () {
        if (!current) return;
        const url = recordUrl(current.row, root.location.href, deps.sourceUrl(current.row));
        const succeeded = isSavedView(current.row) ? removeSavedView(current.row) : saveView(current.row, url);
        if (!succeeded) { deps.status("Could not save this view in this browser.", true); return; }
        refresh(false);
      };
      if (backButton) backButton.onclick = back;
      if (copy) copy.onclick = function () {
        if (!current) return;
        if (!current.row) return;
        deps.copy(compactRecordUrl(current.row, root.location.href), copy).catch(function (error) { deps.status(error.message, true); });
      };
      const qualifiedCopy = get("portalRecordCopyQualifiedLink");
      if (qualifiedCopy) qualifiedCopy.onclick = function () {
        if (!current || !current.row) return;
        deps.copy(compactRecordUrl(current.row, root.location.href, true), qualifiedCopy).catch(function (error) { deps.status(error.message, true); });
      };
      if (facebook) facebook.onclick = function () {
        if (!current) return;
        try {
          const annotation = deps.annotation ? deps.annotation(current.row) : null;
          const pageMetadata = deps.facebookPreviewMetadata ? deps.facebookPreviewMetadata(current.row) : null;
          const url = facebookShareUrl(current.row, deps.fileProxyUrl(), annotation, pageMetadata);
          deps.copy(url, facebook).catch(function (error) { deps.status(error.message, true); });
        } catch (error) { deps.status(error.message, true); }
      };

      if (download) download.onclick = function () {
        if (!current || !current.row.raw) return;
        const source = deps.sourceUrl(current.row), url = recordUrl(current.row, root.location.href, source);
        const annotation = deps.annotation ? deps.annotation(current.row) : null;
        const blob = new Blob([JSON.stringify(exportRecord(current.row, url, source, annotation), null, 2)], {type: "application/json"});
        const objectUrl = URL.createObjectURL(blob), link = doc.createElement("a");
        link.href = objectUrl;
        link.download = "chisel-" + current.coin + "-" + current.txid + ".json";
        link.click();
        root.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
      };
      root.addEventListener("popstate", openFromUrl);
      return openFromUrl();
    }

    return {active: active, currentRow: function () { return current && current.row; }, refresh: refresh, bind: bind, back: back, openFromUrl: openFromUrl,
      openRow: function (row) {
        const route = parseRoute(recordUrl(row, root.location.href, deps.sourceUrl(row)));
        return open(route, row, true);
      }};
  }

  root.CHISEL_PORTAL_RECORD = {publicDataUrl: publicDataUrl, parseRoute: parseRoute, recordUrl: recordUrl,
    compactRecordUrl: compactRecordUrl, encodeTxid: encodeTxid, decodeTxid: decodeTxid,
    facebookShareUrl: facebookShareUrl, exportRecord: exportRecord, createController: createController};
})(window);
