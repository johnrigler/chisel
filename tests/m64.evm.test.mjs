import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

await import('../tools/m64Artifact/m64.js');
await import('../tools/m64Artifact/m64.dictionary.js');
await import('../tools/m64Artifact/m64.dictionary.evm.js');

const M=globalThis.ChiselM64;
const MAX=(1n<<256n)-1n;

function fakeContract(seed=['function']){
  const terms=[...seed],ids=new Map(terms.map((t,i)=>[t,i]));
  const tx=()=>({wait:async()=>({status:1})});
  return {
    async language(){return'javascript'},
    async dictionaryVersion(){return 1n},
    async termCount(){return BigInt(terms.length)},
    async lookupTerm(id){return Number(id)<terms.length?terms[Number(id)]:''},
    async lookupId(term){return ids.has(term)?BigInt(ids.get(term)):MAX},
    async addTerm(term){if(!ids.has(term)){ids.set(term,terms.length);terms.push(term)}return tx()},
    async addTerms(batch){for(const term of batch)if(!ids.has(term)){ids.set(term,terms.length);terms.push(term)}return tx()},
    snapshot(){return[...terms]}
  };
}

test('EIP-155 dictionary refs canonicalize chain and address',()=>{
  const parsed=M.parseEip155DictionaryRef('eip155:137:0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD');
  assert.equal(parsed.chainId,137);
  assert.equal(parsed.address,'0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
  assert.equal(parsed.ref,'eip155:137:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
});

test('EVM resolver maps uint256 max to missing and preserves existing IDs',async()=>{
  const contract=fakeContract(['function','return']);
  const resolver=M.createEvmDictionaryResolver({contract,chainId:137,address:'0x0000000000000000000000000000000000000001'});
  assert.equal(await resolver.idForTerm('function'),0);
  assert.equal(await resolver.idForTerm('missing'),null);
  assert.equal(await resolver.termForId(1),'return');
  assert.equal(await resolver.termForId(99),null);
  assert.deepEqual(await resolver.inspectContract(),{
    descriptor:{kind:'ledger-dictionary',ref:'eip155:137:0x0000000000000000000000000000000000000001',version:1,language:'javascript'},
    language:'javascript',version:1,termCount:2
  });
});

test('permissionless-style EVM resolver appends missing terms and reuses duplicates',async()=>{
  const contract=fakeContract(['function']);
  const resolver=M.createEvmDictionaryResolver({contract,chainId:137,address:'0x0000000000000000000000000000000000000001'});
  const first=await resolver.ensureTerms(['function','return','const','return']);
  assert.equal(first.get('function'),0);
  assert.equal(first.get('return'),1);
  assert.equal(first.get('const'),2);
  assert.deepEqual(contract.snapshot(),['function','return','const']);
  const second=await resolver.ensureTerms(['const','width']);
  assert.equal(second.get('const'),2);
  assert.equal(second.get('width'),3);
  assert.deepEqual(contract.snapshot(),['function','return','const','width']);
});

test('Solidity dictionary source exposes append/read methods and no owner mutation surface',async()=>{
  const source=await readFile(new URL('../tools/m64Artifact/contracts/M64Dictionary.sol',import.meta.url),'utf8');
  for(const name of ['language','dictionaryVersion','termCount','lookupTerm','lookupId','addTerm','addTerms'])assert.match(source,new RegExp('function\\s+'+name+'\\s*\\('));
  assert.match(source,/event\s+TermAdded/);
  assert.doesNotMatch(source,/function\s+owner\s*\(/i);
  assert.doesNotMatch(source,/\bonlyOwner\b/);
  assert.doesNotMatch(source,/function\s+(transferOwnership|renounceOwnership|delete|remove|edit|update|setTerm)\b/i);
});

test('captured deployment artifact matches its CI bytecode hash and expected ABI',async()=>{
  const artifact=JSON.parse(await readFile(new URL('../tools/m64Artifact/contracts/M64Dictionary.compiled.json',import.meta.url),'utf8'));
  assert.equal(artifact.kind,'chisel-solidity-artifact');
  assert.equal(artifact.contractName,'M64Dictionary');
  assert.equal(artifact.compiler,'solcjs 0.8.30');
  assert.match(artifact.bytecode,/^0x[0-9a-f]+$/i);
  const hash=createHash('sha256').update(Buffer.from(artifact.bytecode.slice(2),'hex')).digest('hex');
  assert.equal(hash,artifact.bytecodeSha256);
  const functions=new Set(artifact.abi.filter(x=>x.type==='function').map(x=>x.name));
  for(const name of ['language','dictionaryVersion','termCount','lookupTerm','lookupId','addTerm','addTerms'])assert.ok(functions.has(name));
});
