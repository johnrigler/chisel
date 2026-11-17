/* Browser share diagnostics. No keys, identity or transaction data transmitted. */
(function () {
  "use strict";
  const button = document.getElementById("shareApiTest");
  const copy = document.getElementById("shareApiCopy");
  const output = document.getElementById("shareApiTrace");
  const traceKey = "chisel.share.trace.v1";
  if (!button || !copy || !output) return;

  let lines = [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(traceKey) || "[]");
    if (Array.isArray(saved)) lines = saved.slice(-100).filter(item => item && typeof item.at === "string" && typeof item.message === "string");
  } catch (_) {}

  function clean(value) {
    const diagnostics = window.CHISEL_DIAGNOSTICS;
    return diagnostics && typeof diagnostics.clean === "function"
      ? diagnostics.clean(value, 1000)
      : String(value == null ? "" : value).slice(0, 1000);
  }
  function render() {
    output.textContent = lines.map(entry => new Date(entry.at).toLocaleTimeString() + " " + entry.message).join("\n") || "Share API: not tested";
  }
  function log(message, level) {
    const safeMessage = clean(message);
    lines.push({at: new Date().toISOString(), message: safeMessage});
    if (lines.length > 100) lines = lines.slice(-100);
    try { sessionStorage.setItem(traceKey, JSON.stringify(lines)); } catch (_) {}
    render();
    const severity = level || (/failed|unavailable|rejected/i.test(safeMessage) ? "error" : "info");
    if (window.CHISEL_DIAGNOSTICS && typeof window.CHISEL_DIAGNOSTICS.record === "function") {
      window.CHISEL_DIAGNOSTICS.record("share.trace", safeMessage, {level: severity});
    }
    if (typeof window.chiselActivity === "function") window.chiselActivity("Share", safeMessage, severity);
    console.info("[Chisel share trace]", safeMessage);
  }
  function snapshot() {
    return {
      apiAvailable: typeof navigator.share === "function",
      canShareAvailable: typeof navigator.canShare === "function",
      secureContext: !!window.isSecureContext,
      userActivation: !!(navigator.userActivation && navigator.userActivation.isActive),
      recentTrace: lines.slice(-50)
    };
  }
  function clear() {
    lines = [];
    try { sessionStorage.removeItem(traceKey); } catch (_) {}
    render();
  }
  window.CHISEL_SHARE_DIAGNOSTICS = Object.freeze({snapshot: snapshot, clear: clear});

  copy.addEventListener("click", function () {
    const report = lines.map(entry => new Date(entry.at).toLocaleTimeString() + " " + entry.message).join("\n") || output.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(report).then(function () { log("Trace copied", "info"); }).catch(function () {
        output.textContent = report + "\nClipboard unavailable. Select and copy this text.";
      });
    } else output.textContent = report + "\nClipboard unavailable. Select and copy this text.";
  });

  button.addEventListener("click", function () {
    const payload = {title:"Chisel share API test",text:"Test URL from Chisel",url:"https://youtu.be/Y75CulcxWRU"};
    const activated = !!(navigator.userActivation && navigator.userActivation.isActive);
    log("API: " + typeof navigator.share + " | canShare: " + typeof navigator.canShare +
      " | secure: " + String(!!window.isSecureContext) + " | activated: " + String(activated), activated ? "info" : "warn");
    if (typeof navigator.share !== "function") {
      log("Share unavailable: navigator.share is not exposed by this browser.", "error");
      return;
    }
    if (typeof navigator.canShare === "function") {
      try {
        const accepted = navigator.canShare(payload);
        log("canShare test payload: " + (accepted ? "accepted" : "rejected"), accepted ? "info" : "error");
        if (!accepted) return;
      } catch (error) {
        log("canShare failed: " + (error && error.name || "Error") + ": " + (error && error.message || "unknown"), "error");
        return;
      }
    }
    log("Invoking system chooser...");
    try {
      Promise.resolve(navigator.share(payload)).then(function () {
        log("Share resolved by browser (not proof that any target received it).");
      }).catch(function (error) {
        const name = error && error.name || "Error";
        const message = error && error.message || "unknown";
        log("Share failed: " + name + ": " + message, name === "AbortError" ? "warn" : "error");
      });
    } catch (error) {
      log("Share failed synchronously: " + (error && error.name || "Error") + ": " + (error && error.message || "unknown"), "error");
    }
  });
  render();
})();