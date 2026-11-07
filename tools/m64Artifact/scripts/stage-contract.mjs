// Hardhat 3 requires Solidity source inside its project directory.
// Stage exact byte-for-byte temporary copies of the canonical root sources.
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {dirname} from "node:path";
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
for(const name of ["M64Dictionary.sol","M64SymbolDictionary.sol"]){
  const canonical=new URL("../../../contracts/"+name,import.meta.url);
  const target=new URL("../contracts/"+name,import.meta.url);
  const bytes=await readFile(canonical);
  await mkdir(dirname(fileURLToPath(target)),{recursive:true});
  await writeFile(target,bytes);
  if(sha(await readFile(target))!==sha(bytes))throw Error("Staged source differs from canonical: "+name);
  console.log("Staged M64 Solidity: "+name+" ("+bytes.length+" bytes; sha256 "+sha(bytes)+")");
}
