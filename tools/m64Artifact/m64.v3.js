(function(g){
"use strict";
const M=g.ChiselM64;
if(!M)throw new Error("m64.v3.js requires m64.js first");
if(typeof M.validateArtifactV3!=="function")throw new Error("m64.v3.js requires m64.artifact.js first");
if(typeof M.canonicalizeJavascriptV1!=="function")throw new Error("m64.v3.js requires m64.javascript.js first");

function requireResolver(resolver){
  if(!resolver||typeof resolver.describe!=="function"||typeof resolver.ensureTerms!=="function"||typeof resolver.termForId!=="function")throw new Error("M64 v3 dictionary resolver required");
  return resolver;
}

async function sha256HexUtf8(text){
  if(!g.crypto?.subtle)throw new Error("Web Crypto SHA-256 is required for M64 v3");
  const bytes=new TextEncoder().encode(text);
  const digest=await g.crypto.subtle.digest("SHA-256",bytes);
  return[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

function assertResolverMatchesArtifact(resolver,artifact){
  const d=resolver.describe();
  if(d.kind!==artifact.dictionary.kind||d.ref!==artifact.dictionary.ref||d.version!==artifact.dictionary.version||d.language!==artifact.dictionary.language)throw new Error("M64 v3 resolver does not match artifact dictionary reference");
  return d;
}

async function buildJavascriptArtifactV3(source,opt={}){
  const resolver=requireResolver(opt.resolver);
  const languageVersion=String(opt.languageVersion||"es2026");
  const identifierMap=opt.identifierMap||opt.map||"";
  const sourceEntry=String(opt.entry||"");
  const canonical=M.canonicalizeJavascriptV1(source,identifierMap);
  const entry=M.mappedEntry(sourceEntry,identifierMap);
  const discovered=M.collectDictionaryTerms(canonical,[]);
  const resolved=await resolver.ensureTerms(discovered);
  const abstract=M.tokenizeResolved(canonical,resolved);
  const payload=M.encode64(abstract,M.M64_V3_CODEC.alphabet);
  const sha256=await sha256HexUtf8(canonical);
  const descriptor=resolver.describe();

  if(descriptor.language!=="javascript")throw new Error("M64 JavaScript artifact requires a JavaScript dictionary");

  const artifact={
    kind:"chisel-m64-artifact",
    version:3,
    language:"javascript",
    languageVersion,
    codec:M.M64_V3_CODEC.id,
    canonicalizer:M.JS_CANONICAL_V1.id,
    dictionary:descriptor,
    runtime:"CHISEL-PURE1",
    entry,
    payload,
    canonicalBytes:M.utf8Len(canonical),
    sha256
  };
  if(Object.prototype.hasOwnProperty.call(opt,"input"))artifact.input=opt.input;

  M.validateArtifactV3(artifact);
  return{artifact,canonical,abstract,resolvedTerms:resolved,addedOrResolvedTerms:discovered};
}

async function hydrateArtifactV3(artifact,resolver){
  resolver=requireResolver(resolver);
  const a=M.validateArtifactV3(artifact);
  assertResolverMatchesArtifact(resolver,a);
  const canonical=await M.hydrateLookup(a.payload,M.M64_V3_CODEC.alphabet,id=>resolver.termForId(id));
  const canonicalBytes=M.utf8Len(canonical);
  if(canonicalBytes!==a.canonicalBytes)throw new Error("M64 v3 canonical byte-count mismatch");
  const sha256=await sha256HexUtf8(canonical);
  if(sha256!==a.sha256)throw new Error("M64 v3 canonical SHA-256 mismatch");
  const abstract=M.decode64(a.payload,M.M64_V3_CODEC.alphabet);
  return{artifact:a,canonical,canonicalBytes,sha256,dictionaryIndexes:M.dictionaryIndexes(abstract)};
}

M.sha256HexUtf8=sha256HexUtf8;
M.buildJavascriptArtifactV3=buildJavascriptArtifactV3;
M.hydrateArtifactV3=hydrateArtifactV3;
})(globalThis);
