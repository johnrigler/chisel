import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash, webcrypto} from "node:crypto";
import vm from "node:vm";

const SCRIPT = readFileSync(new URL("../contracts/build-chisel.py", import.meta.url), "utf8");
const INDEX = readFileSync(new URL("../tools/evmFactory/index.html", import.meta.url), "utf8");
const APP = readFileSync(new URL("../tools/evmFactory/app.js", import.meta.url), "utf8");
const FACTORY = readFileSync(new URL("../tools/evmFactory/factory.js", import.meta.url), "utf8");

test("the contract factory can load the canonical Chisel artifact from the repository", () => {
  assert.match(INDEX, /id="bundledChisel"/);
  assert.match(APP, /\.\.\/\.\.\/contracts\/compiled\/Chisel\.json/);
  assert.match(APP, /loadJSON\(data\)/);
  assert.match(APP, /id|artifactStatus/);
  assert.match(APP, /eth_sendTransaction|sendReviewed/);
});

test("native solc build writes a deterministic, checked, cross-chain artifact", () => {
  const root = mkdtempSync(join(tmpdir(), "chisel-compiler-"));
  try {
    const dir = join(root, "contracts");
    mkdirSync(dir);
    const src = join(dir, "Chisel.sol");
    const builder = join(dir, "build-chisel.py");
    const fakeSolc = join(root, "fake-solc.py");
    const source = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24; contract Chisel {}\n";
    writeFileSync(src, source);
    writeFileSync(builder, SCRIPT);
    writeFileSync(fakeSolc, `#!/usr/bin/env python3
import json, sys
if "--version" in sys.argv:
    print("solc, version 0.8.30")
    sys.exit(0)
request = json.load(sys.stdin)
assert request["language"] == "Solidity"
assert "contracts/Chisel.sol" in request["sources"]
assert request["settings"]["evmVersion"] == "paris"
assert request["settings"]["metadata"]["appendCBOR"] == False
print(json.dumps({"contracts":{"contracts/Chisel.sol":{"Chisel":{
    "abi":[{"type":"constructor","inputs":[]}],
    "evm":{"bytecode":{"object":"60006000"},"deployedBytecode":{"object":"6000"}}
}}}}))
`);
    chmodSync(fakeSolc, 0o755);
    const run = (...args) => spawnSync("python3", [builder, ...args], {
      encoding:"utf8", env:{...process.env, SOLC:fakeSolc}
    });
    const built = run();
    assert.equal(built.status, 0, built.stderr);
    const file = join(dir,"compiled","Chisel.json");
    const artifact = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(artifact.contractName,"Chisel");
    assert.equal(artifact.sourceName,"contracts/Chisel.sol");
    assert.equal(artifact.compiler,"solc, version 0.8.30");
    assert.equal(artifact.bytecode,"0x60006000");
    assert.equal(artifact.deployedBytecode,"0x6000");
    assert.equal(artifact.settings.evmVersion,"paris");
    assert.equal(artifact.sourceSha256, createHash("sha256").update(source).digest("hex"));
    assert.equal(artifact.bytecodeSha256,
      createHash("sha256").update(Buffer.from("60006000","hex")).digest("hex"));
    assert.equal(run("--check").status,0);
    writeFileSync(src,source+"// changed\n");
    const changed = run("--check");
    assert.notEqual(changed.status,0,"modified source must invalidate compiled artifact");
    assert.match(changed.stderr,/missing or stale/);
  } finally {
    rmSync(root,{recursive:true,force:true});
  }
});

test("the existing deployment engine accepts that manifest and preserves chain selection", async () => {
  const scope = vm.createContext({crypto: webcrypto, Uint8Array, BigInt, TextEncoder});
  vm.runInContext(FACTORY,scope);
  const F = scope.CHISEL_EVM_FACTORY;
  const sample = {
    compiler:"solc, version 0.8.30",
    contractName:"Chisel",
    sourceName:"contracts/Chisel.sol",
    sourceSha256:"a".repeat(64),
    settings:{evmVersion:"paris"},
    abi:[{type:"constructor",inputs:[]}],
    bytecode:"0x60006000",
    deployedBytecode:"0x6000"
  };
  const found = F.collectArtifacts(sample);
  assert.equal(found.length,1);
  assert.equal(found[0].name,"Chisel");
  assert.equal(found[0].evmVersion,"paris");
  assert.equal(found[0].declaredSourceSha256,sample.sourceSha256);
  const digest = await F.sha256(sample.bytecode);
  const verified = F.collectArtifacts({...sample,bytecodeSha256:digest})[0];
  assert.equal(verified.declaredCreationSha256,digest);
  assert.equal(F.expectedChain("137"),137);
  assert.equal(F.expectedChain("1088"),1088);
  assert.equal(F.expectedChain("11155111"),11155111);
});
