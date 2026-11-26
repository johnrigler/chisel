/* Native Send form: Polygon short records only. Reuse the reviewed contract writer. */
(function(root) {
  "use strict";
  const $ = id => document.getElementById(id);
  const panel = $("polygonSendPanel");
  if (!panel) return;
  const key = $("polygonSendKey"), method = $("polygonSendMethod"), address = $("polygonSendAddress"),
    text = $("polygonSendText"), status = $("polygonSendStatus"), funds = $("polygonSendFunds"),
    preview = $("polygonSendPreview"), broadcast = $("polygonSendBroadcast"),
    reviewButton = $("polygonSendReview"), load = $("polygonSendLoadKey"),
    clear = $("polygonSendClearKey"), balanceButton = $("polygonSendBalance"), txLink = $("polygonSendTx"),
    saveKey = $("polygonSendSaveKey"), restoreKey = $("polygonSendRestoreKey"),
    credentialStatus = $("polygonSendCredentialStatus"), credentialForm = $("polygonSendCredentialForm");
  credentialForm.addEventListener("submit", event => event.preventDefault());
  if (!root.ethers || !root.CHISEL_EVM_LOCAL || !root.CHISEL_EVM_WRITE || !root.CHISEL_EVM_CONTRACTS) {
    status.textContent = "Polygon signing modules unavailable. Reload Chisel.";
    [load, reviewButton, broadcast, balanceButton, saveKey, restoreKey].forEach(b => b.disabled = true);
    panel.hidden = document.body.dataset.sendNetwork !== "polygon";
    return;
  }
  const local = root.CHISEL_EVM_LOCAL.createLocalWallet(root.ethers);
  const writer = root.CHISEL_EVM_WRITE.createWriter({registry:root.CHISEL_EVM_CONTRACTS, ethers:root.ethers});
  let provider = null, reviewed = null, generation = 0, busy = false, unresolved = "";
  // Only the loaded local identity has a saveable secret. Never persist it in app storage.
  let loadedSecret = "";
  function updateCredentialButtons() {
    saveKey.disabled = busy || method.value !== "local" || provider !== local || !loadedSecret || !address.value;
    restoreKey.disabled = busy || method.value !== "local";
  }
  saveKey.onclick = async function () {
    if (saveKey.disabled) return;
    if (!root.PasswordCredential || !navigator.credentials || typeof navigator.credentials.store !== "function") {
      credentialStatus.textContent = "Direct password-manager saving is unavailable in this browser. Open Chisel in Chrome, or add the credential manually in your password manager.";
      return;
    }
    const publicAddress = address.value;
    setBusy(true);
    try {
      const credential = new root.PasswordCredential({id:publicAddress,password:loadedSecret,name:"Polygon (POL) " + publicAddress});
      const result = await navigator.credentials.store(credential);
      credentialStatus.textContent = result ? "Credential offered to the browser password manager. Confirm its save prompt if shown." : "Browser did not confirm storage; check your password manager.";
    } catch (_) {
      credentialStatus.textContent = "Password-manager save was cancelled or unavailable. No key was stored by Chisel.";
    } finally { setBusy(false); }
  };
  restoreKey.onclick = async function () {
    if (restoreKey.disabled) return;
    if (!root.PasswordCredential || !navigator.credentials || typeof navigator.credentials.get !== "function") {
      credentialStatus.textContent = "Direct credential selection is unavailable here. Tap the private-key field and select a saved password from your browser.";
      key.focus();
      return;
    }
    setBusy(true);
    try {
      const credential = await navigator.credentials.get({password:true,mediation:"required"});
      if (!credential) { credentialStatus.textContent = "No saved credential selected."; return; }
      const candidate = root.CHISEL_EVM_LOCAL.walletFromKey(credential.password,root.ethers);
      if (!root.ethers.isAddress(credential.id) || candidate.address.toLowerCase() !== credential.id.toLowerCase()) {
        credentialStatus.textContent = "That credential does not match its Polygon address. Choose a saved Polygon identity.";
        return;
      }
      loadSecret(credential.password);
      credentialStatus.textContent = "Saved Polygon identity loaded.";
    } catch (_) {
      credentialStatus.textContent = "Could not load the selected credential. Choose a valid Polygon identity.";
    } finally { setBusy(false); }
  };
  const hashField = $("polygonSendHash"), checkTx = $("polygonSendCheckTx"), txStatus = $("polygonSendTxStatus");
  function showHash(hash) {
    hashField.value = hash;
    txLink.href = "https://polygonscan.com/tx/" + hash;
    txLink.hidden = false;
  }
  checkTx.onclick = async function () {
    const hash = hashField.value.trim();
    if (!/^0x[0-9a-f]{64}$/i.test(hash)) { txStatus.textContent = "Enter a 32-byte transaction hash."; return; }
    checkTx.disabled = true;
    showHash(hash);
    try {
      // Public lookup works without loading or unlocking any private key.
      const receipt = await local.request({method:"eth_getTransactionReceipt",params:[hash]});
      if (receipt) {
        if (String(receipt.transactionHash).toLowerCase() !== hash.toLowerCase()) throw Error("Receipt hash mismatch.");
        const state = BigInt(receipt.status);
        if (state !== 0n && state !== 1n) throw Error("Unrecognized receipt status.");
        txStatus.textContent = (state === 1n ? "Confirmed successfully" : "Confirmed, execution reverted") + " in block " + BigInt(receipt.blockNumber).toString() + ".";
        if (unresolved.toLowerCase() === hash.toLowerCase()) unresolved = "";
      } else {
        const tx = await local.request({method:"eth_getTransactionByHash",params:[hash]});
        if (tx && String(tx.hash).toLowerCase() !== hash.toLowerCase()) throw Error("Transaction hash mismatch.");
        txStatus.textContent = tx ? "Transaction found; awaiting receipt." : "Not found by this RPC. This is not proof of rejection; check PolygonScan before resending.";
      }
    } catch (_) { txStatus.textContent = "Receipt lookup failed. Check PolygonScan or another Polygon RPC."; }
    finally { checkTx.disabled = false; }
  };
  function message(s) { status.textContent = s; }
  function invalidate() {
    generation++; writer.invalidate(); local.invalidate(); reviewed = null;
    broadcast.disabled = true; preview.hidden = true; preview.textContent = "";
  }
  function disconnect() {
    invalidate(); local.lock(); provider = null; loadedSecret = ""; address.value = ""; funds.textContent = "";
    credentialStatus.textContent = "";
    updateCredentialButtons();
  }
  function setBusy(value) {
    busy = value;
    [load, reviewButton, clear, balanceButton, method, key, text].forEach(el => el.disabled = value);
    broadcast.disabled = value || !reviewed;
    updateCredentialButtons();
  }
  function sync() {
    const active = document.body.dataset.sendNetwork === "polygon";
    panel.hidden = !active;
    if (active) $("headerCurrency").value = "polygon";
  }
  const select = $("polygonSendCurrency");
  for (const option of $("currency").options) if (option.value !== "polygon") select.appendChild(option.cloneNode(true));
  select.onchange = function () {
    if (select.value === "polygon") return;
    $("currency").value = select.value;
    $("currency").dispatchEvent(new Event("change", {bubbles:true}));
    select.value = "polygon";
    sync();
  };
  $("currency").addEventListener("change", () => { setTimeout(sync, 0); });
  root.addEventListener("chisel:mode", sync);
  function loadSecret(value) {
    disconnect();
    method.value = "local";
    // Preserve the canonical 32-byte secret rather than a network-specific WIF.
    const canonical = root.CHISEL_EVM_LOCAL.walletFromKey(value,root.ethers).privateKey;
    const account = local.unlock(canonical);
    loadedSecret = canonical;
    key.value = "";
    address.value = account;
    provider = local;
    updateCredentialButtons();
    credentialStatus.textContent = "Save this Polygon identity to your password manager if you want to reuse it.";
    message("Polygon key loaded. Check funds or enter a record to review.");
  }
  function updateText() {
    invalidate();
    const count = new TextEncoder().encode(text.value).length;
    $("polygonSendBytes").textContent = count + " / 80 UTF-8 bytes";
  }
  function takeDraft(value) {
    if (typeof value === "string" && value.trim()) { text.value = value; updateText(); }
  }
  root.addEventListener("chisel:polygon-send", event => {
    sync();
    takeDraft(event.detail.text || $("opReturnAscii").value);
    if (!provider && $("senderWif").value.trim()) {
      try { loadSecret($("senderWif").value.trim()); } catch (_) { message("Load a valid Polygon key."); }
    }
  });
  root.addEventListener("chisel:share-loaded", event => {
    if (document.body.dataset.sendNetwork === "polygon") takeDraft(event.detail.content);
  });
  key.addEventListener("input", () => { disconnect(); message("Key changed. Load key to continue."); });
  method.addEventListener("change", () => { disconnect(); key.value = ""; message("Connect the selected signing method."); });
  clear.onclick = () => { disconnect(); key.value = ""; message("Identity cleared."); };
  text.addEventListener("input", updateText);
  load.onclick = async function() {
    if (busy) return;
    setBusy(true);
    try {
      if (method.value === "local") {
        if (key.value.trim()) loadSecret(key.value);
        if (!provider || provider !== local) throw Error("Enter a 64-hex private key or WIF.");
      } else {
        disconnect();
        const injected = root.ethereum;
        provider = injected && ((injected.providers || []).find(p => p.isMetaMask) || injected);
        if (!provider) throw Error("No injected wallet. Open Chisel in the MetaMask browser.");
      }
      const connected = await writer.connect(provider);
      if (connected.chainId !== 137) throw Error("Select Polygon mainnet (137) in your wallet.");
      address.value = connected.from;
      message("Connected to Polygon. Enter a record and review.");
    } catch (error) { message(error.message); }
    finally { key.value = ""; setBusy(false); }
  };
  balanceButton.onclick = async function() {
    if (busy) return;
    setBusy(true);
    try {
      if (!provider || !address.value) throw Error("Load a key first.");
      if (provider === local) funds.textContent = await local.balance() + " POL";
      else {
        if (BigInt(await provider.request({method:"eth_chainId"})) !== 137n) throw Error("Select Polygon mainnet.");
        funds.textContent = root.ethers.formatEther(BigInt(await provider.request({method:"eth_getBalance",params:[address.value,"latest"]}))) + " POL";
      }
    } catch(error) { message(error.message); } finally { setBusy(false); }
  };
  reviewButton.onclick = async function() {
    if (busy) return;
    if (unresolved) { message("Check the unresolved transaction before reviewing another send."); return; }
    invalidate(); setBusy(true);
    try {
      if (!provider || !address.value) throw Error("Load or connect a key first.");
      const token = generation;
      const data = root.CHISEL_EVM_SHARE.encodeText(text.value).hex;
      const result = await writer.prepare(provider,{deploymentId:"chisel.polygon.137",functionName:"logRecord",args:{logData:data}});
      const fees = provider === local ? await local.quote({from:result.from,to:result.to,data:result.data,value:result.value},result.gasEstimate) : null;
      if (token !== generation) throw Error("Draft changed. Review again.");
      reviewed = result;
      preview.textContent = JSON.stringify({chainId:result.chainId,from:result.from,to:result.to,calldata:result.data,gasEstimate:result.gasEstimate,fees},null,2);
      preview.hidden = false;
      message("Review the exact calldata and fee. SEND broadcasts only after confirmation.");
    } catch(error) { invalidate(); message(error.message); } finally { setBusy(false); }
  };
  broadcast.onclick = async function() {
    if (busy || !reviewed || document.body.dataset.sendNetwork !== "polygon") return;
    if (!root.confirm("Sign and broadcast this reviewed Polygon record?")) return;
    setBusy(true);
    try {
      const result = await writer.submit(provider,reviewed);
      invalidate();
      showHash(result.hash);
      message("Submitted: " + result.hash);
      txStatus.textContent = "Submitted; check receipt to confirm execution.";
    } catch(error) {
      invalidate();
      if (/^0x[0-9a-f]{64}$/i.test(error.transactionHash || "")) {
        unresolved = error.transactionHash;
        showHash(unresolved);
        txStatus.textContent = "Submission uncertain; check receipt before another send.";
      }
      message(error.message);
    } finally { setBusy(false); }
  };
  // One-time QR handoff; only same-tab sessionStorage and no secret in URL.
  const url = new URL(root.location.href);
  if (url.searchParams.get("qrKey") === "1" && document.body.dataset.sendNetwork === "polygon") {
    try {
      const raw = root.sessionStorage.getItem("chisel.pendingPolygonQrKey");
      root.sessionStorage.removeItem("chisel.pendingPolygonQrKey");
      const pending = JSON.parse(raw || "null"), age = pending ? Date.now()-pending.createdAt : Infinity;
      if (!pending || age < 0 || age >= 120000 || !/^[0-9a-f]{64}$/i.test(pending.privateKeyHex)) throw Error("Scanned key expired or unavailable. Scan again.");
      loadSecret(pending.privateKeyHex);
    } catch(error) { message(error.message); }
    url.searchParams.delete("qrKey");
    root.history.replaceState(root.history.state,"",url.href);
  }
  sync();
  updateCredentialButtons();
})(window);
