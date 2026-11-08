(function () {
"use strict";
const ADDRESS = "0xd78e182813cd4e964aa382d6a81f9efbb10648bd";
const RPC = "https://polygon-bor-rpc.publicnode.com";
const EXPECTED_DIGEST = "0x426a13288d28851f6cb25d02d7af346cb656a97c387f03804bad54599af1b1cd";
const ABI = [
 "function name() view returns (string)",
 "function symbol() view returns (string)",
 "function language() view returns (string)",
 "function mediaType() view returns (string)",
 "function codecVersion() view returns (uint32)",
 "function dictionaryVersion() view returns (uint32)",
 "function primaryCount() view returns (uint256)",
 "function secondaryCount() view returns (uint256)",
 "function primaryDigest() view returns (bytes32)",
 "function definitionDigest() view returns (bytes32)",
 "function digestAtCount(uint256) view returns (bytes32)",
 "function primary(uint256) view returns (bytes)",
 "function entry(uint256) view returns (uint8 kind,bytes data,uint32 symbolCount)",
 "function addSecondaryBatch(bytes[] packed,uint32[] counts) returns (uint256[] ids)"
];
const $ = id => document.getElementById(id);
const seed = window.ChiselM64Native6SvgIconsSeed;
const codec = window.ChiselM64Native6;
const wallets = [];
let snapshot = null;
let reviewed = null;
let readRevision = 0;
let writeBusy = false;
const hex = bytes => ethers.hexlify(bytes).toLowerCase();
const rawBytes = value => ethers.getBytes("0x" + value);
const decoder = new TextDecoder("utf-8", {fatal:true});
const icons = seed.rawIconHex.map((raw, ordinal) => {
 const fragment = decoder.decode(rawBytes(raw));
 const match = /^<symbol id="icon-([a-z0-9-]+)"[\s\S]*<\/symbol>\s*$/.exec(fragment);
 if (!match) throw Error("Malformed trusted SVG seed at " + ordinal);
 return Object.freeze({ordinal, name:match[1], raw:raw.toLowerCase(), fragment});
});
if (icons.length !== 64 || seed.primaryHex.length !== 62 ||
    new Set(icons.map(i => i.name)).size !== 64) throw Error("Invalid icon seed");
function status(id, message, ok) {
 const el = $(id);
 el.textContent = message;
 el.classList.toggle("ok", ok === true);
 el.classList.toggle("bad", ok === false);
}
function errText(error) { return error && (error.shortMessage || error.reason || error.message) || String(error); }
function invalidateWrite() {
 reviewed = null;
 $("sendBatch").disabled = true;
 $("reviewBatch").disabled = !snapshot || writeBusy;
}
function srcFor(icon) {
 // Only known local fragments, or byte-for-byte verified chain matches, are rendered.
 const document = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" color="#27384b"><defs>' +
  icon.fragment + '</defs><use href="#icon-' + icon.name + '" width="24" height="24"/></svg>';
 return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(document);
}
function imgFor(icon) {
 const img = document.createElement("img");
 img.alt = icon.name;
 img.src = srcFor(icon);
 img.loading = "lazy";
 return img;
}
function onchainId(icon) { return snapshot ? snapshot.map.get(icon.ordinal) : undefined; }
function renderGallery() {
 const gallery = $("gallery");
 gallery.replaceChildren();
 for (const icon of icons) {
  const id = onchainId(icon);
  const item = document.createElement("button");
  item.type = "button";
  item.className = "iconItem" + (id !== undefined ? " onchain" : "");
  item.append(imgFor(icon));
  const name = document.createElement("strong");
  name.textContent = icon.name;
  const source = document.createElement("small");
  source.textContent = id === undefined ? "Local preview" : "On-chain entry " + id;
  item.append(name,source);
  item.addEventListener("click", () => {
   $("lookup").value = icon.name;
   displayLookup();
  });
  gallery.append(item);
 }
}
function chooseIcon(text) {
 const original = text.trim();
 const query = original.toLowerCase();
 if (/^@.$/.test(original) && codec.alphabet.includes(original.slice(1)))
  return icons[codec.alphabet.indexOf(original.slice(1))];
 if (/^#[0-9]+$/.test(query)) {
  if (!snapshot) throw Error("Read the deployed dictionary before requesting a raw entry ID");
  const id = Number(query.slice(1));
  if (!Number.isSafeInteger(id) || id < 0 || id >= snapshot.count) throw Error("Entry ID outside deployed dictionary");
  const match = icons.find(icon => snapshot.map.get(icon.ordinal) === id);
  if (!match) throw Error("Entry #" + id + " exists but is not a verified SVG icon from this manifest");
  return match;
 }
 if (/^[0-9]+$/.test(query)) {
  const ordinal = Number(query);
  if (!Number.isSafeInteger(ordinal) || !icons[ordinal]) throw Error("Icon ordinal must be 0–63");
  return icons[ordinal];
 }
 if (original.length===1 && codec.alphabet.includes(original))
  return icons[codec.alphabet.indexOf(original)];
 const icon = icons.find(x => x.name === query);
 if (!icon) throw Error("Unknown icon name: " + query);
 return icon;
}
function displayLookup() {
 const box = $("preview");
 box.replaceChildren();
 try {
  const icon = chooseIcon($("lookup").value);
  const id = onchainId(icon);
  box.append(imgFor(icon));
  const note = document.createElement("p");
  note.textContent = "Icon " + icon.ordinal + " (" + icon.name + "). " +
   (id === undefined ? "LOCAL SEED ONLY: no matching on-chain entry found." :
    "VERIFIED ON POLYGON: entry(" + id + "), reconstructed bytes match the icon manifest.");
  box.append(note);
  $("svgSource").value = icon.fragment;
  const params = new URLSearchParams(location.search);
  params.set("icon",icon.name);
  history.replaceState(null,"",location.pathname + "?" + params.toString());
 } catch (error) {
  const note = document.createElement("p");
  note.textContent = "Cannot show icon: " + errText(error);
  box.append(note);
  $("svgSource").value = "";
 }
}
function addWallet(provider, name) {
 if (!provider || typeof provider.request !== "function" || wallets.some(x => x.provider === provider)) return;
 wallets.push({provider, name:String(name || "Injected EVM wallet")});
 renderWalletChoices();
}
function renderWalletChoices() {
 const write = $("wallet"), read = $("readSource");
 const writeOld = write.value, readOld = read.value;
 write.replaceChildren();
 const none = document.createElement("option");
 none.value = "";
 none.textContent = wallets.length ? "Select wallet for writes" : "No wallet detected";
 write.append(none);
 read.replaceChildren();
 const publicOption = document.createElement("option");
 publicOption.value = "public";
 publicOption.textContent = "PublicNode Polygon RPC (no wallet)";
 read.append(publicOption);
 wallets.forEach((w, i) => {
  const wo = document.createElement("option");
  wo.value = String(i);
  wo.textContent = w.name;
  write.append(wo);
  const ro = document.createElement("option");
  ro.value = "wallet:" + i;
  ro.textContent = "Wallet RPC: " + w.name;
  read.append(ro);
 });
 write.value = [...write.options].some(x => x.value === writeOld) ? writeOld : "";
 read.value = [...read.options].some(x => x.value === readOld) ? readOld : "public";
}
function discover() {
 if (window.ethereum) addWallet(window.ethereum,"Injected wallet");
 window.dispatchEvent(new Event("eip6963:requestProvider"));
 renderWalletChoices();
}
window.addEventListener("eip6963:announceProvider", event => {
 if (event.detail && event.detail.provider) addWallet(event.detail.provider, event.detail.info && event.detail.info.name);
});
function chosenWallet() {
 const i = Number($("wallet").value);
 if ($("wallet").value === "" || !wallets[i]) throw Error("Select an injected wallet");
 return wallets[i].provider;
}
function reader() {
 const source = $("readSource").value;
 if (source === "public") return new ethers.JsonRpcProvider(RPC, 137);
 const i = Number(source.replace("wallet:",""));
 if (!/^wallet:[0-9]+$/.test(source) || !wallets[i]) throw Error("Read wallet unavailable");
 return new ethers.BrowserProvider(wallets[i].provider);
}
async function batches(n, size, worker) {
 const out = [];
 for (let start=0; start<n; start+=size) {
  const ids = Array.from({length:Math.min(size,n-start)},(_,i)=>i+start);
  const rows = await Promise.all(ids.map(worker));
  out.push(...rows);
 }
 return out;
}
async function inspect(provider, progress) {
 const net = await provider.getNetwork();
 if (BigInt(net.chainId) !== 137n) throw Error("Provider on wrong network; expected Polygon chain 137");
 const block = await provider.getBlockNumber();
 const opts = {blockTag:block};
 const c = new ethers.Contract(ADDRESS,ABI,provider);
 const [code,name,symbol,language,mediaType,cv,dv,primaryCount,secondaryCount,primaryDigest,definitionDigest] = await Promise.all([
  provider.getCode(ADDRESS,block), c.name(opts),c.symbol(opts),c.language(opts),c.mediaType(opts),
  c.codecVersion(opts),c.dictionaryVersion(opts),c.primaryCount(opts),c.secondaryCount(opts),
  c.primaryDigest(opts),c.definitionDigest(opts)
 ]);
 const count = Number(secondaryCount);
 if (code === "0x") throw Error("No runtime code at deployed address");
 if (name !== "M64 SVG Icons v1" || symbol !== "M64SVG" ||
    language !== "svg" || mediaType !== "image/svg+xml" ||
    Number(cv) !== 2 || Number(dv) !== 1 || Number(primaryCount) !== 62 ||
    primaryDigest.toLowerCase() !== EXPECTED_DIGEST) throw Error("Polygon contract metadata/digest does not match expected SVG dictionary");
 if (!Number.isSafeInteger(count) || count > 256) throw Error("Unbounded secondary table; this viewer audits at most 256 entries");
 const pinned = await c.digestAtCount(count, opts);
 if (pinned.toLowerCase() !== definitionDigest.toLowerCase()) throw Error("Latest dictionary digest does not match its snapshot");
 const primaries = await batches(62,8,i => c.primary(i,opts));
 if (!primaries.every((v,i)=>v.toLowerCase()==="0x"+seed.primaryHex[i].toLowerCase()))
  throw Error("One or more on-chain primary bytes differ from the expected seed");
 const entries = await batches(count,8,async i => {
  const e = await c.entry(i,opts);
  if (progress) progress(i + 1, count);
  return {kind:Number(e[0]),data:ethers.getBytes(e[1]),symbolCount:Number(e[2])};
 });
 const prepared = codec.prepareDictionary({primary:seed.primaryHex.map(rawBytes),secondary:entries},1024*1024);
 const map = new Map();
 const known = new Map(icons.map(icon => [icon.raw,icon.ordinal]));
 prepared.expanded.forEach((value,id) => {
  const ordinal = known.get(codec.bytesHex(value));
  if (ordinal !== undefined && !map.has(ordinal)) map.set(ordinal,id);
 });
 return {block,count,codeBytes:(code.length-2)/2,primaryDigest,definitionDigest,map,entries};
}
async function refreshRead() {
 const request = ++readRevision;
 snapshot = null;
 invalidateWrite();
 status("status","Reading Polygon chain 137. Checking metadata, 62 primary bytes, and stored entries…");
 try {
  const result = await inspect(reader(),(done,total) => {
   if (request===readRevision && (done===total || done%8===0))
    status("status","Reading Polygon icon entries: " + done + "/" + total);
  });
  if (request!==readRevision) return;
  snapshot = result;
  const remaining = 64-result.map.size;
  status("status",[
   "READ-ONLY AUDIT PASSED (not verified Solidity source)",
   "Chain: Polygon 137 · Block: " + result.block,
   "Runtime: " + result.codeBytes + " bytes",
   "Primary: 62/62 byte-for-byte match",
   "Primary digest: " + result.primaryDigest,
   "Secondary entries: " + result.count,
   "Recognized SVG icons: " + result.map.size + " / 64",
   "Other secondary entries: " + (result.count - result.map.size),
   "Definition snapshot: " + result.definitionDigest,
   remaining ? remaining + " icons remain to be appended." : "All 64 expected icons recoverable from Polygon."
  ].join("\n"), true);
  $("reviewBatch").disabled = remaining===0;
 } catch (error) {
  if (request===readRevision) status("status","READ FAILED: " + errText(error) + "\nLocal previews remain available. No on-chain source is asserted.",false);
 }
 if (request===readRevision) {renderGallery();displayLookup();}
}
function nextBatch() {
 if (!snapshot) throw Error("Read and verify Polygon dictionary first");
 const missing = icons.filter(i => !snapshot.map.has(i.ordinal)).slice(0,8);
 if (!missing.length) throw Error("All expected icons are already stored");
 const primary = seed.primaryHex.map(rawBytes);
 const dict = {primary,secondary:[]};
 const packed = [], counts = [], metrics = [];
 for (const icon of missing) {
  const encoded = codec.encode(rawBytes(icon.raw),dict);
  if (encoded.symbolCount===0 || encoded.symbolCount>4096) throw Error("Icon exceeds contract symbol limit: " + icon.name);
  if (codec.bytesHex(codec.decode(encoded.wire,dict))!==icon.raw) throw Error("Local reconstruction differs: "+icon.name);
  packed.push(hex(encoded.packed));
  counts.push(encoded.symbolCount);
  metrics.push(icon.name + " (" + icon.raw.length/2 + " raw → " + encoded.packed.length + " packed bytes)");
 }
 return {missing,packed,counts,metrics};
}
async function reviewBatch() {
 invalidateWrite();
 const current = snapshot;
 if (!current) throw Error("Read dictionary first");
 const wallet = chosenWallet();
 const wp = new ethers.BrowserProvider(wallet);
 const accounts = await wallet.request({method:"eth_requestAccounts"});
 if (!accounts || !accounts[0]) throw Error("Wallet returned no account");
 if (BigInt((await wp.getNetwork()).chainId)!==137n) throw Error("Wallet must be switched to Polygon mainnet (137)");
 const c = new ethers.Contract(ADDRESS,ABI,wp);
 if (Number(await c.secondaryCount())!==current.count ||
     (await c.definitionDigest()).toLowerCase()!==current.definitionDigest.toLowerCase())
  throw Error("Dictionary changed since scan. Refresh on-chain state first");
 const plan = nextBatch();
 const signer = await wp.getSigner();
 const account = await signer.getAddress();
 if (account.toLowerCase()!==accounts[0].toLowerCase()) throw Error("Wallet account changed during review");
 const signed = c.connect(signer);
 const gas = await signed.addSecondaryBatch.estimateGas(plan.packed,plan.counts);
 const data = c.interface.encodeFunctionData("addSecondaryBatch",[plan.packed,plan.counts]);
 reviewed = {...plan,wallet,wp,account,count:current.count,digest:current.definitionDigest,data};
 $("sendBatch").disabled = false;
 status("writeStatus",[
  "REVIEWED, NOT SUBMITTED",
  "Sender: " + account,"Chain: 137","To: " + ADDRESS,
  "Function: addSecondaryBatch(bytes[],uint32[])",
  "New entries: " + plan.missing.length,
  ...plan.metrics,
  "Call data: " + (data.length-2)/2 + " bytes",
  "Estimated gas: " + gas.toString() + " units (not a quoted fee)",
  "Value: 0",
  "Click Submit reviewed batch for a wallet approval."
 ].join("\n"),true);
}
async function submitBatch() {
 if (!reviewed) throw Error("No reviewed batch");
 const plan = reviewed;
 reviewed = null;
 $("sendBatch").disabled = true;
 const wp = new ethers.BrowserProvider(plan.wallet);
 if (chosenWallet()!==plan.wallet) throw Error("Selected wallet changed");
 if (BigInt((await wp.getNetwork()).chainId)!==137n) throw Error("Wallet network changed");
 const signer = await wp.getSigner();
 if ((await signer.getAddress()).toLowerCase()!==plan.account.toLowerCase()) throw Error("Wallet account changed");
 const c = new ethers.Contract(ADDRESS,ABI,signer);
 if (Number(await c.secondaryCount())!==plan.count ||
     (await c.definitionDigest()).toLowerCase()!==plan.digest.toLowerCase())
  throw Error("Dictionary changed since review; read it again before sending");
 const data = c.interface.encodeFunctionData("addSecondaryBatch",[plan.packed,plan.counts]);
 if (data.toLowerCase()!==plan.data.toLowerCase()) throw Error("Encoded calldata changed");
 status("writeStatus","Rechecking gas and requesting wallet signature. No transaction has been sent yet.");
 await c.addSecondaryBatch.estimateGas(plan.packed,plan.counts);
 const tx = await c.addSecondaryBatch(plan.packed,plan.counts);
 status("writeStatus","SUBMITTED, NOT YET CONFIRMED\nTx: " + tx.hash + "\nWaiting for a successful Polygon receipt.",true);
 const receipt = await tx.wait(1);
 if (!receipt || receipt.status!==1) throw Error("Transaction did not execute successfully: " + tx.hash);
 status("writeStatus","MINED SUCCESSFULLY\nTx: " + tx.hash + "\nBlock: " + receipt.blockNumber +
  "\nRefresh/read again to verify exact reconstructed icon bytes.",true);
 await refreshRead();
}
$("showIcon").addEventListener("click",displayLookup);
$("lookup").addEventListener("keydown",event => {if(event.key==="Enter") displayLookup();});
$("refresh").addEventListener("click",refreshRead);
$("readSource").addEventListener("change",refreshRead);
$("scanWallet").addEventListener("click",discover);
$("wallet").addEventListener("change",invalidateWrite);
$("reviewBatch").addEventListener("click",async()=>{
 if (writeBusy) return;writeBusy=true;$("reviewBatch").disabled=true;
 try {await reviewBatch();} catch(error){status("writeStatus","REVIEW FAILED: "+errText(error),false);}
 finally {writeBusy=false;$("reviewBatch").disabled=!snapshot;}
});
$("sendBatch").addEventListener("click",async()=>{
 if (writeBusy) return;writeBusy=true;$("reviewBatch").disabled=true;
 try {await submitBatch();} catch(error){status("writeStatus","SUBMISSION NOT CONFIRMED: "+errText(error)+
   "\nIf a transaction was submitted, check wallet history before retrying.",false);}
 finally {writeBusy=false;invalidateWrite();}
});
const params = new URLSearchParams(location.search);
if(params.has("icon")) $("lookup").value=params.get("icon").slice(0,80);
discover();
renderGallery();
displayLookup();
void refreshRead();
})();
