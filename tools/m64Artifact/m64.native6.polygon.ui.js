"use strict";
const $=id=>document.getElementById(id),API=window.ChiselM64Native6Polygon;
const sources=[],seed=window.ChiselM64Native6DarkStarSeed.create();
let verified=null,prepared=null,reviewed=null,sent=null,reconstructed=null,sample=null;
function show(id,text,ok){const el=$(id);el.textContent=text;el.classList.toggle("good",ok===true);el.classList.toggle("error",ok===false)}
function addWallet(provider,name){
 if(!provider||typeof provider.request!=="function"||sources.some(item=>item.provider===provider))return;
 sources.push({provider,name:String(name||"Injected wallet")});refreshSelect();
}
function refreshSelect(){
 const sel=$("wallet"),before=sel.value;sel.replaceChildren();
 sources.forEach((item,i)=>{const opt=document.createElement("option");opt.value=String(i);opt.textContent=item.name;sel.append(opt)});
 if(!sources.length){const opt=document.createElement("option");opt.value="";opt.textContent="No injected wallet found";sel.append(opt);}
 if(sources[Number(before)])sel.value=before;
}
function discover(){
 if(window.ethereum)addWallet(window.ethereum,"Injected EVM wallet");
 if(window.backpack?.ethereum)addWallet(window.backpack.ethereum,"Backpack");
 window.dispatchEvent(new Event("eip6963:requestProvider"));refreshSelect();
}
window.addEventListener("eip6963:announceProvider",event=>{
 if(event.detail?.provider)addWallet(event.detail.provider,event.detail.info?.name);
});
function selectedWallet(){
 const index=Number($("wallet").value);
 if($("wallet").value===""||!sources[index])throw Error("No injected EVM wallet selected");
 return sources[index].provider;
}
function provider(){
 return new ethers.BrowserProvider(selectedWallet());
}
function clearPublication(){
 prepared=null;reviewed=null;
 $("prepare").disabled=!verified;$("review").disabled=true;$("publish").disabled=true;
 $("record").value="";
 show("prepareStatus","Record must be rebuilt after source or dictionary changes.");
 show("publishStatus","Publication review invalidated. Nothing submitted.");
}
function clearDictionary(){
 verified=null;clearPublication();$("prepare").disabled=true;
 show("inspectStatus","Verify the selected Polygon dictionary before publishing.",false);
}
$("wallet").addEventListener("change",clearDictionary);
$("dictionary").addEventListener("input",clearDictionary);
$("source").addEventListener("input",clearPublication);
$("scanWallet").onclick=discover;
$("inspect").onclick=async()=>{
 $("inspect").disabled=true;clearDictionary();
 try{
  const p=provider(),address=$("dictionary").value.trim();
  show("inspectStatus","Querying Polygon dictionary definitions. No wallet signature required.");
  verified=await API.verifyDictionary(p,{seed,address,ethers,onProgress:(count,total)=>{
   show("inspectStatus","Reading on-chain entries: "+count+" / "+total);
  }});
  $("prepare").disabled=false;
  show("inspectStatus",[
   "PASSED: actual Polygon dictionary bytes match the Dark Star seed.",
   "Contract: "+verified.address,"Chain: "+verified.chainId,
   "Codec: "+verified.codecVersion,"Dictionary version: "+verified.dictionaryVersion,
   "Name: "+verified.name,"Language: "+verified.language,"Media type: "+verified.mediaType,
   "Primary entries inspected: 62 / 62",
   "Secondary entries inspected: "+verified.snapshotCount+" / "+verified.snapshotCount,
   "Secondary entries currently stored: "+verified.secondaryCount,
   "Pinned snapshot digest: "+verified.snapshotDigest,
   "Snapshot is immutable at this count, even if more entries are appended."
  ].join("\n"),true);
 }catch(e){show("inspectStatus","NOT VERIFIED: "+(e.message||String(e)),false)}
 finally{$("inspect").disabled=false}
};
$("loadSample").onclick=async()=>{
 try{
  const r=await fetch("./examples/darkstar-core.js",{cache:"no-store"});
  if(!r.ok)throw Error("Dark Star sample HTTP "+r.status);
  sample=await r.text();$("source").value=sample;clearPublication();
 }catch(e){show("prepareStatus",e.message,false)}
};
$("canonical").onclick=()=>{
 try{
  if(!sample||$("source").value!==sample)throw Error("Canonicalization is only available on the unedited Dark Star example");
  $("source").value=ChiselM64.canonicalizeJavascriptV1(sample,"darkStar=a\nmod=m\nputPixel=q\ndrawLine=l");
  clearPublication();
 }catch(e){show("prepareStatus",e.message,false)}
};
$("prepare").onclick=async()=>{
 clearPublication();
 try{
  if(!verified)throw Error("Dictionary must be verified first");
  prepared=await API.prepare(new TextEncoder().encode($("source").value),verified);
  $("record").value=API.hex(prepared.record);
  $("review").disabled=false;
  show("prepareStatus",[
   "Local lossless round trip PASSED",
   "Original source bytes: "+prepared.sourceLength,
   "Native M64 program bytes: "+prepared.wireBytes,
   "Full on-ledger binary record bytes: "+prepared.recordBytes,
   "Source SHA-256: "+prepared.sourceSha256,
   "Record SHA-256: "+prepared.recordSha256,
   "Dictionary address: "+verified.address,
   "Dictionary snapshot at entry "+verified.snapshotCount+": "+verified.snapshotDigest,
   "Savings and byte counts are shown here only, not written as a JSON record."
  ].join("\n"),true);
 }catch(e){show("prepareStatus",e.message,false)}
};
$("review").onclick=async()=>{
 $("review").disabled=true;$("publish").disabled=true;reviewed=null;
 try{
  if(!prepared||!verified)throw Error("Prepare program first");
  const selected=selectedWallet();
  const accounts=await selected.request({method:"eth_requestAccounts"});
  if(!accounts?.[0])throw Error("Wallet account not connected");
  const p=provider();
  reviewed=await API.previewPublish(p,prepared,{ethers,account:accounts[0]});
  $("publish").disabled=false;
  show("publishStatus",[
   "REVIEWED. NOT SUBMITTED.",
   "Chain: Polygon 137","Sender: "+reviewed.from,
   "To: "+reviewed.to,"Function: logRecord(bytes32,bytes)",
   "Format: "+reviewed.format,"Native binary record: "+reviewed.bytes+" bytes",
   "Exact record SHA-256: "+reviewed.recordSha256,
   "Estimated gas units: "+reviewed.gas,
   "Value: 0",
   "Click Publish reviewed binary record for wallet approval."
  ].join("\n"),true);
 }catch(e){show("publishStatus","Review failed: "+(e.message||e),false);$("review").disabled=false}
};
$("publish").onclick=async()=>{
 $("publish").disabled=true;
 try{
  if(!reviewed||!prepared||!verified)throw Error("No reviewed publication");
  const p=provider();
  show("publishStatus","Revalidating on-chain dictionary bytes and account before wallet signature. No prior signature is reused.");
  const tx=await API.sendReviewed(p,reviewed,prepared,verified,{seed,ethers});
  sent=tx.hash;$("txHash").value=sent;
  show("publishStatus","SUBMITTED, NOT YET MINED\nHash: "+sent+"\nUse Rebuild after the receipt confirms successful execution.",true);
 }catch(e){show("publishStatus","Publish failed or declined: "+(e.message||e),false);$("review").disabled=false}
};
$("rebuild").onclick=async()=>{
 $("rebuild").disabled=true;reconstructed=null;$("saveSource").disabled=true;$("reconstructed").value="";
 try{
  const p=provider();
  if(!verified||verified.address!==$("dictionary").value.trim().toLowerCase()){
   show("rebuildStatus","Verifying deployed dictionary before receipt reconstruction.");
   verified=await API.verifyDictionary(p,{seed,address:$("dictionary").value.trim(),ethers});
   $("prepare").disabled=false;
  }
  const result=await API.readReceipt(p,$("txHash").value.trim(),verified,{ethers});
  reconstructed=result.source;
  $("reconstructed").value=new TextDecoder("utf-8",{fatal:true}).decode(result.source);
  $("saveSource").disabled=false;
  show("rebuildStatus",[
   "REBUILT AND VERIFIED. SOURCE NOT EXECUTED.",
   "Transaction: "+result.txHash,"Block: "+result.blockNumber,
   "Writer: "+result.writer,
   "Dictionary: "+result.address,
   "Pinned dictionary entries: "+result.snapshotCount,
   "Dictionary snapshot: "+result.snapshotDigest,
   "Source length: "+result.sourceLength+" bytes",
   "Reconstructed SHA-256: "+result.sourceSha256,
   "Log record bytes: "+result.recordBytes,
   "Save the exact bytes to reconstruct an IPFS source file, then wrap with a trusted renderer if needed."
  ].join("\n"),true);
 }catch(e){show("rebuildStatus","Rebuild failed: "+(e.message||e),false)}
 finally{$("rebuild").disabled=false}
};
$("saveSource").onclick=()=>{
 if(!reconstructed)return;
 const url=URL.createObjectURL(new Blob([reconstructed],{type:"text/javascript"}));
 const a=document.createElement("a");a.href=url;a.download="m64-native6-reconstructed.js";
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
const params=new URLSearchParams(location.search);
if(params.get("tx"))$("txHash").value=params.get("tx");
if(params.get("dictionary"))$("dictionary").value=params.get("dictionary");
discover();$("loadSample").click();
