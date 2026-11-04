import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile, lstat, readlink} from "node:fs/promises";

const ROOT=new URL("../",import.meta.url);
const read=async path=>readFile(new URL(path,ROOT),"utf8");
const sha=hex=>createHash("sha256").update(Buffer.from(hex.slice(2),"hex")).digest("hex");

test("Solidity is the canonical home of both EVM sources and deployable artifacts",async()=>{
  const chisel=await read("Solidity/Chisel.sol");
  const m64=await read("Solidity/M64Dictionary.sol");
  assert.match(chisel,/contract\s+Chisel\s*\{/);
  assert.match(m64,/contract\s+M64Dictionary\s*\{/);
  for(const [name,source] of [["Chisel",chisel],["M64Dictionary",m64]]){
    const compiled=JSON.parse(await read("Solidity/compiled/"+name+".json"));
    assert.equal(compiled.contractName,name);
    assert.ok(compiled.abi.some(item=>item.type==="function"));
    assert.match(compiled.bytecode,/^0x(?:[0-9a-f]{2})+$/i);
    assert.equal(sha(compiled.bytecode),compiled.bytecodeSha256);
    assert.ok(source.length>100);
  }
  const abi=JSON.parse(await read("Solidity/compiled/M64Dictionary.abi.json"));
  assert.ok(abi.some(item=>item.type==="function"&&item.name==="lookupTerm"));
  assert.ok(abi.some(item=>item.type==="event"&&item.name==="Packet"));
});

test("optional M64 Hardhat workspace references canonical source, not a second copy",async()=>{
  const path=new URL("tools/m64Artifact/contracts/M64Dictionary.sol",ROOT);
  const info=await lstat(path);
  assert.equal(info.isSymbolicLink(),true);
  assert.equal(await readlink(path),"../../../Solidity/M64Dictionary.sol");
  assert.equal(await readFile(path,"utf8"),await read("Solidity/M64Dictionary.sol"));
});

test("both contract artifacts and M64 tools are reachable from the menu and EVM factory",async()=>{
  const home=await read("index.html");
  const catalog=await read("Solidity/index.html");
  const factory=await read("tools/evmFactory/app.js");
  const factoryHtml=await read("tools/evmFactory/index.html");
  const m64Deploy=await read("tools/m64Artifact/deploy-dictionary-polygon.html");
  const m64Packet=await read("tools/m64Artifact/packet-polygon.html");
  const m64Menu=await read("tools/m64Artifact/index.html");
  assert.match(home,/href="Solidity\/index\.html"/);
  assert.match(home,/href="tools\/evmFactory\/index\.html"/);
  assert.match(home,/href="tools\/m64Artifact\/dictionary-polygon\.html"/);
  assert.match(catalog,/compiled\/Chisel\.json/);
  assert.match(catalog,/compiled\/M64Dictionary\.json/);
  assert.match(factory,/\.\.\/\.\.\/Solidity\/compiled\/Chisel\.json/);
  assert.match(factory,/\.\.\/\.\.\/Solidity\/compiled\/M64Dictionary\.json/);
  assert.match(factoryHtml,/id="bundledChisel"/);
  assert.match(m64Deploy,/\.\.\/\.\.\/Solidity\/compiled\/M64Dictionary\.json/);
  assert.match(m64Packet,/\.\.\/\.\.\/Solidity\/compiled\/M64Dictionary\.json/);
  assert.match(m64Menu,/href="\.\.\/\.\.\/Solidity\/index\.html"/);
});

test("build script and CI publish into the Solidity namespace",async()=>{
  const py=await read("Solidity/build-chisel.py");
  const ci=await read(".github/workflows/regression.yml");
  assert.match(py,/SOURCE_NAME\s*=\s*"Solidity\/Chisel\.sol"/);
  assert.match(py,/ROOT\s*\/\s*"Solidity"\s*\/\s*"compiled"/);
  assert.match(ci,/Solidity\/compiled\/Chisel\.json/);
  assert.match(ci,/Solidity\/Chisel\.sol/);
});
