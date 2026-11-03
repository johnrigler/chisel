import { expect } from "chai";
import { readFileSync } from "node:fs";
import solc from "solc";
import { network } from "hardhat";

const source = readFileSync(new URL("../../../contracts/Mogwai.sol", import.meta.url), "utf8");
const output = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity",
  sources: { "contracts/Mogwai.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    metadata: { appendCBOR: false },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
  }
})));
const problems = (output.errors || []).filter((entry: any) => entry.severity === "error");
if (problems.length) throw new Error(problems.map((entry: any) => entry.formattedMessage).join("\n"));
const artifact = output.contracts?.["contracts/Mogwai.sol"]?.Mogwai;
if (!artifact) throw new Error("Mogwai was not compiled");
const { ethers } = await network.create();
const fmt = ethers.encodeBytes32String("TEXT");

async function deploy(signer?: (Awaited<ReturnType<typeof ethers.getSigners>>)[number]) {
  const deployer = signer ?? (await ethers.getSigners())[0];
  const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, deployer);
  const instance = await factory.deploy();
  await instance.waitForDeployment();
  return instance;
}

describe("Mogwai EVM kernel", function () {
  it("uses two-key writer/artifact indexing, stable creator and revision history", async function () {
    const [owner, other] = await ethers.getSigners();
    const instance = await deploy(owner);
    expect(await instance.creator()).to.equal(owner.address);
    await expect(instance.connect(other).mapArtifact("same", "other"))
      .to.emit(instance, "ArtifactMapped");
    await instance.mapArtifact("same", "creator");
    await instance.mapArtifact("same", "");
    expect(await instance.getArtifact(other.address, "same")).to.deep.equal(["other", 1n]);
    expect(await instance.getArtifact(owner.address, "same")).to.deep.equal(["", 2n]);
    expect((await instance.getArtifact(other.address, "absent"))[1]).to.equal(0n);
    await expect(instance.initialize(other.address)).to.be.revertedWithCustomError(instance, "AlreadyInitialized");
  });

  it("handles atomic batches, indexed Thunderwords, and log sequence", async function () {
    const [owner] = await ethers.getSigners();
    const instance = await deploy(owner);
    const word = "westend";
    const address = "0x77657374656e64" + "00".repeat(13);
    expect((await instance.thunderwordAddress(word)).toLowerCase()).to.equal(address);
    expect(await instance.decodeThunderword(address)).to.equal(word);
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const operations = [
      {kind: 1, data: coder.encode(["string", "string"], ["topic", "body"])},
      {kind: 2, data: coder.encode(["bytes32", "bytes"], [fmt, "0x1234"])},
      {kind: 3, data: coder.encode(["address", "bytes32", "bytes"], [address, fmt, "0xabcd"])}
    ];
    await instance.execute(operations);
    expect((await instance.getArtifact(owner.address, "topic"))[1]).to.equal(1n);
    expect(await instance.writerSequence(owner.address)).to.equal(2n);
    expect(await instance.thunderwordCount(address)).to.equal(1n);
    const logs = await instance.queryFilter(instance.filters.ThunderwordPublished(owner.address, address, fmt));
    expect(logs).to.have.length(1);
    expect(logs[0].args.data).to.equal("0xabcd");
    await expect(instance.execute([
      {kind:1,data:coder.encode(["string", "string"],["willRollback","no"])},
      {kind:255,data:"0x"}
    ])).to.be.revertedWithCustomError(instance,"UnknownOperation");
    expect((await instance.getArtifact(owner.address, "willRollback"))[1]).to.equal(0n);
    await expect(instance.publishThunderwordText("café",fmt,"0x"))
      .to.be.revertedWithCustomError(instance,"InvalidThunderword");
  });

  it("relays messages while marking original identity as a peer claim", async function () {
    const [owner, other] = await ethers.getSigners();
    const source = await deploy(owner);
    const target = await deploy(other);
    await expect(source.connect(other).sendToPeer(await target.getAddress(),fmt,"0x1234"))
      .to.emit(target,"PeerMessageReceived")
      .withArgs(await source.getAddress(),other.address,fmt,"0x1234");
    await expect(target.receiveFromPeer(owner.address,fmt,"0x"))
      .to.be.revertedWithCustomError(target,"InvalidPeer");
  });

  it("deploys address-predictable clone instances with the actual caller as creator", async function () {
    const [owner, other] = await ethers.getSigners();
    const root = await deploy(owner);
    const salt = ethers.id("child-one");
    const predicted = await root.predictChildAddress(other.address,salt);
    await expect(root.connect(other).deployChild(salt))
      .to.emit(root,"ChildDeployed");
    const child = new ethers.Contract(predicted,artifact.abi,other);
    expect(await child.creator()).to.equal(other.address);
    expect(await child.implementation()).to.equal(await root.getAddress());
    await child.mapArtifact("key","child");
    expect((await child.getArtifact(other.address,"key"))[0]).to.equal("child");
    await expect(root.connect(other).deployChild(salt))
      .to.be.revertedWithCustomError(root,"DeploymentFailed");
  });
});
