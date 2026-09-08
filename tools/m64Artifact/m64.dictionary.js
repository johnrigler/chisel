(function(g){
"use strict";
const M=g.ChiselM64;
if(!M)throw new Error("m64.dictionary.js requires m64.js first");

function nonEmpty(v){return typeof v==="string"&&v.length>0}
function validIndex(v){return Number.isSafeInteger(v)&&v>=0}

function normalizeDescriptor(d){
  if(!d||typeof d!=="object"||Array.isArray(d))throw new Error("Dictionary descriptor required");
  const out={kind:d.kind,ref:d.ref,version:d.version,language:d.language};
  if(out.kind!=="ledger-dictionary")throw new Error("Unsupported dictionary descriptor kind");
  if(!nonEmpty(out.ref))throw new Error("Dictionary descriptor ref required");
  if(!Number.isSafeInteger(out.version)||out.version<1)throw new Error("Dictionary descriptor version invalid");
  if(!nonEmpty(out.language))throw new Error("Dictionary descriptor language required");
  return Object.freeze(out);
}

function normalizeLookupId(v){
  if(v===null||v===undefined||v===-1)return null;
  if(!validIndex(v))throw new Error("Dictionary provider returned invalid term id");
  return v;
}

function normalizeLookupTerm(v){
  if(v===null||v===undefined)return null;
  if(typeof v!=="string"||!v.length)throw new Error("Dictionary provider returned invalid term");
  return v;
}

function createDictionaryResolver(opt={}){
  const descriptor=normalizeDescriptor(opt.descriptor);
  if(typeof opt.lookupId!=="function")throw new Error("Dictionary resolver requires lookupId(term)");
  if(typeof opt.lookupTerm!=="function")throw new Error("Dictionary resolver requires lookupTerm(id)");

  async function idForTerm(term){
    if(typeof term!=="string"||!term.length)throw new Error("Dictionary term must be non-empty text");
    return normalizeLookupId(await opt.lookupId(term));
  }

  async function termForId(id){
    if(!validIndex(id))throw new Error("Dictionary id must be a non-negative safe integer");
    return normalizeLookupTerm(await opt.lookupTerm(id));
  }

  async function ensureTerm(term){
    const existing=await idForTerm(term);
    if(existing!==null)return existing;
    if(typeof opt.addTerm!=="function")throw new Error("Dictionary is read-only; missing term: "+term);
    const added=normalizeLookupId(await opt.addTerm(term));
    if(added===null)throw new Error("Dictionary addTerm failed for: "+term);
    return added;
  }

  async function ensureTerms(terms){
    const unique=[];
    const seen=new Set;
    for(const term of terms||[]){
      if(typeof term!=="string"||!term.length)throw new Error("Dictionary terms must be non-empty text");
      if(!seen.has(term)){seen.add(term);unique.push(term)}
    }

    const resolved=new Map;
    const missing=[];
    for(const term of unique){
      const id=await idForTerm(term);
      if(id===null)missing.push(term);else resolved.set(term,id);
    }

    if(missing.length&&typeof opt.addTerms==="function"){
      const ids=await opt.addTerms(missing);
      if(!Array.isArray(ids)||ids.length!==missing.length)throw new Error("Dictionary addTerms returned the wrong number of ids");
      for(let i=0;i<missing.length;i++){
        const id=normalizeLookupId(ids[i]);
        if(id===null)throw new Error("Dictionary addTerms failed for: "+missing[i]);
        resolved.set(missing[i],id);
      }
    }else{
      for(const term of missing)resolved.set(term,await ensureTerm(term));
    }

    return resolved;
  }

  function describe(){return{...descriptor}}
  function matches(d){
    if(!d)return false;
    return d.kind===descriptor.kind&&d.ref===descriptor.ref&&d.version===descriptor.version&&d.language===descriptor.language;
  }

  return Object.freeze({describe,matches,idForTerm,termForId,ensureTerm,ensureTerms});
}

function createMemoryDictionary(opt={}){
  const descriptor=normalizeDescriptor(opt.descriptor||{
    kind:"ledger-dictionary",
    ref:opt.ref||"memory:m64-dictionary",
    version:opt.version||1,
    language:opt.language||"javascript"
  });
  const terms=[];
  const ids=new Map;

  for(const term of opt.terms||[]){
    if(typeof term!=="string"||!term.length)throw new Error("Memory dictionary terms must be non-empty text");
    if(ids.has(term))throw new Error("Memory dictionary contains duplicate term: "+term);
    ids.set(term,terms.length);
    terms.push(term);
  }

  function lookupId(term){return ids.has(term)?ids.get(term):null}
  function lookupTerm(id){return validIndex(id)&&id<terms.length?terms[id]:null}
  function addTerm(term){
    if(typeof term!=="string"||!term.length)throw new Error("Memory dictionary term must be non-empty text");
    const existing=lookupId(term);
    if(existing!==null)return existing;
    const id=terms.length;
    terms.push(term);
    ids.set(term,id);
    return id;
  }
  function addTerms(batch){return(batch||[]).map(addTerm)}

  const resolver=createDictionaryResolver({descriptor,lookupId,lookupTerm,addTerm,addTerms});
  return Object.freeze({...resolver,snapshotTerms:()=>[...terms]});
}

M.createDictionaryResolver=createDictionaryResolver;
M.createMemoryDictionary=createMemoryDictionary;
})(globalThis);
