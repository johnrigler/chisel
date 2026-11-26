(function(root){
  "use strict";
  const ADDRESS="19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", MAX_BYTES=1024*1024;
  const encoder=new TextEncoder();
  function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");}
  function le(n,count){let s="";for(let i=0;i<count;i++){s+=(n%256).toString(16).padStart(2,"0");n=Math.floor(n/256);}return s;}
  function push(bytes){
    if(!(bytes instanceof Uint8Array)||bytes.length>MAX_BYTES) throw new Error("Data exceeds the 1 MiB local preview limit");
    const n=bytes.length;
    return (n<=75?le(n,1):n<=255?"4c"+le(n,1):n<=65535?"4d"+le(n,2):"4e"+le(n,4))+hex(bytes);
  }
  function compactSize(n){if(!Number.isSafeInteger(n)||n<0||n>0xffffffff)throw new Error("Invalid output length");return n<253?le(n,1):n<=65535?"fd"+le(n,2):"fe"+le(n,4);}
  function build(options){
    const o=options||{},content=typeof o.content==="string"?encoder.encode(o.content):o.content;
    if(!(content instanceof Uint8Array)||!content.length||content.length>MAX_BYTES)throw new Error("Choose 1 byte to 1 MiB of content.");
    const mime=String(o.mime||"").trim().toLowerCase(),encoding=String(o.encoding||""),filename=String(o.filename||"");
    if(!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime)||mime.length>128)throw new Error("Enter a valid MIME type, for example image/png.");
    if(encoding==="|"||filename==="|"||encoder.encode(encoding).length>40||encoder.encode(filename).length>200)throw new Error("Invalid encoding or filename.");
    const fields=[encoder.encode(ADDRESS),content,encoder.encode(mime)];
    if(encoding||filename)fields.push(encoder.encode(encoding));
    if(filename)fields.push(encoder.encode(filename));
    const scriptHex="006a"+fields.map(push).join(""),scriptBytes=scriptHex.length/2;
    return Object.freeze({protocol:"Bitcom B",protocolAddress:ADDRESS,valueSats:0,mime,encoding,filename,payloadBytes:content.length,scriptBytes,scriptHex,outputHex:"0000000000000000"+compactSize(scriptBytes)+scriptHex});
  }
  root.CHISEL_BSV_WRITE=Object.freeze({ADDRESS,MAX_BYTES,push,compactSize,build});
  for(const id of ["bsv","bsvTestnet"]){
    const coin=root.CHISEL.coins[id];
    root.CHISEL_SEND.register(id,{label:coin.DISPLAY_NAME,workspace:"bsv",canBroadcast:false,formats:[{id:"bitcom-b",label:"Bitcom B",state:"output-preview"},{id:"twetch",label:"Twetch",state:"read-only"},{id:"1sat",label:"1Sat Ordinals",state:"read-only"}]});
  }
})(window);
