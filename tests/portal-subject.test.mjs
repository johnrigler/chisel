import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({TextDecoder, Uint8Array, URL, URLSearchParams});
context.window = context;
for (const source of ["chisel.portal.payload.js", "chisel.portal.subject.js"]) {
  vm.runInContext(await readFile(new URL("../" + source, import.meta.url), "utf8"), context, {filename:source});
}
const payload = context.CHISEL_PORTAL_PAYLOAD, interpreter = context.CHISEL_PORTAL_SUBJECT;
const txid = "1c79a0d3983af67b73659711135fd3d631aacba7da2100eec45ba97e1a0dc8ea";
const address = "LKxNATioNALxCREDiTxSYSTEMSzzXVQA9v";
const digest = "0f727f44d47a9208b28ee6043961dfe2994259f1cdb75634bec84e2cb6ee105a";
const opReturn = text => {
  const bytes = Buffer.from(text, "utf8");
  return {n:2, scriptPubKey:{hex:"6a" + bytes.length.toString(16).padStart(2,"0") + bytes.toString("hex"),type:"op_return",addresses:[]}};
};
const namedOutput = {n:1,scriptPubKey:{hex:"76a91408056bfba4f80550ce823315001388193ac6d91688ac",type:"p2pkh",addresses:[address]}};
const from = (text, output=namedOutput) => interpreter.interpret({vout:[output, opReturn(text)]},txid,payload.fromOutput);

test("existing November 15 NCS record decodes name from output address and digest from OP_RETURN",()=>{
  const result=from(digest);
  assert.equal(result.subject,"National Credit Systems");
  assert.equal(result.address,address);
  assert.equal(result.sha256,digest);
  assert.equal(result.bytesOnLedger,64);
  assert.equal(result.kind,"sha256");
  const link=interpreter.commonsHandoff(result);
  assert.match(link,/https:\/\/johnrigler\.github\.io\/commons\/tools\/ledger-reference\.html#/);
  const query=new URLSearchParams(link.split("#")[1]);
  assert.equal(query.get("txid"),txid);
  assert.equal(query.get("sha256"),digest);
});

test("sha256-prefixed ASCII OP_RETURN is still accepted without changing the original bytes",()=>{
  const result=from("sha256:"+digest);
  assert.equal(result.sha256,digest);
  assert.equal(result.bytesOnLedger,71);
});

test("another transaction to same named address can carry an ordinary URL",()=>{
  const result=from("https://johnrigler.github.io/commons/");
  assert.equal(result.subject,"National Credit Systems");
  assert.equal(result.kind,"link");
  assert.equal(result.url,"https://johnrigler.github.io/commons/");
  assert.equal(result.sha256,"");
  assert.equal(interpreter.commonsHandoff(result),"");
});

test("ignore unrelated outputs, malformed text and binary that is not 64 ASCII hex",()=>{
  assert.equal(from(digest,{scriptPubKey:{addresses:["LcudkPQzLuuqsnzHSmJ7iLREaHStvPKRVb"]}}),null);
  assert.equal(from("not a sha"),null);
  assert.equal(from("0x"+digest),null);
  assert.equal(interpreter.decodeAddress("LKx"),null);
});
