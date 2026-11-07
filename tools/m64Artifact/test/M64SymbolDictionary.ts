import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const primary = () => Array.from({ length: 62 }, (_, i) =>
  ethers.hexlify(ethers.toUtf8Bytes(String.fromCharCode(33 + i)))
);

// Pack one six-bit instruction into the top six bits of a byte stream.
// No printable/Base64 wrapping is ever sent to the Solidity contract.
function packed6(symbols: number[]): string {
  const bytes = new Uint8Array(Math.ceil(symbols.length * 6 / 8));
  let bit = 0;
  for (const symbol of symbols) {
    if (!Number.isInteger(symbol) || symbol < 0 || symbol > 63) {
      throw new Error("Not a six-bit symbol");
    }
    for (let i = 5; i >= 0; i--, bit++) {
      if ((symbol >> i) & 1) bytes[bit >> 3] |= (1 << (7 - (bit & 7)));
    }
  }
  return ethers.hexlify(bytes);
}

async function deploy(seedPacked: string[] = [], seedCounts: number[] = []) {
  const contract = await ethers.deployContract("M64SymbolDictionary", [
    "text/javascript",
    "Six-bit test JavaScript vocabulary",
    primary(),
    seedPacked,
    seedCounts,
  ]);
  await contract.waitForDeployment();
  return contract;
}

describe("M64SymbolDictionary (native six-bit contract)", function () {
  it("exposes an immutable 62-symbol primary table and reusable descriptor", async function () {
    const dict = await deploy();
    expect(await dict.codecVersion()).to.equal(1n);
    expect(await dict.dictionaryVersion()).to.equal(1n);
    expect(await dict.ASCII_ESCAPE()).to.equal(62n);
    expect(await dict.SECONDARY_ESCAPE()).to.equal(63n);
    expect(await dict.primaryCount()).to.equal(62n);
    expect(await dict.secondaryCount()).to.equal(0n);
    expect(await dict.mediaType()).to.equal("text/javascript");
    expect(await dict.description()).to.equal("Six-bit test JavaScript vocabulary");
    expect(await dict.primary(0)).to.equal(primary()[0]);
    expect(await dict.primary(61)).to.equal(primary()[61]);
    const descriptor = await dict.descriptor();
    expect(descriptor[0]).to.equal("text/javascript");
    expect(descriptor[2]).to.equal(1n);
    expect(descriptor[3]).to.equal(1n);
    expect(descriptor[4]).to.equal(await dict.primaryDigest());
    expect(descriptor[5]).to.equal(await dict.definitionDigest());
    await expect(dict.primary(62)).to.be.revertedWithCustomError(dict, "InvalidPrimaryIndex");
  });

  it("stores a packed secondary sequence with an exact symbol count", async function () {
    const dict = await deploy();
    const [publisher] = await ethers.getSigners();
    const body = packed6([0, 1, 2, 3]); // 4 symbols = 24 bits = 3 bytes.
    await expect(dict.addSecondary(body, 4))
      .to.emit(dict, "SecondaryAdded")
      .withArgs(0n, 4n, ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint32", "bytes"], [4, body])
      ), publisher.address);
    expect(await dict.secondaryCount()).to.equal(1n);
    const [bytes, count] = await dict.secondary(0);
    expect(bytes).to.equal(body);
    expect(count).to.equal(4n);
    const digestAfter = await dict.definitionDigest();
    expect(digestAfter).to.not.equal(await dict.primaryDigest());
    expect(await dict.addSecondary.staticCall(body, 4)).to.equal(0n);
    await dict.addSecondary(body, 4); // no new entry
    expect(await dict.secondaryCount()).to.equal(1n);
    expect(await dict.definitionDigest()).to.equal(digestAfter);
  });

  it("supports nested M64 references to earlier secondary records", async function () {
    const dict = await deploy([packed6([0, 1, 2])], [3]);
    expect(await dict.secondaryCount()).to.equal(1n);
    // 63 = second-level escape, 0 = index of prior packed definition.
    await dict.addSecondary(packed6([63, 0]), 2);
    expect(await dict.secondaryCount()).to.equal(2n);
    const [bytes, count] = await dict.secondary(1);
    expect(bytes).to.equal(packed6([63, 0]));
    expect(count).to.equal(2n);
    await expect(dict.secondary(2)).to.be.revertedWithCustomError(dict, "InvalidSecondaryIndex");
  });

  it("accepts two six-bit digits representing an arbitrary byte", async function () {
    const dict = await deploy();
    await dict.addSecondary(packed6([62, 3, 8]), 3); // ASCII/raw byte 200
    expect(await dict.secondaryCount()).to.equal(1n);
  });

  it("rejects malformed lengths, padding, truncated escapes and forward references", async function () {
    const dict = await deploy();
    await expect(dict.addSecondary("0x", 0))
      .to.be.revertedWithCustomError(dict, "InvalidSymbolCount");
    await expect(dict.addSecondary("0x00", 4))
      .to.be.revertedWithCustomError(dict, "InvalidSymbolCount");
    await expect(dict.addSecondary("0x01", 1))
      .to.be.revertedWithCustomError(dict, "InvalidPadding");
    await expect(dict.addSecondary(packed6([62]), 1))
      .to.be.revertedWithCustomError(dict, "TruncatedLiteral");
    await expect(dict.addSecondary(packed6([63]), 1))
      .to.be.revertedWithCustomError(dict, "TruncatedIndex");
    await expect(dict.addSecondary(packed6([63, 0]), 2))
      .to.be.revertedWithCustomError(dict, "ForwardSecondaryReference");
    await expect(dict.addSecondary(packed6([63, 32]), 2))
      .to.be.revertedWithCustomError(dict, "TruncatedIndex");
  });

  it("rejects invalid initial tables, mismatched seed arrays, and incomplete initial definitions", async function () {
    const options: [string, string, string[], string[], number[]] = [
      "text/javascript", "Test dictionary", primary().slice(0, 61), [], []
    ];
    await expect(ethers.deployContract("M64SymbolDictionary", options))
      .to.be.revertedWithCustomError(await deploy(), "WrongPrimaryCount");
    await expect(ethers.deployContract("M64SymbolDictionary", [
      "text/javascript", "Test dictionary", primary(), [packed6([0])], []
    ])).to.be.reverted;
  });

  it("does not expose an owner, mutable primary symbols or arbitrary secondary edits", async function () {
    const dict = await deploy();
    const functions = new Set(dict.interface.fragments
      .filter(fragment => fragment.type === "function")
      .map(fragment => fragment.name));
    for (const forbidden of [
      "owner", "setPrimary", "updatePrimary", "setSecondary",
      "deleteSecondary", "deletePrimary", "setDescriptor", "transferOwnership"
    ]) expect(functions.has(forbidden)).to.equal(false);
  });
});
