(function(g){
"use strict";
const M=g.ChiselM64;
if(!M||typeof M.createDictionaryResolver!=="function")throw new Error("m64.dictionary.evm.js requires m64.js and m64.dictionary.js first");

const MAX_UINT256=(1n<<256n)-1n;
const ABI=Object.freeze([
  "function language() view returns (string)",
  "function dictionaryVersion() view returns (uint256)",
  "function termCount() view returns (uint256)",
  "function lookupTerm(uint256 id) view returns (string)",
  "function lookupId(string term) view returns (uint256)",
  "function addTerm(string term) returns (uint256)",
  "function addTerms(string[] batch) returns (uint256[])",
  "event TermAdded(uint256 indexed id,string term,address indexed payer)"
]);

function safeInteger(v,label){
  const n=typeof v==="bigint"?v:BigInt(String(v));
  if(n<0n||n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error((label||"value")+" exceeds JavaScript safe integer range");
  return Number(n);
}

function normalizeAddress(address){
  const a=String(address||"").toLowerCase();
  if(!/^0x[0-9a-f]{40}$/.test(a))throw new Error("Expected a 20-byte EVM contract address");
  return a;
}

function normalizeChainId(chainId){
  const n=typeof chainId==="bigint"?chainId:BigInt(String(chainId));
  if(n<1n||n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error("Invalid EIP-155 chain id");
  return Number(n);
}

function dictionaryRef(chainId,address){return"eip155:"+normalizeChainId(chainId)+":"+normalizeAddress(address)}

function parseEip155DictionaryRef(ref){
  const m=/^eip155:([1-9][0-9]*):(0x[0-9a-fA-F]{40})$/.exec(String(ref||""));
  if(!m)throw new Error("Expected dictionary ref eip155:<chainId>:0x<address>");
  return{chainId:normalizeChainId(m[1]),address:normalizeAddress(m[2]),ref:dictionaryRef(m[1],m[2])};
}

async function waitTransaction(tx){
  if(!tx)throw new Error("Dictionary write returned no transaction");
  if(typeof tx.wait==="function")return tx.wait();
  return tx;
}

function createEvmDictionaryResolver(opt={}){
  const contract=opt.contract;
  if(!contract)throw new Error("EVM dictionary contract adapter required");
  for(const method of ["lookupId","lookupTerm"]){if(typeof contract[method]!=="function")throw new Error("EVM dictionary contract missing "+method+"()")}

  const parsed=opt.descriptor?.ref?parseEip155DictionaryRef(opt.descriptor.ref):parseEip155DictionaryRef(opt.ref||dictionaryRef(opt.chainId,opt.address));
  const descriptor={
    kind:"ledger-dictionary",
    ref:parsed.ref,
    version:Number(opt.descriptor?.version??opt.version??1),
    language:String(opt.descriptor?.language??opt.language??"javascript")
  };

  async function lookupId(term){
    const raw=await contract.lookupId(term);
    const n=typeof raw==="bigint"?raw:BigInt(String(raw));
    if(n===MAX_UINT256)return null;
    return safeInteger(n,"dictionary term id");
  }

  async function lookupTerm(id){
    const term=await contract.lookupTerm(id);
    return term===""||term===null||term===undefined?null:String(term);
  }

  async function addTerm(term){
    if(typeof contract.addTerm!=="function")throw new Error("EVM dictionary is read-only");
    await waitTransaction(await contract.addTerm(term));
    const id=await lookupId(term);
    if(id===null)throw new Error("Dictionary transaction mined but term was not found: "+term);
    return id;
  }

  async function addTerms(terms){
    if(!Array.isArray(terms))throw new Error("EVM dictionary addTerms expects an array");
    if(!terms.length)return[];
    if(typeof contract.addTerms!=="function")return Promise.all(terms.map(addTerm));
    await waitTransaction(await contract.addTerms(terms));
    const ids=[];
    for(const term of terms){
      const id=await lookupId(term);
      if(id===null)throw new Error("Dictionary batch mined but term was not found: "+term);
      ids.push(id);
    }
    return ids;
  }

  const resolver=M.createDictionaryResolver({descriptor,lookupId,lookupTerm,addTerm:typeof contract.addTerm==="function"?addTerm:undefined,addTerms:typeof contract.addTerm==="function"?addTerms:undefined});

  async function termCount(){
    if(typeof contract.termCount!=="function")throw new Error("EVM dictionary contract missing termCount()");
    return safeInteger(await contract.termCount(),"dictionary term count");
  }

  async function inspectContract(){
    if(typeof contract.language!=="function"||typeof contract.dictionaryVersion!=="function")throw new Error("EVM dictionary contract metadata methods are missing");
    const language=String(await contract.language());
    const version=safeInteger(await contract.dictionaryVersion(),"dictionary version");
    const count=await termCount();
    if(language!==descriptor.language)throw new Error("EVM dictionary language mismatch: "+language);
    if(version!==descriptor.version)throw new Error("EVM dictionary version mismatch: "+version);
    return{descriptor:resolver.describe(),language,version,termCount:count};
  }

  return Object.freeze({...resolver,contract,termCount,inspectContract});
}

async function createEip1193Dictionary(opt={}){
  const E=opt.ethers||g.ethers;
  if(!E?.BrowserProvider||!E?.Contract)throw new Error("ethers v6 is required for the browser EVM dictionary provider");
  const eip1193=opt.eip1193||g.ethereum;
  if(!eip1193||typeof eip1193.request!=="function")throw new Error("Injected EIP-1193 wallet/provider required");
  const parsed=parseEip155DictionaryRef(opt.ref||dictionaryRef(opt.chainId||137,opt.address));
  const provider=new E.BrowserProvider(eip1193);
  const network=await provider.getNetwork();
  if(Number(network.chainId)!==parsed.chainId)throw new Error("Wallet is on chain "+network.chainId+"; expected "+parsed.chainId);
  const readContract=new E.Contract(parsed.address,ABI,provider);
  let contract=readContract;
  if(opt.writable!==false){
    const signer=opt.signer||await provider.getSigner();
    contract=readContract.connect(signer);
  }
  const resolver=createEvmDictionaryResolver({contract,ref:parsed.ref,version:opt.version||1,language:opt.language||"javascript"});
  if(opt.verify!==false)await resolver.inspectContract();
  return resolver;
}

M.M64_DICTIONARY_EVM_ABI=ABI;
M.M64_DICTIONARY_MAX_UINT256=MAX_UINT256;
M.eip155DictionaryRef=dictionaryRef;
M.parseEip155DictionaryRef=parseEip155DictionaryRef;
M.createEvmDictionaryResolver=createEvmDictionaryResolver;
M.createEip1193Dictionary=createEip1193Dictionary;
})(globalThis);
