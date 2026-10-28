/* Read-only storage checks. Export endpoint locations and status, never payloads or URL queries. */
(function () {
  "use strict";

  const KEY = "chisel.data-diagnostics.v1", MAX_REQUESTS = 200, TIMEOUT_MS = 6000;
  let requests = [], lastRun = null, running = null, restoring = false;
  const byId = id => document.getElementById(id);
  const now = () => new Date().toISOString();

  function safeText(value) {
    return String(value == null ? "" : value)
      .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
      .replace(/\b(?:wif|private.?key|seed|mnemonic|authorization|password|token|secret)\s*[:=]\s*[^\s,;\/]+/gi, "[secret]")
      .slice(0, 300);
  }

  function publicPath(value) {
    let path = String(value || "");
    try { path = decodeURIComponent(path); } catch (_) {}
    return safeText(path.replace(/([/\\](?:home|Users)[/\\])[^/\\]+/g, "$1[user]")
      .replace(/([/\\](?:tokens?|secrets?|passwords?|keys?)[/\\])[^/\\]+/gi, "$1[redacted]"));
  }

  function endpoint(value) {
    try {
      const url = new URL(value, document.baseURI || location.href);
      if (!/^(https?:|file:)$/.test(url.protocol)) return "[unsupported endpoint]";
      return (url.protocol === "file:" ? "file://" : url.origin) + publicPath(url.pathname);
    } catch (_) { return "[invalid endpoint]"; }
  }

  function persist() {
    if (restoring) return;
    try { sessionStorage.setItem(KEY, JSON.stringify(requests)); } catch (_) {}
  }

  function request(info) {
    const item = {
      at: now(), component: safeText(info.component), operation: safeText(info.operation),
      endpoint: endpoint(info.url), method: info.method === "POST" ? "POST" : "GET",
      httpStatus: Number.isInteger(info.status) ? info.status : null,
      elapsedMs: Math.max(0, Math.round(Number(info.elapsedMs) || 0)),
      outcome: info.ok === true ? "passed" : "failed",
      reason: ["http", "network", "timeout", "json", "service"].includes(info.reason) ? info.reason : null
    };
    requests.push(item);
    requests = requests.slice(-MAX_REQUESTS);
    persist();
  }

  try {
    restoring = true;
    const saved = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    if (Array.isArray(saved)) saved.slice(-MAX_REQUESTS).forEach(item => {
      // Project known metadata fields; never copy arbitrary stored fields into an export.
      if (!item || typeof item !== "object") return;
      request({ component: item.component, operation: item.operation, url: item.endpoint,
        method: item.method, status: item.httpStatus, elapsedMs: item.elapsedMs,
        ok: item.outcome === "passed", reason: item.reason });
      requests[requests.length - 1].at = /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(item.at) ? item.at : now();
    });
  } catch (_) {} finally { restoring = false; }
  if (requests.length) persist();

  function log(type, message) { window.CHISEL_DIAGNOSTICS?.record(type, message); }

  function render() {
    const summary = byId("dataCheckSummary"), output = byId("dataCheckResults");
    if (summary) summary.textContent = running ? "Checking FileProxy and data paths…" : lastRun ?
      lastRun.summary.failed + " failed · " + lastRun.summary.warnings + " warnings · " + lastRun.summary.passed + " passed. Checked " + lastRun.finishedAt : "Data paths have not been checked yet.";
    if (!output) return;
    output.replaceChildren();
    (lastRun?.checks || []).forEach(check => {
      const row = document.createElement("li");
      row.className = "dataCheckResult";
      row.dataset.status = check.outcome;
      const title = document.createElement("strong");
      title.textContent = check.outcome.toUpperCase() + " · " + check.label + (check.httpStatus ? " · HTTP " + check.httpStatus : "");
      const message = document.createElement("div");
      message.textContent = check.message;
      row.append(title, message);
      if (check.endpoint) {
        const path = document.createElement("code");
        path.textContent = check.endpoint;
        row.appendChild(path);
      }
      output.appendChild(row);
    });
  }

  function busy(value) {
    ["runDataChecks", "downloadDebugJson", "clearDebugJson"].forEach(id => {
      const button = byId(id);
      if (button) button.disabled = value;
    });
    const panel = byId("dataChecksPanel");
    if (panel) { panel.open = true; panel.setAttribute("aria-busy", String(value)); }
    render();
  }

  function reason(error) {
    return error?.name === "AbortError" ? "timeout" : error?.name === "SyntaxError" ? "json" : "network";
  }

  async function probe(report, label, url, optional, validate) {
    const check = { label: label, endpoint: endpoint(url), outcome: "failed", httpStatus: null, elapsedMs: 0, message: "" };
    report.checks.push(check);
    const start = performance.now(), controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let value = null, failure = null;
    try {
      const target = new URL(url, document.baseURI || location.href);
      if (!/^(https?:|file:)$/.test(target.protocol) || target.username || target.password) throw new TypeError("Unsupported endpoint");
      const response = await fetch(target.href, { cache: "no-store", signal: controller.signal });
      check.httpStatus = response.status;
      if (!response.ok) {
        failure = "http";
        check.message = "HTTP " + response.status + (response.status === 503 ? ": service or reverse proxy unavailable." : ": path could not be read.");
      } else {
        value = await response.json();
        const invalid = validate ? validate(value) : null;
        if (invalid) { failure = "service"; check.message = invalid; }
        else { check.outcome = "passed"; check.message = "Readable JSON."; }
      }
    } catch (error) {
      failure = reason(error);
      check.message = failure === "timeout" ? "Timed out after 6 seconds." : failure === "json" ?
        "HTTP response was not valid JSON." : "Browser could not read this endpoint (network, CORS, TLS, mixed content, or invalid URL).";
    } finally {
      clearTimeout(timer);
      check.elapsedMs = Math.round(performance.now() - start);
    }
    if (failure) { value = null; check.outcome = optional ? "warning" : "failed"; }
    request({ component: "data-check", operation: label, url: url, status: check.httpStatus,
      elapsedMs: check.elapsedMs, ok: !failure, reason: failure });
    return { check: check, value: value };
  }

  function object(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function paths(value, fallback) { return (Array.isArray(value) ? value : typeof value === "string" ? [value] : fallback).filter(v => typeof v === "string" && v.trim()).slice(0, 6); }

  function storageMetadata(value) {
    if (!object(value)) return null;
    return {
      source: value.source === "CHISEL_DATA_ROOT" ? "CHISEL_DATA_ROOT" : "workspace-data",
      configured: publicPath(value.configured), resolved: publicPath(value.resolved),
      exists: value.exists === true, isDirectory: value.isDirectory === true, isSymlink: value.isSymlink === true,
      workspaceDataResolved: publicPath(value.workspaceDataResolved),
      workspaceDataExists: value.workspaceDataExists === true,
      workspaceDataMatches: typeof value.workspaceDataMatches === "boolean" ? value.workspaceDataMatches : null
    };
  }

  async function checkProxy(report, base) {
    const result = await probe(report, "FileProxy health", String(base).replace(/\/+$/, "") + "/ping", false,
      value => !object(value) || value.ok !== true || value.service !== "chisel-fileproxy" ? "Response is not a healthy Chisel FileProxy ping." : null);
    window.CHISEL_PORTAL?.applyDiagnosticsProxyHealth?.(base, !!result.value, result.check.httpStatus, result.value?.storage);
    if (!result.value) return;
    const storage = storageMetadata(result.value.storage);
    if (!storage) {
      report.checks.push({ label: "FileProxy data root", outcome: "warning",
        message: "This FileProxy does not report resolved storage paths yet. Update it to diagnose symlink and data-root mismatches.",
        configured: publicPath(result.value.data_root) });
      return;
    }
    const healthy = storage.exists && storage.isDirectory;
    report.checks.push({ label: "FileProxy data root", outcome: healthy ? "passed" : "failed", storage: storage,
      message: (healthy ? "Using " : "Missing or unusable data root: ") + storage.configured + " → " + storage.resolved + " (" + storage.source + ")." });
    if (storage.workspaceDataExists && storage.workspaceDataMatches === false) report.checks.push({
      label: "FileProxy workspace data link", outcome: "warning",
      message: "The checkout's data path resolves to " + storage.workspaceDataResolved + "; FileProxy uses " + storage.resolved + ". Static and service reads may differ."
    });
  }

  async function checkManifest(report, url, optional) {
    const result = await probe(report, "Data manifest", url, optional,
      value => !object(value) || (!value.defaultIndex && !value.schema && !value.version) ? "Response does not look like a data manifest." : null);
    if (!result.value) return;
    const manifest = result.value;
    // Match Portal's current path semantics exactly so this check tests the URL it really reads.
    const transport = window.CHISEL_PORTAL_STATIC_DATA;
    const base = manifest.baseUrl || String(url).slice(0, String(url).lastIndexOf("/") + 1);
    const indexUrl = typeof transport?.joinDataPath === "function" ? transport.joinDataPath(base, manifest.defaultIndex || "index/portal.index.json") :
      String(base).replace(/\/+$/, "") + "/" + String(manifest.defaultIndex || "index/portal.index.json").replace(/^\/+/, "");
    result.check.generatedAt = /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(manifest.generatedAt) ? manifest.generatedAt : null;
    result.check.records = Number.isFinite(manifest.records) ? manifest.records : null;
    result.check.message = "Manifest readable" + (result.check.records === null ? "" : "; " + result.check.records + " records") +
      (result.check.generatedAt ? "; generated " + result.check.generatedAt : "") + ".";
    const index = await probe(report, "Data index", indexUrl, optional,
      value => !(Array.isArray(value) || object(value) && [value.transactions, value.records, value.rows].some(Array.isArray)) ? "Response does not contain a transaction index." : null);
    if (index.value) {
      const rows = Array.isArray(index.value) ? index.value : [index.value.transactions, index.value.records, index.value.rows].find(Array.isArray);
      index.check.records = rows.length;
      index.check.message = "Index readable; " + rows.length + " records. Availability does not verify ledger contents.";
    }
    // Also show where the mirror's own colocated index lives when a page-relative base points elsewhere.
    try {
      const manifestUrl = new URL(url, document.baseURI || location.href);
      const actualIndex = new URL(indexUrl, document.baseURI || location.href);
      const colocatedIndex = new URL(manifest.defaultIndex || "index/portal.index.json", manifestUrl);
      if (manifestUrl.origin !== location.origin && actualIndex.origin !== manifestUrl.origin) report.checks.push({
        label: "Manifest base path", outcome: "warning", endpoint: endpoint(indexUrl),
        message: "This remote manifest resolves its index on the page's host. Check baseUrl if that is unintended. Colocated index: " + endpoint(colocatedIndex.href)
      });
    } catch (_) {}
  }

  function run() {
    if (running) return running;
    log("data.checks", "Read-only data checks started");
    running = (async function () {
      const report = { startedAt: now(), finishedAt: null, checks: [], summary: {} };
      const loaded = await probe(report, "Portal configuration", "chisel.portal.config.json", true,
        value => !object(value) || value.ok === false ? "Portal configuration is not a JSON object." : null);
      let runtime;
      try { runtime = window.CHISEL_PORTAL?.getDiagnosticsConfig?.(); }
      catch (_) { report.checks.push({ label: "Portal runtime configuration", outcome: "warning", message: "Portal's settings could not be read; checking the configuration file or defaults." }); }
      const config = runtime || loaded.value || {};
      report.configurationSource = runtime ? "portal-runtime" : loaded.value ? "file" : "defaults";
      const manifests = Array.from(new Set([
        ...paths(config.staticManifestPaths, ["data/manifest.json", "data-bundled/manifest.json"]),
        ...paths(config.staticManifestMirrors, ["https://rigler.org/chisel-data/manifest.json"])
      ])).slice(0, 8);
      const checks = [checkProxy(report, config.fileProxyUrl || "https://rigler.org/fileproxy"),
        ...manifests.map(url => checkManifest(report, url, true))];
      // An old-name alias is optional: a missing alias is not a failed canonical datastore.
      const aliases = new Set();
      manifests.forEach(url => {
        try {
          const alias = new URL(url, document.baseURI || location.href);
          if (/\/chisel[-_]data\//.test(alias.pathname)) {
            alias.pathname = alias.pathname.replace(/\/chisel([-_])data\//, (_, separator) => separator === "-" ? "/chisel_data/" : "/chisel-data/");
            if (!manifests.some(path => new URL(path, document.baseURI || location.href).href === alias.href)) aliases.add(alias.href);
          }
        } catch (_) {}
      });
      aliases.forEach(url => checks.push(probe(report, "Alternate data-directory spelling (optional)", url, true,
        value => !object(value) ? "Alias did not return a JSON manifest." : null)));
      const completed = await Promise.allSettled(checks);
      completed.forEach(result => {
        if (result.status === "rejected") report.checks.push({ label: "Diagnostic checker", outcome: "failed", message: "A checker could not finish. Other check results have been retained." });
      });
      const indexes = report.checks.filter(check => check.label === "Data index");
      if (!indexes.some(check => check.outcome === "passed")) report.checks.push({ label: "Static data availability", outcome: "failed", message: "No configured static data index could be read." });
      report.finishedAt = now();
      report.summary = { passed: 0, warnings: 0, failed: 0 };
      report.checks.forEach(check => report.summary[check.outcome === "warning" ? "warnings" : check.outcome === "passed" ? "passed" : "failed"]++);
      lastRun = report;
      log("data.checks", report.summary.failed + " failed; " + report.summary.warnings + " warnings; " + report.summary.passed + " passed");
      return snapshot().lastRun;
    })().finally(() => { running = null; busy(false); });
    busy(true);
    return running;
  }

  function snapshot() { return JSON.parse(JSON.stringify({ schema: "chisel-data-diagnostics-v1", lastRun: lastRun, requests: requests })); }
  function clear() { requests = []; lastRun = null; try { sessionStorage.removeItem(KEY); } catch (_) {} render(); }
  window.CHISEL_DATA_DIAGNOSTICS = { request: request, run: run, snapshot: snapshot, clear: clear };
  document.addEventListener("DOMContentLoaded", function () {
    byId("runDataChecks")?.addEventListener("click", () => run().catch(() => {
      log("data.checks", "Data checks could not finish");
      const summary = byId("dataCheckSummary");
      if (summary) summary.textContent = "Data checks could not finish. Export debug JSON for the captured events.";
    }));
    render();
  });
})();
