(function(g){
"use strict";
// Native-six-bit M64 Polygon adapter. Ledger data is a binary byte record,
// NOT a JSON, Base64-text or UTF-8 metadata envelope. All wallet writes require
// an explicit caller action. Sources are never automatically executed.
const M=g.ChiselM64Native6;
if(!M||typeof M.encode!=="function")throw Error("Load m64.native6.js first");
const CHAIN_ID=137;
const DICTIONARY="0xe6e9df9f49b1ab4417129454991466adc9923f8c";
const CHISEL="0x683cfA103FE5DbD0a47402d78Fbf818D4160B1d3";
const FORMAT_NAME="chisel-m64-native6-v2";
const MAGIC=Uint8Array.from([0x4d,0x36,0x50,0x32,1]); // "M6P2" record v1
const SHA=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const MAX_PAYLOAD_BYTES=32768;
const DICT_ABI=[
  "function codecVersion() view returns (uint32)",
  "function dictionaryVersion() view returns (uint32)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function language() view returns (string)",
  "function mediaType() view returns (string)",
  "function description() view returns (string)",
  "function primaryCount() view returns (uint256)",
  "function secondaryCount() view returns (uint256)",
  "function primary(uint256) view returns (bytes)",
  "function entry(uint256) view returns (uint8,bytes,uint32)",
  "function primaryDigest() view returns (bytes32)",
  "function definitionDigest() view returns (bytes32)",
  "function digestAtCount(uint256) view returns (bytes32)"
];
const CHISEL_ABI=[
  "function logRecord(bytes32 format,bytes data)",
  "event RecordLogged(address indexed writer,bytes32 indexed format,bytes data)"
];
function getEthers(E){const e=E||g.ethers;if(!e?.Contract||!e?.BrowserProvider||!e?.Interface||!e?.id)throw Error("Bundled ethers v6 required");return e}
function getWallet(wallet){const w=wallet||g.ethereum;if(!w||typeof w.request!=="function")throw Error("Select an injected EIP-1193 wallet");return w}
function toBytes(hex){
  if(typeof hex!=="string"||!/^0x(?:[0-9a-fA-F]{2})*$/.test(hex))throw Error("Invalid hex bytes");
  return M.fromHex(hex.slice(2));
}
function eqBytes(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i])}
function concat(...arrs){let n=0;for(const a of arrs){if(!(a instanceof Uint8Array))throw Error("Expected binary data");n+=a.length}const output=new Uint8Array(n);let at=0;for(const a of arrs){output.set(a,at);at+=a.length}return output}
function hex(a){return"0x"+M.bytesHex(a)}
function fromAscii(text){return new TextEncoder().encode(text)}
async function digest(bytes){
  if(!(bytes instanceof Uint8Array))throw Error("Expected binary bytes");
  if(!g.crypto?.subtle)throw Error("SHA-256 requires HTTPS/localhost WebCrypto");
  const data=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  return hex(new Uint8Array(await g.crypto.subtle.digest("SHA-256",data)));
}
function safeNumber(n,label){
  const v=BigInt(n);
  if(v<0n||v>BigInt(Number.MAX_SAFE_INTEGER))throw Error(label+" is outside safe integer range");
  return Number(v);
}
function normalizeAddress(a){
  if(!ADDRESS.test(a))throw Error("Invalid 20-byte EVM address");
  return a.toLowerCase();
}
function validateProvider(network,E,provider){
  const ethers=getEthers(E);
  const p=provider||new ethers.BrowserProvider(getWallet(network));
  return p;
}
async function requirePolygon(provider){
  const chain=Number((await provider.getNetwork()).chainId);
  if(chain!==CHAIN_ID)throw Error("Wallet RPC is on chain "+chain+"; expected Polygon 137. Switch manually.");
  return chain;
}
async function readInBatches(count,batch,read,onProgress){
  const result=[];
  for(let start=0;start<count;start+=batch){
    const end=Math.min(count,start+batch);
    const items=await Promise.all(Array.from({length:end-start},(_,i)=>read(start+i)));
    result.push(...items);
    if(onProgress)onProgress(end,count);
  }
  return result;
}
async function verifyDictionary(provider,opt={}){
  const ethers=getEthers(opt.ethers);
  await requirePolygon(provider);
  const address=normalizeAddress(opt.address||DICTIONARY);
  const seed=opt.seed;
  if(!seed||seed.primary?.length!==62||!Array.isArray(seed.secondary)||seed.secondary.length<1)
    throw Error("Expected a fixed 62-primary seeded dictionary for independent value checks");
  const contract=new ethers.Contract(address,DICT_ABI,provider);
  const code=await provider.getCode(address);
  if(code==="0x")throw Error("No deployed runtime bytecode at dictionary address");
  const [codec,version,primaryCount,secondaryCount,name,symbol,language,mediaType,description,primaryDigest,digest0,digestSeed]=await Promise.all([
    contract.codecVersion(),contract.dictionaryVersion(),contract.primaryCount(),contract.secondaryCount(),
    contract.name(),contract.symbol(),contract.language(),contract.mediaType(),contract.description(),
    contract.primaryDigest(),contract.digestAtCount(0),contract.digestAtCount(seed.secondary.length)
  ]);
  const count=safeNumber(secondaryCount,"secondaryCount");
  if(Number(codec)!==2||Number(version)!==1||safeNumber(primaryCount,"primaryCount")!==62)
    throw Error("Unexpected deployed M64 codec version or primary count");
  if(count<seed.secondary.length)throw Error("Dictionary has only "+count+" secondary entries; requires seeded "+seed.secondary.length);
  if(language!=="javascript"||mediaType!==seed.descriptor.mediaType)
    throw Error("Dictionary type differs from expected JavaScript profile");
  if(primaryDigest.toLowerCase()!==digest0.toLowerCase()||digest0===ethers.ZeroHash)
    throw Error("Primary dictionary snapshot digest is inconsistent");
  const countAfter=()=>contract.secondaryCount();
  // Check every definition from the contract rather than trusting a local
  // seed or a self-reported contract hash alone.
  const primary=await readInBatches(62,6,i=>contract.primary(i),opt.onProgress);
  const primBytes=primary.map((v,i)=>{
    const b=toBytes(v);
    if(!eqBytes(b,seed.primary[i]))throw Error("Primary dictionary entry "+i+" differs from Dark Star seed");
    return b;
  });
  const secondaryRaw=await readInBatches(seed.secondary.length,6,i=>contract.entry(i),opt.onProgress);
  const secondary=secondaryRaw.map((e,i)=>{
    const kind=safeNumber(e[0],"entry kind"),data=toBytes(e[1]);
    const symbols=safeNumber(e[2],"symbolCount");
    if(kind!==0||symbols!==seed.secondary[i].symbolCount||
      !eqBytes(data,seed.secondary[i].packed))throw Error("Secondary entry "+i+" differs from Dark Star seed");
    return {kind:0,packed:data,symbolCount:symbols};
  });
  const latest=await countAfter();
  if(safeNumber(latest,"secondaryCount")<seed.secondary.length)
    throw Error("Dictionary changed during inspection");
  const confirmedSnapshot=await contract.digestAtCount(seed.secondary.length);
  if(confirmedSnapshot.toLowerCase()!==digestSeed.toLowerCase()||digestSeed===ethers.ZeroHash)
    throw Error("Dictionary snapshot changed during verification");
  const latestDigest=await contract.definitionDigest();
  if(count===seed.secondary.length&&latestDigest.toLowerCase()!==digestSeed.toLowerCase())
    throw Error("Final dictionary digest disagrees with snapshot digest");
  // Fail closed on malformed nested definitions.
  const dict={primary:primBytes,secondary};
  M.prepareDictionary(dict);
  return Object.freeze({
    chainId:CHAIN_ID,address,codecVersion:2,dictionaryVersion:1,
    name,symbol,language,mediaType,description,
    primaryCount:62,secondaryCount:count,
    snapshotCount:seed.secondary.length,snapshotDigest:digestSeed.toLowerCase(),
    primaryDigest:primaryDigest.toLowerCase(),dictionary:dict
  });
}
function packRecord({address=DICTIONARY,snapshotCount,snapshotDigest,sourceSha256,sourceLength,wire}){
  if(!Number.isSafeInteger(snapshotCount)||snapshotCount<0)throw Error("Invalid dictionary snapshot count");
  if(!Number.isSafeInteger(sourceLength)||sourceLength<0||sourceLength>MAX_PAYLOAD_BYTES)throw Error("Input source exceeds 32 KiB limit");
  if(!SHA.test(snapshotDigest)||!SHA.test(sourceSha256))throw Error("Expected SHA-256/dictionary digest bytes32");
  if(!(wire instanceof Uint8Array)||wire.length<1)throw Error("Missing six-bit native wire bytes");
  return concat(MAGIC,toBytes(normalizeAddress(address)),Uint8Array.from(M.writeUint(snapshotCount)),
    toBytes(snapshotDigest),Uint8Array.from(M.writeUint(sourceLength)),toBytes(sourceSha256),wire);
}
function unpackRecord(record){
  if(!(record instanceof Uint8Array)||record.length<5+20+1+32+1+32+1||
    !MAGIC.every((v,i)=>record[i]===v))throw Error("Invalid M6P2 record or unsupported version");
  let at=MAGIC.length;
  const address=hex(record.slice(at,at+20));at+=20;
  const snap=M.readUint(record,at);at=snap.next;
  if(at+32>record.length)throw Error("Truncated M64 snapshot digest");
  const snapshotDigest=hex(record.slice(at,at+32));at+=32;
  const size=M.readUint(record,at);at=size.next;
  if(size.value>MAX_PAYLOAD_BYTES)throw Error("M64 source exceeds maximum size");
  if(at+32>record.length)throw Error("Truncated M64 SHA-256");
  const sourceSha256=hex(record.slice(at,at+32));at+=32;
  const wire=record.slice(at);
  if(!wire.length)throw Error("Missing native six-bit instructions");
  return {address:normalizeAddress(address),snapshotCount:snap.value,snapshotDigest,sourceSha256,sourceLength:size.value,wire};
}
async function rebuildRecord(record,verified){
  const parsed=unpackRecord(record);
  if(!verified||verified.address!==parsed.address ||
    parsed.snapshotCount!==verified.snapshotCount||
    parsed.snapshotDigest.toLowerCase()!==verified.snapshotDigest.toLowerCase())
    throw Error("Record's dictionary contract or immutable snapshot does not match verified on-chain seed");
  const source=M.decode(parsed.wire,verified.dictionary);
  if(source.length!==parsed.sourceLength)throw Error("Decoded source byte count mismatch");
  if((await digest(source)).toLowerCase()!==parsed.sourceSha256.toLowerCase())
    throw Error("Decoded source SHA-256 mismatch");
  return {...parsed,source,verified:true};
}
async function prepare(source,verified){
  if(!verified?.dictionary||verified.chainId!==CHAIN_ID)
    throw Error("Read and verify Polygon dictionary before preparing a publication");
  if(!(source instanceof Uint8Array)||source.length>MAX_PAYLOAD_BYTES)
    throw Error("Input must be Uint8Array no larger than 32 KiB");
  const wire=M.encode(source,verified.dictionary).wire;
  const sourceSha256=await digest(source);
  const record=packRecord({address:verified.address,snapshotCount:verified.snapshotCount,
    snapshotDigest:verified.snapshotDigest,sourceSha256,sourceLength:source.length,wire});
  const proof=await rebuildRecord(record,verified);
  if(!eqBytes(proof.source,source))throw Error("Local native six-bit byte reconstruction failed");
  return Object.freeze({source,wire,record,sourceSha256,recordSha256:await digest(record),
    sourceLength:source.length,wireBytes:wire.length,recordBytes:record.length});
}
function eventFormat(E){return getEthers(E).id(FORMAT_NAME)}
async function readReceipt(provider,txHash,verified,opt={}){
  const ethers=getEthers(opt.ethers);
  await requirePolygon(provider);
  if(!SHA.test(txHash))throw Error("Enter a 32-byte Polygon transaction hash");
  // Do not call BrowserProvider.getTransaction() here. Some Polygon RPCs
  // return both v and yParity as hex strings for type-2 transactions;
  // ethers 6.6.0 rejects that combination during signature normalization
  // ("yParity mismatch"), before we ever inspect Chisel's event.
  // A smart-account wallet may route the outer transaction through a
  // delegation manager. The authoritative provenance is the receipt log
  // *emitted by Chisel*, not necessarily the top-level tx.to address.
  const receipt=await provider.getTransactionReceipt(txHash);
  if(!receipt)throw Error("Transaction is pending or unavailable from wallet RPC");
  if(Number(receipt.status)!==1)throw Error("Transaction reverted");
  const iface=new ethers.Interface(CHISEL_ABI),format=eventFormat(ethers);
  const found=[];
  for(const log of receipt.logs||[]){
    if(log.address?.toLowerCase()!==CHISEL.toLowerCase())continue;
    let parsed;try{parsed=iface.parseLog(log)}catch{continue}
    if(parsed?.name!=="RecordLogged"||parsed.args.format?.toLowerCase()!==format.toLowerCase())continue;
    found.push(parsed);
  }
  if(found.length!==1)throw Error("Expected one native M64 record log at Chisel; found "+found.length);
  const data=toBytes(found[0].args.data);
  const rebuilt=await rebuildRecord(data,verified);
  // Raw RPC avoids ethers transaction signature parsing. These fields are
  // informational only: the verified emitting log supplies provenance.
  let outerTo=null;
  try {
    const raw=await provider.send("eth_getTransactionByHash",[txHash]);
    if(typeof raw?.to==="string"&&ADDRESS.test(raw.to))outerTo=raw.to;
  } catch (_) { /* Receipt verification does not require outer tx metadata. */ }
  return {...rebuilt,txHash,recordBytes:data.length,writer:found[0].args.writer,blockNumber:receipt.blockNumber,
    outerTo,direct:outerTo!==null&&outerTo.toLowerCase()===CHISEL.toLowerCase()};
}
async function previewPublish(provider,prepared,opt={}){
  const ethers=getEthers(opt.ethers);
  await requirePolygon(provider);
  if(!prepared?.record)throw Error("Prepare a six-bit M64 record first");
  const code=await provider.getCode(CHISEL);
  if(code==="0x")throw Error("Chisel publisher contract missing on Polygon");
  const interface_=new ethers.Interface(CHISEL_ABI);
  const data=interface_.encodeFunctionData("logRecord",[eventFormat(ethers),hex(prepared.record)]);
  const account=opt.account;
  if(!ADDRESS.test(account||""))throw Error("Connect a wallet and supply its account for gas estimation");
  const gas=await provider.estimateGas({from:account,to:CHISEL,data,value:0n});
  return Object.freeze({to:CHISEL,from:account,data,gas:gas.toString(),
    format:eventFormat(ethers),recordSha256:prepared.recordSha256,
    decodedSourceSha256:prepared.sourceSha256,bytes:prepared.recordBytes});
}
async function sendReviewed(provider,review,prepared,verified,opt={}){
  const ethers=getEthers(opt.ethers);
  await requirePolygon(provider);
  if(!review||!prepared||review.recordSha256!==prepared.recordSha256)
    throw Error("Review is missing or the record has changed");
  const updated=await verifyDictionary(provider,{seed:opt.seed,ethers,address:verified.address});
  if(updated.snapshotDigest!==verified.snapshotDigest)throw Error("Dictionary snapshot changed since review");
  const signer=await provider.getSigner();
  const from=(await signer.getAddress()).toLowerCase();
  if(from!==review.from.toLowerCase())throw Error("Wallet account changed since review");
  const account=await provider.send("eth_accounts",[]);
  if(!Array.isArray(account)||account[0]?.toLowerCase()!==from)throw Error("Connected account changed");
  // Do not silently update transaction data, chain, account, or gas estimate.
  const data=new ethers.Interface(CHISEL_ABI).encodeFunctionData("logRecord",
    [eventFormat(ethers),hex(prepared.record)]);
  if(data!==review.data)throw Error("Prepared transaction differs from reviewed calldata");
  await provider.estimateGas({from,to:review.to,data,value:0n});
  return signer.sendTransaction({to:review.to,data,value:0n});
}
g.ChiselM64Native6Polygon=Object.freeze({
  CHAIN_ID,DICTIONARY,CHISEL,FORMAT_NAME,DICT_ABI,CHISEL_ABI,
  toBytes,hex,digest,packRecord,unpackRecord,verifyDictionary,rebuildRecord,
  prepare,eventFormat,previewPublish,readReceipt,sendReviewed,requirePolygon
});
})(globalThis);
