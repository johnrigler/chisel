import { expect } from "chai";
import { readFileSync } from "node:fs";
import solc from "solc";
import { network } from "hardhat";

// Optional local EVM tests; browser runtime needs no Hardhat.
const sourcePath = "contracts/Chisel.sol";
const source = readFileSync(new URL("../../../contracts/Chisel.sol", import.meta.url), "utf8");
const rejectPath = "tests/RejectEther.sol";
const rejectSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract RejectEther {
    receive() external payable { revert("no funds accepted"); }
}`;
const output = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity",
  sources: {
    [sourcePath]: {content: source},
    [rejectPath]: {content: rejectSource}
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    metadata: { appendCBOR: false },
    outputSelection: {"*": {"*": ["abi", "evm.bytecode.object"]}}
  }
})));
const problems = (output.errors || []).filter((entry: any) => entry.severity === "error");
if (problems.length) throw new Error(problems.map((entry: any) => entry.formattedMessage).join("\n"));
const artifact = output.contracts?.[sourcePath]?.Chisel;
const rejectArtifact = output.contracts?.[rejectPath]?.RejectEther;
if (!artifact || !rejectArtifact) throw new Error("Chisel contract and test recipient must compile");
const { ethers } = await network.create();
const fmt = ethers.encodeBytes32String("TEXT");

async function deploy(signer?: (Awaited<ReturnType<typeof ethers.getSigners>>)[number]) {
  const deployer = signer ?? (await ethers.getSigners())[0];
  const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, deployer);
  const instance = await factory.deploy();
  await instance.waitForDeployment();
  return instance;
}

describe("Chisel EVM publisher", function () {
  it("preserves permissionless, writer-address-scoped dictionary revision history", async function () {
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
  });

  it("combines optional dictionary, payments and log in a single transaction", async function () {
    const [owner, recipient] = await ethers.getSigners();
    const instance = await deploy(owner);
    const before = await ethers.provider.getBalance(recipient.address);
    const tx = await instance.execute(
      "certificate", "sha256:abcd",
      [{ recipient: recipient.address, amount: 3n }],
      fmt, "0x1234", {value: 3n}
    );
    const receipt = await tx.wait();
    expect(receipt?.status).to.equal(1);
    expect(await ethers.provider.getBalance(recipient.address)).to.equal(before + 3n);
    expect(await instance.getArtifact(owner.address, "certificate"))
      .to.deep.equal(["sha256:abcd", 1n]);
    const records = await instance.queryFilter(
      instance.filters.RecordLogged(), receipt!.blockNumber, receipt!.blockNumber
    );
    expect(records).to.have.length(1);
    expect(records[0].args.data).to.equal("0x1234");
    const transfers = await instance.queryFilter(
      instance.filters.TransferResult(), receipt!.blockNumber, receipt!.blockNumber
    );
    expect(transfers.map(log => log.args.status)).to.deep.equal([2n]);
    await instance.execute("", "", [], fmt, "0x");
    expect((await instance.getArtifact(owner.address, ""))[1]).to.equal(0n);
  });

  it("continues best-effort distribution after a recipient reverts", async function () {
    const [owner, recipient] = await ethers.getSigners();
    const instance = await deploy(owner);
    const reject = await new ethers.ContractFactory(
      rejectArtifact.abi, rejectArtifact.evm.bytecode.object, owner
    ).deploy();
    await reject.waitForDeployment();
    const before = await ethers.provider.getBalance(recipient.address);
    const tx = await instance.distribute(
      [
        {recipient: await reject.getAddress(), amount: 2n},
        {recipient: recipient.address, amount: 3n}
      ],
      {value: 5n}
    );
    const receipt = await tx.wait();
    const transfers = await instance.queryFilter(
      instance.filters.TransferResult(), receipt!.blockNumber, receipt!.blockNumber
    );
    expect(transfers.map(log => log.args.status)).to.deep.equal([1n, 2n]);
    expect(await ethers.provider.getBalance(recipient.address)).to.equal(before + 3n);
    expect(await instance.pendingRefunds(owner.address)).to.equal(0n);
  });

  it("provides a separate checked, atomic payment function", async function () {
    const [owner, recipient] = await ethers.getSigners();
    const instance = await deploy(owner);
    await expect(instance.distributeChecked([
      {recipient: ethers.ZeroAddress, amount: 1n}
    ], {value: 1n})).to.be.revertedWithCustomError(instance, "InvalidPayment");
    await expect(instance.distributeChecked([
      {recipient: recipient.address, amount: 2n}
    ], {value: 1n})).to.be.revertedWithCustomError(instance, "InvalidPayment");
    await expect(instance.distributeChecked([
      {recipient: recipient.address, amount: 1n}
    ], {value: 1n})).to.emit(instance, "TransferResult")
      .withArgs(owner.address, recipient.address, 0n, 1n, 2n);
  });
});
