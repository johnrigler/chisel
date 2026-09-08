import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

async function deployDictionary() {
  const dictionary = await ethers.deployContract("M64Dictionary");
  await dictionary.waitForDeployment();
  return dictionary;
}

describe("M64Dictionary", function () {
  it("starts as an empty JavaScript dictionary", async function () {
    const dictionary = await deployDictionary();

    expect(await dictionary.language()).to.equal("javascript");
    expect(await dictionary.dictionaryVersion()).to.equal(1n);
    expect(await dictionary.termCount()).to.equal(0n);
    expect(await dictionary.lookupId("missing")).to.equal(ethers.MaxUint256);
    expect(await dictionary.lookupTerm(999n)).to.equal("");
  });

  it("appends stable IDs and reuses duplicates", async function () {
    const dictionary = await deployDictionary();
    const [publisher] = await ethers.getSigners();

    await expect(dictionary.addTerm("function"))
      .to.emit(dictionary, "TermAdded")
      .withArgs(0n, "function", publisher.address);

    await dictionary.addTerm("return");
    expect(await dictionary.lookupId("function")).to.equal(0n);
    expect(await dictionary.lookupId("return")).to.equal(1n);
    expect(await dictionary.lookupTerm(0n)).to.equal("function");
    expect(await dictionary.lookupTerm(1n)).to.equal("return");

    await dictionary.addTerm("function");
    expect(await dictionary.termCount()).to.equal(2n);
    expect(await dictionary.lookupId("function")).to.equal(0n);
  });

  it("supports permissionless batch vocabulary writes", async function () {
    const dictionary = await deployDictionary();
    const [, stranger] = await ethers.getSigners();

    await dictionary.connect(stranger).addTerms(["width", "height", "drawLine", "width"]);

    expect(await dictionary.termCount()).to.equal(3n);
    expect(await dictionary.lookupId("width")).to.equal(0n);
    expect(await dictionary.lookupId("height")).to.equal(1n);
    expect(await dictionary.lookupId("drawLine")).to.equal(2n);
  });

  it("rejects an empty dictionary term", async function () {
    const dictionary = await deployDictionary();
    await expect(dictionary.addTerm("")).to.be.revertedWithCustomError(dictionary, "EmptyTerm");
  });

  it("publishes opaque packet bytes under three indexed routing fields", async function () {
    const dictionary = await deployDictionary();
    const [, publisher] = await ethers.getSigners();
    const namespace = ethers.encodeBytes32String("M64");
    const objectId = ethers.keccak256(ethers.toUtf8Bytes("elliptic-demo-object"));
    const payload = ethers.toUtf8Bytes("M64 packet payload");

    await expect(dictionary.connect(publisher).publishPacket(namespace, objectId, 7n, payload))
      .to.emit(dictionary, "Packet")
      .withArgs(namespace, objectId, 7n, publisher.address, ethers.hexlify(payload));

    const events = await dictionary.queryFilter(dictionary.filters.Packet(namespace, objectId, 7n));
    expect(events).to.have.length(1);
    expect(events[0].args.namespace).to.equal(namespace);
    expect(events[0].args.objectId).to.equal(objectId);
    expect(events[0].args.part).to.equal(7n);
    expect(events[0].args.publisher).to.equal(publisher.address);
    expect(events[0].args.data).to.equal(ethers.hexlify(payload));
  });

  it("has no owner or administrator mutation surface", async function () {
    const dictionary = await deployDictionary();
    const names = new Set(
      dictionary.interface.fragments
        .filter((fragment) => fragment.type === "function")
        .map((fragment) => fragment.name),
    );

    for (const forbidden of [
      "owner",
      "transferOwnership",
      "renounceOwnership",
      "setTerm",
      "updateTerm",
      "deleteTerm",
      "removeTerm",
    ]) {
      expect(names.has(forbidden)).to.equal(false);
    }
  });
});
