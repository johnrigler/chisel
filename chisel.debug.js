/* Local diagnostics: sanitized errors and endpoint routes, never request bodies or key material. */
(function () {
  "use strict";
  const MAX=1000, MAX_CHARS=1000000, KEY="chisel.debug.events.v1", RELEASE="20261031-v2820";
  let events=[];
  try { const saved=JSON.parse(sessionStorage.getItem(KEY)||"[]"); if(Array.isArray(saved)) events=saved.slice(-MAX); } catch (_) {}
  const sensitive=/\b(?:(?:0x)?[0-9a-fA-F]{64,}|[1-9A-HJ-NP-Za-km-z]{51,}|(?:[LM3D][a-km-zA-HJ-NP-Z1-9]{25,34}))\b/g;
  function redact(value) {
    return String(value).replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+\/_=.:-]+/gi,"[credentials]")
      .replace(/["']?\b(?:wif|sender[ _-]?wif|private[ _-]?key|seed|mnemonic|authorization|password|api[ _-]?key|token|secret)\b["']?\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\r\n,;}]+)/gi,"[secret]")
      .replace(sensitive,"[redacted]");
  }
  function endpoint(value) {
    if (!value) return null;
    try {
      const url=new URL(String(value),location.href);
      if (!/^https?:$/.test(url.protocol)) return null;
      return {origin:url.origin,hostname:url.hostname,port:url.port || (url.protocol === "https:" ? "443" : "80"),
        protocol:url.protocol,path:redact(url.pathname).slice(0,240)};
    } catch (_) { return null; }
  }
  function clean(value, limit=2000) {
    const text=String(value == null ? "" : value)
      .replace(/https?:\/\/[^\s"'<>]+/gi,function (raw) {
        const info=endpoint(raw);
        return info ? info.origin+info.path : "[url]";
      }).replace(/file:\/\/[^\s"'<>]+/gi,raw=>"[file]/"+raw.split("/").pop().split(/[?#]/)[0]);
    return redact(text).slice(0,limit);
  }
  function errorInfo(value) {
    return {name:clean(value && value.name || "Error",120),stack:clean(value && value.stack || "",6000),
      cause:clean(value && value.cause && (value.cause.message || value.cause) || "")};
  }
  function save() {
    try {
      let json=JSON.stringify(events);
      while (events.length && json.length>MAX_CHARS) { events.shift(); json=JSON.stringify(events); }
      sessionStorage.setItem(KEY,json);
    } catch (_) {}
  }
  function record(type, detail, context) {
    const entry={at:new Date().toISOString(),type:clean(type),detail:clean(detail)};
    const info=context || {};
    if (info.level) entry.level=clean(info.level,20);
    if (info.method) entry.method=clean(info.method,12);
    if (info.endpoint) entry.endpoint=endpoint(info.endpoint);
    if (info.coin) entry.coin=clean(info.coin,40);
    if (info.resourceTag) entry.resourceTag=clean(info.resourceTag,20);
    if (Number.isFinite(info.httpStatus)) entry.httpStatus=info.httpStatus;
    if (Number.isFinite(info.durationMs)) entry.durationMs=Math.max(0,Math.round(info.durationMs));
    if (info.error) entry.error=errorInfo(info.error);
    events.push(entry); if(events.length>MAX) events.shift();
    save();
    return entry;
  }
  function recordError(type, error, context) {
    return record(type,error && error.message || String(error),Object.assign({},context,{level:"error",error:error}));
  }
  function overflow() {
    const w=document.documentElement.clientWidth;
    const found=[];
    document.querySelectorAll("body *").forEach(function(el) {
      if(found.length>=35) return;
      if(el.closest("script,style,svg,dialog:not([open])")) return;
      const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
      if(cs.display==="none" || cs.visibility==="hidden" || !r.width || !r.height) return;
      if(r.right>w+2 || r.left < -2) {
        const id=el.id?"#"+el.id:"";
        const cls=typeof el.className==="string"?el.className.trim().split(/\s+/).slice(0,2).join("."):"";
        found.push({element:el.tagName.toLowerCase()+id+(cls?"."+cls:""),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)});
      }
    });
    return {viewportWidth:w,documentWidth:document.documentElement.scrollWidth,offenders:found};
  }
  function scripts() {
    return Array.from(document.scripts).filter(s=>s.src).map(s=>{
      const u=new URL(s.src,location.href);
      const entry=performance.getEntriesByName(s.src).slice(-1)[0];
      return {file:u.pathname.split("/").pop(),rev:u.searchParams.get("rev")||null,
        loaded:!!entry,bytes:entry && typeof entry.transferSize==="number"?entry.transferSize:null};
    });
  }
  function snapshot() {
    const coin=document.getElementById("headerCurrency");
    const mode=document.body && document.body.dataset.mode || "unknown";
    const v=document.getElementById("version");
    const balance=document.getElementById("headerIdentityBalance");
    const identity=document.getElementById("headerIdentityName");
    const portal=window.CHISEL_PORTAL && window.CHISEL_PORTAL.state || {};
    const proxy=document.getElementById("portalFileProxyUrl");
    const configured=portal.config && portal.config.fileProxyUrl || "https://rigler.org/fileproxy";
    const status=document.getElementById("portalStatus");
    const health=document.getElementById("portalFileProxyHealth");
    return {
      schema:"chisel-debug-v3",exportedAt:new Date().toISOString(),release:RELEASE,
      version:clean(v && v.textContent),mode:clean(mode),selectedCurrency:coin?clean(coin.value):null,
      identityLabel:identity?clean(identity.textContent).replace(/\b[A-Za-z0-9]{15,}\b/g,"[account]"):null,
      balanceState:balance ? (/\d/.test(balance.textContent)?"populated":(/unavailable/i.test(balance.textContent)?"unavailable":(/not loaded/i.test(balance.textContent)?"not-loaded":"pending"))) : "unavailable",
      fileProxy:{configured:endpoint(configured),entered:endpoint(proxy && proxy.value),
        effective:endpoint(proxy && proxy.value || configured),available:typeof portal.fileProxyAvailable === "boolean" ? portal.fileProxyAvailable : null,
        health:clean(health && health.textContent),pageProtocol:location.protocol || new URL(location.href).protocol},
      portal:{status:clean(status && status.textContent),coin:clean(portal.currentIndex && portal.currentIndex.coin),
        accountCoin:clean(portal.personalAccount && portal.personalAccount.coin),rows:Array.isArray(portal.portalRows) ? portal.portalRows.length : 0,
        publications:(portal.portalRows || []).filter(row=>row.publication).slice(0,20).map(row=>({coin:clean(row.publication.coin),
          ledgerState:clean(row.publication.ledgerState),error:clean(row.publication.error),seenAt:row.publication.seenAt || null}))},
      environment:{userAgent:navigator.userAgent,screen:{width:screen.width,height:screen.height},viewport:{width:innerWidth,height:innerHeight,devicePixelRatio:devicePixelRatio}},
      assetManifest:scripts(),viewportMeta:document.querySelector('meta[name="viewport"]')?.content||null,
      historyNote:"events may span multiple reloads in this browser tab; use boot timestamps to separate sessions",
      layout:overflow(),events:events.slice()
    };
  }
  function download() {
    record("diagnostics","User exported debug JSON");
    const data=JSON.stringify(snapshot(),null,2);
    const url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
    const a=document.createElement("a");
    a.href=url;a.download="chisel-debug-"+new Date().toISOString().replace(/[:.]/g,"-")+".json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  window.CHISEL_DIAGNOSTICS={record:record,error:recordError,clean:clean,endpoint:endpoint,snapshot:snapshot,download:download,clear:function(){events=[];try{sessionStorage.removeItem(KEY)}catch(_){}}};
  window.addEventListener("error",function(e){
    const target=e.target, tag=String(target && target.tagName || "").toUpperCase();
    // Resource error events have no runtime message, filename or stack.
    // Keep the failed target instead of inventing an unknown script error.
    if (/^(SCRIPT|LINK|IMG|VIDEO|AUDIO|SOURCE|TRACK|IFRAME|OBJECT|EMBED|INPUT)$/.test(tag) && !e.message && !e.error) {
      const url=target.currentSrc || target.src || target.href || "";
      const critical=tag === "SCRIPT" || (tag === "LINK" && /\bstylesheet\b/i.test(target.rel || ""));
      record(tag === "SCRIPT" ? "javascript.load" : "resource.load",tag+" failed to load",{
        level:critical ? "error" : "warn",endpoint:url,resourceTag:tag
      });
      return;
    }
    const file=e.filename?e.filename.split("/").pop().split("?")[0]:"unknown";
    recordError("javascript.error",e.error || e.message || "Runtime error; browser provided no source details",{endpoint:e.filename});
    record("javascript.location",file+":"+(e.lineno||0)+":"+(e.colno||0));
  },true);
  window.addEventListener("unhandledrejection",function(e){recordError("javascript.rejection",e.reason || "promise rejected");});
  document.addEventListener("DOMContentLoaded",function(){
    const button=document.getElementById("downloadDebugJson");
    if(button) button.addEventListener("click",download);
    const clear=document.getElementById("clearDebugJson");
    if(clear) clear.addEventListener("click",function(){window.CHISEL_DIAGNOSTICS.clear();record("diagnostics","Log cleared");});
    const currency=document.getElementById("headerCurrency");
    if(currency) currency.addEventListener("change",function(){record("currency.change",currency.value);});
    document.querySelectorAll("[data-mode-target]").forEach(function(btn){btn.addEventListener("click",function(){record("navigation",btn.dataset.modeTarget);});});
    record("boot","Diagnostics initialized");
  });
})();
