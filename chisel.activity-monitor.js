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

  let lastPulseAt = 0;
  let lastStatusAt = 0;
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
      value === "busy" ? "LOADING" :
      value === "ok" ? "ACTIVE" : "IDLE";
  }

  function pulse() {
    lastPulseAt = Date.now();
    clock.classList.remove("activityClockPulse");
    // Replay only when a new event arrives, never on clock ticks.
    void clock.offsetWidth;
    clock.classList.add("activityClockPulse");
    if (pulseTimer) clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => clock.classList.remove("activityClockPulse"), 750);
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
    const value = count && count.textContent.trim().replace(/\s+/g, " ");
    records.textContent = value ? value.slice(0, 72) : "Records: pending";
  }

  function syncProxy() {
    const status = byId("portalFileProxyHealth");
    const value = status && status.textContent.trim().replace(/\s+/g, " ");
    // Report only the component's actual status, never infer a connection.
    proxy.textContent = value ? value.slice(0, 90) : "FileProxy: untested";
  }

  window.chiselActivity = function (source, message, level) {
    originalActivity.apply(this, arguments);
    const src = String(source || "");
    const msg = String(message || "");
    const failure = level === "error" || /error|fail|rejected|timeout/i.test(msg);

    if (src === "Portal") {
      if (failure) {
        state("error");
        if (document.body.dataset.mode === "portal" && current.dataset.latched !== "error") {
          current.textContent = "Portal: request failed; inspect activity log";
          current.dataset.level = "error";
        }
        pulse();
      } else if (/response received/i.test(msg)) {
        state("ok");
        if (document.body.dataset.mode === "portal" && current.dataset.latched !== "error") {
          if (current.textContent !== "Portal: transaction stream updating") {
            current.textContent = "Portal: transaction stream updating";
          }
          current.dataset.level = "info";
        }
        pulse();
      } else if (/status changed/i.test(msg)) {
        state("ok");
        pulse();
      } else if (/loading/i.test(msg)) {
        state("busy");
        if (document.body.dataset.mode === "portal" && current.dataset.latched !== "error") {
          current.textContent = "Portal: loading transaction records";
          current.dataset.level = "busy";
        }
      }
    } else if (src === "Send" || src === "Broadcast") {
      state(failure ? "error" : /load|build|sign|broadcast/i.test(msg) ? "busy" : "ok");
      if (failure || /success|accepted|confirmed/i.test(msg)) pulse();
    } else if (src === "JavaScript" && failure) {
      state("error");
      pulse();
    }

    syncStream();
    syncRecords();
    if (src === "FileProxy") syncProxy();
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
      if (document.body.dataset.mode === "portal" && current.dataset.latched !== "error") {
        current.textContent = "Portal: no recent status updates";
        current.dataset.level = "info";
      }
    }
  }, 1000);
})();
