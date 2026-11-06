import {readdir,readFile} from "node:fs/promises";
import {join,resolve,relative} from "node:path";
import {createHash} from "node:crypto";
const root=resolve(import.meta.dirname,".."), repo=resolve(root,"../..");
async function list(dir){
  const all=[];
  for(const item of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,item.name);
    if(item.isDirectory())all.push(...await list(path));
    else if(item.isFile() && item.name==="M64Dictionary.json")all.push(path);
  }
  return all;
}
const found=[];
for(const path of await list(join(root,"artifacts"))){
  const json=JSON.parse(await readFile(path,"utf8"));
  if(json.contractName==="M64Dictionary" && typeof json.bytecode==="string")found.push({path,json});
}
if(found.length!==1)throw Error("Expected exactly one compiled Hardhat M64Dictionary, got "+found.length);
const h=found[0].json;
const s=JSON.parse(await readFile(join(root,".standalone-artifacts/M64Dictionary.json"),"utf8"));
const c=JSON.parse(await readFile(join(repo,"contracts/compiled/M64Dictionary.json"),"utf8"));
const hash=hex=>createHash("sha256").update(Buffer.from(hex.slice(2),"hex")).digest("hex");
if(c.canonicalSourcePath!=="contracts/M64Dictionary.sol")throw Error("M64 canonical source mismatch");
if(h.bytecode!==s.bytecode || h.bytecode!==c.bytecode)throw Error("M64 creation code differs across Hardhat/solc/captured manifest");
if(h.deployedBytecode!==s.deployedBytecode)throw Error("M64 runtime code differs across compilers");
if(hash(h.bytecode)!==c.bytecodeSha256 || hash(h.deployedBytecode)!==c.runtimeBytecodeSha256)throw Error("M64 artifact hashes mismatch");
console.log("M64 creation/runtime bytecode verified:",relative(repo,found[0].path),"bytes:",(h.bytecode.length-2)/2);
