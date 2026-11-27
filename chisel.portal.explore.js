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
  const protocolLabel=p=>p==="B"?"Bitcom B":p;
  const recordFacts=new WeakMap();
  const list=v=>Array.isArray(v)?v:[];
  const norm=v=>String(v||"").trim().toLowerCase();
  // Addresses are case-sensitive. Provider-reported destinations and asserted
  // AIP signers are evidence, not proof of ownership or spendability.
  function addressTrails(raw, metadataRecords, coin) {
    const tx=raw&&(raw.tx||raw)||{}, result=new Map();
    const testnet=coin==="bsvTestnet";
    const pattern=testnet?/^[mn2][1-9A-HJ-NP-Za-km-z]{25,34}$/:/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
    function add(value,role) {
      if(typeof value!=="string"||!pattern.test(value))return;
      if(!result.has(value))result.set(value,{address:value,roles:[],wordCandidate:!testnet&&/^1[A-E]x/.test(value)});
      const roles=result.get(value).roles;if(!roles.includes(role))roles.push(role);
    }
    function reported(entry,role) {
      if(!entry)return;
      const script=entry.scriptPubKey||entry.script||{};
      [entry.scriptpubkey_address,entry.address,entry.addr,script.address,...list(entry.addresses),...list(script.addresses)].forEach(a=>add(a,role));
    }
    list(tx.vin||tx.inputs).forEach((input,i)=>{
      reported(input,"input "+i+" (reported)");
      reported(input&&input.prevout,"input "+i+" prevout");
    });
    list(tx.vout||tx.outputs).forEach((output,i)=>reported(output,"output "+(output&&Number.isInteger(output.n)?output.n:i)));
    list(metadataRecords).filter(m=>m&&m.protocol==="AIP").forEach(m=>list(m.fields).filter(f=>f&&f.key==="signing address").forEach(f=>add(f.value,"AIP signer (unverified)")));
    return Array.from(result.values());
  }
  function addressExplorerLinks(coin,address) {
    if(coin!=="bsv"||typeof address!=="string"||!/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address))return [];
    const a=encodeURIComponent(address);
    return [{label:"BSV · WhatsOnChain",url:"https://whatsonchain.com/address/"+a},
      {label:"BTC · mempool.space",url:"https://mempool.space/address/"+a},
      {label:"BCH · Blockchair",url:"https://blockchair.com/bitcoin-cash/address/"+a}];
  }
  // MAP identifies the application; Bitcom B carries the actual post text.
  function twetchForRow(row) {
    if (!row || !/^bsv(?:Testnet)?$/.test(scope(row))) return null;
    const api=root.CHISEL_BSV_MEDIA, summary=row.summary||{};
    if (row.raw && api) {
      const decoded=api.twetchPost(row.raw);
      if (decoded) return decoded;
    }
    const map=list(summary.metadata).find(m=>m.protocol==="MAP"&&list(m.fields).some(f=>f.key==="app"&&norm(f.value)==="twetch"));
    if(!map)return null;
    const action=(list(map.fields).find(f=>f.key==="type")||{}).value||"record";
    let text=String(summary.opReturnText||"").trim();
    if (/19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut|1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5|\ufffd/.test(text)||/^Twetch\s*·/i.test(text)) text="";
    return {name:"Twetch · "+action,action,text:text.slice(0,65536)};
  }
  function twetchTitle(post) {
    return String(post&&post.text||"").trim().split(/\r?\n/)[0].slice(0,160).trim() || "Untitled "+String(post&&post.action||"post");
  }
  function appendTwetchMenu(container,row,onFilter) {
    const doc=container.ownerDocument, menu=doc.createElement("details");
    menu.className="portalTwetchMenu";
    const summary=doc.createElement("summary");summary.className="secondaryButton";summary.textContent="Twetch";
    summary.title="Twetch actions and protocol details";
    const actions=doc.createElement("div");actions.className="actions";
    const only=doc.createElement("button");only.type="button";only.className="secondaryButton";only.textContent="Only show Twetch";
    only.onclick=event=>{event.preventDefault();event.stopPropagation();onFilter();};
    actions.appendChild(only);
    if(scope(row)==="bsv"&&/^[a-f0-9]{64}$/i.test(row.txid||"")){
      const link=doc.createElement("a");link.className="secondaryButton";link.textContent="Open this in Twetch";
      link.href="https://twetch.com/t/"+row.txid;link.target="_blank";link.rel="noopener noreferrer";actions.appendChild(link);
    }
    const website=doc.createElement("a");website.className="secondaryButton";website.textContent="Twetch website";
    website.href="https://twetch.com/";website.target="_blank";website.rel="noopener noreferrer";actions.appendChild(website);
    const meta=doc.createElement("details"), label=doc.createElement("summary");label.textContent="Protocol details";meta.appendChild(label);
    interpretationLines(row).forEach(line=>{const node=doc.createElement("p");node.textContent=line;meta.appendChild(node);});
    menu.append(summary,actions,meta);container.appendChild(menu);return menu;
  }
  function facts(row) {
    if (!/^bsv(?::|Testnet|$)/.test(scope(row))) return {apps:[],collections:[],parents:[],addresses:[],name:""};
    const summary=row.summary||{}, raw=row.raw, cached=recordFacts.get(row);
    if(cached && cached.raw===raw && cached.summary===summary) return cached.value;
    const api=root.CHISEL_BSV_MEDIA;
    const recordType = raw && api && api.classify ? api.classify(raw) : summary.recordType;
    const files=list(fileList(row)).concat(list(summary.files));
    const map=list(raw && api ? api.metadata(raw) : []).concat(list(summary.metadata));
    const uniq=values=>Array.from(new Map(values.filter(v=>typeof v==="string"&&v.trim()).map(v=>[norm(v),v.trim()])).values());
    const parents=list(raw && api ? api.parentInputs(raw) : []).concat(list(summary.parentInputs)).filter(p=>p && typeof p.txid==="string" && /^[a-f0-9]{64}$/i.test(p.txid) && Number.isInteger(p.vout) && p.vout>=0);
    const named=files.find(f=>f && f.protocol==="1Sat Ordinals" && f.name);
    const ordinal=named || files.find(f=>f && f.protocol==="1Sat Ordinals");
    const encrypted=files.find(f=>f && f.encrypted);
    const mapFields=map.filter(m=>m && m.protocol==="MAP").flatMap(m=>list(m.fields));
    const app=mapFields.find(f=>f&&f.key==="app"&&typeof f.value==="string");
    const type=mapFields.find(f=>f&&f.key==="type"&&typeof f.value==="string");
    const twetch=twetchForRow(row);
    const value={apps:uniq(map.filter(m=>m && m.protocol==="MAP").flatMap(m=>list(m.fields).filter(f=>f && f.key==="app").map(f=>norm(f.value)==="twetch"?"Twetch":f.value)).concat(files.filter(f=>f&&f.encrypted&&f.metadata&&/^indelible\./.test(f.metadata.application)).map(()=>"Indelible"))),
      collections:uniq(files.map(f=>f && f.metadata && f.metadata.collection)),
      addresses:addressTrails(raw,map,store().canonicalCoinForRow(row)),
      parents:Array.from(new Map(parents.map(p=>[norm(p.txid)+":"+p.vout,{txid:norm(p.txid),vout:p.vout}])).values()),
      name:encrypted ? encrypted.name : twetch ? twetchTitle(twetch) : ordinal ? ordinalTitle(ordinal) : app && type ? (norm(app.value)==="twetch"?"Twetch":app.value)+" · "+type.value.replace(/_/g," ") : recordType && recordType.name || ""};
    recordFacts.set(row,{raw,summary,value});return value;
  }
  function ordinalTitle(file) {
    const kind=file.mime==="model/gltf-binary"?"3D ordinal":/^image\//.test(file.mime)?"image inscription":/^text\//.test(file.mime)?"text inscription":"inscription";
    return file.name ? file.name+" · "+(file.mime==="model/gltf-binary"?"3D ordinal":"inscription") : "1Sat Ordinal · "+kind;
  }
  const inlineFiles = new WeakMap();
  function appendInlineBsvMedia(container,row) {
    if (!/^bsv(?:Testnet)?$/.test(scope(row)) || !row.raw || !root.CHISEL_BSV_MEDIA) return;
    const api=root.CHISEL_BSV_MEDIA;
    const files=fileList(row);
    const selected=files.find(f=>f.protocol==="1Sat Ordinals" && /^image\/(jpeg|png|gif|webp|avif|bmp|x-icon)$/.test(f.mime)) ||
      files.find(f=>/^image\/(jpeg|png|gif|webp|avif|bmp|x-icon)$/.test(f.mime));
    if(!selected)return;
    const doc=container.ownerDocument, section=doc.createElement("section"), title=doc.createElement("div"), img=doc.createElement("img"), status=doc.createElement("p"), button=doc.createElement("button");
    section.className="portalInterpretedRecord";
    title.className="stepTitle";title.textContent=selected.protocol==="1Sat Ordinals"?ordinalTitle(selected):protocolLabel(selected.protocol)+" · image";
    img.alt=selected.name||title.textContent;img.style.cssText="display:block;max-width:100%;width:auto;height:auto;max-height:80vh;object-fit:contain;margin:0 auto";
    img.hidden=true;img.style.display="none";
    status.className="muted";status.setAttribute("role","status");
    button.type="button";button.className="secondaryButton";button.textContent="LOAD IMAGE";
    section.append(title,img,status,button);container.appendChild(section);
    const description=selected.mime+" · "+selected.bytes.toLocaleString()+" bytes · output "+selected.output;
    status.textContent=description;
    async function load() {
      if(button.disabled)return;
      button.disabled=true;status.textContent=description+" · loading…";
      let url="";
      try {
        if(!Number.isFinite(selected.bytes)||selected.bytes<=0||selected.bytes>32*1024*1024)throw Error("Image exceeds inline preview limit.");
        let pending=inlineFiles.get(selected);
        if(!pending){
          pending=selected.complete?Promise.resolve(selected):api.loadFile(scope(row),row.txid,selected,root.fetch.bind(root),AbortSignal.timeout(30000));
          inlineFiles.set(selected,pending);
          pending.catch(()=>{if(inlineFiles.get(selected)===pending)inlineFiles.delete(selected);});
        }
        const full=await pending;
        if(!section.isConnected)return;
        if(!full.complete||!full.data||full.data.length!==full.bytes)throw Error("Complete image unavailable.");
        url=URL.createObjectURL(new Blob([full.data],{type:full.mime}));
        img.src=url;await img.decode();
        if(!section.isConnected)return;
        img.hidden=false;img.style.display="block";button.hidden=true;
        status.textContent=description;
      }catch(error){
        img.removeAttribute("src");img.hidden=true;img.style.display="none";
        status.textContent=description+" · "+(error.message||String(error));
        button.textContent="RETRY IMAGE";
      }finally{if(url)URL.revokeObjectURL(url);button.disabled=false;}
    }
    button.onclick=event=>{event.preventDefault();event.stopPropagation();load();};
    if(selected.bytes>0&&selected.bytes<=4*1024*1024)root.setTimeout(()=>{if(section.isConnected)load();},0);
  }
  function matchesFacet(row,facet) {
    if(!facet)return true;
    const f=facts(row), value=norm(facet.value);
    if(facet.kind==="app")return f.apps.some(a=>norm(a)===value);
    if(facet.kind==="collection")return f.collections.some(a=>norm(a)===value);
    if(facet.kind==="parent")return norm(row.txid)===value||f.parents.some(p=>p.txid===value);
    if(facet.kind==="address")return f.addresses.some(a=>a.address===facet.value);
    return false;
  }
  function interpretationLines(row) {
    if(!/^bsv(?::|Testnet|$)/.test(scope(row)))return [];
    const raw=row.raw, summary=row.summary||{}, api=root.CHISEL_BSV_MEDIA;
    const map=list(raw&&api?api.metadata(raw):summary.metadata);
    const files=fileList(row);
    const recordType=raw&&api&&api.classify?api.classify(raw):summary.recordType;
    const typeLine=recordType?[recordType.name,"output "+recordType.output,Number.isFinite(recordType.payloadBytes)?(Number.isFinite(recordType.availablePayloadBytes)?recordType.availablePayloadBytes.toLocaleString()+" / ":"")+recordType.payloadBytes.toLocaleString()+" payload bytes":"",recordType.complete?"complete":"partial preview"].filter(Boolean).join(" · "):"";
    return files.map(f=>[f.name||f.mime,protocolLabel(f.protocol),f.metadata&&f.metadata.collection,f.metadata&&f.metadata.meshCount?f.metadata.meshCount+" meshes":"",f.metadata&&list(f.metadata.traits).find(t=>t.trait==="Rarity")?.value,Number.isFinite(f.bytes)?f.bytes.toLocaleString()+" bytes":"","output "+f.output,f.complete?"complete":"partial preview"].filter(Boolean).join(" · ")).concat(map.map(m=>m.protocol+" output "+m.output+": "+list(m.fields).map(f=>f.key+" = "+f.value).join(" · ")),typeLine?[typeLine]:[]);
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
        (summary.imageChordLines || []).join(" "), files.map(function (file) { return [file.name, file.mime, file.protocol, protocolLabel(file.protocol), file.protocolAddress, file.metadata && file.metadata.collection].join(" "); }).join(" ")].join(" ").toLowerCase();
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
    const postHero=doc.createElement("section");postHero.className="portalTwetchHero";postHero.hidden=true;panel.insertBefore(postHero,inventory);
    let heroStamp="";
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
      f.apps.filter(a=>norm(a)!=="twetch").forEach(a=>add("app",a,"Explore "+a));
      const coin=store().canonicalCoinForRow(current);
      if(coin==="bsv"&&/^[a-f0-9]{64}$/i.test(current.txid)){
        const a=doc.createElement("a");a.className="secondaryButton";a.textContent="BananaBlocks";
        a.href="https://bananablocks.com/tx/"+current.txid;a.target="_blank";a.rel="noopener noreferrer";facetPanel.appendChild(a);
      }
      if(f.addresses.length){
        const details=doc.createElement("details");details.style.width="100%";
        const title=doc.createElement("summary");title.textContent="Address rabbit trails ("+f.addresses.length+")";details.appendChild(title);
        if(facet&&facet.kind==="address")details.open=true;
        const note=doc.createElement("p");note.className="muted";note.textContent="Local catalog matches exact addresses. External links inspect separate ledgers; equal address text does not establish shared activity or ownership. Word candidates and AIP signers are not verified.";details.appendChild(note);
        f.addresses.forEach(trail=>{
          const line=doc.createElement("div");line.className="portalRecordFile";
          const label=doc.createElement("p");label.textContent=trail.address+" · "+trail.roles.join(" · ")+(trail.wordCandidate?" · Thunderword-pattern candidate":"");label.style.overflowWrap="anywhere";line.appendChild(label);
          const b=doc.createElement("button");b.type="button";b.className="secondaryButton";b.textContent="Explore loaded address history";
          b.setAttribute("aria-pressed",String(!!facet&&facet.kind==="address"&&facet.value===trail.address));
          b.onclick=()=>{facet={kind:"address",value:trail.address};query.value="";type.value="all";block.value="all";renderFacets();renderResults();};
          line.appendChild(b);
          addressExplorerLinks(coin,trail.address).forEach(link=>{
            const a=doc.createElement("a");a.className="secondaryButton";a.textContent=link.label;a.href=link.url;a.target="_blank";a.rel="noopener noreferrer";line.appendChild(a);
          });
          details.appendChild(line);
        });
        facetPanel.appendChild(details);
      }
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
    function renderPostHero() {
      const post=twetchForRow(current);
      const stamp=post?JSON.stringify([current.txid,post,interpretationLines(current)]):"";
      if(stamp===heroStamp)return;
      heroStamp=stamp;postHero.replaceChildren();postHero.hidden=!post;
      if(!post)return;
      const title=doc.createElement("h2");title.textContent=twetchTitle(post);postHero.appendChild(title);
      const text=String(post.text||"").trim(), rest=text.slice(title.textContent.length).trim();
      if(rest){const body=doc.createElement("p");body.className="portalTwetchText";body.textContent=rest;postHero.appendChild(body);}
      appendTwetchMenu(postHero,current,deps.showTwetch);
    }
    function renderFiles() {
      const coin = store().canonicalCoinForRow(current), bsv = /^(?:bsv|bsvTestnet)$/.test(coin);
      inventory.hidden = !bsv;
      if (!bsv) return;
      const post=twetchForRow(current), files = fileList(current).slice(), visible = new Set();
      if(post)files.sort((a,b)=>Number(/^image\//.test(b.mime))-Number(/^image\//.test(a.mime)));
      const map = current.raw && root.CHISEL_BSV_MEDIA ? root.CHISEL_BSV_MEDIA.metadata(current.raw) : list((current.summary||{}).metadata);
      const mapText = map.map(m=>m.protocol+" output "+m.output+": "+m.fields.map(f=>f.key+" = "+f.value).join(" · ")).join(" | ");
      get("portalRecordFileStatus").textContent = (files.length ? "Files in this transaction" : !current.raw ? "File inventory requires transaction data." : "No recognized BSV files in this transaction.") + (mapText && !post ? " · "+mapText : "");
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
        if(post && inventory.children[visible.size]!==view.node)inventory.insertBefore(view.node,inventory.children[visible.size]||null);
        view.label.textContent = [file.name || file.mime, protocolLabel(file.protocol), file.metadata && file.metadata.collection, file.metadata && file.metadata.meshCount ? file.metadata.meshCount+" meshes" : "", file.metadata && file.metadata.traits && (file.metadata.traits.find(t=>t.trait==="Rarity") || {}).value, file.bytes.toLocaleString() + " bytes", "output " + file.output,
          file.encrypted ? "encrypted envelope" : file.mimeSource === "signature" ? "type from file signature" : "declared type"].filter(Boolean).join(" · ");
        if (!view.url && !view.abort) view.status.textContent = file.encrypted ? "Use Download encrypted envelope in the record. No plaintext preview." : file.complete ? "File bytes available." : "Saved preview is incomplete. Retrieve the complete output on demand.";
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
      renderPostHero(); renderFacets(); renderResults(); renderFiles();
      if (!checkedServices) { checkedServices = true; services(); }
    }, clear: function () { clearFiles(); current = null; facet=null; facetPanel.replaceChildren(); postHero.replaceChildren();postHero.hidden=true;heroStamp=""; }};
  }
  root.CHISEL_PORTAL_EXPLORE = {scope: scope, fileList: fileList, imageRow: imageRow, facts: facts, twetchForRow:twetchForRow, twetchTitle:twetchTitle, appendTwetchMenu:appendTwetchMenu, addressTrails: addressTrails, addressExplorerLinks: addressExplorerLinks, ordinalTitle: ordinalTitle, appendInlineBsvMedia: appendInlineBsvMedia, interpretationLines: interpretationLines, matchesFacet: matchesFacet, search: search, createController: createController};
})(window);
