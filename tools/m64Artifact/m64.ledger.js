(function(g){
"use strict";
const M=g.ChiselM64;
if(!M||!M.M64_V3_CODEC||!M.validateArtifactV3)throw Error("m64.ledger.js requires the M64 v3 modules");
const MAGIC=Uint8Array.of(0x43,0x4d,0x36,0x34); // CM64
const VERSION=2;
const PROGRAM_FORMAT="chisel-m64-program-v3";
const LEGACY_PROGRAM_FORMAT="chisel-m64-program-v2";
const BINARY_VERSION=3;
const TEMPLATE_FORMAT="chisel-m64-template-v1";
const enc=new TextEncoder();
const dec=new TextDecoder("utf-8",{fatal:true});
function validTx(v){return typeof v==="string"&&/^0x[0-9a-fA-F]{64}$/.test(v)}
function validSha(v){return typeof v==="string"&&/^[a-f0-9]{64}$/.test(v)}
function eip155Ref(chain,address){if(!Number.isSafeInteger(chain)||chain<1||!/^0x[0-9a-fA-F]{40}$/.test(address))throw Error("Invalid EIP-155 ledger carrier");return "eip155:"+chain+":"+address.toLowerCase()}
function packLedgerProgramV2(artifact,options={}){
  M.validateArtifactV3(artifact);
  const carrier=String(options.carrier||"");
  if(!/^eip155:[1-9][0-9]*:0x[0-9a-f]{40}$/.test(carrier))throw Error("Chisel contract carrier reference required");
  const templateTx=String(options.templateTx||"");
  const templateSha256=String(options.templateSha256||"");
  if(!validTx(templateTx)||!validSha(templateSha256))throw Error("Ledger template tx and SHA-256 required");
  const payload=artifact.payload;
  // M64 is textual Base64url. EVM presents the UTF-8 bytes as hex, but the
  // ledger stores exactly the UTF-8 bytes of these 64-alphabet characters.
  if(!/^[A-Za-z0-9_-]*$/.test(payload)||M.encode64(M.decode64(payload,M.M64_V3_CODEC.alphabet),M.M64_V3_CODEC.alphabet)!==payload)
    throw Error("M64 payload must be canonical unpadded Base64url text");
  const header={kind:"chisel-m64-ledger-program",version:VERSION,carrier,payloadEncoding:"m64-base64url-ascii",artifact:{...artifact},template:{format:TEMPLATE_FORMAT,tx:templateTx.toLowerCase(),sha256:templateSha256}};
  delete header.artifact.payload;
  const meta=enc.encode(JSON.stringify(header));
  if(meta.length>65535)throw Error("Ledger header exceeds 64 KiB");
  const text=enc.encode(payload);
  const out=new Uint8Array(9+meta.length+text.length);
  out.set(MAGIC,0);out[4]=VERSION;
  new DataView(out.buffer).setUint32(5,meta.length,false);
  out.set(meta,9);out.set(text,9+meta.length);
  return out;
}
function unpackLedgerProgramV2(value){
  const bytes=value instanceof Uint8Array?value:Uint8Array.from(value||[]);
  if(bytes.length<9||!MAGIC.every((v,i)=>bytes[i]===v)||bytes[4]!==VERSION)throw Error("Invalid CM64 ledger record magic/version");
  const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(5,false);
  if(size<2||size>65535||9+size>bytes.length)throw Error("Invalid ledger header length");
  const header=JSON.parse(dec.decode(bytes.subarray(9,9+size)));
  if(header.kind!=="chisel-m64-ledger-program"||header.version!==VERSION||!/^eip155:[1-9][0-9]*:0x[0-9a-f]{40}$/.test(header.carrier||""))throw Error("Invalid ledger carrier metadata");
  if(header.payloadEncoding!=="m64-base64url-ascii")throw Error("M64 ledger payload must be 64-alphabet UTF-8 text");
  const t=header.template;
  if(!t||t.format!==TEMPLATE_FORMAT||!validTx(t.tx)||!validSha(t.sha256))throw Error("Ledger record lacks immutable HTML template locator");
  const payload=dec.decode(bytes.subarray(9+size));
  if(!/^[A-Za-z0-9_-]*$/.test(payload)||M.encode64(M.decode64(payload,M.M64_V3_CODEC.alphabet),M.M64_V3_CODEC.alphabet)!==payload)
    throw Error("Noncanonical M64 Base64url text in ledger record");
  const artifact={...header.artifact,payload};
  M.validateArtifactV3(artifact);
  return {artifact,carrier:header.carrier,template:t,payloadEncoding:header.payloadEncoding,
    m64TextBytes:bytes.length-9-size,m64Characters:payload.length,ledgerRecordBytes:bytes.length};
}

// CM64/v3 is a compact binary wire record. JSON is used only to decode old CM64/v2 records.
// This codec is deliberately explicit: unknown parameter schemas are rejected, not stringified.
const DARK_STAR_INPUT_KEYS=Object.freeze([
  "seed","width","height","lines","yLeft","yRight","dyLeft","dyRight",
  "slopeEvery","ddyLeft","ddyRight","r","g","b","dr","dg","db",
  "colorEvery","ddr","ddg","ddb"
]);
function writeVar(out,value){
  let n=BigInt(value);
  if(n<0n||n>BigInt(Number.MAX_SAFE_INTEGER))throw Error("M64 integer out of range");
  do{const byte=Number(n&127n);n>>=7n;out.push(byte|(n?128:0))}while(n);
}
function writeSigned(out,value){
  if(!Number.isSafeInteger(value))throw Error("M64 input values must be safe integers");
  const n=BigInt(value);
  writeVar(out,n>=0n?n*2n:(-n*2n-1n));
}
function readByte(state){
  if(state.pos>=state.bytes.length)throw Error("Truncated CM64 binary record");
  return state.bytes[state.pos++];
}
function readBytes(state,count){
  if(!Number.isSafeInteger(count)||count<0||count>state.bytes.length-state.pos)throw Error("Truncated CM64 binary record");
  const b=state.bytes.subarray(state.pos,state.pos+count);
  state.pos+=count;
  return b;
}
function readVar(state){
  let n=0n;
  for(let i=0;i<8;i++){
    const b=readByte(state);
    n|=BigInt(b&127)<<BigInt(i*7);
    if(!(b&128)){
      if(i>0&&b===0)throw Error("Noncanonical CM64 varint");
      if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error("CM64 integer out of range");
      return Number(n);
    }
  }
  throw Error("CM64 varint too long");
}
function readSigned(state){
  const n=BigInt(readVar(state));
  const signed=(n&1n)?-((n+1n)/2n):(n/2n);
  if(signed<BigInt(Number.MIN_SAFE_INTEGER)||signed>BigInt(Number.MAX_SAFE_INTEGER))throw Error("CM64 signed integer out of range");
  return Number(signed);
}
function byteHex(bytes){return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("")}
function hexBytes(value,count){
  const h=String(value||"").replace(/^0x/,"");
  if(h.length!==count*2||!/^[0-9a-f]+$/i.test(h))throw Error("Expected "+count+"-byte hex field");
  return Uint8Array.from(h.match(/../g),x=>parseInt(x,16));
}
function writeShortText(out,value,label){
  const bytes=enc.encode(value);
  if(!bytes.length||bytes.length>64||!bytes.every(x=>x>=32&&x<=126))throw Error("Unsupported CM64 "+label);
  writeVar(out,bytes.length);out.push(...bytes);
}
function readShortText(state,label){
  const n=readVar(state);
  if(n<1||n>64)throw Error("Invalid CM64 "+label+" length");
  const v=dec.decode(readBytes(state,n));
  if(![...v].every(x=>x.charCodeAt(0)>=32&&x.charCodeAt(0)<=126))throw Error("Invalid CM64 "+label);
  return v;
}
function packLedgerProgram(artifact,options={}){
  M.validateArtifactV3(artifact);
  const carrier=String(options.carrier||"");
  const c=/^eip155:([1-9][0-9]*):(0x[0-9a-f]{40})$/.exec(carrier);
  const d=/^eip155:([1-9][0-9]*):(0x[0-9a-f]{40})$/.exec(artifact.dictionary.ref);
  if(!c||!d||c[1]!==d[1])throw Error("Chisel and dictionary must use the same EIP-155 chain");
  const chain=Number(c[1]);
  if(!Number.isSafeInteger(chain)||chain<1)throw Error("Invalid CM64 chain id");
  if(!validTx(options.templateTx)||!validSha(options.templateSha256))throw Error("Template transaction hash and SHA-256 required");
  const raw=M.decode64(artifact.payload,M.M64_V3_CODEC.alphabet);
  if(M.encode64(raw,M.M64_V3_CODEC.alphabet)!==artifact.payload)throw Error("Noncanonical M64 payload");
  const out=[...MAGIC,BINARY_VERSION];
  writeVar(out,chain);
  out.push(...hexBytes(c[2],20),...hexBytes(d[2],20));
  writeVar(out,artifact.dictionary.version);
  out.push(...hexBytes(options.templateTx,32),...hexBytes(options.templateSha256,32),...hexBytes(artifact.sha256,32));
  writeVar(out,artifact.canonicalBytes);
  writeShortText(out,artifact.languageVersion,"language version");
  writeShortText(out,artifact.entry,"entry");
  if(artifact.input===undefined){
    writeVar(out,0);
  }else{
    const input=artifact.input;
    if(!input||typeof input!=="object"||Array.isArray(input)||
       Object.keys(input).length!==DARK_STAR_INPUT_KEYS.length||
       !DARK_STAR_INPUT_KEYS.every(key=>Object.hasOwn(input,key)))
      throw Error("CM64 binary input requires the complete Dark Star numeric parameter schema; no JSON fallback is permitted");
    writeVar(out,1);
    for(const key of DARK_STAR_INPUT_KEYS)writeSigned(out,input[key]);
  }
  out.push(...raw);
  return Uint8Array.from(out);
}
function unpackLedgerProgramV3(value){
  const state={bytes:value,pos:5};
  const chain=readVar(state);
  if(chain<1)throw Error("Invalid CM64 chain");
  const chisel="0x"+byteHex(readBytes(state,20));
  const dictionary="0x"+byteHex(readBytes(state,20));
  const dictionaryVersion=readVar(state);
  if(dictionaryVersion<1)throw Error("Invalid CM64 dictionary version");
  const templateTx="0x"+byteHex(readBytes(state,32));
  const templateSha256=byteHex(readBytes(state,32));
  const sha256=byteHex(readBytes(state,32));
  const canonicalBytes=readVar(state);
  const languageVersion=readShortText(state,"language version");
  const entry=readShortText(state,"entry");
  const schema=readVar(state);
  let input;
  if(schema===1){
    input={};
    for(const key of DARK_STAR_INPUT_KEYS)input[key]=readSigned(state);
  }else if(schema!==0)throw Error("Unknown CM64 binary input schema "+schema);
  const raw=state.bytes.subarray(state.pos);
  if(!raw.length)throw Error("CM64 binary program payload is empty");
  const payload=M.encode64(raw,M.M64_V3_CODEC.alphabet);
  const artifact={
    kind:"chisel-m64-artifact",version:3,language:"javascript",languageVersion,
    codec:M.M64_V3_CODEC.id,canonicalizer:M.JS_CANONICAL_V1.id,
    dictionary:{kind:"ledger-dictionary",ref:eip155Ref(chain,dictionary),version:dictionaryVersion,language:"javascript"},
    runtime:"CHISEL-PURE1",entry,payload,canonicalBytes,sha256
  };
  if(schema===1)artifact.input=input;
  M.validateArtifactV3(artifact);
  return{
    artifact,carrier:eip155Ref(chain,chisel),
    template:{format:TEMPLATE_FORMAT,tx:templateTx,sha256:templateSha256},
    payloadEncoding:"m64-binary",rawPayloadBytes:raw.length,
    m64TextBytes:0,m64Characters:payload.length,ledgerRecordBytes:value.length,version:BINARY_VERSION
  };
}
function unpackLedgerProgram(value){
  const bytes=value instanceof Uint8Array?value:Uint8Array.from(value||[]);
  if(bytes.length<5||!MAGIC.every((v,i)=>bytes[i]===v))throw Error("Invalid CM64 ledger record magic/version");
  if(bytes[4]===BINARY_VERSION)return unpackLedgerProgramV3(bytes);
  if(bytes[4]===VERSION)return {...unpackLedgerProgramV2(bytes),version:VERSION};
  throw Error("Unsupported CM64 ledger record magic/version");
}

function compressionReport(source,artifact,ledgerBytes=null){
  M.validateArtifactV3(artifact);
  const sourceBytes=M.utf8Len(String(source));
  const canonicalBytes=artifact.canonicalBytes;
  const rawPayloadBytes=M.decode64(artifact.payload,M.M64_V3_CODEC.alphabet).length;
  const payloadTextBytes=M.utf8Len(artifact.payload);
  const jsonBytes=M.utf8Len(JSON.stringify(artifact));
  const sizeSaved=(before,after)=>before?100*(before-after)/before:0;
  return {sourceBytes,canonicalBytes,rawPayloadBytes,payloadTextBytes,m64Characters:artifact.payload.length,jsonBytes,ledgerRecordBytes:ledgerBytes,
    canonicalSavingsPct:sizeSaved(sourceBytes,canonicalBytes),
    rawSavingsPct:sizeSaved(canonicalBytes,rawPayloadBytes),
    textSavingsPct:sizeSaved(canonicalBytes,payloadTextBytes),
    envelopeSavingsPct:ledgerBytes==null?null:sizeSaved(sourceBytes,ledgerBytes)};
}
M.M64_LEDGER_PROGRAM_FORMAT=PROGRAM_FORMAT;
M.M64_LEDGER_PROGRAM_FORMAT_V2=LEGACY_PROGRAM_FORMAT;
M.M64_LEDGER_TEMPLATE_FORMAT=TEMPLATE_FORMAT;
M.m64Eip155CarrierRef=eip155Ref;
M.packLedgerProgram=packLedgerProgram;
M.packLedgerProgramV2=packLedgerProgramV2;
M.unpackLedgerProgram=unpackLedgerProgram;
M.m64CompressionReport=compressionReport;
})(globalThis);
