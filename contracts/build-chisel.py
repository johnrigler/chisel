#!/usr/bin/env python3
"""Compile contracts/Chisel.sol into a reusable EVM JSON deployment artifact.

Requires native solc >=0.8.24 and Python 3 standard library only.
Run from anywhere: python3 contracts/build-chisel.py
Generated contracts/compiled/Chisel.json is meant to be committed to git.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "contracts" / "Chisel.sol"
DEST = ROOT / "contracts" / "compiled" / "Chisel.json"
SOURCE_NAME = "contracts/Chisel.sol"
CONTRACT_NAME = "Chisel"
SETTINGS = {
    "optimizer": {"enabled": True, "runs": 200},
    # Paris bytecode avoids PUSH0 (Shanghai) on otherwise EVM-compatible
    # networks that have not activated Shanghai semantics.
    "evmVersion": "paris",
    "metadata": {"appendCBOR": False},
    "outputSelection": {
        "*": {"*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"]}
    },
}


def main():
    source = SOURCE.read_bytes()
    compiler = os.environ.get("SOLC", "solc")
    try:
        version = subprocess.run(
            [compiler, "--version"], check=True, capture_output=True, text=True
        ).stdout.strip().splitlines()[-1]
        standard_input = {
            "language": "Solidity",
            "sources": {SOURCE_NAME: {"content": source.decode("utf-8")}},
            "settings": SETTINGS,
        }
        result = subprocess.run(
            [compiler, "--standard-json"],
            input=json.dumps(standard_input),
            capture_output=True, text=True, check=True,
        )
    except (OSError, subprocess.CalledProcessError, IndexError) as exc:
        raise SystemExit("Native solc unavailable or failed: " + str(exc)) from exc

    # Some solc versions prepend a non-JSON diagnostic line on stdout.
    start = result.stdout.find("{")
    if start < 0:
        raise SystemExit("solc did not return Standard JSON: " + result.stderr)
    try:
        output = json.loads(result.stdout[start:])
    except json.JSONDecodeError as exc:
        raise SystemExit("Invalid solc Standard JSON: " + str(exc)) from exc

    for diagnostic in output.get("errors", []):
        print(diagnostic.get("formattedMessage", diagnostic.get("message", "")), file=sys.stderr)
    if any(item.get("severity") == "error" for item in output.get("errors", [])):
        raise SystemExit("Compilation failed; no artifact written.")

    contract = output.get("contracts", {}).get(SOURCE_NAME, {}).get(CONTRACT_NAME)
    if not contract:
        raise SystemExit("Solidity output does not contain contracts/Chisel.sol:Chisel.")
    evm = contract.get("evm", {})
    creation = evm.get("bytecode", {}).get("object", "")
    runtime = evm.get("deployedBytecode", {}).get("object", "")
    if not isinstance(creation, str) or not creation or any(
        c not in "0123456789abcdefABCDEF" for c in creation
    ) or len(creation) % 2:
        raise SystemExit("Missing, invalid or unlinked Chisel creation bytecode.")
    if not isinstance(runtime, str) or not runtime or any(
        c not in "0123456789abcdefABCDEF" for c in runtime
    ) or len(runtime) % 2:
        raise SystemExit("Missing or invalid Chisel runtime bytecode.")
    if not isinstance(contract.get("abi"), list):
        raise SystemExit("Missing Chisel ABI.")

    artifact = {
        "contractName": CONTRACT_NAME,
        "sourceName": SOURCE_NAME,
        "compiler": version,
        "settings": {"evmVersion": SETTINGS["evmVersion"], "optimizer": SETTINGS["optimizer"],
                     "metadata": SETTINGS["metadata"]},
        "sourceSha256": hashlib.sha256(source).hexdigest(),
        "bytecodeSha256": hashlib.sha256(bytes.fromhex(creation)).hexdigest(),
        "abi": contract["abi"],
        "bytecode": "0x" + creation.lower(),
        "deployedBytecode": "0x" + runtime.lower(),
    }
    payload = (json.dumps(artifact, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    if "--check" in sys.argv[1:]:
        if not DEST.is_file() or DEST.read_bytes() != payload:
            raise SystemExit("Compiled artifact missing or stale: " + str(DEST))
        print("Artifact matches:", DEST.relative_to(ROOT))
        return
    if len(sys.argv) > 1:
        raise SystemExit("Usage: python3 contracts/build-chisel.py [--check]")
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_bytes(payload)
    print("Compiled", SOURCE_NAME + ":" + CONTRACT_NAME)
    print("Compiler:", version)
    print("Creation bytes:", len(creation) // 2)
    print("Creation SHA-256:", artifact["bytecodeSha256"])
    print("Output:", DEST.relative_to(ROOT))


if __name__ == "__main__":
    main()
