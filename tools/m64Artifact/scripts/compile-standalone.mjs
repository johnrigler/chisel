import { mkdir, readFile, writeFile } from "node:fs/promises";
import solc from "solc";

const sourcePath = new URL("../contracts/M64Dictionary.sol", import.meta.url);
const source = await readFile(sourcePath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "contracts/M64Dictionary.sol": { content: source },
  },
  settings: {
    metadata: {
      appendCBOR: false,
    },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors ?? [];
for (const diagnostic of errors) {
  const line = diagnostic.formattedMessage ?? diagnostic.message;
  if (diagnostic.severity === "error") console.error(line);
  else console.warn(line);
}
if (errors.some((diagnostic) => diagnostic.severity === "error")) {
  process.exitCode = 1;
  throw new Error("Solidity compilation failed");
}

const contract = output.contracts?.["contracts/M64Dictionary.sol"]?.M64Dictionary;
if (!contract) throw new Error("M64Dictionary compiler output missing");

const artifact = {
  compiler: solc.version(),
  contractName: "M64Dictionary",
  sourceName: "contracts/M64Dictionary.sol",
  metadataAppendCBOR: false,
  abi: contract.abi,
  bytecode: `0x${contract.evm.bytecode.object}`,
  deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
};

await mkdir(".standalone-artifacts", { recursive: true });
await writeFile(
  ".standalone-artifacts/M64Dictionary.json",
  `${JSON.stringify(artifact, null, 2)}\n`,
  "utf8",
);

console.log(
  `standalone solc ${artifact.compiler}: ${artifact.bytecode.length / 2 - 1} creation bytes`,
);
