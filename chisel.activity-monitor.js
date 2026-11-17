/* Chisel activity monitor: presentation only; does not fetch, sign, or broadcast. */
(function () {
  "use strict";

  const byId = id => document.getElementById(id);
  const monitor = byId("chiselActivityMonitor");
  const clock = byId("activityClock");
  const badge = byId("activityPulse");
  const stream = byId("activityStream");
  const records = byId("activityRecords");
  const proxy = byId("activityProxyState");
  const current = byId("activityCurrent");
  const originalActivity = window.chiselActivity;

  if (!monitor || !clock || !badge || !stream || !records || !proxy ||
      !current || typeof originalActivity !== "function") return;

  let lastStatusAt = Date.now();
  let pulseTimer = null;

  function tick() {
    clock.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  }

  function state(value) {
    if (value !== "idle") lastStatusAt = Date.now();
    monitor.dataset.state = value;
    badge.textContent = value === "error" ? "ERROR" :
      value === "busy" ? "WORKING" :
      value === "ok" ? "READY" : "IDLE";
  }

  function pulse() {
    clock.classList.remove("activityClockPulse");
    // Replay the animation only when a real activity event arrives.
    void clock.offsetWidth;
    clock.classList.add("activityClockPulse");
    if (pulseTimer) clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => clock.classList.remove("activityClockPulse"), 750);
  }

  function clean(value, limit) {
    const diagnostics = window.CHISEL_DIAGNOSTICS;
    const raw = String(value == null ? "" : value).replace(/\\s+/g, " ").trim();
    return diagnostics && typeof diagnostics.clean === "function"
      ? diagnostics.clean(raw, limit || 220)
      : raw.slice(0, limit || 220);
  }

  function syncStream() {
    const caption = byId("portalIndexCaption");
    const label = (caption && caption.textContent || "").split(":")[0].trim();
    if (label && label.length < 90) {
      // The caption's trailing address is deliberately not repeated in the header.
      stream.textContent = label;
      return;
    }
    const select = byId("portalThunderwordSelect");
    const option = select && select.selectedOptions && select.selectedOptions[0];
    stream.textContent = option ? option.textContent.trim() : "Waiting for stream";
  }

  function syncRecords() {
    const count = byId("portalExplorerCount");
    const value = count && count.textContent.trim().replace(/\\s+/g, " ");
    records.textContent = value ? value.slice(0, 72) : "Records: pending";
  }

  function syncProxy() {
    const status = byId("portalFileProxyHealth");
    const value = status && status.textContent.trim().replace(/\\s+/g, " ");
    // Report only the component's actual status, never infer a connection.
    proxy.textContent = value ? value.slice(0, 90) : "FileProxy: untested";
  }

  function renderEvent(source, message, level) {
    const src = String(source || "Chisel").trim();
    const msg = String(message || "").trim();
    if (!msg) return;
    const failure = level === "error" || /error|fail|rejected|timeout|unavailable/i.test(msg);
    const working = /start|load|check|fetch|connect|build|sign|broadcast|wait|query|index|resolv|sync|pending/i.test(msg);
    const success = /ready|initialized|updated|connected|complete|loaded|confirmed|accepted|finished/i.test(msg);
    const nextState = failure ? "error" : working ? "busy" : success ? "ok" : null;

    // Every real subsystem event replaces the generic startup label.
    current.textContent = clean(src + ": " + msg, 240);
    current.title = current.textContent;
    current.dataset.level = failure ? "error" : working ? "busy" : "info";
    if (nextState) state(nextState);
    pulse();
  }

  window.chiselActivity = function (source, message, level, detail) {
    originalActivity.apply(this, arguments);
    const src = String(source || "");
    const msg = String(message || "");
    const failure = level === "error" || /error|fail|rejected|timeout|unavailable/i.test(msg);

    renderEvent(src, detail || msg, level);

    if (src === "Portal" && document.body.dataset.mode === "portal" &&
        current.dataset.latched !== "error") {
      current.dataset.level = failure ? "error" : /loading|pending/i.test(msg) ? "busy" : "info";
    }
    if (src === "FileProxy") syncProxy();
    syncStream();
    syncRecords();
  };

  const watchText = (id, sync) => {
    const element = byId(id);
    if (element) new MutationObserver(sync).observe(element, {
      childList: true, subtree: true, characterData: true
    });
  };
  watchText("portalIndexCaption", syncStream);
  watchText("portalExplorerCount", syncRecords);
  watchText("portalFileProxyHealth", syncProxy);
  byId("portalThunderwordSelect")?.addEventListener("change", syncStream);

  current.textContent = "Chisel: Loading browser modules…";
  state("busy");
  tick();
  syncStream();
  syncRecords();
  syncProxy();
  setInterval(() => {
    tick();
    // A ticking clock alone must not imply an active network connection.
    if (lastStatusAt && Date.now() - lastStatusAt > 12000 &&
        (monitor.dataset.state === "ok" || monitor.dataset.state === "busy")) {
      state("idle");
    }
  }, 1000);
})();
