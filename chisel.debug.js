/* Chisel diagnostics: public metadata only. No form values, URLs, key material, or response bodies. */
(function () {
  "use strict";
  const MAX=1000, KEY="chisel.debug.events.v1", RELEASE="20261009Q";
  let events=[];
  try { const saved=JSON.parse(sessionStorage.getItem(KEY)||"[]"); if(Array.isArray(saved)) events=saved.slice(-MAX); } catch (_) {}
  const sensitive=/\b(?:[KL5][1-9A-HJ-NP-Za-km-z]{48,52}|(?:0x)?[0-9a-fA-F]{64,}|(?:[LM3D][a-km-zA-HJ-NP-Z1-9]{25,34}))\b/g;
  function clean(value) {
    return String(value == null ? "" : value).replace(sensitive,"[redacted]").replace(/(?:https?:\/\/|file:\/\/)[^\s"'<>]+/gi,"[url]").replace(/\b(?:wif|private.?key|seed|mnemonic|authorization|password|token|secret)\s*[:=]\s*[^\s,;]+/gi,"[secret]").slice(0,240);
  }
  function record(type, detail) {
    const entry={at:new Date().toISOString(),type:clean(type),detail:clean(detail)};
    events.push(entry); if(events.length>MAX) events.shift();
    try { sessionStorage.setItem(KEY,JSON.stringify(events)); } catch (_) {}
    return entry;
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
    return {
      schema:"chisel-debug-v2",exportedAt:new Date().toISOString(),release:RELEASE,
      version:clean(v && v.textContent),mode:clean(mode),selectedCurrency:coin?clean(coin.value):null,
      identityLabel:identity?clean(identity.textContent).replace(/\b[A-Za-z0-9]{15,}\b/g,"[account]"):null,
      balanceState:balance ? (/\d/.test(balance.textContent)?"populated":(/unavailable/i.test(balance.textContent)?"unavailable":(/not loaded/i.test(balance.textContent)?"not-loaded":"pending"))) : "unavailable",
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
  window.CHISEL_DIAGNOSTICS={record:record,snapshot:snapshot,download:download,clear:function(){events=[];try{sessionStorage.removeItem(KEY)}catch(_){}}};
  window.addEventListener("error",function(e){
    const file=e.filename?e.filename.split("/").pop().split("?")[0]:"unknown";
    record("javascript.error",file+":"+(e.lineno||0)+":"+(e.colno||0)+" "+clean(e.message||"script error"));
  },true);
  window.addEventListener("unhandledrejection",function(e){record("javascript.rejection",e.reason&&e.reason.name||"promise rejected");});
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
