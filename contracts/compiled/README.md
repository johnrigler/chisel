# Compiled Chisel deployment artifact

Run `python3 contracts/build-chisel.py` from the repository root (requires
native `solc`). This creates `Chisel.json` next to this README.

Commit the generated `Chisel.json` so every IPFS/static deployment can
load the same ABI and creation bytecode. The JavaScript factory reads it using
a relative path, and the connected browser wallet signs the deployment
transaction on the selected EVM chain.

There is intentionally **no placeholder bytecode** in this directory.
Do not mistake historical `contracts/Mogwai.bin` or `Mogwai.txt` for
the current Chisel contract. No keys or deployment addresses belong here.

After successful main-branch CI, the publish job automatically commits the\ncompiled `Chisel.json` from its pinned Solidity compiler. This is a public\ndeployment artifact; it contains no wallet secrets or private keys.\n