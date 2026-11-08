#!/usr/bin/env bash
# Chisel Solidity build shortcut. Uses the existing Python + native-solc
# Standard JSON compiler, with no Node.js / npm / Hardhat dependency.
# Run with: bash contracts/build.sh [Source.sol] [build-solidity.py options]
set -euo pipefail

contracts_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(dirname "$contracts_dir")"

usage() {
  cat <<'EOF'
Chisel Solidity build

  bash contracts/build.sh --list
  bash contracts/build.sh                         # M64SymbolDictionary.sol
  bash contracts/build.sh M64SymbolDictionary.sol
  bash contracts/build.sh M64SymbolDictionary.sol --check
  bash contracts/build.sh Chisel.sol
  bash contracts/build.sh JethroV2.sol
  bash contracts/build.sh SomeFile.sol --contract SomeDeclaration

Compiles ONE contract to contracts/compiled/<Contract>.json.
Requires python3 and native solc (>=0.8.24 and <0.9.0 for M64SymbolDictionary).
Set SOLC=/full/path/to/solc to select another compiler.

Compiling does not deploy, supply the M64 SVG seed, or alter deployed contracts.
After compiling, import the JSON into tools/evmFactory/index.html.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi
if [[ "${1:-}" == "--list" ]]; then
  printf 'Solidity source files in %s:\n' "$contracts_dir"
  for source in "$contracts_dir"/*.sol; do
    [[ -f "$source" ]] || continue
    printf '  %s\n' "${source##*/}"
  done
  printf '\nBuild driver: contracts/build-solidity.py\n'
  printf 'Compiled artifacts: contracts/compiled/\n'
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  printf 'ERROR: python3 not found on PATH.\n' >&2
  exit 127
fi
solc_bin="${SOLC:-solc}"
if ! command -v "$solc_bin" >/dev/null 2>&1; then
  printf 'ERROR: Solidity compiler not found: %s\n' "$solc_bin" >&2
  printf 'Install native solc 0.8.24+ (below 0.9), or set SOLC=/path/to/solc.\n' >&2
  exit 127
fi

# Invoke the repository's single source of truth. Do not bulk-recompile
# historical artifacts such as M64Dictionary.json with a different compiler.
cd "$repo_dir"
if [[ "$#" -eq 0 ]]; then
  set -- M64SymbolDictionary.sol
elif [[ "${1:0:1}" == "-" ]]; then
  # Options such as --check without an explicit source target M64 SVG.
  set -- M64SymbolDictionary.sol "$@"
fi
python3 "$contracts_dir/build-solidity.py" "$@"
