(function(root){
  "use strict";
  const registry=root.CHISEL_SEND, writer=root.CHISEL_BSV_WRITE;
  const el=id=>document.getElementById(id), select=el("currency"), nav=el("sendWorkspaceNav"), panel=el("bsvWritePanel"), title=el("sendWorkspaceTitle"), formats=el("sendWorkspaceFormats");
  if(!select||!nav||!panel||!registry)return;
  let result=null, generation=0;
  function active(){return document.body.dataset.sendNetwork==="polygon"?"polygon":select.value;}
  function sync(){
    const id=active(),entry=registry.get(id);
    if(!entry)return;
    document.body.dataset.sendWorkspace=entry.workspace;
    panel.hidden=entry.workspace!=="bsv";
    title.textContent="Send · "+entry.label;
    formats.textContent=entry.formats.map(f=>f.label+(f.state==="output-preview"?" (build output)":f.state==="read-only"?" (read only)":"")).join(" · ")||"Receive and balance checks only";
    for(const button of nav.querySelectorAll("button"))button.setAttribute("aria-pressed",String(button.dataset.currency===id));
  }
  for(const entry of registry.list()){
    const b=document.createElement("button");b.type="button";b.className="secondaryButton";b.textContent=entry.label;b.dataset.currency=entry.id;
    b.onclick=()=>{select.value=entry.id;select.dispatchEvent(new Event("change",{bubbles:true}));root.setGuiMode("send");sync();};
    nav.append(b);
  }
  function clear(){
    generation++;result=null;el("bsvWriteResult").hidden=true;el("bsvWriteDownload").disabled=true;el("bsvWriteStatus").textContent="No output built.";
  }
  for(const id of ["bsvWriteText","bsvWriteMime","bsvWriteEncoding","bsvWriteFilename"])el(id).addEventListener("input",clear);
  el("bsvWriteFile").addEventListener("change",()=>{
    const f=el("bsvWriteFile").files[0];if(f){el("bsvWriteMime").value=f.type||"application/octet-stream";el("bsvWriteFilename").value=f.name;el("bsvWriteEncoding").value="";}else{el("bsvWriteMime").value="text/plain";el("bsvWriteFilename").value="";el("bsvWriteEncoding").value="UTF-8";}clear();
  });
  el("bsvWriteBuild").onclick=async()=>{
    clear();const token=generation;
    try{
      const f=el("bsvWriteFile").files[0];
      if(f&&f.size>writer.MAX_BYTES)throw new Error("File exceeds the 1 MiB local preview limit.");
      const content=f?new Uint8Array(await f.arrayBuffer()):el("bsvWriteText").value;
      if(token!==generation)return;
      result=writer.build({content,mime:el("bsvWriteMime").value,encoding:el("bsvWriteEncoding").value,filename:el("bsvWriteFilename").value});
      el("bsvWriteStatus").textContent=result.payloadBytes+" content bytes · "+result.scriptBytes+" script bytes · "+result.outputHex.length/2+" serialized output bytes · 0 satoshis";
      el("bsvWriteResult").textContent=result.scriptHex.length>4096?result.scriptHex.slice(0,4096)+"… (download complete output JSON)":result.scriptHex;
      el("bsvWriteResult").hidden=false;el("bsvWriteDownload").disabled=false;
    }catch(e){if(token===generation)el("bsvWriteStatus").textContent=e.message;}
  };
  el("bsvWriteDownload").onclick=()=>{
    if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify({...result,network:active()},null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="chisel-bitcom-b-output.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  select.addEventListener("change",()=>{clear();sync();});
  root.addEventListener("chisel:mode",sync);root.addEventListener("chisel:polygon-send",sync);sync();
})(window);
