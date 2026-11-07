(function(g){
"use strict";
const M=g.ChiselM64;
if(!M||!M.M64_V3_CODEC||!M.validateArtifactV3)throw Error("m64.ledger.js requires the M64 v3 modules");
const MAGIC=Uint8Array.of(0x43,0x4d,0x36,0x34); // CM64
const VERSION=2;
const PROGRAM_FORMAT="chisel-m64-program-v2";
const TEMPLATE_FORMAT="chisel-m64-template-v1";
const enc=new TextEncoder();
const dec=new TextDecoder("utf-8",{fatal:true});
function validTx(v){return typeof v==="string"&&/^0x[0-9a-fA-F]{64}$/.test(v)}
function validSha(v){return typeof v==="string"&&/^[a-f0-9]{64}$/.test(v)}
function eip155Ref(chain,address){if(!Number.isSafeInteger(chain)||chain<1||!/^0x[0-9a-fA-F]{40}$/.test(address))throw Error("Invalid EIP-155 ledger carrier");return "eip155:"+chain+":"+address.toLowerCase()}
function packLedgerProgram(artifact,options={}){
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
function unpackLedgerProgram(value){
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
M.M64_LEDGER_TEMPLATE_FORMAT=TEMPLATE_FORMAT;
M.m64Eip155CarrierRef=eip155Ref;
M.packLedgerProgram=packLedgerProgram;
M.unpackLedgerProgram=unpackLedgerProgram;
M.m64CompressionReport=compressionReport;
})(globalThis);
