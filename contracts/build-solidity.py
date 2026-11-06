#!/usr/bin/env python3
"""Compile a Solidity source file into a browser-loadable EVM deployment artifact.

Uses the native solc Standard JSON interface and only the Python standard library.
Run from any working directory:
    python3 contracts/build-solidity.py M64Dictionary.sol
    python3 contracts/build-solidity.py contracts/JethroV2.sol --check
    python3 contracts/build-solidity.py contracts/Multi.sol --contract Chosen

The source filename supplies the default Solidity contract name; --contract
selects a differently named contract in files that define several contracts.
Without a source argument, Chisel.sol is built for backwards compatibility.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
CONTRACTS = ROOT / "contracts"
SETTINGS = {
    "optimizer": {"enabled": True, "runs": 200},
    # Paris avoids PUSH0 on otherwise compatible chains without Shanghai.
    "evmVersion": "paris",
    "metadata": {"appendCBOR": False},
    "outputSelection": {
        "*": {"*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"]}
    },
}


def resolve_source(value):
    proposed = Path(value).expanduser()
    paths = ([proposed] if proposed.is_absolute() else [
        Path.cwd() / proposed, ROOT / proposed, CONTRACTS / proposed,
    ])
    for candidate in paths:
        if candidate.is_file():
            source = candidate.resolve()
            if source.suffix.lower() != ".sol":
                raise SystemExit("Expected a .sol source file: " + str(source))
            return source
    raise SystemExit("Solidity file not found: " + value)


def check_hex(value, label):
    if (not isinstance(value, str) or not value or len(value) % 2
            or any(ch not in "0123456789abcdefABCDEF" for ch in value)):
        raise SystemExit("Missing, invalid or unlinked " + label + " bytecode.")
    return value.lower()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", nargs="?", default="Chisel.sol", help="Solidity file (default: contracts/Chisel.sol)")
    parser.add_argument("--contract", help="Contract declaration to compile (default: source filename stem)")
    parser.add_argument("--output", type=Path, help="JSON artifact destination (default: contracts/compiled/<contract>.json)")
    parser.add_argument("--check", action="store_true", help="Fail if the existing artifact differs from this build")
    args = parser.parse_args(argv)

    source_path = resolve_source(args.source)
    contract_name = args.contract or source_path.stem
    try:
        source_name = source_path.relative_to(ROOT).as_posix()
    except ValueError:
        source_name = source_path.name

    source = source_path.read_bytes()
    try:
        source_text = source.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise SystemExit("Source is not UTF-8: " + str(source_path)) from exc

    compiler = os.environ.get("SOLC", "solc")
    standard_input = {
        "language": "Solidity",
        "sources": {source_name: {"content": source_text}},
        "settings": SETTINGS,
    }
    # Native solc resolves relative Solidity imports on disk; no npm/Hardhat.
    command = [compiler, "--base-path", str(ROOT), "--include-path", str(source_path.parent), "--standard-json"]
    try:
        version_result = subprocess.run(
            [compiler, "--version"], check=True, capture_output=True, text=True
        )
        version = version_result.stdout.strip().splitlines()[-1]
        result = subprocess.run(
            command, input=json.dumps(standard_input),
            capture_output=True, text=True, check=True,
        )
    except (OSError, subprocess.CalledProcessError, IndexError) as exc:
        raise SystemExit("Native solc unavailable or failed: " + str(exc)) from exc

    # Some solc versions put a diagnostic preamble before the JSON object.
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

    contracts = output.get("contracts", {}).get(source_name, {})
    contract = contracts.get(contract_name)
    if not contract:
        available = ", ".join(sorted(contracts)) or "none"
        raise SystemExit(f"Contract {contract_name!r} not found in {source_name}; available: {available}. "
                         "Use --contract NAME if it differs from the filename.")
    evm = contract.get("evm", {})
    creation = check_hex(evm.get("bytecode", {}).get("object", ""), f"{contract_name} creation")
    runtime = check_hex(evm.get("deployedBytecode", {}).get("object", ""), f"{contract_name} runtime")
    if not isinstance(contract.get("abi"), list):
        raise SystemExit(f"Missing {contract_name} ABI.")

    artifact = {
        "contractName": contract_name,
        "sourceName": source_name,
        "compiler": version,
        "settings": {
            "evmVersion": SETTINGS["evmVersion"],
            "optimizer": SETTINGS["optimizer"],
            "metadata": SETTINGS["metadata"],
        },
        "sourceSha256": hashlib.sha256(source).hexdigest(),
        "bytecodeSha256": hashlib.sha256(bytes.fromhex(creation)).hexdigest(),
        "abi": contract["abi"],
        "bytecode": "0x" + creation,
        "deployedBytecode": "0x" + runtime,
    }
    payload = (json.dumps(artifact, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    destination = args.output or (CONTRACTS / "compiled" / (contract_name + ".json"))
    if args.check:
        if not destination.is_file() or destination.read_bytes() != payload:
            raise SystemExit("Compiled artifact missing or stale: " + str(destination))
        print("Artifact matches:", destination)
        return

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(payload)
    print("Compiled", source_name + ":" + contract_name)
    print("Compiler:", version)
    print("Creation bytes:", len(creation) // 2)
    print("Creation SHA-256:", artifact["bytecodeSha256"])
    print("Output:", destination)


if __name__ == "__main__":
    main()
