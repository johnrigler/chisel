#!/usr/bin/env python3
"""
Hydrate Chisel UTXO fixture JSON files with exact block header timestamps.

Use this when an imported feed contains block heights but not block times. The
fileProxy fallback can estimate dates for sorting, but this helper asks a local
coin daemon for the actual block header time and writes it into each fixture.

Example:

  python3 tools/bunOven/hydrate-utxo-block-times.py \
    --coin dogecoin \
    --rpc http://rpcuser:rpcpass@127.0.0.1:22555

Dogecoin Core RPC calls used:
  getblockhash HEIGHT
  getblock HASH
"""
import argparse
import base64
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path


def rpc_call(url, method, params=None, counter=[0]):
    counter[0] += 1
    parsed = urllib.parse.urlparse(url)
    headers = {"Content-Type": "application/json"}
    clean_url = url
    if parsed.username or parsed.password:
        user = urllib.parse.unquote(parsed.username or "")
        password = urllib.parse.unquote(parsed.password or "")
        token = base64.b64encode((user + ":" + password).encode()).decode()
        headers["Authorization"] = "Basic " + token
        netloc = parsed.hostname or ""
        if parsed.port:
            netloc += ":" + str(parsed.port)
        clean_url = urllib.parse.urlunparse(parsed._replace(netloc=netloc))
    payload = json.dumps({"jsonrpc": "1.0", "id": str(counter[0]), "method": method, "params": params or []}).encode()
    req = urllib.request.Request(clean_url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode())
    if data.get("error"):
        raise RuntimeError(str(data["error"]))
    return data.get("result")


def get_block_time(rpc, height, cache):
    height = int(height)
    if height in cache:
        return cache[height]
    block_hash = rpc_call(rpc, "getblockhash", [height])
    block = rpc_call(rpc, "getblock", [block_hash])
    t = int(block.get("time") or 0)
    if not t:
        raise RuntimeError("block has no time: " + str(height))
    cache[height] = t
    return t


def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        return None


def block_height(packet):
    if not isinstance(packet, dict):
        return 0
    summary = packet.get("summary") if isinstance(packet.get("summary"), dict) else {}
    status = packet.get("status") if isinstance(packet.get("status"), dict) else {}
    tx = packet.get("tx") if isinstance(packet.get("tx"), dict) else packet
    for value in (summary.get("blockHeight"), summary.get("block_height"), status.get("block_height"), status.get("blockHeight"), tx.get("block_height"), tx.get("blockHeight"), tx.get("height")):
        try:
            if value not in (None, "") and int(value) > 0:
                return int(value)
        except Exception:
            pass
    return 0


def set_block_time(packet, t):
    packet.setdefault("summary", {})["blockTime"] = int(t)
    packet["summary"]["blockTimeEstimated"] = False
    packet.setdefault("status", {})["block_time"] = int(t)
    packet["block_time"] = int(t)


def find_files(root, coin):
    candidates = []
    for base in (root / "data" / "transactions" / coin, root / "data-bundled" / "transactions" / coin):
        if base.exists():
            candidates.extend(sorted(base.glob("*.json")))
    return candidates


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="Chisel root directory")
    ap.add_argument("--coin", required=True, help="dogecoin, ravencoin, digibyte, litecoin, bitcoin")
    ap.add_argument("--rpc", required=True, help="JSON-RPC URL, e.g. http://user:pass@127.0.0.1:22555")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    coin = args.coin.lower().strip()
    files = find_files(root, coin)
    cache = {}
    changed = 0
    skipped = 0
    for path in files:
        packet = load_json(path)
        h = block_height(packet)
        if not h:
            skipped += 1
            continue
        try:
            t = get_block_time(args.rpc, h, cache)
        except Exception as e:
            print(json.dumps({"path": str(path), "height": h, "error": str(e)}), file=sys.stderr)
            skipped += 1
            continue
        if packet.get("summary", {}).get("blockTime") == t:
            continue
        set_block_time(packet, t)
        changed += 1
        if not args.dry_run:
            path.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "coin": coin, "files": len(files), "changed": changed, "skipped": skipped, "uniqueHeights": len(cache)}, indent=2))


if __name__ == "__main__":
    main()
