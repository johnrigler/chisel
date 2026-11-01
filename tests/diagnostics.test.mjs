import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const sources = await Promise.all(["chisel.js", "chisel.portal.static-data.js", "chisel.portal.payload.js", "chisel.portal.store.js", "chisel.portal.notes.js", "chisel.portal.record.js", "chisel.portal.js", "chisel.debug.js"]
  .map(async file => [file, await readFile(new URL("../" + file, import.meta.url), "utf8")]));
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const headerErrorStart = index.indexOf('    window.addEventListener("error", function (e) {');
const headerErrorEnd = index.indexOf('    window.addEventListener("unhandledrejection"', headerErrorStart);
assert.ok(headerErrorStart >= 0 && headerErrorEnd > headerErrorStart);
const headerErrorSource = index.slice(headerErrorStart, headerErrorEnd);
const txid = "ab".repeat(32);
const response = (status, value) => ({ok: status >= 200 && status < 300, status, json: async () => value});

function fixture(responder = () => response(200, {ok:true, json:{txid}})) {
  const storage = new Map(), listeners = new Map(), calls = [], activity = [];
  const nodes = new Map([
    ["portalFileProxyUrl", {value:"http://127.0.0.1:7799/"}],
    ["portalStatus", {textContent:"Ledger refresh failed with HTTP 429"}],
    ["portalFileProxyHealth", {textContent:"FileProxy: checking"}],
    ["version", {textContent:"chisel v2.8.17"}],
    ["headerCurrency", {value:"ravencoin"}]
  ]);
  const context = vm.createContext({URL, URLSearchParams, TextEncoder, TextDecoder, Uint8Array, AbortController, console,
    location:{href:"https://chisel.example/?mode=portal", protocol:"https:"},
    navigator:{userAgent:"test"}, screen:{width:1500,height:1000}, innerWidth:1500,innerHeight:900,devicePixelRatio:1,
    performance:{getEntriesByName:()=>[]},
    setTimeout(){return 1;}, clearTimeout(){},
    addEventListener(name, callback){listeners.set(name, callback);},
    document:{readyState:"loading", scripts:[], body:{dataset:{mode:"portal"}},
      documentElement:{clientWidth:1500,scrollWidth:1500},
      addEventListener(){}, getElementById:id=>nodes.get(id) || null,
      querySelector:selector=>nodes.get(selector.replace(/^#/,"")) || null, querySelectorAll:()=>[]},
    sessionStorage:{getItem:key=>storage.get(key) || null, setItem:(key,value)=>storage.set(key,value), removeItem:key=>storage.delete(key)},
    localStorage:{getItem:()=>null},
    async fetch(url, options){calls.push({url:String(url),options});return responder(String(url), options);}
  });
  context.window = context;
  for(const [file, source] of sources) vm.runInContext(source, context, {filename:file});
  // Exercise the actual inline header handler as well as the export listener.
  let headerError;
  const register = context.addEventListener;
  context.addEventListener = (name, callback) => { assert.equal(name, "error"); headerError = callback; };
  context.chiselActivity = (source, message, level) => activity.push({source, message, level});
  vm.runInContext(headerErrorSource, context);
  context.addEventListener = register;
  const dispatchError = event => { headerError(event); listeners.get("error")(event); };
  return {context,storage,listeners,calls,nodes,activity,dispatchError,debug:context.CHISEL_DIAGNOSTICS,portal:context.CHISEL_PORTAL};
}

test("failed pictures retain their actual resource URL without reporting a JavaScript failure", () => {
  const f=fixture();
  f.dispatchError({target:{tagName:"IMG",currentSrc:"https://user:credential@images.example/selected.jpg?token=query-secret#fragment-secret",
    src:"https://images.example/fallback.jpg"}});
  const data=f.debug.snapshot(), event=data.events.at(-1);
  assert.equal(event.type,"resource.load"); assert.equal(event.level,"warn"); assert.equal(event.resourceTag,"IMG");
  assert.equal(event.endpoint.origin,"https://images.example"); assert.equal(event.endpoint.path,"/selected.jpg");
  assert.equal(data.events.some(event=>event.type.startsWith("javascript.")),false);
  assert.equal(f.activity[0].source,"Media"); assert.equal(f.activity[0].level,"warn");
  assert.match(f.activity[0].message,/selected\.jpg/);
  assert.doesNotMatch(JSON.stringify(data)+JSON.stringify(f.activity),/credential|query-secret|fragment-secret|unknown script|Script load error/);
});

test("a script resource failure names the asset and remains an error", () => {
  const f=fixture();
  f.dispatchError({target:{tagName:"SCRIPT",src:"https://chisel.example/chisel.portal.store.js?rev=example"}});
  const event=f.debug.snapshot().events.at(-1);
  assert.equal(event.type,"javascript.load"); assert.equal(event.level,"error");
  assert.equal(event.resourceTag,"SCRIPT"); assert.equal(event.endpoint.path,"/chisel.portal.store.js");
  assert.deepEqual(f.activity[0],{source:"JavaScript",message:"chisel.portal.store.js failed to load",level:"error"});
});

test("stylesheets remain errors while optional icons and media remain resource warnings", () => {
  for(const [tag,rel,url,level] of [["LINK","stylesheet","https://chisel.example/style.css","error"],
    ["LINK","icon","https://chisel.example/icon.png","warn"],
    ["VIDEO","","https://media.example/video.mp4","warn"],
    ["AUDIO","","https://media.example/audio.mp3","warn"]]) {
    const f=fixture();
    f.dispatchError({target:{tagName:tag,rel,href:url,src:url}});
    const event=f.debug.snapshot().events.at(-1);
    assert.equal(event.type,"resource.load"); assert.equal(event.resourceTag,tag); assert.equal(event.level,level);
    assert.equal(f.activity[0].level,level); assert.notEqual(f.activity[0].source,"JavaScript");
  }
});

test("real runtime errors retain their source, location and stack", () => {
  const f=fixture(), error=new TypeError("Synthetic record merge failure");
  f.dispatchError({message:error.message,error,filename:"https://chisel.example/chisel.portal.store.js?rev=example",lineno:55,colno:8});
  const data=f.debug.snapshot(), event=data.events.at(-2);
  assert.equal(event.type,"javascript.error"); assert.equal(event.level,"error"); assert.equal(event.error.name,"TypeError");
  assert.match(event.error.stack,/diagnostics.test.mjs/); assert.equal(event.endpoint.path,"/chisel.portal.store.js");
  assert.equal(data.events.at(-1).detail,"chisel.portal.store.js:55:8");
  assert.match(f.activity[0].message,/chisel\.portal\.store\.js:55:8 Synthetic record merge failure/);
  assert.equal(f.activity[0].level,"error");
});

test("opaque runtime errors do not invent a failed script resource", () => {
  const f=fixture(); f.dispatchError({message:"Script error.",filename:"",lineno:0,colno:0});
  assert.equal(f.debug.snapshot().events.at(-2).type,"javascript.error");
  assert.match(f.activity[0].message,/source unavailable Script error\./);
  assert.doesNotMatch(f.activity[0].message,/load error|failed to load/);
});

test("failed inline image payloads are not copied into activity or debug output", () => {
  const f=fixture(); f.dispatchError({target:{tagName:"IMG",src:"data:image/png;base64,do-not-export-image-content"}});
  const event=f.debug.snapshot().events.at(-1);
  assert.equal(event.type,"resource.load"); assert.equal(event.endpoint,null);
  assert.equal(f.activity[0].message,"img resource failed to load");
  assert.doesNotMatch(JSON.stringify(f.debug.snapshot())+JSON.stringify(f.activity),/do-not-export-image-content/);
});

test("actual messages and stack traces survive export while credentials, query values and key material do not", () => {
  const f=fixture();
  const error=new Error("HTTP 502 at http://user:credential@127.0.0.1:47799/tx?token=query-secret#fragment-secret\n"+
    'mnemonic: alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu\n'+
    'privateKey="'+"aa".repeat(32)+'"\n'+"WIF="+"K"+"1".repeat(51)+"\nAuthorization: Bearer abcdefgh-secret");
  f.debug.error("fileproxy.request",error,{endpoint:"http://user:credential@127.0.0.1:47799/tx?password=hidden",
    method:"GET",httpStatus:502,durationMs:12,body:"body-secret",headers:{Authorization:"header-secret"}});
  const event=f.debug.snapshot().events.at(-1);
  assert.match(event.detail,/HTTP 502 at http:\/\/127\.0\.0\.1:47799\/tx/);
  assert.equal(event.endpoint.port,"47799"); assert.equal(event.endpoint.path,"/tx");
  assert.equal(event.httpStatus,502); assert.equal(event.durationMs,12);
  assert.match(event.error.stack,/diagnostics.test.mjs/);
  const saved=[...f.storage.values()].join("\n");
  assert.doesNotMatch(saved,/credential|query-secret|fragment-secret|alpha beta|aaaaaaaa|K111111|abcdefgh-secret|body-secret|header-secret|password=hidden/);
});

test("promise rejections retain the reason and stack instead of only the Error type", () => {
  const f=fixture();
  f.listeners.get("unhandledrejection")({reason:new TypeError("Failed to fetch http://127.0.0.1:7799/ping")});
  const event=f.debug.snapshot().events.at(-1);
  assert.equal(event.type,"javascript.rejection"); assert.equal(event.error.name,"TypeError");
  assert.match(event.detail,/Failed to fetch http:\/\/127\.0\.0\.1:7799\/ping/);
  assert.match(event.error.stack,/TypeError: Failed to fetch/);
});

test("snapshot distinguishes entered and configured ports and Send currency from the Portal account", () => {
  const f=fixture();
  f.portal.state.config.fileProxyUrl="http://127.0.0.1:47799";
  f.portal.state.currentIndex={coin:"litecoin"};
  f.portal.state.personalAccount={coin:"litecoin",address:"not exported"};
  f.portal.state.portalRows=[{publication:{coin:"litecoin",ledgerState:"awaiting-ledger",error:"Ledger read timed out",raw:{hex:"not exported"}}}];
  const data=f.debug.snapshot();
  assert.equal(data.schema,"chisel-debug-v3");
  assert.equal(data.fileProxy.configured.port,"47799"); assert.equal(data.fileProxy.entered.port,"7799");
  assert.equal(data.fileProxy.effective.port,"7799"); assert.equal(data.fileProxy.pageProtocol,"https:");
  assert.equal(data.selectedCurrency,"ravencoin"); assert.equal(data.portal.accountCoin,"litecoin");
  assert.match(data.portal.status,/HTTP 429/); assert.equal(data.portal.publications[0].error,"Ledger read timed out");
  assert.doesNotMatch(JSON.stringify(data),/not exported/);
});

test("requests to explicit 7799 and 47799 endpoints are preserved and failures record the exact port and status", async () => {
  for(const base of ["http://127.0.0.1:7799/", "http://localhost:47799", "https://rigler.org:7799"]){
    const f=fixture(()=>response(503,{ok:false,error:"Storage backend unavailable"}));
    f.nodes.get("portalFileProxyUrl").value=base;
    await assert.rejects(f.portal.loadLocalTransaction(txid,"litecoin"),/Storage backend unavailable/);
    assert.ok(f.calls[0].url.startsWith(base.replace(/\/$/,"")+"/tx?"));
    const event=f.debug.snapshot().events.filter(event=>event.type==="fileproxy.request").at(-1);
    assert.equal(event.type,"fileproxy.request"); assert.equal(event.httpStatus,503);
    assert.equal(event.endpoint.port,new URL(base).port); assert.equal(event.method,"GET");
    assert.equal(event.detail,"Storage backend unavailable");
    assert.doesNotMatch(JSON.stringify(event),new RegExp(txid));
  }
});

test("network failures and malformed JSON preserve their actual causes", async () => {
  const network=fixture(()=>{throw new TypeError("Failed to fetch: connection refused");});
  await assert.rejects(network.portal.loadLocalTransaction(txid,"litecoin"),/connection refused/);
  assert.equal(network.portal.state.fileProxyAvailable,false);
  const event=network.debug.snapshot().events.filter(event=>event.type==="fileproxy.request").at(-1);
  assert.equal(event.detail,"Failed to fetch: connection refused"); assert.equal(event.endpoint.port,"7799");
  assert.equal(event.httpStatus,undefined); assert.match(event.error.stack,/connection refused/);
  const malformed=fixture(()=>({ok:true,status:200,json:async()=>{throw new SyntaxError("Unexpected token <");}}));
  await assert.rejects(malformed.portal.loadLocalTransaction(txid,"litecoin"),/invalid JSON: Unexpected token </);
  const parse=malformed.debug.snapshot().events.filter(event=>event.type==="fileproxy.request").at(-1);
  assert.equal(parse.httpStatus,200); assert.equal(parse.error.cause,"Unexpected token <");
});

test("POST failures log request metadata without persisting the posted transaction", async () => {
  const f=fixture(()=>response(500,{error:"Index is unavailable"}));
  await assert.rejects(f.portal.saveTransactionToFileProxy({txid,secretField:"never log the body"},txid,{coin:"litecoin"}),/Index is unavailable/);
  assert.equal(f.calls[0].options.method,"POST");
  const event=f.debug.snapshot().events.at(-1);
  assert.equal(event.method,"POST"); assert.equal(event.endpoint.path,"/save-tx");
  assert.equal(event.httpStatus,500); assert.doesNotMatch(JSON.stringify(event),/secretField|never log the body/);
});

test("diagnostics exceptions cannot change successful requests or hide the original failure", async () => {
  const f=fixture();
  f.context.CHISEL_DIAGNOSTICS={record(){throw new Error("broken logger");},error(){throw new Error("broken logger");}};
  const result=await f.portal.loadLocalTransaction(txid,"litecoin");
  assert.equal(result.raw.txid,txid);
  const failed=fixture(()=>response(404,{error:"Requested transaction is missing"}));
  failed.context.CHISEL_DIAGNOSTICS=f.context.CHISEL_DIAGNOSTICS;
  await assert.rejects(failed.portal.loadLocalTransaction(txid,"litecoin"),/Requested transaction is missing/);
});
