#!/usr/bin/env python3

from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import json
import mimetypes
import os
import re
import urllib.parse
import time

HOST = os.environ.get("CHISEL_FILE_HOST", "127.0.0.1")
PORT = int(os.environ.get("CHISEL_FILE_PORT", "7799"))

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ROOT = Path(os.environ.get("CHISEL_FILE_ROOT", str(PROJECT_ROOT))).expanduser().resolve()
ROOT.mkdir(parents=True, exist_ok=True)

def _split_roots(value):
    return [Path(part).expanduser().resolve() for part in str(value or "").split(os.pathsep) if part.strip()]

EXTRA_DATA_ROOTS = _split_roots(os.environ.get("CHISEL_DATA_ROOT", ""))
ALLOWED_ROOTS = [ROOT] + EXTRA_DATA_ROOTS

TXID_RE = set("0123456789abcdefABCDEF")
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
JSON_EXTS = ["", ".json", ".txt"]
KNOWN_COINS = {"digibyte", "ravencoin", "litecoin", "litecointestnet", "bitcoin", "bitcointestnet3", "bitcointestnet4", "polygon", "matic", "evm", "unknown"}
INDEX_PATH = Path("data/index/transactions.index.json")

BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def safe_segment(value, default="unknown"):
    text = str(value or default).strip().lower()
    out = []
    for ch in text:
        if ch.isalnum() or ch in ("-", "_", "."):
            out.append(ch)
        elif ch in (" ", "/"):
            out.append("-")
    clean = "".join(out).strip(".-_")
    return clean or default


def base58_from_hex(hex_text):
    raw = bytes.fromhex(str(hex_text).strip())
    n = int.from_bytes(raw, "big")
    chars = []
    while n:
        n, rem = divmod(n, 58)
        chars.append(BASE58_ALPHABET[rem])
    encoded = "".join(reversed(chars)) or "1"
    leading = 0
    for b in raw:
        if b == 0:
            leading += 1
        else:
            break
    return ("1" * leading) + encoded


def txid_from_jsonish(value):
    if isinstance(value, dict):
        for key in ("txid", "hash", "tx_hash"):
            candidate = value.get(key)
            if is_txid(candidate):
                return str(candidate).lower()
    return ""


def is_txid(value):
    text = str(value or "").strip()
    return len(text) == 64 and all(ch in TXID_RE for ch in text)


def _is_under(path, root):
    try:
        resolved = path.resolve()
        base = root.resolve()
        return resolved == base or base in resolved.parents
    except Exception:
        return False


def is_allowed_path(path):
    return any(_is_under(path, allowed) for allowed in ALLOWED_ROOTS)


def safe_path(user_path):
    user_path = user_path or "."
    candidate = (ROOT / user_path).resolve()
    if not is_allowed_path(candidate):
        raise ValueError("Path escapes workspace; set CHISEL_DATA_ROOT for external transaction stores")
    return candidate


def rel_path(path):
    resolved = path.resolve()
    try:
        return str(resolved.relative_to(ROOT.resolve()))
    except Exception:
        for allowed in EXTRA_DATA_ROOTS:
            try:
                return "data-root:" + str(resolved.relative_to(allowed.resolve()))
            except Exception:
                pass
    return str(resolved)


def send_json(handler, obj, status=200):
    data = json.dumps(obj, indent=2).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def send_file(handler, path):
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    data = path.read_bytes()
    handler.send_response(200)
    handler.send_header("Content-Type", mime)
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def read_jsonish(path):
    text = path.read_text(encoding="utf-8", errors="replace")
    try:
        return {"format": "json", "json": json.loads(text), "text": text}
    except Exception:
        return {"format": "text", "json": None, "text": text}


def tx_roots(coin=None):
    roots = []
    bases = ["txids", "data/transactions", "transactions"]
    for base in bases:
        # Transaction stores are read-only discovery roots here. Follow symlinks so a
        # small app tar can point at a separate large data directory.
        p = (ROOT / base).resolve()
        if not p.exists():
            continue
        if coin:
            cp = p / coin
            if cp.exists():
                roots.append(cp)
        roots.append(p)
    for data_root in EXTRA_DATA_ROOTS:
        candidates = [data_root / "transactions", data_root / "data" / "transactions"]
        if coin and (data_root / coin).exists():
            candidates.append(data_root)
        elif not coin and any((data_root / name).exists() for name in ("digibyte", "litecoin", "ravencoin")):
            candidates.append(data_root)
        for p in candidates:
            if not p.exists():
                continue
            if coin:
                cp = p / coin
                if cp.exists():
                    roots.append(cp)
            else:
                roots.append(p)
    seen = []
    for p in roots:
        rp = p.resolve()
        if rp not in seen:
            seen.append(rp)
    return [Path(p) for p in seen]



def detect_coin_for_path(path, explicit_coin=None):
    if explicit_coin:
        return safe_segment(explicit_coin)
    resolved = Path(path).resolve()

    rels = []
    for root in ALLOWED_ROOTS:
        try:
            rels.append(resolved.relative_to(root.resolve()).parts)
        except Exception:
            pass
    rels.append(resolved.parts)

    for parts in rels:
        lowered = [str(part).lower() for part in parts]
        for name in KNOWN_COINS:
            if name != "unknown" and name in lowered:
                return name
        for anchor in ("transactions", "txids"):
            if anchor in lowered:
                idx = lowered.index(anchor)
                if len(lowered) > idx + 1:
                    candidate = safe_segment(lowered[idx + 1])
                    if candidate and candidate not in ("data", "transactions", "txids"):
                        return candidate
    parent = safe_segment(resolved.parent.name)
    return parent if parent not in ("transactions", "txids", "data") else "unknown"


BASE58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{26,80}$")
MAC_OVERRIDES = {
    "LET-S DANCE": "Let's Dance",
    "EYES OF THE WORLD": "Eyes of the World",
    "YOUTUBE.COM": "YouTube.com",
    "YOUTUBe.COM": "YouTube.com",
}


def trim_mac_padding(value):
    return re.sub(r"z+$", "", str(value or ""))


def mac_glyphs_to_text(value):
    text = trim_mac_padding(value)
    text = text.replace("x", " ").replace("z", " ").replace("v", ".").replace("w", ":").replace("y", "-")
    text = text.replace("i", "I").replace("o", "O").replace("c", "0")
    return re.sub(r"\s+", " ", text).strip()


def title_case_mac_text(value):
    small = {"A", "AN", "AND", "AS", "AT", "BUT", "BY", "FOR", "FROM", "IN", "INTO", "NOR", "OF", "ON", "OR", "THE", "TO", "VIA", "VS", "WITH"}
    parts = re.split(r"(\s+)", str(value or ""))
    words = [part for part in parts if part.strip()]
    out = []
    pos = 0
    for part in parts:
        if not part.strip():
            out.append(part)
            continue
        pos += 1
        upper = part.upper()
        if upper in {"IPFS", "DGB", "RVN", "LTC", "BTC", "ETH", "EVM", "SHA256", "URL", "URI", "JSON"}:
            out.append(upper)
        elif 1 < pos < len(words) and upper in small:
            out.append(part.lower())
        else:
            chunks = []
            for chunk in re.split(r"(-)", part):
                if chunk == "-" or not chunk:
                    chunks.append(chunk)
                else:
                    lower = chunk.lower()
                    chunks.append(lower[:1].upper() + lower[1:])
            out.append("".join(chunks))
    return "".join(out)


def normalize_mac_text(value):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text:
        return ""
    replacements = {
        r"\bLET-S\b": "Let's", r"\bI-M\b": "I'm", r"\bCAN-T\b": "Can't", r"\bDON-T\b": "Don't",
        r"\bWON-T\b": "Won't", r"\bWE-RE\b": "We're", r"\bYOU-RE\b": "You're", r"\bTHEY-RE\b": "They're", r"\bIT-S\b": "It's",
    }
    for pat, repl in replacements.items():
        text = re.sub(pat, repl, text, flags=re.I)
    override = MAC_OVERRIDES.get(text.upper())
    if override:
        return override
    if re.match(r"^[A-Z0-9 .:'\-]+$", text) and re.search(r"[A-Z]", text):
        return title_case_mac_text(text)
    return text


def decode_mac_address_line(line):
    text = str(line or "")
    if not BASE58_RE.match(text) or len(text) <= 9 or text.startswith("S"):
        return ""
    payload = text[:-6][3:]
    return normalize_mac_text(mac_glyphs_to_text(payload))

def extract_txid(value):
    if isinstance(value, dict):
        for key in ("txid", "hash", "tx_hash", "id"):
            candidate = value.get(key)
            if is_txid(candidate):
                return str(candidate).lower()
        tx = value.get("tx")
        if isinstance(tx, dict):
            return extract_txid(tx)
    return ""


def output_address(entry):
    if not isinstance(entry, dict):
        return ""
    if entry.get("scriptpubkey_address"):
        return str(entry.get("scriptpubkey_address"))
    spk = entry.get("scriptPubKey")
    if isinstance(spk, dict):
        if spk.get("address"):
            return str(spk.get("address"))
        addresses = spk.get("addresses")
        if isinstance(addresses, list) and addresses:
            return str(addresses[0])
    return ""


def op_return_text(entry):
    if not isinstance(entry, dict):
        return ""
    spk = entry.get("scriptPubKey") if isinstance(entry.get("scriptPubKey"), dict) else {}
    asm = str(entry.get("scriptpubkey_asm") or spk.get("asm") or "")
    hex_value = ""
    parts = asm.strip().split()
    if parts and parts[0] == "OP_RETURN":
        hex_value = parts[-1]
    if not hex_value:
        raw_hex = str(entry.get("scriptpubkey") or (entry.get("scriptPubKey", {}).get("hex") if isinstance(entry.get("scriptPubKey"), dict) else ""))
        if raw_hex.lower().startswith("6a"):
            # Simple small-push decode. Good enough for index summaries.
            h = raw_hex[2:]
            if len(h) >= 2:
                op = int(h[:2], 16)
                if 0 < op <= 75:
                    hex_value = h[2:2 + op * 2]
                else:
                    hex_value = h
    if not hex_value:
        return ""
    try:
        return bytes.fromhex(hex_value).decode("utf-8", errors="replace").strip()
    except Exception:
        return ""


def short_txid(txid):
    text = str(txid or "")
    return text[:10] + "…" + text[-10:] if len(text) > 20 else text


def summarize_tx_json(value, path=None, coin=None, modified=None):
    tx = value.get("tx") if isinstance(value, dict) and isinstance(value.get("tx"), dict) else value
    txid = extract_txid(value) or (Path(path).stem.lower() if path and is_txid(Path(path).stem) else "")
    vout = tx.get("vout", []) if isinstance(tx, dict) else []
    lines = [output_address(row) for row in vout if output_address(row)]
    image_line_values = [line for line in lines if line.startswith("S")]
    image_lines = len(image_line_values)
    non_image_lines = [line for line in lines if not line.startswith("S")]
    op_texts = [op_return_text(row) for row in vout if op_return_text(row)]
    urls = []
    for text in op_texts:
        for part in text.replace('"', ' ').replace("'", " ").split():
            if part.startswith("http://") or part.startswith("https://"):
                urls.append(part.rstrip("),.;"))
    title = ""
    for line in non_image_lines:
        decoded = decode_mac_address_line(line)
        if decoded:
            title = decoded
            break
        if len(line) > 6:
            title = line
            break
    if not title and op_texts:
        title = op_texts[0][:96]
    if not title:
        title = "transaction " + short_txid(txid)
    block_height = None
    block_time = None
    if isinstance(tx, dict):
        status = tx.get("status") if isinstance(tx.get("status"), dict) else {}
        block_height = status.get("block_height") or tx.get("block_height") or tx.get("blockHeight")
        block_time = status.get("block_time") or tx.get("block_time") or tx.get("blockTime")
    return {
        "txid": txid,
        "coin": detect_coin_for_path(path, coin) if path else safe_segment(coin or "unknown"),
        "path": rel_path(Path(path)) if path else "",
        "modified": int(modified or (Path(path).stat().st_mtime if path and Path(path).exists() else time.time())),
        "summary": {
            "txid": txid,
            "title": title,
            "primaryUrl": urls[0] if urls else "",
            "lines": len(lines),
            "imageLines": image_lines,
            "imageChordLines": image_line_values,
            "ipfsCount": 0,
            "opReturnText": op_texts[0] if op_texts else "",
            "opReturnUrls": sorted(set(urls)),
            "blockHeight": block_height,
            "blockTime": block_time
        }
    }


def index_file_path():
    return safe_path(str(INDEX_PATH))


def tx_file_candidates(coin=None):
    seen = set()
    for root in tx_roots(coin):
        if not root.exists() or not root.is_dir():
            continue
        for p in root.rglob("*"):
            if not p.is_file() or p.name.startswith("."):
                continue
            if p.suffix.lower() not in (".json", ".txt", ""):
                continue
            rp = p.resolve()
            if not is_allowed_path(rp):
                continue
            key = str(rp)
            if key in seen:
                continue
            seen.add(key)
            yield rp


def build_tx_index(coin=None):
    rows = []
    seen = set()
    for p in tx_file_candidates(coin):
        try:
            loaded = read_jsonish(p).get("json")
            txid = txid_from_jsonish(loaded) or extract_txid(loaded)
            if not txid:
                name = p.stem if p.suffix else p.name
                txid = name.lower() if is_txid(name) else ""
            if not txid:
                continue
            detected_coin = detect_coin_for_path(p, coin)
            key = detected_coin + ":" + txid
            if key in seen:
                continue
            seen.add(key)
            row = summarize_tx_json(loaded if loaded is not None else {}, p, detected_coin)
            row["txid"] = txid
            row["file_slug"] = p.stem if p.suffix else p.name
            row["size"] = p.stat().st_size
            rows.append(row)
        except Exception:
            continue
    rows.sort(key=lambda row: (row.get("coin") or "", -int(row.get("summary", {}).get("blockTime") or row.get("modified") or 0), row.get("txid") or ""))
    return rows


def read_or_build_tx_index(coin=None, force=False):
    idx = index_file_path()
    if not force and idx.exists():
        try:
            data = json.loads(idx.read_text(encoding="utf-8"))
            rows = data.get("transactions", [])
            if coin:
                rows = [row for row in rows if safe_segment(row.get("coin")) == safe_segment(coin)]
            return {"ok": True, "cached": True, "path": rel_path(idx), "coin": coin or "", "transactions": rows}
        except Exception:
            pass
    rows = build_tx_index(coin=None)
    idx.parent.mkdir(parents=True, exist_ok=True)
    payload = {"ok": True, "generated": int(time.time()), "transactions": rows}
    idx.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if coin:
        rows = [row for row in rows if safe_segment(row.get("coin")) == safe_segment(coin)]
    return {"ok": True, "cached": False, "path": rel_path(idx), "coin": coin or "", "transactions": rows}


def read_config(rel_path="chisel.portal.config.json"):
    p = safe_path(rel_path or "chisel.portal.config.json")
    if not p.exists() or not p.is_file():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))

def find_tx_file(txid, coin=None):
    if not is_txid(txid):
        raise ValueError("txid must be 64 hex characters")
    target = str(txid).lower()
    candidates = []
    b58 = base58_from_hex(target)
    for root in tx_roots(coin):
        for suffix in JSON_EXTS:
            candidates.append(root / (target + suffix))
            candidates.append(root / (str(txid) + suffix))
            candidates.append(root / (b58 + suffix))
        if coin:
            for suffix in JSON_EXTS:
                candidates.append(root / coin / (target + suffix))
                candidates.append(root / coin / (str(txid) + suffix))
                candidates.append(root / coin / (b58 + suffix))
    for p in candidates:
        try:
            rp = p.resolve()
            if rp.exists() and rp.is_file() and is_allowed_path(rp):
                return rp
        except Exception:
            pass
    # last resort: bounded recursive scan under expected roots; supports Base58-slug filenames.
    for root in tx_roots(coin):
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if not p.is_file():
                continue
            if p.stem.lower() == target or p.stem.lower().startswith(b58.lower()):
                return p.resolve()
            if p.suffix.lower() in (".json", ".txt", ""):
                try:
                    found = read_jsonish(p).get("json")
                    if txid_from_jsonish(found) == target:
                        return p.resolve()
                except Exception:
                    pass
    return None


def list_txids(coin=None):
    out = []
    seen = set()
    for root in tx_roots(coin):
        if not root.exists() or not root.is_dir():
            continue
        for p in root.rglob("*"):
            if not p.is_file():
                continue
            name = p.stem if p.suffix else p.name
            txid_value = name.lower() if is_txid(name) else ""
            if not txid_value and p.suffix.lower() in (".json", ".txt", ""):
                try:
                    txid_value = txid_from_jsonish(read_jsonish(p).get("json"))
                except Exception:
                    txid_value = ""
            if not txid_value:
                continue
            key = rel_path(p)
            if key in seen:
                continue
            seen.add(key)
            st = p.stat()
            detected_coin = detect_coin_for_path(p, coin)
            out.append({
                "txid": txid_value,
                "coin": detected_coin,
                "path": key,
                "file_slug": name,
                "size": st.st_size,
                "modified": int(st.st_mtime)
            })
    out.sort(key=lambda row: (row.get("coin") or "", -row["modified"], row["txid"]))
    return out


def find_ipfs_file(cid):
    clean = str(cid or "").strip().replace("/ipfs/", "")
    if not clean:
        raise ValueError("cid is required")
    roots = ["ipfs", "data/ipfs"]
    for base in roots:
        p = safe_path(base)
        if not p.exists():
            continue
        for suffix in JSON_EXTS:
            candidate = (p / (clean + suffix)).resolve()
            if candidate.exists() and candidate.is_file() and ROOT in candidate.parents:
                return candidate
        direct = (p / clean).resolve()
        if direct.exists() and direct.is_file() and ROOT in direct.parents:
            return direct
    return None


def find_assets(txid=None, cid=None):
    needles = [str(x or "").strip().lower() for x in (txid, cid) if str(x or "").strip()]
    roots = ["images", "data/images", "base57", "data/base57", "ipfs", "data/ipfs", "txids"]
    out = []
    seen = set()
    for base in roots:
        p = safe_path(base)
        if not p.exists():
            continue
        for child in p.rglob("*"):
            if not child.is_file() or child.suffix.lower() not in IMAGE_EXTS:
                continue
            hay = (child.stem + " " + child.name + " " + rel_path(child)).lower()
            if needles and not any(n in hay for n in needles):
                continue
            key = rel_path(child)
            if key in seen:
                continue
            seen.add(key)
            st = child.stat()
            out.append({
                "path": key,
                "name": child.name,
                "size": st.st_size,
                "modified": int(st.st_mtime),
                "url": "/raw?path=" + urllib.parse.quote(key)
            })
    out.sort(key=lambda row: row["path"])
    return out


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("%s - - %s" % (self.address_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(parsed.query)

        try:
            if parsed.path == "/ping":
                send_json(self, {"ok": True, "service": "chisel-fileproxy", "root": str(ROOT)})
                return

            if parsed.path == "/config":
                rel = query.get("path", ["chisel.portal.config.json"])[0]
                send_json(self, {"ok": True, "path": rel, "config": read_config(rel)})
                return

            if parsed.path == "/list":
                rel = query.get("path", ["."])[0]
                p = safe_path(rel)
                if not p.exists():
                    send_json(self, {"ok": False, "error": "Path does not exist"}, 404)
                    return
                if not p.is_dir():
                    send_json(self, {"ok": False, "error": "Path is not a directory"}, 400)
                    return
                items = []
                for child in sorted(p.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                    st = child.stat()
                    items.append({"name": child.name, "path": rel_path(child), "type": "dir" if child.is_dir() else "file", "size": st.st_size, "modified": int(st.st_mtime)})
                send_json(self, {"ok": True, "path": rel_path(p), "items": items})
                return

            if parsed.path == "/load":
                rel = query.get("path", [""])[0]
                p = safe_path(rel)
                if not p.exists() or not p.is_file():
                    send_json(self, {"ok": False, "error": "File not found"}, 404)
                    return
                text = p.read_text(encoding="utf-8", errors="replace")
                send_json(self, {"ok": True, "path": rel_path(p), "text": text})
                return

            if parsed.path == "/raw":
                rel = query.get("path", [""])[0]
                p = safe_path(rel)
                if not p.exists() or not p.is_file():
                    send_json(self, {"ok": False, "error": "File not found"}, 404)
                    return
                send_file(self, p)
                return

            if parsed.path == "/txids":
                coin = query.get("coin", [""])[0].strip() or None
                rows = list_txids(coin)
                send_json(self, {"ok": True, "root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS], "coin": coin or "", "transactions": rows})
                return

            if parsed.path == "/tx-index":
                coin = query.get("coin", [""])[0].strip() or None
                force = query.get("force", [""])[0].strip().lower() in ("1", "true", "yes")
                payload = read_or_build_tx_index(coin, force=force)
                payload.update({"root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS]})
                send_json(self, payload)
                return

            if parsed.path == "/reindex":
                coin = query.get("coin", [""])[0].strip() or None
                payload = read_or_build_tx_index(coin, force=True)
                payload.update({"root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS]})
                send_json(self, payload)
                return

            if parsed.path == "/tx":
                txid = query.get("txid", [""])[0]
                coin = query.get("coin", [""])[0].strip() or None
                p = find_tx_file(txid, coin)
                if not p:
                    send_json(self, {"ok": False, "error": "Transaction fixture not found", "txid": txid, "coin": coin or ""}, 404)
                    return
                loaded = read_jsonish(p)
                send_json(self, {"ok": True, "txid": txid.lower(), "coin": coin or "", "path": rel_path(p), "format": loaded["format"], "json": loaded["json"], "text": loaded["text"]})
                return

            if parsed.path == "/ipfs":
                cid = query.get("cid", [""])[0]
                p = find_ipfs_file(cid)
                if not p:
                    send_json(self, {"ok": False, "error": "IPFS fixture not found", "cid": cid}, 404)
                    return
                loaded = read_jsonish(p)
                send_json(self, {"ok": True, "cid": cid, "path": rel_path(p), "format": loaded["format"], "json": loaded["json"], "text": loaded["text"]})
                return

            if parsed.path == "/find-assets":
                txid = query.get("txid", [""])[0]
                cid = query.get("cid", [""])[0]
                send_json(self, {"ok": True, "assets": find_assets(txid=txid, cid=cid)})
                return

            send_json(self, {"ok": False, "error": "Unknown endpoint"}, 404)

        except Exception as e:
            send_json(self, {"ok": False, "error": str(e)}, 500)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length).decode("utf-8")
            body = json.loads(raw) if raw else {}

            if parsed.path == "/save":
                rel = body.get("path", "")
                text = body.get("text", "")
                if not rel:
                    send_json(self, {"ok": False, "error": "Missing path"}, 400)
                    return
                p = safe_path(rel)
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(text, encoding="utf-8")
                send_json(self, {"ok": True, "path": rel_path(p), "size": p.stat().st_size})
                return

            if parsed.path == "/save-tx":
                txid = body.get("txid", "")
                coin = safe_segment(body.get("coin", "unknown"), "unknown")
                payload = body.get("json", None)
                text = body.get("text", "")
                filename_mode = safe_segment(body.get("filenameMode", "base58"), "base58")
                if not is_txid(txid):
                    send_json(self, {"ok": False, "error": "txid must be 64 hex characters"}, 400)
                    return
                txid = str(txid).lower()
                if filename_mode in ("hex", "txid"):
                    filename = txid + ".json"
                else:
                    # Filesystem-safe, shorter than hex, still carries enough hex to eyeball-match explorers.
                    filename = base58_from_hex(txid) + "-" + txid[:12] + ".json"
                p = safe_path("data/transactions/" + coin + "/" + filename)
                p.parent.mkdir(parents=True, exist_ok=True)
                if payload is not None:
                    if isinstance(payload, dict) and not is_txid(payload.get("txid")):
                        payload = dict(payload)
                        payload["txid"] = txid
                    p.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                else:
                    p.write_text(text, encoding="utf-8")
                try:
                    index_file_path().unlink(missing_ok=True)
                except Exception:
                    pass
                send_json(self, {
                    "ok": True,
                    "path": rel_path(p),
                    "size": p.stat().st_size,
                    "txid": txid,
                    "coin": coin,
                    "filename": p.name,
                    "filenameMode": filename_mode
                })
                return

            if parsed.path == "/save-links":
                txid = body.get("txid", "")
                coin = safe_segment(body.get("coin", "unknown"), "unknown")
                payload = body.get("json", body)
                if not is_txid(txid):
                    send_json(self, {"ok": False, "error": "txid must be 64 hex characters"}, 400)
                    return
                filename = str(txid).lower() + "-links.json"
                p = safe_path("data/links/" + coin + "/" + filename)
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                send_json(self, {"ok": True, "path": rel_path(p), "size": p.stat().st_size, "txid": str(txid).lower(), "coin": coin})
                return

            if parsed.path == "/mkdir":
                rel = body.get("path", "")
                if not rel:
                    send_json(self, {"ok": False, "error": "Missing path"}, 400)
                    return
                p = safe_path(rel)
                p.mkdir(parents=True, exist_ok=True)
                send_json(self, {"ok": True, "path": rel_path(p)})
                return

            if parsed.path == "/delete":
                rel = body.get("path", "")
                if not rel:
                    send_json(self, {"ok": False, "error": "Missing path"}, 400)
                    return
                p = safe_path(rel)
                if p.is_dir():
                    send_json(self, {"ok": False, "error": "Refusing to delete directory"}, 400)
                    return
                if p.exists():
                    p.unlink()
                send_json(self, {"ok": True, "path": rel})
                return

            send_json(self, {"ok": False, "error": "Unknown endpoint"}, 404)
        except Exception as e:
            send_json(self, {"ok": False, "error": str(e)}, 500)


def main():
    print(f"chisel-fileproxy running at http://{HOST}:{PORT}")
    print(f"root: {ROOT}")
    print("endpoints: /ping /config /txids /tx-index /reindex /tx /ipfs /find-assets /raw /list /load /save /save-tx")
    HTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
