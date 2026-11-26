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
  const recordFacts=new WeakMap();
  const list=v=>Array.isArray(v)?v:[];
  const norm=v=>String(v||"").trim().toLowerCase();
  function facts(row) {
    if (!/^bsv(?::|Testnet|$)/.test(scope(row))) return {apps:[],collections:[],parents:[],name:""};
    const summary=row.summary||{}, raw=row.raw, cached=recordFacts.get(row);
    if(cached && cached.raw===raw && cached.summary===summary) return cached.value;
    const api=root.CHISEL_BSV_MEDIA;
    const files=list(fileList(row)).concat(list(summary.files));
    const map=list(raw && api ? api.metadata(raw) : []).concat(list(summary.metadata));
    const uniq=values=>Array.from(new Map(values.filter(v=>typeof v==="string"&&v.trim()).map(v=>[norm(v),v.trim()])).values());
    const parents=list(raw && api ? api.parentInputs(raw) : []).concat(list(summary.parentInputs)).filter(p=>p && typeof p.txid==="string" && /^[a-f0-9]{64}$/i.test(p.txid) && Number.isInteger(p.vout) && p.vout>=0);
    const named=files.find(f=>f && f.protocol==="1Sat Ordinals" && f.name);
    const mapFields=map.filter(m=>m && m.protocol==="MAP").flatMap(m=>list(m.fields));
    const app=mapFields.find(f=>f&&f.key==="app"&&typeof f.value==="string");
    const type=mapFields.find(f=>f&&f.key==="type"&&typeof f.value==="string");
    const value={apps:uniq(map.filter(m=>m && m.protocol==="MAP").flatMap(m=>list(m.fields).filter(f=>f && f.key==="app").map(f=>f.value))),
      collections:uniq(files.map(f=>f && f.metadata && f.metadata.collection)),
      parents:Array.from(new Map(parents.map(p=>[norm(p.txid)+":"+p.vout,{txid:norm(p.txid),vout:p.vout}])).values()),
      name:named ? named.name+(named.mime==="model/gltf-binary"?" · 3D ordinal":" · inscription") : app && type ? app.value+" · "+type.value.replace(/_/g," ") : ""};
    recordFacts.set(row,{raw,summary,value});return value;
  }
  function matchesFacet(row,facet) {
    if(!facet)return true;
    const f=facts(row), value=norm(facet.value);
    if(facet.kind==="app")return f.apps.some(a=>norm(a)===value);
    if(facet.kind==="collection")return f.collections.some(a=>norm(a)===value);
    if(facet.kind==="parent")return norm(row.txid)===value||f.parents.some(p=>p.txid===value);
    return false;
  }
  function interpretationLines(row) {
    if(!/^bsv(?::|Testnet|$)/.test(scope(row)))return [];
    const raw=row.raw, summary=row.summary||{}, api=root.CHISEL_BSV_MEDIA;
    const map=list(raw&&api?api.metadata(raw):summary.metadata);
    const files=fileList(row);
    return files.map(f=>[f.name||f.mime,f.protocol,f.metadata&&f.metadata.collection,f.metadata&&f.metadata.meshCount?f.metadata.meshCount+" meshes":"",f.metadata&&list(f.metadata.traits).find(t=>t.trait==="Rarity")?.value,Number.isFinite(f.bytes)?f.bytes.toLocaleString()+" bytes":"","output "+f.output,f.complete?"complete":"partial preview"].filter(Boolean).join(" · ")).concat(map.map(m=>m.protocol+" output "+m.output+": "+list(m.fields).map(f=>f.key+" = "+f.value).join(" · ")));
  }
  function imageRow(row) {
    return fileList(row).some(function (file) { return /^image\//.test(file.mime); }) ||
      !!(row.summary && (row.summary.imageLines > 0 || row.summary.imageChordLines && row.summary.imageChordLines.length || row.summary.imageCount > 0 && row.summary.imageAssetPath));
  }
  function search(rows, current, options) {
    const words = String(options.query || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter(function (row) {
      if (scope(row) !== scope(current) || !matchesFacet(row,options.facet)) return false;
      const summary = row.summary || {}, files = fileList(row);
      if (options.type === "images" && !imageRow(row)) return false;
      if (options.type === "models" && !files.some(file=>file.mime==="model/gltf-binary")) return false;
      if (options.type === "text" && !summary.opReturnText && !summary.cleanText && !files.some(function (file) { return /^text\//.test(file.mime); })) return false;
      if (options.block && (!summary.blockHeight || summary.blockHeight !== (current.summary || {}).blockHeight)) return false;
      const f=facts(row);
      const text = [row.txid, f.name, ...f.apps, ...f.collections, ...f.parents.map(p=>p.txid), summary.title, summary.opReturnText, summary.cleanText, summary.primaryUrl, summary.blockHeight,
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
    let current = null, generation = 0, checkedServices = false, facet=null;
    const facetPanel=doc.createElement("div"); facetPanel.className="actions"; panel.insertBefore(facetPanel,get("portalRecordScope"));
    function clearFiles() {
      generation += 1;
      fileNodes.forEach(function (view) { if (view.abort) view.abort.abort(); if (view.url) URL.revokeObjectURL(view.url); view.node.remove(); });
      fileNodes.clear();
    }
    function renderResults() {
      if (!current) return;
      const rows = search(deps.rows(), current, {query: query.value, type: type.value, block: block.value === "current",facet:facet});
      const chain = store().tickerForCoin(store().canonicalCoinForRow(current));
      count.textContent = rows.length + " matching " + chain + " transaction" + (rows.length === 1 ? "" : "s") + " in the loaded catalog" + (rows.length > 40 ? " · first 40 shown" : "");
      if(facet) count.textContent += " · "+facet.kind+": "+facet.value;
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
        view.row = row; view.node.href = deps.recordUrl(row); view.title.textContent = facts(row).name || (row.summary || {}).title || row.txid.slice(0, 16);
        if (imageRow(row) && /^(?:BSV data output|Truncated OP_RETURN preview)$/.test(view.title.textContent)) view.title.textContent = "BSV image file";
        const formats = Array.from(new Set(fileList(row).map(function (file) { return file.mime; }))).join(", ");
        const related=facts(row).parents.filter(p=>facet&&facet.kind==="parent"&&p.txid===facet.value).map(p=>"parent output "+p.vout).join(", ");
        view.detail.textContent = [related,formats, "block " + ((row.summary || {}).blockHeight || "unknown"), row.txid.slice(0, 16) + "…"].filter(Boolean).join(" · ");
        view.node.setAttribute("aria-current", row.txid === current.txid ? "page" : "false");
        if (results.children[visible.size - 1] !== view.node) results.insertBefore(view.node, results.children[visible.size - 1] || null);
      });
      resultNodes.forEach(function (view, key) { if (!visible.has(key)) { view.node.remove(); resultNodes.delete(key); } });
    }
    function renderFacets() {
      facetPanel.replaceChildren();
      const f=facts(current);
      function add(kind,value,label) {
        const b=doc.createElement("button"); b.type="button";b.className="secondaryButton";b.textContent=label;
        b.setAttribute("aria-pressed",String(!!facet&&facet.kind===kind&&norm(facet.value)===norm(value)));
        b.onclick=()=>{facet={kind,value};query.value="";type.value="all";block.value="all";renderFacets();renderResults();};
        facetPanel.appendChild(b);
      }
      f.apps.forEach(a=>add("app",a,"Explore "+a));
      f.collections.forEach(a=>add("collection",a,"Collection: "+a));
      Array.from(new Set(f.parents.map(p=>p.txid))).forEach(txid=>{
        add("parent",txid,"Related: parent "+txid.slice(0,12)+"…");
        const a=doc.createElement("a");a.className="secondaryButton";a.textContent="Open parent in Chisel";
        const coin=store().canonicalCoinForRow(current);
        a.href=deps.parentUrl(coin,txid);
        a.onclick=event=>{if(event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();deps.openParent(coin,txid);};
        facetPanel.appendChild(a);
      });
      if(/^bsv(?:Testnet)?$/.test(store().canonicalCoinForRow(current))&&deps.rows().some(row=>scope(row)===scope(current)&&facts(row).parents.some(p=>p.txid===current.txid)))add("parent",current.txid,"Explore funded transactions");
      if(facet){const b=doc.createElement("button");b.type="button";b.className="secondaryButton";b.textContent="Clear "+facet.kind+" filter";b.onclick=()=>{facet=null;renderFacets();renderResults();};facetPanel.appendChild(b);}
    }
    function renderFiles() {
      const coin = store().canonicalCoinForRow(current), bsv = /^(?:bsv|bsvTestnet)$/.test(coin);
      inventory.hidden = !bsv;
      if (!bsv) return;
      const files = fileList(current), visible = new Set();
      const map = current.raw && root.CHISEL_BSV_MEDIA ? root.CHISEL_BSV_MEDIA.metadata(current.raw) : list((current.summary||{}).metadata);
      const mapText = map.map(m=>m.protocol+" output "+m.output+": "+m.fields.map(f=>f.key+" = "+f.value).join(" · ")).join(" | ");
      get("portalRecordFileStatus").textContent = (files.length ? "Files in this transaction" : !current.raw ? "File inventory requires transaction data." : "No recognized BSV files in this transaction.") + (mapText ? " · "+mapText : "");
      // Only the first reasonably sized raster image auto-loads on record open.
      // Remaining images, large payloads and SVG retain explicit user controls.
      const autoImage = files.find(file => /^image\/(?:jpeg|png|gif|webp|avif|bmp|x-icon)$/.test(file.mime) &&
        Number.isFinite(file.bytes) && file.bytes > 0 && file.bytes <= 4 * 1024 * 1024);
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
            if (view.abort || view.url) return;
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
              view.url = URL.createObjectURL(new Blob([full.data], {type: full.mime}));
              const imageUrl = view.url;
              view.image.onload = function () {
                if (generation !== token || view.url !== imageUrl) return;
                view.status.textContent = "Loaded " + full.data.length.toLocaleString() + " bytes.";
                button.hidden = true;
              };
              view.image.onerror = function () {
                if (generation !== token || view.url !== imageUrl) return;
                URL.revokeObjectURL(imageUrl); view.url = null;
                view.status.textContent = "The browser could not display this image.";
                button.hidden = false; button.textContent = "RETRY IMAGE"; button.disabled = false;
              };
              view.status.textContent = "Decoding image…";
              view.image.src = imageUrl;
            } catch (error) {
              if (generation === token) {
                view.status.textContent = abort.signal.aborted ? "Image request timed out. Try loading it again." : error.message || String(error);
                button.textContent = "RETRY IMAGE";
              }
            }
            finally { root.clearTimeout(timeout); if (generation === token) { view.abort = null; button.disabled = false; } }
          };
        }
        if (file === autoImage && current.raw && view.button && !view.autoAttempted && !view.abort && !view.url) {
          view.autoAttempted = true;
          view.button.click();
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
      if (!current || scope(current) !== scope(row)) { query.value = ""; type.value = "all"; block.value = "all"; facet=null; }
      if (!current || scope(current) !== scope(row) || current.txid !== row.txid) clearFiles();
      current = row;
      get("portalRecordScope").textContent = "Explore " + store().tickerForCoin(store().canonicalCoinForRow(row));
      const option = get("portalRecordCurrentBlock"); option.textContent = "This block (" + ((row.summary || {}).blockHeight || "unknown") + ")"; option.disabled = !(row.summary || {}).blockHeight;
      renderFacets(); renderResults(); renderFiles();
      if (!checkedServices) { checkedServices = true; services(); }
    }, clear: function () { clearFiles(); current = null; facet=null; facetPanel.replaceChildren(); }};
  }
  root.CHISEL_PORTAL_EXPLORE = {scope: scope, fileList: fileList, imageRow: imageRow, facts: facts, interpretationLines: interpretationLines, matchesFacet: matchesFacet, search: search, createController: createController};
})(window);
