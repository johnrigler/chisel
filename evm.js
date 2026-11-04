import json, pathlib, sys
source = pathlib.Path("contracts/Mogwai.sol").read_text()
json.dump({
  "language": "Solidity",
  "sources": {"contracts/Mogwai.sol": {"content": source}},
  "settings": {
    "metadata": {"appendCBOR": False},
    "outputSelection": {"*": {"*": [
      "abi", "evm.bytecode.object", "evm.deployedBytecode.object"
    ]}}
  }
}, sys.stdout)
