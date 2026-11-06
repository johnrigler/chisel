// Hardhat 3 rejects sources outside the npm project root. Materialize a
// transient, git-ignored copy of the canonical Solidity as compile input.
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";
const canonical=new URL("../../../contracts/M64Dictionary.sol",import.meta.url);
const target=new URL("../contracts/M64Dictionary.sol",import.meta.url);
const bytes=await readFile(canonical);
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
await mkdir(dirname(fileURLToPath(target)),{recursive:true});
await writeFile(target,bytes);
if(sha(await readFile(target))!==sha(bytes))throw Error("M64 staged source differs from canonical file");
console.log("Staged M64 Solidity from contracts/M64Dictionary.sol ("+bytes.length+" bytes; sha256 "+sha(bytes)+")");
