/* Browser share diagnostics. No keys, identity or transaction data transmitted. */
(function () {
  "use strict";
  const button = document.getElementById("shareApiTest");
  const copy = document.getElementById("shareApiCopy");
  const output = document.getElementById("shareApiTrace");
  if (!button || !copy || !output) return;

  const lines = [];
  function log(message) {
    const entry = new Date().toLocaleTimeString() + " " + message;
    lines.push(entry);
    if (lines.length > 25) lines.shift();
    output.textContent = lines.join("\n");
    if (typeof window.chiselActivity === "function") {
      window.chiselActivity("Share", message, /failed|unavailable/i.test(message) ? "error" : "info");
    }
    console.info("[Chisel share trace]", message);
  }

  copy.addEventListener("click", function () {
    const report = lines.join("\n") || output.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(report).then(function () { log("Trace copied"); }).catch(function () {
        output.textContent = report + "\nClipboard unavailable. Select and copy this text.";
      });
    } else {
      output.textContent = report + "\nClipboard unavailable. Select and copy this text.";
    }
  });

  button.addEventListener("click", function () {
    const payload = {
      title: "Chisel share API test",
      text: "Test URL from Chisel",
      url: "https://youtu.be/Y75CulcxWRU"
    };
    log("API: " + (typeof navigator.share) +
      " | canShare: " + (typeof navigator.canShare) +
      " | secure: " + String(window.isSecureContext) +
      " | activated: " + String(!!(navigator.userActivation && navigator.userActivation.isActive)));
    if (typeof navigator.share !== "function") {
      log("Share unavailable: navigator.share is not exposed by this browser.");
      return;
    }
    if (typeof navigator.canShare === "function" && !navigator.canShare(payload)) {
      log("Share unavailable: navigator.canShare rejected test payload.");
      return;
    }
    log("Invoking system chooser...");
    // This call must occur synchronously in the click handler, preserving user activation.
    try {
      const operation = navigator.share(payload);
      Promise.resolve(operation).then(function () {
        log("Share resolved by browser (not proof that any target received it).");
      }).catch(function (error) {
        log("Share failed: " + (error && error.name || "Error") + ": " + (error && error.message || "unknown"));
      });
    } catch (error) {
      log("Share failed synchronously: " + (error && error.name || "Error") + ": " + (error && error.message || "unknown"));
    }
  });
})();
