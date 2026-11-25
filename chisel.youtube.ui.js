/* YouTube presentation layer. It never handles private keys, signing, or broadcast. */
(function(root) {
  "use strict";
  const share = root.CHISEL_SHARE_DRIVER;
  if (!share || typeof document !== "object") return;
  const $ = id => document.getElementById(id);
  const content = $("opReturnAscii");
  const sendPanel = document.querySelector('[data-mode-panel="etch"]');
  const workbench = $("sendCredentialForm")?.closest(".panel");
  if (!content || !sendPanel || !workbench) return;
  const ui = document.createElement("section");
  ui.id = "youtubeDriver";
  ui.hidden = true;
  ui.innerHTML = '<div class="ytEyebrow">CHISEL / YOUTUBE</div><h2 id="ytTitle">YouTube video</h2>' +
    '<img id="ytImage" alt="Video thumbnail" referrerpolicy="no-referrer">' +
    '<p id="ytLink" class="ytLink"></p><p id="ytIdentity"></p><p id="ytStatus" role="status" aria-live="polite"></p>' +
    '<label for="ytPublishChain">Publish using</label><select id="ytPublishChain"><option value="utxo">Saved Chisel key (UTXO)</option><option value="metamask">MetaMask (Polygon / POL)</option><option value="polygon">Other Polygon wallet</option></select>' +
    '<button id="ytSettings" type="button">Transaction settings</button>' +
    '<div class="ytActions"><button id="ytCancel" type="button">Cancel</button><button id="ytGo" type="button">Go</button></div>' +
    '<p class="ytNote">Go opens the final transaction review. No signing or broadcast occurs before your approval.</p>';
  sendPanel.insertBefore(ui, sendPanel.firstElementChild);
  workbench.classList.add("youtubeWorkbench");
  const css = document.createElement("style");
  css.textContent =
    '#youtubeDriver{background:#18222b;border:1px solid #34434f;border-radius:12px;color:#e7edf1;padding:20px;margin:0 0 16px;display:flex;flex-direction:column;gap:12px;max-width:760px}' +
    '#youtubeDriver[hidden]{display:none!important}#youtubeDriver h2{font-size:25px;margin:0}' +
    '#youtubeDriver .ytEyebrow{font:12px ui-monospace,monospace;color:#edb576;letter-spacing:.1em}' +
    '#ytImage{width:100%;max-height:35svh;min-height:120px;object-fit:contain;background:#10171d;border-radius:8px}' +
    '#ytLink{font:12px/1.5 ui-monospace,monospace;color:#a7b6c1;overflow-wrap:anywhere;margin:0}' +
    '#ytIdentity,#ytStatus{font:13px/1.5 system-ui,sans-serif;color:#c7d1d9;overflow-wrap:anywhere;margin:0}' +
    '#youtubeDriver button{border-radius:8px;padding:13px 16px;font-weight:700;cursor:pointer}' +
    '#ytSettings{align-self:flex-start;background:#23313c;color:#e7edf1;border:1px solid #34434f;font-size:13px}' +
    '.ytActions{display:flex;gap:12px;margin-top:8px}.ytActions button{min-height:72px;flex:1;font-size:23px}' +
    '#ytCancel{background:#7e252a;border:1px solid #c4484e;color:white}' +
    '#ytGo{background:#26964b;border:1px solid #45c96a;color:white}' +
    '#youtubeDriver .ytNote{font-size:12px;line-height:1.5;color:#a7b6c1;margin:0}' +
    'body.youtube-active [data-mode-panel="etch"]>.panel.hero{display:none}' +
    'body.youtube-active .youtubeWorkbench:not(.youtube-editing){display:none}' +
    '@media(max-width:600px){#youtubeDriver{padding:16px}.ytActions{margin-top:auto}}';
  document.head.appendChild(css);
  let title = "", titledContent = "";
  const chainChoice = $("ytPublishChain");
  const chainPreference = "chisel.youtube.publishChain.v1";
  try { const saved = root.localStorage.getItem(chainPreference); if (saved === "polygon" || saved === "metamask") chainChoice.value = saved; } catch (_) {}
  chainChoice.addEventListener("change", function() {
    try { root.localStorage.setItem(chainPreference, chainChoice.value); } catch (_) {}
    $("ytStatus").textContent = "";
    render();
  });
  function render() {
    const value = content.value.trim();
    const driver = share.forContent(value);
    if (driver.kind !== "youtube") {
      ui.hidden = true;
      document.body.classList.remove("youtube-active");
      workbench.classList.remove("youtube-editing");
      return;
    }
    const video = driver.describe(value);
    ui.hidden = false;
    document.body.classList.add("youtube-active");
    $("ytTitle").textContent = title && titledContent === value ? title : "YouTube video";
    $("ytImage").src = video.thumbnail;
    $("ytLink").textContent = value;
    const address = $("senderAddress")?.value.trim() || "";
    const coin = $("currency")?.selectedOptions[0]?.textContent || $("currency")?.value || "Selected chain";
    $("ytIdentity").textContent = chainChoice.value !== "utxo"
      ? (chainChoice.value === "metamask" ? "MetaMask" : "External wallet") + " · Polygon mainnet (137) · no saved Chisel key required."
      : address ? coin+" · "+address : coin+" · Select a signing identity in Transaction settings.";
    $("ytSettings").textContent = workbench.classList.contains("youtube-editing") ? "Hide transaction settings" : "Transaction settings";
  }
  $("ytSettings").onclick = function () {workbench.classList.toggle("youtube-editing");render();};
  $("ytCancel").onclick = function () {
    title = ""; titledContent = "";
    content.value = "";
    const hex = $("opReturnHex");
    if (hex) {hex.value = "";hex.dispatchEvent(new Event("input",{bubbles:true}));}
    content.dispatchEvent(new Event("input",{bubbles:true}));
    if (root.setGuiMode) root.setGuiMode("portal");
    render();
  };
  $("ytGo").onclick = function () {
    if (chainChoice.value !== "utxo") {
      try {
        const bridge = root.CHISEL_EVM_SHARE;
        if (!bridge) throw new Error("Polygon share bridge unavailable. Refresh Chisel.");
        if (chainChoice.value === "metamask") bridge.openMetaMask(content.value);
        else root.location.href = bridge.workbenchUrl(root.location.href, content.value);
      } catch (error) { $("ytStatus").textContent = error.message || String(error); }
      return;
    }
    if (!$("senderAddress")?.value.trim()) {
      workbench.classList.add("youtube-editing");
      $("ytStatus").textContent = "Load a Chisel identity before continuing.";
      render(); $("senderWif")?.focus();
      return;
    }
    $("ytStatus").textContent = "Preparing transaction for review…";
    $("sendButton")?.click(); // Existing audited review, local sign, broadcast.
  };
  root.addEventListener("chisel:share-loaded", function(event) {
    const detail = event.detail || {};
    titledContent = typeof detail.content === "string" ? detail.content.trim() : "";
    title = typeof detail.title === "string" ? detail.title.slice(0,160) : "";
    render();
  });
  content.addEventListener("input", function() {title="";render();});
  content.addEventListener("change",render);
  $("currency")?.addEventListener("change",render);
  $("senderAddress")?.addEventListener("change",render);
  if ($("status")) new MutationObserver(function() {
    if (!ui.hidden) $("ytStatus").textContent = $("status").textContent;
    render();
  }).observe($("status"),{subtree:true,childList:true,characterData:true});
  const metaButton = $("sendMetaMaskButton");
  if (metaButton) metaButton.onclick = function () {
    try { root.CHISEL_EVM_SHARE.openMetaMask(content.value); }
    catch (error) { $("sendMetaMaskStatus").textContent = error.message || String(error); }
  };
  render();
})(typeof window === "object" ? window : globalThis);
