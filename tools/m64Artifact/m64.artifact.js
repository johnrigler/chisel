(function(g){
"use strict";
const M=g.ChiselM64;
if(!M)throw new Error("m64.artifact.js requires m64.js first");

const M64_V3_CODEC=Object.freeze({
  id:"m64-dict-v1",
  alphabet:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
});

function nonEmpty(v){return typeof v==="string"&&v.trim().length>0}
function jsIdentifier(v){return typeof v==="string"&&/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(v)}
function positiveVersion(v){return Number.isSafeInteger(v)&&v>=1}
function canonicalByteCount(v){return Number.isSafeInteger(v)&&v>=0}
function sha256Hex(v){return typeof v==="string"&&/^[0-9a-f]{64}$/.test(v)}

function validateDictionaryRef(d,language){
  if(!d||typeof d!=="object"||Array.isArray(d))throw new Error("M64 v3 dictionary reference missing");
  if(d.kind!=="ledger-dictionary")throw new Error("Unsupported M64 v3 dictionary kind");
  if(!nonEmpty(d.ref))throw new Error("M64 v3 dictionary ref missing");
  if(!positiveVersion(d.version))throw new Error("Bad M64 v3 dictionary version");
  if(!nonEmpty(d.language))throw new Error("M64 v3 dictionary language missing");
  if(d.language!==language)throw new Error("M64 v3 dictionary language mismatch");
  return d;
}

function validatePayload(payload){
  if(typeof payload!=="string")throw new Error("M64 v3 artifact payload missing");
  const bytes=M.decode64(payload,M64_V3_CODEC.alphabet);
  M.dictionaryIndexes(bytes);
  return bytes;
}

function validateArtifactV3(a){
  if(!a||a.kind!=="chisel-m64-artifact"||a.version!==3)throw new Error("Unsupported M64 v3 artifact package");
  if(a.language!=="javascript")throw new Error("Unsupported M64 v3 language");
  if(!nonEmpty(a.languageVersion))throw new Error("M64 v3 languageVersion missing");
  if(a.codec!==M64_V3_CODEC.id)throw new Error("Unsupported M64 v3 codec");
  if(a.canonicalizer!=="js-canonical-v1")throw new Error("Unsupported M64 v3 canonicalizer");
  validateDictionaryRef(a.dictionary,a.language);
  if(a.runtime!=="CHISEL-PURE1")throw new Error("Unsupported M64 v3 runtime");
  if(!jsIdentifier(a.entry))throw new Error("Bad M64 v3 artifact entry");
  validatePayload(a.payload);
  if(!canonicalByteCount(a.canonicalBytes))throw new Error("Bad M64 v3 canonicalBytes");
  if(!sha256Hex(a.sha256))throw new Error("Bad M64 v3 sha256");
  return a;
}

M.M64_V3_CODEC=M64_V3_CODEC;
M.validateArtifactV3=validateArtifactV3;
M.validateDictionaryRefV3=validateDictionaryRef;
})(globalThis);
