import test from "node:test";
import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";
import {createHash} from "node:crypto";
import vm from "node:vm";

const root=new URL("../",import.meta.url);
const read=async path=>readFile(new URL(path,root),"utf8");

test("M64 canonical source, ABI and compiler artifact are registered without inventing a deployment",async()=>{
  const [source,artifactText,abiText,registryCode]=await Promise.all([
    read("contracts/M64Dictionary.sol"),
    read("contracts/compiled/M64Dictionary.json"),
    read("contracts/compiled/M64Dictionary.abi.json"),
    read("chisel.evm.contracts.js")
  ]);
  assert.match(source,/contract M64Dictionary/);
  const a=JSON.parse(artifactText),abi=JSON.parse(abiText);
  assert.equal(a.canonicalSourcePath,"contracts/M64Dictionary.sol");
  assert.equal(a.sourceBlobSha,"2303538f37210477b4a4c6ba68224818aa5a5108");
  assert.equal(a.bytecode.length/2-1,4002);
  assert.equal(createHash("sha256").update(Buffer.from(a.bytecode.slice(2),"hex")).digest("hex"),a.bytecodeSha256);
  assert.equal(a.bytecodeSha256,"f55001c8e085674028643483943f42363d913d172b328f7d10dc175d3419e051");
  assert.ok(abi.some(x=>x.type==="event"&&x.name==="Packet"));
  const scope=vm.createContext({TextEncoder});scope.window=scope;vm.runInContext(registryCode,scope);
  const r=scope.CHISEL_EVM_CONTRACTS;
  assert.equal(r.implementations["m64.dictionary.v1"].source,"contracts/M64Dictionary.sol");
  assert.equal(r.implementations["m64.dictionary.v1"].compiledArtifact,"contracts/compiled/M64Dictionary.json");
  assert.ok(r.interfaces["m64.dictionary.v1"].abi.length>0);
  assert.equal(Object.values(r.deployments).some(x=>x.implementationId==="m64.dictionary.v1"),false);
});

test("M64 factory, original deploy page and optional Hardhat workspace use canonical contract",async()=>{
  const [factory,deploy,evm,compile,config,ci]=await Promise.all([
    read("tools/evmFactory/app.js"),
    read("tools/m64Artifact/deploy-dictionary-polygon.html"),
    read("evm.html"),
    read("tools/m64Artifact/scripts/compile-standalone.mjs"),
    read("tools/m64Artifact/hardhat.config.ts"),
    read(".github/workflows/regression.yml")
  ]);
  assert.match(factory,/\.\.\/\.\.\/contracts\/compiled\/M64Dictionary\.json/);
  assert.match(deploy,/\.\.\/\.\.\/contracts\/compiled\/M64Dictionary\.json/);
  assert.match(evm,/id="m64ContractPanel"/);
  assert.match(evm,/no M64Dictionary Polygon deployment is registered/);
  assert.match(compile,/\.\.\/\.\.\/\.\.\/contracts\/M64Dictionary\.sol/);
  assert.match(config,/sources:\s*"\.\/contracts"/);
  const stage=await read("tools/m64Artifact/scripts/stage-contract.mjs");
  assert.match(stage,/\.\.\/\.\.\/\.\.\/contracts\/M64Dictionary\.sol/);
  assert.match(stage,/writeFile\(target,bytes\)/);
  assert.match(ci,/scripts\/verify-bytecode\.mjs/);
  for(const path of ["tools/m64Artifact/contracts/M64Dictionary.sol",
    "tools/m64Artifact/contracts/M64Dictionary.abi.json",
    "tools/m64Artifact/contracts/M64Dictionary.compiled.json"])
    await assert.rejects(access(new URL(path,root)),/ENOENT/);
});
