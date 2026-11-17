/* Optional, read-only context handoff for AI-assisted debugging.
   No network requests, wallet access, signing, or transaction actions. */
(function (root) {
  "use strict";

  const button = document.getElementById("copyAiContext");
  const status = document.getElementById("aiContextStatus");
  const preview = document.getElementById("aiContextPreview");

  function text(id, limit) {
    const el = document.getElementById(id);
    let value = el ? String(el.textContent || "").replace(/\\s+/g, " ").trim() : "";
    const diagnostics = root.CHISEL_DIAGNOSTICS;
    if (diagnostics && typeof diagnostics.clean === "function") {
      value = diagnostics.clean(value, limit || 240);
    }
    return value.slice(0, limit || 240);
  }

  function snapshot() {
    const monitor = document.getElementById("chiselActivityMonitor");
    const currency = document.getElementById("headerCurrency");
    const mode = document.body && document.body.dataset.mode || "unknown";
    return {
      schema: "chisel-workmode-context-v1",
      exportedAt: new Date().toISOString(),
      app: {
        name: "Chisel",
        version: root.CHISEL_RELEASE && root.CHISEL_RELEASE.version || "unknown"
      },
      page: {
        url: location.origin + location.pathname + "?mode=" + encodeURIComponent(mode),
        mode: mode,
        currency: currency && !currency.hidden ? String(currency.value || "") : null
      },
      activity: {
        state: monitor && monitor.dataset.state || "unknown",
        indicator: text("activityPulse", 40),
        current: text("activityCurrent", 240),
        records: text("activityRecords", 120),
        fileProxy: text("activityProxyState", 120)
      },
      privacy: "Read-only status summary. No keys, identity, balance, recipient, transaction body, or event log included."
    };
  }

  function announce(message, isError) {
    if (!status) return;
    status.textContent = message;
    status.dataset.level = isError ? "error" : "info";
  }

  async function copyContext() {
    const payload = JSON.stringify(snapshot(), null, 2);
    if (preview) {
      preview.value = payload;
      preview.hidden = true;
    }
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(payload);
      announce("Copied. Paste this read-only summary into the Work Mode conversation.", false);
    } catch (_) {
      if (preview) {
        preview.hidden = false;
        preview.focus();
        preview.select();
      }
      announce("Clipboard access was blocked. The summary is shown below for manual copy.", true);
    }
  }

  root.CHISEL_AI_CONTEXT = Object.freeze({ snapshot: snapshot });

  if (button) {
    button.addEventListener("click", copyContext);
  }
})(window);
