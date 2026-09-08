import { network } from "hardhat";

const { ethers } = await network.connect();
const [publisher] = await ethers.getSigners();

console.log("CHISEL M64 / HARDHAT 3 DEMO");
console.log("publisher:", publisher.address);

const dictionary = await ethers.deployContract("M64Dictionary");
await dictionary.waitForDeployment();

console.log("contract:", await dictionary.getAddress());
console.log("language:", await dictionary.language());
console.log("dictionary version:", (await dictionary.dictionaryVersion()).toString());

const seed = ["function", "return", "width", "height", "drawLine"];
const seedTx = await dictionary.addTerms(seed);
await seedTx.wait();

console.log("seed terms:");
for (const term of seed) {
  console.log(`  ${term} -> ${(await dictionary.lookupId(term)).toString()}`);
}

const namespace = ethers.encodeBytes32String("M64");
const objectId = ethers.keccak256(ethers.toUtf8Bytes("hardhat-demo-object"));
const data = ethers.toUtf8Bytes("opaque M64/carrier bytes would be here");
const packetTx = await dictionary.publishPacket(namespace, objectId, 0n, data);
await packetTx.wait();

const events = await dictionary.queryFilter(dictionary.filters.Packet(namespace, objectId, 0n));
const event = events.at(-1);
if (!event) throw new Error("Packet event was not found");

console.log("packet:");
console.log("  namespace:", event.args.namespace);
console.log("  objectId:", event.args.objectId);
console.log("  part:", event.args.part.toString());
console.log("  publisher:", event.args.publisher);
console.log("  data:", ethers.toUtf8String(event.args.data));
console.log("term count:", (await dictionary.termCount()).toString());
