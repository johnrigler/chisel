(function(g){
"use strict";
// M64 native six-bit v1. This core processes arbitrary binary bytes.
// No JSON or JavaScript parser is required. The caller supplies an immutable
// 62-entry primary dictionary and an append-only typed secondary table.
// kind 0 contains packed six-bit symbols; kind 1 contains reusable raw bytes.
const ABC="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const MAX_OUTPUT=8*1024*1024;
function bytes(v){if(!(v instanceof Uint8Array))throw Error("Expected Uint8Array");return v}
function bytesHex(v){return [...bytes(v)].map(x=>x.toString(16).padStart(2,"0")).join("")}
function fromHex(s){if(typeof s!=="string"||s.length%2||/[^a-fA-F0-9]/.test(s))throw Error("Bad hex");return Uint8Array.from(s.match(/../g)?.map(x=>parseInt(x,16))||[])}
function uint(n){
  if(!Number.isSafeInteger(n)||n<0)throw Error("Invalid nonnegative integer");
  const a=[];
  do{const digit=n%128;n=Math.floor(n/128);a.push(digit+(n?128:0))}while(n);
  return a;
}
function readUint(a,start=0){
  let n=0,p=1,i=start;
  for(let k=0;k<8;k++){
    if(i>=a.length)throw Error("Truncated byte varint");
    const b=a[i++];n+=(b&127)*p;
    if(!Number.isSafeInteger(n))throw Error("Byte varint overflow");
    if(b<128){if(k>0&&b===0)throw Error("Noncanonical byte varint");return {value:n,next:i}}
    p*=128;
  }
  throw Error("Byte varint too long");
}
function index(n){
  if(!Number.isSafeInteger(n)||n<0)throw Error("Bad secondary index");
  const a=[];
  do{const digit=n%32;n=Math.floor(n/32);a.push(digit+(n?32:0))}while(n);
  return a;
}
function readIndex(a,start){
  let n=0,p=1,i=start;
  for(let k=0;k<7;k++){
    if(i>=a.length)throw Error("Truncated secondary index");
    const b=a[i++];n+=(b&31)*p;
    if(!Number.isSafeInteger(n))throw Error("Secondary index overflow");
    if(b<32){if(k>0&&b===0)throw Error("Noncanonical secondary index");return {value:n,next:i}}
    p*=32;
  }
  throw Error("Secondary index too long");
}
function packSymbols(symbols){
  const a=new Uint8Array(Math.ceil(symbols.length*6/8));
  let offset=0;
  for(const v of symbols){
    if(!Number.isInteger(v)||v<0||v>63)throw Error("Not a six-bit value");
    for(let bit=5;bit>=0;bit--,offset++)if((v>>bit)&1)a[offset>>3]|=1<<(7-(offset&7));
  }
  return a;
}
function unpackSymbols(packed,count){
  bytes(packed);
  if(!Number.isSafeInteger(count)||count<0||Math.ceil(count*6/8)!==packed.length)throw Error("Wrong six-bit symbol count");
  let out=[],position=0;
  for(let i=0;i<count;i++){
    let v=0;
    for(let k=0;k<6;k++,position++)v=v*2+((packed[position>>3]>>(7-(position&7)))&1);
    out.push(v);
  }
  for(;position<packed.length*8;position++)if(packed[position>>3]&(1<<(7-(position&7))))throw Error("Nonzero pad bits");
  return out;
}
function appendLimited(out,part,max){
  if(out.length+part.length>max)throw Error("Expanded output limit exceeded");
  for(const b of part)out.push(b);
}
function parseSequence(symbols,primary,secondary,available,max){
  let out=[];
  for(let i=0;i<symbols.length;){
    const s=symbols[i++];
    if(s<62){if(!primary[s])throw Error("Missing primary definition "+s);appendLimited(out,primary[s],max);continue}
    if(s===62){
      if(i+1>=symbols.length)throw Error("Truncated literal");
      const value=symbols[i++]*64+symbols[i++];
      if(value>255)throw Error("Invalid byte literal");
      appendLimited(out,[value],max);continue;
    }
    if(s===63){
      const r=readIndex(symbols,i);i=r.next;
      if(r.value>=available)throw Error("Undefined or forward secondary reference "+r.value);
      appendLimited(out,secondary[r.value],max);continue;
    }
    throw Error("Unknown opcode");
  }
  return Uint8Array.from(out);
}
function prepareDictionary(dict,max=MAX_OUTPUT){
  if(!dict||!Array.isArray(dict.primary)||dict.primary.length!==62)throw Error("Dictionary must have exactly 62 primary entries");
  const primary=dict.primary.map((v,i)=>{bytes(v);if(v.length===0)throw Error("Empty primary entry "+i);return v});
  const defs=dict.secondary||[];
  if(!Array.isArray(defs))throw Error("Bad secondary dictionary");
  const expanded=[];
  for(let i=0;i<defs.length;i++){
    const d=defs[i],kind=d.kind===undefined?0:d.kind;
    if(kind===1){
      const raw=bytes(d.data);
      if(raw.length===0||raw.length>4096||d.symbolCount!==0)throw Error("Invalid raw-byte dictionary entry");
      appendLimited([],raw,max);
      expanded.push(raw);
      continue;
    }
    if(kind!==0)throw Error("Unknown secondary entry kind");
    const packed=bytes(d.packed??d.data),count=d.symbolCount;
    if(!Number.isSafeInteger(count)||count<1||count>4096)throw Error("Bad secondary symbol count");
    const symbols=unpackSymbols(packed,count);
    expanded.push(parseSequence(symbols,primary,expanded,i,max));
  }
  return {primary,expanded};
}
function matchAt(source,offset,term){
  if(term.length>source.length-offset)return false;
  for(let j=0;j<term.length;j++)if(source[offset+j]!==term[j])return false;
  return true;
}
function encode(input,dict){
  const data=bytes(input),p=prepareDictionary(dict),n=data.length;
  const cost=new Array(n+1);cost[n]=0;
  const best=new Array(n);
  const secondaryCodes=p.expanded.map((_,i)=>[63,...index(i)]);
  for(let i=n-1;i>=0;i--){
    let selected={cost:3+cost[i+1],length:1,symbols:[62,data[i]>>6,data[i]&63]};
    for(let id=0;id<62;id++){
      const term=p.primary[id];
      if(matchAt(data,i,term)){
        const c=1+cost[i+term.length];
        if(c<selected.cost||(c===selected.cost&&term.length>selected.length))selected={cost:c,length:term.length,symbols:[id]};
      }
    }
    for(let id=0;id<p.expanded.length;id++){
      const term=p.expanded[id];
      if(term.length&&matchAt(data,i,term)){
        const code=secondaryCodes[id],c=code.length+cost[i+term.length];
        if(c<selected.cost||(c===selected.cost&&term.length>selected.length))selected={cost:c,length:term.length,symbols:code};
      }
    }
    best[i]=selected;cost[i]=selected.cost;
  }
  const symbols=[];
  for(let i=0;i<n;){const x=best[i];symbols.push(...x.symbols);i+=x.length}
  const packed=packSymbols(symbols);
  const wire=Uint8Array.from([...uint(symbols.length),...packed]);
  return {wire,packed,symbols,symbolCount:symbols.length};
}
function decode(wire,dict,max=MAX_OUTPUT){
  bytes(wire);
  const r=readUint(wire,0),count=r.value;
  const packed=wire.slice(r.next);
  const symbols=unpackSymbols(packed,count);
  const p=prepareDictionary(dict,max);
  return parseSequence(symbols,p.primary,p.expanded,p.expanded.length,max);
}
g.ChiselM64Native6=Object.freeze({
  version:1,alphabet:ABC,packSymbols,unpackSymbols,encode,decode,
  prepareDictionary,index,readIndex,writeUint:uint,readUint,bytesHex,fromHex
});
})(globalThis);
