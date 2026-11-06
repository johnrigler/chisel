#!/usr/bin/env python3
"""Backwards-compatible entry point; use build-solidity.py for new contracts."""
from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("build-solidity.py")), run_name="__main__")
