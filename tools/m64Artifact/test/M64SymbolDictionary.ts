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
    "M64 JavaScript Dictionary",
    "M64",
    "javascript",
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
    expect(await dict.codecVersion()).to.equal(2n);
    expect(await dict.name()).to.equal("M64 JavaScript Dictionary");
    expect(await dict.symbol()).to.equal("M64");
    expect(await dict.language()).to.equal("javascript");
    expect(await dict.ENTRY_PACKED_M64()).to.equal(0n);
    expect(await dict.ENTRY_RAW_BYTES()).to.equal(1n);
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
    expect(descriptor[2]).to.equal(2n);
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
    expect(await dict.digestAtCount(0)).to.equal(await dict.primaryDigest());
    expect(await dict.digestAtCount(1)).to.equal(digestAfter);
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

  it("allows raw-byte and packed definitions in one reference namespace", async function () {
    const dict = await deploy();
    const raw = "0x0001027f80ff";
    await expect(dict.addRaw(raw)).to.emit(dict, "EntryAdded");
    expect(await dict.secondaryCount()).to.equal(1n);
    const first = await dict.entry(0);
    expect(first[0]).to.equal(1n);
    expect(first[1]).to.equal(raw);
    expect(first[2]).to.equal(0n);
    await expect(dict.secondary(0)).to.be.revertedWithCustomError(dict, "WrongEntryKind");

    // 63,0 refers to the reusable raw-byte record at index 0.
    await dict.addSecondary(packed6([63, 0, 1]), 3);
    expect(await dict.secondaryCount()).to.equal(2n);
    const second = await dict.entry(1);
    expect(second[0]).to.equal(0n);
    expect(second[2]).to.equal(3n);
    expect(second[1]).to.equal(packed6([63, 0, 1]));

    const snap = await dict.digestAtCount(2);
    await dict.addRaw("0xdeadbeef");
    expect(await dict.digestAtCount(2)).to.equal(snap);
    expect(await dict.digestAtCount(3)).to.equal(await dict.definitionDigest());
    await dict.addRaw(raw);
    expect(await dict.secondaryCount()).to.equal(3n);
    await expect(dict.addRaw("0x")).to.be.revertedWithCustomError(dict, "EmptyRawEntry");
  });

  it("has append-only descriptive cross-contract references without implicit execution", async function () {
    const dict = await deploy();
    const [account] = await ethers.getSigners();
    const parent = account.address;
    const role = ethers.encodeBytes32String("parent");
    const digest = ethers.keccak256("0x1234");
    await expect(dict.addReference(137, parent, role, digest))
      .to.emit(dict, "ReferenceAdded")
      .withArgs(0n, 137n, parent, role, digest);
    expect(await dict.referenceCount()).to.equal(1n);
    const link = await dict.referenceAt(0);
    expect(link[0]).to.equal(137n);
    expect(link[1]).to.equal(parent);
    expect(link[2]).to.equal(role);
    expect(link[3]).to.equal(digest);
    await dict.addReference(137, parent, role, digest);
    expect(await dict.referenceCount()).to.equal(1n);
    await expect(dict.addReference(0, parent, role, digest))
      .to.be.revertedWithCustomError(dict, "InvalidContractReference");
    await expect(dict.addReference(137, ethers.ZeroAddress, role, digest))
      .to.be.revertedWithCustomError(dict, "InvalidContractReference");
    await expect(dict.referenceAt(2)).to.be.revertedWithCustomError(dict, "InvalidContractReference");
  });

  it("rejects invalid initial tables and mismatched seed arrays", async function () {
    async function expectDeployFailure(args: unknown[], expectedError: string) {
      let failure: unknown = null;
      try {
        await ethers.deployContract("M64SymbolDictionary", args);
      } catch (error) {
        failure = error;
      }
      expect(failure, "deployment must reject").not.to.equal(null);
      expect(String(failure)).to.include(expectedError);
    }
    const prefix = ["M64 test", "M64", "javascript", "text/javascript", "Test dictionary"];
    await expectDeployFailure([...prefix, primary().slice(0, 61), [], []], "WrongPrimaryCount");
    await expectDeployFailure([...prefix, primary(), [packed6([0])], []], "LengthMismatch");
    await expectDeployFailure(["", ...prefix.slice(1), primary(), [], []], "EmptyMetadata");
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
