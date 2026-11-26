(function (root) {
  "use strict";
  const mediaFiles = new WeakMap();
  const store = function () { return root.CHISEL_PORTAL_STORE; };
  function scope(row) {
    const coin = store().canonicalCoinForRow(row);
    return coin + (coin === "evm" ? ":" + String(row.index && row.index.chainId || row.summary && row.summary.chainId || "") : "");
  }
  function fileList(row) {
    if (/^bsv(?::|Testnet|$)/.test(scope(row)) && row.raw && root.CHISEL_BSV_MEDIA) {
      if (!mediaFiles.has(row.raw)) mediaFiles.set(row.raw, root.CHISEL_BSV_MEDIA.files(row.raw));
      return mediaFiles.get(row.raw);
    }
    return row.summary && Array.isArray(row.summary.files) ? row.summary.files : [];
  }
  function imageRow(row) {
    return fileList(row).some(function (file) { return /^image\//.test(file.mime); }) ||
      !!(row.summary && (row.summary.imageLines > 0 || row.summary.imageChordLines && row.summary.imageChordLines.length || row.summary.imageCount > 0 && row.summary.imageAssetPath));
  }
  function search(rows, current, options) {
    const words = String(options.query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter(function (row) {
      if (scope(row) !== scope(current)) return false;
      const summary = row.summary || {}, files = fileList(row);
      if (options.type === "images" && !imageRow(row)) return false;
      if (options.type === "models" && !files.some(file=>file.mime==="model/gltf-binary")) return false;
      if (options.type === "text" && !summary.opReturnText && !summary.cleanText && !files.some(function (file) { return /^text\//.test(file.mime); })) return false;
      if (options.block && (!summary.blockHeight || summary.blockHeight !== (current.summary || {}).blockHeight)) return false;
      const text = [row.txid, summary.title, summary.opReturnText, summary.cleanText, summary.primaryUrl, summary.blockHeight,
        (summary.evmWords || []).join(" "),
        (summary.imageChordLines || []).join(" "), files.map(function (file) { return [file.name, file.mime, file.protocol, file.metadata && file.metadata.collection].join(" "); }).join(" ")].join(" ").toLowerCase();
      return words.every(function (word) { return text.includes(word); });
    });
  }
  function createController(deps) {
    const doc = deps.document || root.document, get = function (id) { return doc.querySelector("#" + id); };
    const panel = get("portalRecordExplore");
    if (!panel) return {setRow: function () {}, clear: function () {}};
    const query = get("portalRecordSearch"), type = get("portalRecordFileType"), block = get("portalRecordBlockFilter");
    const results = get("portalRecordResults"), count = get("portalRecordResultCount"), inventory = get("portalRecordFiles");
    const resultNodes = new Map(), fileNodes = new Map();
    let current = null, generation = 0, checkedServices = false;
    function clearFiles() {
      generation += 1;
      fileNodes.forEach(function (view) { if (view.abort) view.abort.abort(); if (view.url) URL.revokeObjectURL(view.url); view.node.remove(); });
      fileNodes.clear();
    }
    function renderResults() {
      if (!current) return;
      const rows = search(deps.rows(), current, {query: query.value, type: type.value, block: block.value === "current"});
      const chain = store().tickerForCoin(store().canonicalCoinForRow(current));
      count.textContent = rows.length + " matching " + chain + " transaction" + (rows.length === 1 ? "" : "s") + " in the loaded catalog" + (rows.length > 40 ? " · first 40 shown" : "");
      const visible = new Set();
      rows.slice(0, 40).forEach(function (row) {
        const key = scope(row) + ":" + row.txid; visible.add(key);
        let view = resultNodes.get(key);
        if (!view) {
          const node = doc.createElement("a"); node.className = "portalRecordResult";
          const title = doc.createElement("strong"), detail = doc.createElement("span"); node.appendChild(title); node.appendChild(detail);
          view = {node: node, title: title, detail: detail}; resultNodes.set(key, view);
          node.onclick = function (event) {
            if (event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); deps.open(view.row);
          };
        }
        view.row = row; view.node.href = deps.recordUrl(row); view.title.textContent = (row.summary || {}).title || row.txid.slice(0, 16);
        if (imageRow(row) && /^(?:BSV data output|Truncated OP_RETURN preview)$/.test(view.title.textContent)) view.title.textContent = "BSV image file";
        const formats = Array.from(new Set(fileList(row).map(function (file) { return file.mime; }))).join(", ");
        view.detail.textContent = [formats, "block " + ((row.summary || {}).blockHeight || "unknown"), row.txid.slice(0, 16) + "…"].filter(Boolean).join(" · ");
        view.node.setAttribute("aria-current", row.txid === current.txid ? "page" : "false");
        if (results.children[visible.size - 1] !== view.node) results.insertBefore(view.node, results.children[visible.size - 1] || null);
      });
      resultNodes.forEach(function (view, key) { if (!visible.has(key)) { view.node.remove(); resultNodes.delete(key); } });
    }
    function renderFiles() {
      const coin = store().canonicalCoinForRow(current), bsv = /^(?:bsv|bsvTestnet)$/.test(coin);
      inventory.hidden = !bsv;
      if (!bsv) return;
      const files = fileList(current), visible = new Set();
      const map = current.raw && root.CHISEL_BSV_MEDIA ? root.CHISEL_BSV_MEDIA.metadata(current.raw) : [];
      const mapText = map.map(m=>m.protocol+" output "+m.output+": "+m.fields.map(f=>f.key+" = "+f.value).join(" · ")).join(" | ");
      get("portalRecordFileStatus").textContent = (files.length ? "Files in this transaction" : !current.raw ? "File inventory requires transaction data." : "No recognized BSV files in this transaction.") + (mapText ? " · "+mapText : "");
      files.forEach(function (file) {
        const key = file.output + ":" + file.protocol + ":" + file.part; visible.add(key);
        let view = fileNodes.get(key);
        if (!view) {
          const node = doc.createElement("div"), label = doc.createElement("p"), status = doc.createElement("p");
          node.className = "portalRecordFile"; node.appendChild(label); node.appendChild(status); inventory.appendChild(node);
          view = {node: node, label: label, status: status}; fileNodes.set(key, view);
        }
        view.file = file;
        view.label.textContent = [file.name || file.mime, file.protocol, file.metadata && file.metadata.collection, file.metadata && file.metadata.meshCount ? file.metadata.meshCount+" meshes" : "", file.metadata && file.metadata.traits && (file.metadata.traits.find(t=>t.trait==="Rarity") || {}).value, file.bytes.toLocaleString() + " bytes", "output " + file.output,
          file.mimeSource === "signature" ? "type from file signature" : "declared type"].filter(Boolean).join(" · ");
        if (!view.url && !view.abort) view.status.textContent = file.complete ? "File bytes available." : "Saved preview is incomplete. Retrieve the complete output on demand.";
        const links = root.CHISEL_BSV_MEDIA ? root.CHISEL_BSV_MEDIA.externalLinks(coin, current.txid, file, map) : [];
        const linkStamp = JSON.stringify(links);
        if (view.linkStamp !== linkStamp) {
          if (view.external) view.external.remove();
          view.external = null;
          view.linkStamp = linkStamp;
          if (links.length) {
            const actions = doc.createElement("div"); actions.className = "actions";
            links.forEach(function (entry) {
              const anchor = doc.createElement("a"); anchor.className = "secondaryButton";
              anchor.href = entry.url; anchor.target = "_blank"; anchor.rel = "noopener noreferrer";
              anchor.textContent = entry.label; anchor.title = "Open this inscription outpoint on an external site";
              actions.appendChild(anchor);
            });
            view.node.insertBefore(actions, view.status.nextSibling);
            view.external = actions;
          }
        }
        if (file.mime==="model/gltf-binary" && !view.modelButton) {
          const button=doc.createElement("button"); button.type="button"; button.className="secondaryButton";
          button.textContent="DOWNLOAD GLB"; view.modelButton=button; view.node.appendChild(button);
          button.onclick=async function() {
            const selected=current, token=generation, abort=new AbortController();
            view.abort=abort; button.disabled=true;
            const timeout=root.setTimeout(()=>abort.abort(),30000);
            try {
              view.status.textContent="Retrieving model bytes…";
              const raw=selected.raw?selected:await deps.hydrate(selected);
              if(generation!==token) return;
              let full=fileList(raw).find(e=>e.output===file.output && e.part===file.part && e.protocol===file.protocol);
              if(!full) throw Error("Model is absent from transaction.");
              if(!full.complete) full=await root.CHISEL_BSV_MEDIA.loadFile(coin,selected.txid,full,root.fetch.bind(root),abort.signal);
              if(generation!==token) return;
              if(!root.CHISEL_BSV_MEDIA.glbMetadata(full.data,full.bytes)) throw Error("Invalid GLB header.");
              const url=URL.createObjectURL(new Blob([full.data],{type:"model/gltf-binary"}));
              const link=doc.createElement("a"); link.href=url; link.download=(full.name||"bsv-model").replace(/[^a-zA-Z0-9._-]+/g,"-")+".glb";
              doc.body.appendChild(link); try { link.click(); } finally { link.remove(); root.setTimeout(()=>URL.revokeObjectURL(url),60000); }
              view.status.textContent="Download requested: "+full.data.length.toLocaleString()+" bytes. Output matches preview; transaction inclusion not independently verified.";
            } catch(error) { if(generation===token) view.status.textContent=abort.signal.aborted?"Model request timed out.":error.message||String(error); }
            finally { root.clearTimeout(timeout); if(generation===token) {view.abort=null;button.disabled=false;} }
          };
        }
        if (/^image\/(?:jpeg|png|gif|webp|svg\+xml|avif|bmp|x-icon)$/.test(file.mime) && !view.button) {
          const button = doc.createElement("button"); button.type = "button"; button.className = "secondaryButton"; button.textContent = "LOAD IMAGE"; view.button = button; view.node.appendChild(button);
          button.onclick = async function () {
            const token = generation, selected = current, abort = new AbortController(); view.abort = abort; button.disabled = true;
            const timeout = root.setTimeout(function () { abort.abort(); }, 30000);
            view.status.textContent = "Loading image bytes…";
            try {
              const raw = selected.raw ? selected : await deps.hydrate(selected);
              if (generation !== token) return;
              let full = fileList(raw).find(function (entry) { return entry.output === file.output && entry.part === file.part && entry.protocol === file.protocol; });
              if (!full) throw new Error("File is absent from the saved transaction.");
              if (!full.complete) full = await root.CHISEL_BSV_MEDIA.loadFile(coin, selected.txid, full, root.fetch.bind(root), abort.signal);
              if (generation !== token) return;
              if (!view.image) { view.image = doc.createElement("img"); view.image.alt = full.name || "BSV transaction image"; view.node.appendChild(view.image); }
              view.url = URL.createObjectURL(new Blob([full.data], {type: full.mime})); view.image.src = view.url;
              view.status.textContent = "Loaded " + full.data.length.toLocaleString() + " bytes."; button.hidden = true;
              view.image.onerror = function () { view.status.textContent = "The browser could not display this image."; };
            } catch (error) { if (generation === token) view.status.textContent = abort.signal.aborted ? "Image request timed out. Try loading it again." : error.message || String(error); }
            finally { root.clearTimeout(timeout); if (generation === token) { view.abort = null; button.disabled = false; } }
          };
        }
      });
      fileNodes.forEach(function (view, key) { if (!visible.has(key)) { if (view.abort) view.abort.abort(); if (view.url) URL.revokeObjectURL(view.url); view.node.remove(); fileNodes.delete(key); } });
    }
    async function services() {
      const status = get("portalRecordServiceStatus"); status.textContent = "Checking rigler.org services…";
      const settled = await Promise.allSettled([
        deps.checkFileProxy(), deps.checkScanner()
      ]);
      const describe = function (result, label) { return result.status === "fulfilled" ? label + ": " + result.value : label + ": " + (result.reason.message || String(result.reason)); };
      status.textContent = describe(settled[0], "FileProxy") + " · " + describe(settled[1], "BSV scanner feed");
    }
    query.addEventListener("input", renderResults); type.addEventListener("change", renderResults); block.addEventListener("change", renderResults);
    get("portalRecordRefreshCatalog").onclick = async function () {
      const button = get("portalRecordRefreshCatalog"); if (button.disabled) return; button.disabled = true;
      try {
        const refreshed = await Promise.allSettled([deps.refresh(), services()]);
        if (refreshed[0].status === "rejected") count.textContent = refreshed[0].reason.message;
        else renderResults();
      } finally { button.disabled = false; }
    };
    return {setRow: function (row) {
      if (!current || scope(current) !== scope(row)) { query.value = ""; type.value = "all"; block.value = "all"; }
      if (!current || scope(current) !== scope(row) || current.txid !== row.txid) clearFiles();
      current = row;
      get("portalRecordScope").textContent = "Explore " + store().tickerForCoin(store().canonicalCoinForRow(row));
      const option = get("portalRecordCurrentBlock"); option.textContent = "This block (" + ((row.summary || {}).blockHeight || "unknown") + ")"; option.disabled = !(row.summary || {}).blockHeight;
      renderResults(); renderFiles();
      if (!checkedServices) { checkedServices = true; services(); }
    }, clear: function () { clearFiles(); current = null; }};
  }
  root.CHISEL_PORTAL_EXPLORE = {scope: scope, fileList: fileList, imageRow: imageRow, search: search, createController: createController};
})(window);
