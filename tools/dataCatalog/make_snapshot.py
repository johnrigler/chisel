#!/usr/bin/env python3
"""Create small Chisel data snapshots for debugging Portal/fileProxy catalog behavior.

Default mode is metadata-only: manifests, JSON wrappers, and image metadata are kept,
while heavy image binaries are omitted. Use --mode full for a complete slice.
"""

from pathlib import Path
import argparse
import json
import os
import tarfile
import time

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
DEFAULT_INCLUDE_DIRS = (
    "index",
    "transactions/evm",
    "assets/evm",
    "overrides",
)


def is_binary_image(path: Path) -> bool:
    return path.suffix.lower() in IMAGE_SUFFIXES


def should_include(path: Path, data_root: Path, mode: str) -> bool:
    if not path.is_file():
        return False
    rel = path.relative_to(data_root).as_posix()
    if not any(rel == item or rel.startswith(item.rstrip("/") + "/") for item in DEFAULT_INCLUDE_DIRS):
        return False
    if mode == "full":
        return True
    if is_binary_image(path):
        return False
    return True


def write_summary(data_root: Path, files: list[Path], out_dir: Path) -> Path:
    streams = []
    for stream_dir in sorted((data_root / "transactions" / "evm").glob("*/*")) if (data_root / "transactions" / "evm").exists() else []:
        if not stream_dir.is_dir():
            continue
        tx_files = [p for p in stream_dir.glob("*.json") if not p.name.startswith("_")]
        blocks = []
        latest = None
        for p in tx_files:
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                summary = data.get("summary") if isinstance(data.get("summary"), dict) else {}
                block = int(summary.get("blockHeight") or summary.get("blockNumber") or 0)
                block_time = int(summary.get("blockTime") or 0)
                if block:
                    blocks.append(block)
                row = {"path": str(p.relative_to(data_root)), "block": block, "blockTime": block_time, "txid": data.get("txid", "")}
                if latest is None or (block, block_time) > (latest["block"], latest["blockTime"]):
                    latest = row
            except Exception:
                pass
        streams.append({
            "path": str(stream_dir.relative_to(data_root)),
            "count": len(tx_files),
            "minBlock": min(blocks) if blocks else 0,
            "maxBlock": max(blocks) if blocks else 0,
            "latest": latest,
        })

    image_manifests = []
    for manifest in sorted((data_root / "assets" / "evm").glob("*/*/images/_image-manifest.json")) if (data_root / "assets" / "evm").exists() else []:
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
            image_manifests.append({
                "path": str(manifest.relative_to(data_root)),
                "count": len(data.get("images", [])),
                "first": data.get("images", [])[:1],
                "last": data.get("images", [])[-1:],
            })
        except Exception:
            pass

    summary = {
        "kind": "chisel-data-snapshot-summary",
        "generated": int(time.time()),
        "dataRoot": str(data_root),
        "fileCount": len(files),
        "streams": streams,
        "imageManifests": image_manifests,
    }
    summary_path = out_dir / "_snapshot-summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return summary_path


def make_snapshot(data_root: Path, out_path: Path, mode: str) -> None:
    data_root = data_root.expanduser().resolve()
    if not data_root.exists() or not data_root.is_dir():
        raise SystemExit(f"data root not found: {data_root}")
    out_path = out_path.expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    files = [p for p in data_root.rglob("*") if should_include(p, data_root, mode)]
    temp_dir = out_path.parent / (out_path.name + ".meta")
    temp_dir.mkdir(parents=True, exist_ok=True)
    summary_path = write_summary(data_root, files, temp_dir)

    with tarfile.open(out_path, "w:gz") as tf:
        for p in files:
            tf.add(p, arcname="chisel-data/" + p.relative_to(data_root).as_posix(), recursive=False)
        tf.add(summary_path, arcname="chisel-data/_snapshot-summary.json", recursive=False)

    try:
        summary_path.unlink()
        temp_dir.rmdir()
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a compact Chisel data snapshot tarball.")
    parser.add_argument("--data-root", default=os.environ.get("CHISEL_DATA_ROOT", "/home/john/daisy/2026/chisel-data"))
    parser.add_argument("--out", default="chisel-data-snapshot.tgz")
    parser.add_argument("--mode", choices=("metadata", "full"), default="metadata")
    args = parser.parse_args()
    make_snapshot(Path(args.data_root), Path(args.out), args.mode)
    print(args.out)


if __name__ == "__main__":
    main()
