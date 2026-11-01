(function (root) {
  "use strict";
  const SCHEMA = "chisel-interaction-v1", COMMENT_TYPE = "chisel-comment-v1", STORAGE = "chisel.interactions.v1";
  const KINDS = ["visit", "select", "engage", "comment"], MODES = ["portal", "send", "review", "examples", "tools"];
  const COINS = ["litecoin", "litecoinTestnet", "digibyte", "ravencoin", "bitcoin", "dogecoin", "ecash", "evm"];
  const KEYS = ["schema", "id", "session", "kind", "at", "mode", "action", "subject", "title", "synopsis", "url", "comment", "author"];

  function text(value, maximum, name, required) {
    if (typeof value !== "string" || Array.from(value).length > maximum || required && !value.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error("Invalid " + name + ".");
    if (typeof value.isWellFormed === "function" && !value.isWellFormed()) throw new Error("Invalid Unicode in " + name + ".");
    return value;
  }
  function publicUrl(value, data) {
    text(value, 2048, "URL");
    if (!value) return "";
    const url = new URL(value), host = url.hostname.toLowerCase();
    if (!/^https?:$/.test(url.protocol) || url.username || url.password ||
        /^(?:localhost|.*\.localhost|.*\.local|0\..*|127\..*|10\..*|192\.168\..*|169\.254\..*|172\.(?:1[6-9]|2\d|3[01])\..*|\[.*\])$/.test(host) || data && (url.search || url.hash)) throw new Error("History links must be public URLs without credentials.");
    return value;
  }
  function subjectKey(subject) {
    if (subject === null) return "";
    if (!subject || Object.keys(subject).sort().join(",") !== "chainId,coin,dataUrl,sourceId,txid" || !COINS.includes(subject.coin) || !/^[0-9a-f]{64}$/.test(subject.txid)) throw new Error("Invalid record identity.");
    publicUrl(subject.dataUrl, true);
    if (subject.coin === "evm") {
      if (!["evmGomez", "evmJethro", "other"].includes(subject.sourceId) || !/^\d{1,15}$/.test(subject.chainId)) throw new Error("An EVM record needs its source and chain.");
      return "evm:" + subject.chainId + ":" + subject.sourceId + ":" + subject.txid;
    }
    if (subject.sourceId !== "" || subject.chainId !== "") throw new Error("UTXO records use currency and transaction identity.");
    return subject.coin + ":" + subject.txid;
  }
  function normalizePayload(value) {
    if (!value || Object.keys(value).sort().join(",") !== KEYS.slice().sort().join(",") || value.schema !== SCHEMA || !KINDS.includes(value.kind)) throw new Error("Invalid interaction payload.");
    for (const key of ["id", "session"]) if (typeof value[key] !== "string" || !/^[0-9a-f]{32}$/.test(value[key])) throw new Error("Invalid interaction " + key + ".");
    if (typeof value.at !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.at) || new Date(value.at).toISOString() !== value.at || !MODES.includes(value.mode)) throw new Error("Invalid interaction date or page.");
    for (const [key, maximum] of [["action", 48], ["title", 200], ["synopsis", 500], ["comment", 4000]]) text(value[key], maximum, key, key === "comment" && value.kind === "comment");
    publicUrl(value.url);
    if (!subjectKey(value.subject) && value.kind !== "visit") throw new Error("A record is required.");
    if (value.kind !== "comment" && (value.comment || value.author !== null)) throw new Error("Only comments have text and authors.");
    if (value.author !== null) {
      const author = value.author;
      if (!author || Object.keys(author).sort().join(",") !== "address,coin,identity" || author.coin !== "litecoin" || !/^chisel:v1:0[23][0-9a-f]{64}$/.test(author.identity) || !/^[1-9A-HJ-NP-Za-km-z]{26,35}$/.test(author.address)) throw new Error("Invalid comment author.");
    }
    return JSON.parse(JSON.stringify(value));
  }
  async function verifyDocument(document, crypto) {
    try {
      const payload = normalizePayload(document.payload);
      if (document.format === SCHEMA) return Object.keys(document).sort().join(",") === "format,payload" && payload.author === null ? {status: "anonymous"} : {status: "invalid"};
      const C = crypto || root.CHISEL;
      if (!C || document.format !== "chisel-signed-v1" || document.type !== COMMENT_TYPE || payload.kind !== "comment" || !payload.author || payload.author.identity !== document.identity || !await C.verifyArtifact(document)) return {status: "invalid"};
      const address = await C.litecoin.publicKeyHexToAddress(document.identity.slice(10), {network: "mainnet"});
      return address === payload.author.address ? {status: "verified", address: address, identity: document.identity} : {status: "invalid"};
    } catch (_) { return {status: "invalid"}; }
  }
  function createCommentSigner(deps) {
    return Object.freeze({available: function () { return !!deps.privateKey(); },
      sign: async function (value) {
        const payload = normalizePayload(value), C = deps.crypto, key = deps.privateKey();
        if (!key) throw new Error("Load an identity to sign this comment.");
        if (payload.kind !== "comment" || payload.author !== null) throw new Error("Only a new comment can be signed.");
        const identity = C.identityFromPrivateKey(key);
        payload.author = {identity: identity, coin: "litecoin", address: await C.litecoin.publicKeyHexToAddress(identity.slice(10), {network: "mainnet"})};
        const document = await C.signArtifact({type: COMMENT_TYPE, payload: payload, privateKeyHex: key});
        if (deps.privateKey() !== key) throw new Error("Identity changed before the comment was signed. Submit it again.");
        if ((await verifyDocument(document, C)).status !== "verified") throw new Error("Comment signature did not verify locally.");
        return document;
      }});
  }

  function createClient(deps) {
    const now = deps.now || function () { return new Date().toISOString(); };
    const random = deps.randomId || function () {
      const bytes = new Uint8Array(16); root.crypto.getRandomValues(bytes);
      return Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    };
    const session = random(), listeners = new Set(), feeds = new Map();
    const state = {enabled: true, storageAvailable: true, entries: [], outbox: [], error: "", online: false};
    let sending = null, retryAt = 0, currentBase = "";
    function base() {
      const url = new URL(deps.baseUrl());
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("History API needs a credential-free HTTP(S) base URL.");
      return url.href.replace(/\/+$/, "");
    }
    function notify() { for (const callback of listeners) callback(); }
    function save() {
      try { deps.writeStorage(STORAGE, JSON.stringify({enabled: state.enabled, entries: state.entries.slice(0, 500), outbox: state.outbox})); state.storageAvailable = true; }
      catch (_) { state.storageAvailable = false; }
    }
    function validEntry(entry, endpoint) {
      if (!entry || !entry.document) throw new Error("History API returned no document.");
      normalizePayload(entry.document.payload);
      if (entry.seq !== null && (!Number.isSafeInteger(entry.seq) || entry.seq <= 0)) throw new Error("Invalid history sequence.");
      return {seq: entry.seq, receivedAt: entry.receivedAt || "", document: entry.document, endpoint: endpoint, sha256: entry.sha256 || ""};
    }
    try {
      const saved = JSON.parse(deps.readStorage(STORAGE) || "null");
      if (saved) {
        state.enabled = saved.enabled !== false;
        for (const value of (Array.isArray(saved.entries) ? saved.entries : []).slice(0, 500)) {
          try { state.entries.push(validEntry(value, value.endpoint)); } catch (_) {}
        }
        for (const value of (Array.isArray(saved.outbox) ? saved.outbox : []).slice(0, 500)) {
          try { normalizePayload(value.document.payload); if (typeof value.endpoint === "string") state.outbox.push(value); } catch (_) {}
        }
      }
    } catch (_) { state.storageAvailable = false; }
    function endpoint() {
      const value = base();
      if (value !== currentBase) { currentBase = value; retryAt = 0; state.online = false; state.error = ""; }
      return value;
    }
    function matches(entry, filter) {
      const payload = entry.document.payload;
      return entry.endpoint === currentBase && (!filter.subject || subjectKey(payload.subject) === filter.subject) && (!filter.kind || payload.kind === filter.kind);
    }
    function order(a, b) {
      if (a.seq === null || b.seq === null) {
        if (a.seq !== b.seq) return a.seq === null ? -1 : 1;
        return b.document.payload.at.localeCompare(a.document.payload.at);
      }
      return b.seq - a.seq;
    }
    function merge(entries, source) {
      const byId = new Map(state.entries.map(function (entry) { return [entry.endpoint + ":" + entry.document.payload.id, entry]; }));
      const clean = entries.map(function (value) {
        const entry = validEntry(value, source), key = source + ":" + entry.document.payload.id, old = byId.get(key);
        if (old && JSON.stringify(old.document) !== JSON.stringify(entry.document)) throw new Error("History API changed an existing interaction document.");
        byId.set(key, entry); return entry;
      });
      state.entries = Array.from(byId.values()).sort(order).slice(0, 500);
      for (const feed of feeds.values()) {
        const items = new Map(feed.items.map(function (entry) { return [entry.document.payload.id, entry]; }));
        for (const entry of clean) if (matches(entry, feed.filter) && feed.endpoint === source) items.set(entry.document.payload.id, entry);
        feed.items = Array.from(items.values()).sort(order);
      }
      save(); notify(); return clean;
    }
    function fail(error, source) {
      if (source !== endpoint()) return;
      state.online = false; state.error = error.message || String(error);
      retryAt = Date.now() + 30000; notify();
    }
    async function flush(force) {
      const source = endpoint();
      if (sending) return sending;
      if (!force && Date.now() < retryAt) return;
      sending = (async function () {
        for (const queued of state.outbox.filter(function (item) { return item.endpoint === source; }).slice(0, 20)) {
          if (source !== endpoint()) return;
          try {
            const response = await deps.request(source, "/interactions", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(queued.document), keepalive: true});
            if (source !== endpoint()) return;
            if (!response.ok || !response.entry || response.entry.document.payload.id !== queued.document.payload.id || JSON.stringify(response.entry.document) !== JSON.stringify(queued.document)) throw new Error("History API did not preserve the submitted document.");
            merge([response.entry], source);
            state.outbox = state.outbox.filter(function (item) { return item !== queued; });
            state.online = true; state.error = ""; retryAt = 0; save(); notify();
          } catch (error) { fail(error, source); return; }
        }
      })();
      try { await sending; } finally {
        sending = null;
        if (!state.error && Date.now() >= retryAt && state.outbox.some(function (item) { return item.endpoint === currentBase; })) Promise.resolve().then(function () { flush(); });
      }
    }
    function getFeed(filter) {
      const source = endpoint(), normalized = {subject: filter && filter.subject || "", kind: filter && filter.kind || ""};
      const key = source + ":" + normalized.subject + ":" + normalized.kind;
      if (!feeds.has(key)) feeds.set(key, {endpoint: source, filter: normalized, items: state.entries.filter(function (entry) { return matches(entry, normalized); }).sort(order), hasMore: true, busy: false, error: "", loaded: false, after: null, catchupBefore: null, checkedAt: 0});
      return feeds.get(key);
    }
    async function refresh(filter, older, force) {
      const feed = getFeed(filter), source = feed.endpoint;
      if (feed.busy || !force && (Date.now() < retryAt || !older && Date.now() - feed.checkedAt < 15000)) return feed;
      feed.busy = true; notify();
      try {
        const stored = feed.items.filter(function (entry) { return entry.seq !== null; });
        const newest = stored.length ? Math.max.apply(null, stored.map(function (entry) { return entry.seq; })) : null;
        const oldest = stored.length ? Math.min.apply(null, stored.map(function (entry) { return entry.seq; })) : null;
        const params = new URLSearchParams({limit: "20"});
        if (feed.filter.subject) params.set("subject", feed.filter.subject);
        if (feed.filter.kind) params.set("kind", feed.filter.kind);
        if (older && oldest !== null) params.set("before", String(oldest));
        else if (feed.loaded && newest !== null) {
          params.set("after", String(feed.after === null ? newest : feed.after));
          if (feed.catchupBefore !== null) params.set("before", String(feed.catchupBefore));
        }
        const response = await deps.request(source, "/interactions?" + params.toString(), {cache: "no-store"});
        if (source !== endpoint()) return feed;
        if (!response.ok || !Array.isArray(response.entries)) throw new Error("History API returned an invalid page.");
        merge(response.entries, source);
        if (older || !feed.loaded) feed.hasMore = !!response.hasMore;
        else if (response.hasMore) { if (feed.after === null) feed.after = newest; feed.catchupBefore = response.before; }
        else { feed.after = null; feed.catchupBefore = null; }
        feed.loaded = true; feed.error = ""; feed.checkedAt = Date.now(); state.online = true; state.error = ""; retryAt = 0;
      } catch (error) { feed.error = error.message || String(error); fail(error, source); }
      finally { feed.busy = false; notify(); }
      return feed;
    }
    function payload(kind, record, options) {
      const opts = options || {}, item = record || {};
      return normalizePayload({schema: SCHEMA, id: random(), session: session, kind: kind, at: opts.at || now(), mode: MODES.includes(opts.mode) ? opts.mode : "portal", action: String(opts.action || kind),
        subject: item.subject || null, title: Array.from(String(item.title || "Chisel")).slice(0, 200).join(""), synopsis: Array.from(String(item.synopsis || "")).slice(0, 500).join(""),
        url: item.url || "", comment: opts.comment || "", author: null});
    }
    async function record(kind, item, options) {
      if (!state.enabled && kind !== "comment") return null;
      if (state.outbox.length >= 500) {
        state.error = "The history outbox is full. Export it or connect to the API before adding more entries.";
        notify(); throw new Error(state.error);
      }
      const source = endpoint(), value = payload(kind, item, options);
      const signer = deps.signer && deps.signer();
      let document;
      if (kind === "comment" && signer && signer.available()) document = await signer.sign(value);
      else document = {format: SCHEMA, payload: value};
      if (source !== endpoint()) throw new Error("History API changed. Submit the comment again.");
      if ((await verifyDocument(document, deps.crypto)).status === "invalid") throw new Error("The interaction document did not verify.");
      state.outbox.push({endpoint: source, document: document});
      merge([{seq: null, document: document}], source); save();
      flush().catch(function (error) { fail(error, source); });
      return document;
    }
    return {state: state, session: session, record: record, refresh: refresh, flush: flush, feed: getFeed,
      subscribe: function (callback) { listeners.add(callback); return function () { listeners.delete(callback); }; },
      setEnabled: function (enabled) { state.enabled = !!enabled; save(); notify(); },
      clearLocal: function () { state.entries = []; state.outbox = []; feeds.clear(); save(); notify(); },
      exportData: function () {
        const entries = new Map(state.entries.map(function (entry) { return [entry.endpoint + ":" + entry.document.payload.id, entry]; }));
        for (const feed of feeds.values()) for (const entry of feed.items) entries.set(entry.endpoint + ":" + entry.document.payload.id, entry);
        return {schema: "chisel-interaction-history-v1", exportedAt: now(), entries: Array.from(entries.values()).sort(order), outbox: state.outbox};
      }};
  }
  root.CHISEL_INTERACTIONS = {SCHEMA: SCHEMA, COMMENT_TYPE: COMMENT_TYPE, subjectKey: subjectKey, normalizePayload: normalizePayload,
    publicUrl: publicUrl, verifyDocument: verifyDocument, createCommentSigner: createCommentSigner, createClient: createClient};
})(window);
