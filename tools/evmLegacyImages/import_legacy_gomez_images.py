#!/usr/bin/env python3
"""Import old Gomez EVM image artifacts into the Chisel persistent data catalog.

This is a thin client for fileProxy's /import-legacy-evm-images endpoint. It is
intentionally dumb: fileProxy owns path safety, data-root resolution, image
sniffing, manifest writing, and optional tx wrapper attachment.
"""

import argparse
import json
import sys
import urllib.request

GOMEZ = "0x5a2220d56f56db9C9F5B0cb83ff35b42746503a2"


def post_json(url, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url.rstrip("/") + "/import-legacy-evm-images",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.loads(res.read().decode("utf-8"))


def main():
    ap = argparse.ArgumentParser(description="Import legacy Gomez image files from easyBase/server or easyBase.tar")
    ap.add_argument("--fileproxy", default="http://127.0.0.1:7799", help="fileProxy base URL")
    ap.add_argument("--source-dir", default="", help="Legacy easyBase/server directory, for example ../easyBase/server")
    ap.add_argument("--source-tar", default="", help="Legacy easyBase.tar file, for example ../easyBase.tar")
    ap.add_argument("--chain-id", default="137")
    ap.add_argument("--contract-name", default="gomez")
    ap.add_argument("--contract-address", default=GOMEZ)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.source_dir and not args.source_tar:
        ap.error("provide --source-dir or --source-tar")

    payload = {
        "chainId": args.chain_id,
        "contractName": args.contract_name,
        "contractAddress": args.contract_address,
        "sourceDir": args.source_dir,
        "sourceTar": args.source_tar,
        "dryRun": args.dry_run,
    }
    out = post_json(args.fileproxy, payload)
    print(json.dumps(out, indent=2))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
