import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const require=createRequire(import.meta.url);
const ethers=require("../vendor/ethers-6.6.0.umd.min.js");
const context={}; vm.runInNewContext(await readFile(new URL("../chisel.evm.local.js",import.meta.url),"utf8"),context);
const api=context.CHISEL_EVM_LOCAL;
const pk="0x"+"0".repeat(63)+"1";
function wif(prefix,compressed) {
 const payload=ethers.concat([ethers.toBeHex(prefix,1),pk,...(compressed?["0x01"]:[])]);
 return ethers.encodeBase58(ethers.concat([payload,ethers.dataSlice(ethers.sha256(ethers.sha256(payload)),0,4)]));
}
test("WIF network prefix and compression do not change Polygon identity",()=>{
 for(const prefix of [128,176,239,158]) for(const compressed of [true,false])
   assert.equal(api.walletFromWif(wif(prefix,compressed),ethers).address,"0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf");
 const valid=wif(176,true); assert.throws(()=>api.walletFromWif(valid.slice(0,-1)+(valid.endsWith("1")?"2":"1"),ethers),/Invalid WIF/);
});
test("local signer uses only raw signed Polygon bytes and locks on demand",async()=>{
 let raw, chain="0x89", nonce="0x0";
 const transport={async getFeeData(){return {maxFeePerGas:100n,maxPriorityFeePerGas:10n};},
 async send(method,params){if(method==="eth_chainId")return chain;if(method==="eth_getTransactionCount")return nonce;if(method==="eth_getBalance")return "0x10000000000000000";if(method==="eth_sendRawTransaction"){raw=params[0];return ethers.keccak256(raw);}throw Error(method);}};
 const adapter=api.createLocalWallet(ethers,transport);
 const from=adapter.unlock(wif(176,true));
 const tx={from,to:"0x"+"12".repeat(20),data:"0x1234",value:"0x0"};
 await assert.rejects(adapter.request({method:"eth_sendTransaction",params:[tx]}),/review/);
 await adapter.quote(tx,"30000");
 assert.equal(raw,undefined);
 await adapter.request({method:"eth_sendTransaction",params:[tx]});
 const decoded=ethers.Transaction.from(raw);
 assert.equal(decoded.chainId,137n);assert.equal(decoded.from,from);assert.equal(decoded.to,ethers.getAddress(tx.to));assert.equal(decoded.data,tx.data);assert.equal(decoded.gasLimit,36000n);
 await adapter.quote(tx,"30000");nonce="0x1";
 await assert.rejects(adapter.request({method:"eth_sendTransaction",params:[tx]}),/Nonce changed/);
 chain="0x1"; await assert.rejects(adapter.quote(tx,"30000"),/Polygon mainnet/);
 adapter.lock(); assert.equal(adapter.address,"");
});
