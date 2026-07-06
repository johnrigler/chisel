#!/usr/bin/env python3

from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import base64
import hashlib
import html
import json
import mimetypes
import os
import re
import tarfile
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
DATA_LINK = ROOT / "data"
try:
    DATA_LINK_TARGET = DATA_LINK.resolve()
    if DATA_LINK.is_symlink() and DATA_LINK_TARGET not in EXTRA_DATA_ROOTS:
        EXTRA_DATA_ROOTS.append(DATA_LINK_TARGET)
except Exception:
    pass
LEGACY_SOURCE_ROOTS = _split_roots(os.environ.get("CHISEL_LEGACY_ROOTS", ""))
try:
    if ROOT.parent not in LEGACY_SOURCE_ROOTS:
        LEGACY_SOURCE_ROOTS.append(ROOT.parent)
except Exception:
    pass

ALLOWED_ROOTS = [ROOT] + EXTRA_DATA_ROOTS
ALLOWED_SOURCE_ROOTS = ALLOWED_ROOTS + LEGACY_SOURCE_ROOTS

TXID_RE = set("0123456789abcdefABCDEF")
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
JSON_EXTS = ["", ".json", ".txt"]
KNOWN_COINS = {"digibyte", "ravencoin", "raven", "rvn", "litecoin", "litecointestnet", "bitcoin", "bitcointestnet3", "bitcointestnet4", "dogecoin", "doge", "polygon", "matic", "evm", "unknown"}
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


def strip_0x(value):
    text = str(value or "").strip()
    if text.lower().startswith("0x"):
        text = text[2:]
    return text.lower()


def is_evm_hash(value):
    return is_txid(strip_0x(value))


def first_present(*values):
    for value in values:
        if value is not None and value != "":
            return value
    return None


def coerce_unix_time(value):
    if value is None or value == "":
        return None
    try:
        n = float(value)
    except Exception:
        try:
            from email.utils import parsedate_to_datetime
            n = parsedate_to_datetime(str(value)).timestamp()
        except Exception:
            return None
    if n <= 0:
        return None
    if n > 1000000000000:
        n = n / 1000
    return int(n)


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
    user_path = str(user_path or ".").strip()
    if user_path.startswith("data-root:"):
        rel = user_path[len("data-root:"):].lstrip("/\\")
        for data_root in EXTRA_DATA_ROOTS:
            candidate = (data_root / rel).resolve()
            if _is_under(candidate, data_root):
                return candidate
        raise ValueError("data-root path requested but CHISEL_DATA_ROOT does not allow it")

    raw = Path(user_path).expanduser()
    candidate = raw.resolve() if raw.is_absolute() else (ROOT / raw).resolve()
    if not is_allowed_path(candidate):
        raise ValueError("Path escapes workspace; set CHISEL_DATA_ROOT for external transaction stores")
    return candidate


def is_allowed_source_path(path):
    return any(_is_under(path, allowed) for allowed in ALLOWED_SOURCE_ROOTS)


def safe_source_path(user_path):
    if not user_path:
        raise ValueError("Missing legacy source path")
    raw = Path(str(user_path)).expanduser()
    candidate = raw.resolve() if raw.is_absolute() else (ROOT / raw).resolve()
    if not is_allowed_source_path(candidate):
        raise ValueError("Legacy source path escapes allowed roots; set CHISEL_LEGACY_ROOTS to the directory containing easyBase")
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


def data_path(*parts):
    rel = Path(*[str(part).strip("/\\") for part in parts if str(part).strip("/\\")])
    for data_root in EXTRA_DATA_ROOTS:
        candidate = (data_root / rel).resolve()
        if _is_under(candidate, data_root):
            return candidate
    return safe_path(str(Path("data") / rel))


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
    bases = ["txids", "data/transactions", "data-bundled/transactions", "transactions"]
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
        elif not coin and any((data_root / name).exists() for name in ("digibyte", "litecoin", "ravencoin", "dogecoin")):
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
                        return normalize_coin_name(candidate)
    parent = normalize_coin_name(safe_segment(resolved.parent.name))
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
            candidate = strip_0x(value.get(key))
            if is_txid(candidate):
                return candidate
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


def unique_strings(values):
    seen = set()
    out = []
    for value in values or []:
        text = str(value or "").strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def htmlish_to_text(value):
    text = str(value or "")
    text = re.sub(r"<\s*br\s*/?\s*>", " ", text, flags=re.I)
    text = re.sub(r"<\s*/?\s*[a-z][^>]*>", " ", text, flags=re.I)
    text = re.sub(r'https?://[^\s\'"<>]+', " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def extract_urls_from_text(value):
    text = str(value or "")
    found = []
    for match in re.findall(r'https?://[^\s\'"<>]+', text, flags=re.I):
        found.append(match.rstrip("),.;"))
    return unique_strings(found)


def html_attr_urls(value):
    text = html.unescape(str(value or ""))
    found = []
    # Good HTML: href="..." or src="...". Also tolerates the old Gomez oddities.
    for match in re.findall(r'''(?is)\b(?:href|src)\s*=\s*(?:["\'])?([^"\'\s>]+)''', text):
        found.append(match.strip())
    # Malformed forms such as <a href=<iframe ... src="https://..."> are rescued here.
    return unique_strings([u.rstrip("),.;") for u in found if u.lower().startswith(("http://", "https://"))])


def extract_all_urls(value):
    text = str(value or "")
    return unique_strings(html_attr_urls(text) + extract_urls_from_text(html.unescape(text)))


def extract_anchor_texts(value):
    text = html.unescape(str(value or ""))
    out = []
    for match in re.findall(r'''(?is)<a\b[^>]*>(.*?)</a>''', text):
        cleaned = htmlish_to_text(match)
        if cleaned:
            out.append(cleaned)
    return unique_strings(out)


def youtube_id_from_url(url):
    u = html.unescape(str(url or "")).strip()
    patterns = [
        r'''(?i)(?:youtube\.com|youtube-nocookie\.com)/embed/([A-Za-z0-9_-]{6,})''',
        r'''(?i)(?:youtube\.com|youtube-nocookie\.com)/shorts/([A-Za-z0-9_-]{6,})''',
        r'''(?i)(?:youtube\.com|youtube-nocookie\.com)/live/([A-Za-z0-9_-]{6,})''',
        r'''(?i)(?:youtu\.be/)([A-Za-z0-9_-]{6,})''',
        r'''(?i)[?&]v=([A-Za-z0-9_-]{6,})''',
    ]
    for pat in patterns:
        m = re.search(pat, u)
        if m:
            return m.group(1)
    return ""


def seconds_from_time_code(value):
    text = str(value or "")
    if not text:
        return ""
    if text.isdigit():
        return text
    total = 0
    matched = False
    for number, unit in re.findall(r'''(\d+)([hms])''', text, flags=re.I):
        matched = True
        n = int(number)
        unit = unit.lower()
        if unit == "h":
            total += n * 3600
        elif unit == "m":
            total += n * 60
        else:
            total += n
    return str(total) if matched else ""


def youtube_start_from_url(url):
    u = html.unescape(str(url or ""))
    for pat in (r'''[?&]start=(\d+)''', r'''[?&]t=([0-9hms]+)'''):
        m = re.search(pat, u, flags=re.I)
        if m:
            return seconds_from_time_code(m.group(1))
    return ""


def normalize_media_url(url):
    u = html.unescape(str(url or "")).strip().rstrip("),.;")
    if not u:
        return ""
    vid = youtube_id_from_url(u)
    if vid:
        start = youtube_start_from_url(u)
        return "https://www.youtube.com/watch?v=" + vid + (("&t=" + start + "s") if start else "")
    m = re.search(r'''(?i)open\.spotify\.com/embed/(track|album|playlist|episode|show)/([A-Za-z0-9]+)''', u)
    if m:
        return "https://open.spotify.com/" + m.group(1).lower() + "/" + m.group(2)
    return u


def media_kind_for_url(url):
    u = str(url or "").lower()
    if youtube_id_from_url(u):
        return "youtube"
    if "open.spotify.com" in u:
        return "spotify"
    if "archive.org" in u:
        return "archive"
    if "voca.ro" in u or "vocaroo.com" in u:
        return "audio"
    if re.search(r'''\.(mp3|flac|wav|ogg|m4a)(?:[?#].*)?$''', u):
        return "audio"
    return "link"


def youtube_thumbnail_url(video_id, quality="hqdefault"):
    vid = str(video_id or "").strip()
    if not vid:
        return ""
    q = quality if quality in {"default", "mqdefault", "hqdefault", "sddefault", "maxresdefault"} else "hqdefault"
    return "https://i.ytimg.com/vi/" + vid + "/" + q + ".jpg"


def build_media_cards(raw_values, words=None, overrides=None):
    words = [w for w in unique_strings(words or []) if w]
    raw_text = "\n".join(str(x or "") for x in raw_values or [] if x is not None)
    anchor_texts = extract_anchor_texts(raw_text)
    urls = extract_all_urls(raw_text)
    cards = []
    for index, url in enumerate(urls):
        normalized = normalize_media_url(url)
        kind = media_kind_for_url(url)
        video_id = youtube_id_from_url(url)
        title = ""
        if index < len(anchor_texts):
            title = anchor_texts[index]
        if not title:
            title = " | ".join(words[:3]) if words else normalized
        card = {
            "kind": kind,
            "url": normalized,
            "sourceUrl": url,
            "title": title,
            "text": htmlish_to_text(raw_text)[:900],
        }
        if video_id:
            card["videoId"] = video_id
            card["thumbnailUrl"] = youtube_thumbnail_url(video_id)
        cards.append(card)
    overrides = overrides if isinstance(overrides, dict) else {}
    override_cards = overrides.get("mediaCards") if isinstance(overrides.get("mediaCards"), list) else []
    for item in override_cards:
        if isinstance(item, dict):
            cards.append(item)
    deduped = []
    seen = set()
    for card in cards:
        url = str(card.get("url") or card.get("sourceUrl") or "")
        key = (card.get("kind", "link"), url.lower())
        if not url or key in seen:
            continue
        seen.add(key)
        deduped.append(card)
    return deduped


def evm_media_overrides():
    path = (EXTRA_DATA_ROOTS[0] if EXTRA_DATA_ROOTS else (ROOT / "data")) / "overrides" / "evm-media-overrides.json"
    if not path.exists():
        return {}
    try:
        loaded = read_jsonish(path).get("json")
    except Exception:
        return {}
    if isinstance(loaded, dict):
        return loaded
    return {}


def override_for_evm_record(txid, words=None):
    overrides = evm_media_overrides()
    if not isinstance(overrides, dict):
        return {}
    by_hash = overrides.get("byHash") if isinstance(overrides.get("byHash"), dict) else {}
    key = strip_0x(txid).lower()
    for candidate in (key, "0x" + key):
        item = by_hash.get(candidate)
        if isinstance(item, dict):
            return item
    by_word = overrides.get("byWord") if isinstance(overrides.get("byWord"), dict) else {}
    for word in words or []:
        item = by_word.get(str(word).lower())
        if isinstance(item, dict):
            return item
    return {}


def evm_address_word(address):
    clean = strip_0x(address)
    if len(clean) != 40 or not re.fullmatch(r"[0-9a-fA-F]{40}", clean):
        return ""
    try:
        raw = bytes.fromhex(clean)
    except Exception:
        return ""
    if b"\x00" in raw:
        raw = raw.split(b"\x00", 1)[0]
    if not raw:
        return ""
    if any(b < 32 or b > 126 for b in raw):
        return ""
    text = raw.decode("ascii", errors="ignore").strip()
    if len(text) < 2 or not re.search(r"[A-Za-z]", text):
        return ""
    return text


def evm_tx_from_jsonish(value):
    if not isinstance(value, dict):
        return None
    tx = value.get("tx") if isinstance(value.get("tx"), dict) else value
    if isinstance(tx, dict) and is_evm_hash(tx.get("hash")):
        return tx
    if is_evm_hash(value.get("hash")):
        return value
    return None


def evm_summary_title(value, tx):
    if isinstance(value, dict):
        summary = value.get("summary") if isinstance(value.get("summary"), dict) else {}
        decoded = value.get("decoded") if isinstance(value.get("decoded"), dict) else {}
        for candidate in (summary.get("title"), decoded.get("message"), decoded.get("text"), decoded.get("body"), decoded.get("artifact")):
            text = htmlish_to_text(candidate)
            if text:
                return text[:160]
    fn = str(tx.get("functionName") or "").strip()
    if fn:
        return fn.split("(")[0] or fn
    method = str(tx.get("methodId") or "").strip()
    if method and method != "0x":
        return "EVM " + method
    if not str(tx.get("to") or "").strip() and str(tx.get("contractAddress") or "").strip():
        return "EVM contract deployment"
    return "EVM transaction " + short_txid(strip_0x(tx.get("hash")))


def evm_explorer_url(chain_id, txid):
    clean = strip_0x(txid)
    if not clean:
        return ""
    chain = str(chain_id or "137")
    if chain == "1":
        return "https://etherscan.io/tx/0x" + clean
    if chain == "11155111":
        return "https://sepolia.etherscan.io/tx/0x" + clean
    if chain == "80002":
        return "https://amoy.polygonscan.com/tx/0x" + clean
    return "https://polygonscan.com/tx/0x" + clean


def summarize_evm_tx_json(value, path=None, coin=None, modified=None):
    tx = evm_tx_from_jsonish(value)
    if not tx:
        return None
    txid = strip_0x(tx.get("hash"))
    block_height = None
    try:
        block_height = int(tx.get("blockNumber")) if tx.get("blockNumber") not in (None, "") else None
    except Exception:
        block_height = None
    block_time = coerce_unix_time(first_present(
        tx.get("timeStamp"), tx.get("timestamp"),
        value.get("summary", {}).get("blockTime") if isinstance(value.get("summary"), dict) else None
    )) if isinstance(value, dict) else coerce_unix_time(tx.get("timeStamp"))
    decoded = value.get("decoded") if isinstance(value, dict) and isinstance(value.get("decoded"), dict) else {}
    existing_summary = value.get("summary") if isinstance(value, dict) and isinstance(value.get("summary"), dict) else {}
    url_sources = [
        existing_summary.get("primaryUrl"), existing_summary.get("title"),
        decoded.get("message"), decoded.get("text"), decoded.get("body"), decoded.get("artifact")
    ]
    for item in existing_summary.get("opReturnUrls", []) if isinstance(existing_summary.get("opReturnUrls"), list) else []:
        url_sources.append(item)
    urls = unique_strings([url for source in url_sources for url in extract_all_urls(source)])
    receivers = decoded.get("receivers") if isinstance(decoded.get("receivers"), list) else []
    amounts = [str(x) for x in decoded.get("amounts", [])] if isinstance(decoded.get("amounts"), list) else []
    words = []
    if isinstance(decoded.get("words"), list):
        words.extend(decoded.get("words"))
    if decoded.get("artifact"):
        words.append(decoded.get("artifact"))
    for receiver in receivers:
        w = evm_address_word(receiver)
        if w:
            words.append(w)
    words = unique_strings(words)
    record_override = override_for_evm_record(txid, words)
    media_cards = build_media_cards(url_sources, words, record_override)
    if record_override.get("words") and isinstance(record_override.get("words"), list):
        words = unique_strings(words + [str(x) for x in record_override.get("words")])
    clean_text = htmlish_to_text(record_override.get("cleanText") or decoded.get("message") or decoded.get("text") or decoded.get("body") or existing_summary.get("title") or "")
    override_title = htmlish_to_text(record_override.get("title") or "")
    override_url = normalize_media_url(record_override.get("primaryUrl") or record_override.get("url") or "")
    contract = value.get("contract") if isinstance(value, dict) and isinstance(value.get("contract"), dict) else {}
    chain_id = str(value.get("chainId") or contract.get("chainId") or "137") if isinstance(value, dict) else "137"
    assets = value.get("assets") if isinstance(value, dict) and isinstance(value.get("assets"), dict) else {}
    image_assets = assets.get("images") if isinstance(assets.get("images"), list) else []
    first_image = image_assets[0] if image_assets and isinstance(image_assets[0], dict) else {}
    return {
        "txid": txid,
        "hash": "0x" + txid,
        "coin": detect_coin_for_path(path, coin or "evm") if path else safe_segment(coin or "evm"),
        "path": rel_path(Path(path)) if path else "",
        "modified": int(modified or (Path(path).stat().st_mtime if path and Path(path).exists() else time.time())),
        "summary": {
            "txid": txid,
            "hash": "0x" + txid,
            "title": override_title or (media_cards[0].get("title") if media_cards else "") or evm_summary_title(value if isinstance(value, dict) else {}, tx),
            "primaryUrl": override_url or (media_cards[0].get("url") if media_cards else "") or (normalize_media_url(urls[0]) if urls else ""),
            "cleanText": clean_text,
            "mediaCards": media_cards,
            "evmWords": words,
            "evmReceivers": receivers,
            "evmAmounts": amounts,
            "recordKind": decoded.get("kind") or "",
            "lines": 0,
            "imageLines": 0,
            "imageChordLines": [],
            "imageCount": len(image_assets),
            "imageAssetPath": first_image.get("path", ""),
            "imageMime": first_image.get("mime", ""),
            "imageBytes": first_image.get("bytes", 0),
            "ipfsCount": 0,
            "opReturnText": "",
            "opReturnUrls": urls,
            "blockHeight": block_height,
            "blockTime": block_time,
            "methodId": tx.get("methodId") or "",
            "functionName": tx.get("functionName") or "",
            "from": tx.get("from") or "",
            "to": tx.get("to") or "",
            "contractName": contract.get("name") or "",
            "contractAddress": contract.get("address") or tx.get("contractAddress") or tx.get("to") or "",
            "explorerUrl": evm_explorer_url(chain_id, txid)
        }
    }


def evm_contract_slug(chain_id, contract_name, contract_address):
    name = safe_segment(contract_name or "contract", "contract")
    address = strip_0x(contract_address)
    if address and len(address) >= 8:
        return name + "-0x" + address[:12]
    return name


def evm_tx_filename(txid, filename_mode):
    clean = strip_0x(txid)
    if not is_txid(clean):
        raise ValueError("txid must be 64 hex characters")
    if filename_mode in ("hex", "txid"):
        return clean + ".json"
    return base58_from_hex(clean) + "-" + clean[:12] + ".json"


def evm_tx_save_path(txid, chain_id, contract_name, contract_address, filename_mode="base58"):
    chain = safe_segment(chain_id or "unknown-chain", "unknown-chain")
    contract = evm_contract_slug(chain, contract_name, contract_address)
    filename = evm_tx_filename(txid, filename_mode)
    return safe_path("data/transactions/evm/" + chain + "/" + contract + "/" + filename)


def write_evm_tx_packet(packet, chain_id="", contract_name="", contract_address="", filename_mode="base58"):
    if not isinstance(packet, dict):
        raise ValueError("transaction packet must be a JSON object")
    tx = packet.get("tx") if isinstance(packet.get("tx"), dict) else packet
    txid = strip_0x(packet.get("txid") or packet.get("hash") or tx.get("hash"))
    if not is_txid(txid):
        raise ValueError("txid must be 64 hex characters")
    contract = packet.get("contract") if isinstance(packet.get("contract"), dict) else {}
    c_name = contract_name or contract.get("name") or "contract"
    c_addr = contract_address or contract.get("address") or tx.get("to") or tx.get("contractAddress") or ""
    c_chain = chain_id or packet.get("chainId") or "unknown-chain"
    packet = dict(packet)
    packet["txid"] = txid
    packet["hash"] = packet.get("hash") or ("0x" + txid)
    packet["coin"] = packet.get("coin") or "evm"
    p = evm_tx_save_path(txid, c_chain, c_name, c_addr, filename_mode)
    p.parent.mkdir(parents=True, exist_ok=True)
    try:
        attach_inline_image_asset_to_packet(packet, c_chain, c_name, c_addr)
    except Exception as e:
        packet.setdefault("warnings", []).append("inline image asset save failed: " + str(e))
    p.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return p


def evm_stream_path(chain_id="", contract_name="", contract_address=""):
    chain = safe_segment(chain_id or "unknown-chain", "unknown-chain")
    contract = evm_contract_slug(chain, contract_name or "contract", contract_address or "")
    return data_path("transactions", "evm", chain, contract)


def evm_stream_status(chain_id="", contract_name="", contract_address=""):
    p = evm_stream_path(chain_id, contract_name, contract_address)
    rows = []
    latest_block = 0
    latest_time = 0
    latest_hash = ""
    latest_path = ""
    contract = evm_contract_slug(chain_id or "unknown-chain", contract_name or "contract", contract_address or "")
    if p.exists() and p.is_dir():
        for child in sorted(p.glob("*.json")):
            if child.name.startswith("_"):
                continue
            loaded = read_jsonish(child)
            value = loaded.get("json")
            summary = summarize_evm_tx_json(value, child, "evm", child.stat().st_mtime)
            if not summary:
                continue
            info = summary.get("summary", {})
            try:
                block_height = int(info.get("blockHeight") or 0)
            except Exception:
                block_height = 0
            try:
                block_time = int(info.get("blockTime") or 0)
            except Exception:
                block_time = 0
            row = {
                "txid": summary.get("txid", ""),
                "hash": summary.get("hash", ""),
                "blockNumber": block_height,
                "blockTime": block_time,
                "path": rel_path(child),
                "modified": int(child.stat().st_mtime)
            }
            rows.append(row)
            if block_height > latest_block or (block_height == latest_block and block_time > latest_time):
                latest_block = block_height
                latest_time = block_time
                latest_hash = row["hash"]
                latest_path = row["path"]
    return {
        "ok": True,
        "chainId": str(chain_id or ""),
        "contractName": str(contract_name or ""),
        "contractAddress": str(contract_address or ""),
        "contractSlug": contract,
        "directory": rel_path(p),
        "exists": p.exists() and p.is_dir(),
        "count": len(rows),
        "latestBlock": latest_block,
        "nextStartBlock": latest_block + 1 if latest_block else 0,
        "latestTime": latest_time,
        "latestHash": latest_hash,
        "latestPath": latest_path
    }


def evm_contract_stream_dirs(chain_id="", contract_name="", contract_address=""):
    out = []
    seen = set()
    if contract_name or contract_address:
        candidates = [evm_stream_path(chain_id or "137", contract_name or "contract", contract_address or "")]
    else:
        candidates = []
        for root in [ROOT] + EXTRA_DATA_ROOTS:
            for base in (root / "data" / "transactions" / "evm", root / "transactions" / "evm"):
                if not base.exists():
                    continue
                if chain_id:
                    chain_root = base / safe_segment(chain_id)
                    if chain_root.exists():
                        candidates.extend([p for p in chain_root.iterdir() if p.is_dir()])
                else:
                    for chain_root in base.iterdir():
                        if chain_root.is_dir():
                            candidates.extend([p for p in chain_root.iterdir() if p.is_dir()])
    for p in candidates:
        try:
            rp = p.resolve()
            if not rp.exists() or not rp.is_dir() or not is_allowed_path(rp):
                continue
            key = str(rp)
            if key in seen:
                continue
            seen.add(key)
            out.append(rp)
        except Exception:
            continue
    return out


def evm_image_manifest_for_stream(chain_id, stream_dir):
    slug = stream_dir.name
    for root in [ROOT] + EXTRA_DATA_ROOTS:
        for base in (root / "data" / "assets" / "evm", root / "assets" / "evm"):
            mp = base / safe_segment(chain_id or "137") / slug / "images" / "_image-manifest.json"
            try:
                if mp.exists() and mp.is_file() and is_allowed_path(mp.resolve()):
                    loaded = read_jsonish(mp).get("json")
                    if isinstance(loaded, dict):
                        loaded.setdefault("images", [])
                        return loaded
            except Exception:
                continue
    return {"ok": True, "images": [], "contractSlug": slug, "chainId": str(chain_id or "")}


def evm_image_lookup(manifest):
    by_hash = {}
    by_block_pos = {}
    for image in manifest.get("images", []) if isinstance(manifest, dict) else []:
        if not isinstance(image, dict):
            continue
        h = strip_0x(image.get("hash"))
        if h:
            by_hash[h] = image
        try:
            bp = (int(image.get("blockNumber") or 0), int(image.get("transactionIndex") or 0))
            if bp != (0, 0):
                by_block_pos[bp] = image
        except Exception:
            pass
    return by_hash, by_block_pos


def attach_catalog_image_to_summary(row, tx_value, image):
    if not isinstance(row, dict) or not isinstance(image, dict):
        return row
    summary = row.get("summary") if isinstance(row.get("summary"), dict) else {}
    summary["imageCount"] = max(int(summary.get("imageCount") or 0), 1)
    summary["imageAssetPath"] = summary.get("imageAssetPath") or image.get("path", "")
    summary["imageMime"] = summary.get("imageMime") or image.get("mime", "")
    summary["imageBytes"] = summary.get("imageBytes") or image.get("bytes", 0)
    summary["imageWidth"] = summary.get("imageWidth") or image.get("width", 0)
    summary["imageHeight"] = summary.get("imageHeight") or image.get("height", 0)
    summary["imageAssetId"] = summary.get("imageAssetId") or image.get("assetId", "")
    row["summary"] = summary
    row["imageAsset"] = image
    if isinstance(tx_value, dict):
        assets = tx_value.get("assets") if isinstance(tx_value.get("assets"), dict) else {}
        images = assets.get("images") if isinstance(assets.get("images"), list) else []
        if not any(isinstance(x, dict) and x.get("assetId") == image.get("assetId") for x in images):
            images.append(image)
            assets["images"] = images
            tx_value["assets"] = assets
    return row


def evm_local_catalog(chain_id="", contract_name="", contract_address="", limit=0):
    rows = []
    streams = []
    for stream_dir in evm_contract_stream_dirs(chain_id, contract_name, contract_address):
        chain = stream_dir.parent.name
        slug = stream_dir.name
        manifest = evm_image_manifest_for_stream(chain, stream_dir)
        image_by_hash, image_by_block_pos = evm_image_lookup(manifest)
        stream_count = 0
        for child in sorted(stream_dir.glob("*.json")):
            if child.name.startswith("_"):
                continue
            loaded = read_jsonish(child)
            value = loaded.get("json")
            row = summarize_evm_tx_json(value, child, "evm", child.stat().st_mtime)
            if not row:
                continue
            tx = evm_tx_from_jsonish(value) or {}
            info = row.get("summary", {})
            h = strip_0x(row.get("hash") or row.get("txid") or tx.get("hash"))
            image = image_by_hash.get(h)
            if not image:
                try:
                    image = image_by_block_pos.get((int(info.get("blockHeight") or tx.get("blockNumber") or 0), int(tx.get("transactionIndex") or 0)))
                except Exception:
                    image = None
            if image:
                attach_catalog_image_to_summary(row, value, image)
            row["stream"] = {
                "chainId": chain,
                "contractSlug": slug,
                "contractName": info.get("contractName") or (slug.split("-0x", 1)[0] if "-0x" in slug else slug),
                "contractAddress": info.get("contractAddress") or contract_address or "",
                "directory": rel_path(stream_dir)
            }
            rows.append(row)
            stream_count += 1
            if limit and len(rows) >= limit:
                break
        streams.append({
            "chainId": chain,
            "contractSlug": slug,
            "directory": rel_path(stream_dir),
            "transactions": stream_count,
            "images": len(manifest.get("images", [])) if isinstance(manifest, dict) else 0
        })
        if limit and len(rows) >= limit:
            break
    rows.sort(key=lambda row: (-int(row.get("summary", {}).get("blockTime") or row.get("modified") or 0), -int(row.get("summary", {}).get("blockHeight") or 0), row.get("txid") or ""))
    return {
        "ok": True,
        "kind": "chisel-evm-local-catalog",
        "chainId": str(chain_id or ""),
        "contractName": str(contract_name or ""),
        "contractAddress": str(contract_address or ""),
        "count": len(rows),
        "streams": streams,
        "transactions": rows
    }



def image_mime_ext(data):
    if not data:
        return "", ""
    if len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png", "png"
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "image/jpeg", "jpg"
    if len(data) >= 6 and data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif", "gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    stripped = data[:256].lstrip().lower()
    if stripped.startswith(b"<svg"):
        return "image/svg+xml", "svg"
    return "", ""


def png_dimensions(data):
    if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    return None, None


def jpeg_dimensions(data):
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        return None, None
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xff:
            i += 1
            continue
        marker = data[i + 1]
        i += 2
        if marker in (0xd8, 0xd9):
            continue
        if i + 2 > len(data):
            break
        size = int.from_bytes(data[i:i + 2], "big")
        if size < 2 or i + size > len(data):
            break
        if marker in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
            if i + 7 <= len(data):
                return int.from_bytes(data[i + 5:i + 7], "big"), int.from_bytes(data[i + 3:i + 5], "big")
        i += size
    return None, None


def image_dimensions(data, mime):
    if mime == "image/png":
        return png_dimensions(data)
    if mime == "image/jpeg":
        return jpeg_dimensions(data)
    return None, None


def decode_legacy_gomez_image_from_input(input_hex):
    clean = strip_0x(input_hex)
    if not clean or len(clean) <= 8 + (32 * 20):
        return None
    payload = clean[8 + (32 * 20):]
    final = []
    i = 0
    while i + 1 < len(payload):
        target = payload[i:i + 2].lower()
        nxt = payload[i + 2:i + 4].lower()
        if target == "c2":
            i += 2
            continue
        if target == "c3" and len(nxt) == 2:
            if nxt[0] == "8":
                final.append("c" + nxt[1])
            elif nxt[0] == "9":
                final.append("d" + nxt[1])
            elif nxt[0] == "a":
                final.append("e" + nxt[1])
            elif nxt[0] == "b":
                final.append("f" + nxt[1])
            else:
                i += 2
                continue
            i += 4
            continue
        if target and re.fullmatch(r"[0-9a-f]{2}", target):
            final.append(target)
        i += 2
    if not final:
        return None
    try:
        data = bytes.fromhex("".join(final))
    except Exception:
        return None
    mime, ext = image_mime_ext(data)
    if not mime:
        return None
    return {"data": data, "mime": mime, "extension": ext, "decoder": "legacy-gomez-c2-c3-repair"}


def evm_image_asset_dir(chain_id, contract_name, contract_address):
    chain = safe_segment(chain_id or "unknown-chain", "unknown-chain")
    contract = evm_contract_slug(chain, contract_name or "contract", contract_address or "")
    return data_path("assets", "evm", chain, contract, "images")


def evm_image_manifest_path(chain_id, contract_name, contract_address):
    return evm_image_asset_dir(chain_id, contract_name, contract_address) / "_image-manifest.json"


def read_evm_image_manifest(chain_id, contract_name, contract_address):
    mp = evm_image_manifest_path(chain_id, contract_name, contract_address)
    if mp.exists():
        loaded = read_jsonish(mp).get("json")
        if isinstance(loaded, dict):
            loaded.setdefault("images", [])
            return loaded
    return {
        "ok": True,
        "kind": "chisel-evm-image-catalog",
        "chainId": str(chain_id or ""),
        "contractName": str(contract_name or ""),
        "contractAddress": str(contract_address or ""),
        "contractSlug": evm_contract_slug(chain_id or "unknown-chain", contract_name or "contract", contract_address or ""),
        "generated": int(time.time()),
        "images": []
    }


def write_evm_image_manifest(chain_id, contract_name, contract_address, manifest):
    mp = evm_image_manifest_path(chain_id, contract_name, contract_address)
    mp.parent.mkdir(parents=True, exist_ok=True)
    manifest = dict(manifest)
    manifest["generated"] = int(time.time())
    manifest["count"] = len(manifest.get("images", []))
    mp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return mp


def find_evm_tx_by_block_pos(chain_id, contract_name, contract_address, block_number, transaction_index):
    try:
        target_block = int(block_number)
        target_pos = int(transaction_index)
    except Exception:
        return None, None
    root = evm_stream_path(chain_id, contract_name, contract_address)
    if not root.exists() or not root.is_dir():
        return None, None
    for child in root.glob("*.json"):
        if child.name.startswith("_"):
            continue
        value = read_jsonish(child).get("json")
        tx = evm_tx_from_jsonish(value)
        if not tx:
            continue
        try:
            b = int(tx.get("blockNumber") or 0)
            i = int(tx.get("transactionIndex") or -1)
        except Exception:
            continue
        if b == target_block and i == target_pos:
            return child, tx.get("hash") or ("0x" + strip_0x(value.get("txid") if isinstance(value, dict) else ""))
    return None, None


def attach_image_asset_to_tx(tx_path, asset):
    if not tx_path or not Path(tx_path).exists():
        return False
    loaded = read_jsonish(tx_path)
    packet = loaded.get("json")
    if not isinstance(packet, dict):
        return False
    assets = packet.get("assets") if isinstance(packet.get("assets"), dict) else {}
    images = assets.get("images") if isinstance(assets.get("images"), list) else []
    asset_id = asset.get("assetId")
    images = [row for row in images if isinstance(row, dict) and row.get("assetId") != asset_id]
    images.append(asset)
    assets["images"] = images
    packet["assets"] = assets
    summary = packet.get("summary") if isinstance(packet.get("summary"), dict) else {}
    summary["imageAssetPath"] = asset.get("path", "")
    summary["imageMime"] = asset.get("mime", "")
    summary["imageBytes"] = asset.get("bytes", 0)
    summary["imageCount"] = len(images)
    packet["summary"] = summary
    tx_path.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return True


def write_evm_image_asset(data, chain_id="137", contract_name="gomez", contract_address="", block_number=0, transaction_index=0, source=None, tx_path=None, attach=True):
    mime, ext = image_mime_ext(data)
    if not mime:
        raise ValueError("Decoded bytes are not a supported image")
    chain = safe_segment(chain_id or "137", "137")
    block = int(block_number or 0)
    pos = int(transaction_index or 0)
    asset_id = chain + "_" + str(block) + "_" + str(pos)
    out_dir = evm_image_asset_dir(chain, contract_name, contract_address)
    out_dir.mkdir(parents=True, exist_ok=True)
    image_path = out_dir / (asset_id + "." + ext)
    meta_path = out_dir / (asset_id + ".json")
    image_path.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    width, height = image_dimensions(data, mime)
    if tx_path is None:
        tx_path, tx_hash = find_evm_tx_by_block_pos(chain, contract_name, contract_address, block, pos)
    else:
        tx_hash = ""
    asset = {
        "assetId": asset_id,
        "chainId": chain,
        "contractName": str(contract_name or ""),
        "contractAddress": str(contract_address or ""),
        "blockNumber": block,
        "transactionIndex": pos,
        "hash": tx_hash or "",
        "mime": mime,
        "extension": ext,
        "bytes": len(data),
        "sha256": sha,
        "width": width,
        "height": height,
        "path": rel_path(image_path),
        "metadataPath": rel_path(meta_path),
        "txPath": rel_path(tx_path) if tx_path else "",
        "source": source or {},
        "imported": int(time.time())
    }
    meta_path.write_text(json.dumps(asset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    manifest = read_evm_image_manifest(chain, contract_name, contract_address)
    images = manifest.get("images") if isinstance(manifest.get("images"), list) else []
    images = [row for row in images if isinstance(row, dict) and row.get("assetId") != asset_id]
    images.append(asset)
    images.sort(key=lambda row: (int(row.get("blockNumber") or 0), int(row.get("transactionIndex") or 0)))
    manifest["images"] = images
    write_evm_image_manifest(chain, contract_name, contract_address, manifest)
    if attach and tx_path:
        attach_image_asset_to_tx(tx_path, asset)
    return asset


def decoded_inline_image_from_packet(packet):
    if not isinstance(packet, dict):
        return None
    decoded = packet.get("decoded") if isinstance(packet.get("decoded"), dict) else {}
    image = decoded.get("image") if isinstance(decoded.get("image"), dict) else {}
    data_text = image.get("data") or image.get("base64") or decoded.get("imageBase64") or ""
    if not data_text:
        return None
    try:
        data = base64.b64decode(str(data_text), validate=False)
    except Exception:
        return None
    mime, ext = image_mime_ext(data)
    if not mime:
        return None
    return data, mime, ext


def attach_inline_image_asset_to_packet(packet, chain_id, contract_name, contract_address):
    inline = decoded_inline_image_from_packet(packet)
    if not inline:
        return None
    tx = packet.get("tx") if isinstance(packet.get("tx"), dict) else {}
    block = int(tx.get("blockNumber") or packet.get("summary", {}).get("blockNumber") or 0)
    pos = int(tx.get("transactionIndex") or packet.get("summary", {}).get("transactionIndex") or 0)
    asset = write_evm_image_asset(
        inline[0], chain_id, contract_name, contract_address, block, pos,
        source={"kind": "evm2-inline-decoded-image", "txHash": packet.get("hash") or tx.get("hash") or ""},
        tx_path=None,
        attach=False
    )
    assets = packet.get("assets") if isinstance(packet.get("assets"), dict) else {}
    images = assets.get("images") if isinstance(assets.get("images"), list) else []
    images = [row for row in images if isinstance(row, dict) and row.get("assetId") != asset.get("assetId")]
    images.append(asset)
    assets["images"] = images
    packet["assets"] = assets
    summary = packet.get("summary") if isinstance(packet.get("summary"), dict) else {}
    summary["imageAssetPath"] = asset.get("path", "")
    summary["imageMime"] = asset.get("mime", "")
    summary["imageBytes"] = asset.get("bytes", 0)
    summary["imageCount"] = len(images)
    packet["summary"] = summary
    return asset


def import_legacy_evm_images_from_directory(source_dir, chain_id="137", contract_name="gomez", contract_address="", dry_run=False):
    source = safe_source_path(source_dir)
    if not source.exists() or not source.is_dir():
        raise ValueError("Legacy source directory not found")
    imported = []
    skipped = []
    image_re = re.compile(r"^(\d+)_(\d+)_(\d+)$")
    json_re = re.compile(r"^(\d+)_(\d+)_(\d+)\.json$")
    for child in sorted(source.iterdir()):
        if not child.is_file():
            continue
        m = image_re.match(child.name)
        data = None
        decoder = "legacy-decoded-file"
        if m:
            data = child.read_bytes()
        else:
            jm = json_re.match(child.name)
            if not jm:
                continue
            m = jm
            value = read_jsonish(child).get("json")
            tx = evm_tx_from_jsonish(value) or (value if isinstance(value, dict) else {})
            decoded = decode_legacy_gomez_image_from_input(tx.get("input") if isinstance(tx, dict) else "")
            if decoded:
                data = decoded.get("data")
                decoder = decoded.get("decoder")
        if not data:
            skipped.append({"name": child.name, "reason": "no image data"})
            continue
        mime, ext = image_mime_ext(data)
        if not mime:
            skipped.append({"name": child.name, "reason": "not an image"})
            continue
        chain, block, pos = m.groups()
        row = {
            "sourcePath": str(child),
            "assetId": chain + "_" + block + "_" + pos,
            "chainId": chain,
            "blockNumber": int(block),
            "transactionIndex": int(pos),
            "mime": mime,
            "bytes": len(data),
            "decoder": decoder
        }
        if not dry_run:
            asset = write_evm_image_asset(data, chain_id or chain, contract_name, contract_address, block, pos, source={"kind": decoder, "sourcePath": str(child)})
            row.update(asset)
        imported.append(row)
    return {"ok": True, "source": str(source), "dryRun": bool(dry_run), "imported": imported, "skipped": skipped, "count": len(imported), "skippedCount": len(skipped)}


def import_legacy_evm_images_from_tar(source_tar, chain_id="137", contract_name="gomez", contract_address="", dry_run=False):
    source = safe_source_path(source_tar)
    if not source.exists() or not source.is_file():
        raise ValueError("Legacy source tar not found")
    imported = []
    skipped = []
    image_re = re.compile(r"(?:^|/)(\d+)_(\d+)_(\d+)$")
    json_re = re.compile(r"(?:^|/)(\d+)_(\d+)_(\d+)\.json$")
    with tarfile.open(source, "r:*") as tf:
        for member in tf.getmembers():
            if not member.isfile():
                continue
            m = image_re.search(member.name)
            jm = json_re.search(member.name)
            if not m and not jm:
                continue
            fh = tf.extractfile(member)
            if not fh:
                continue
            raw = fh.read()
            data = None
            decoder = "legacy-decoded-file"
            if m:
                data = raw
            elif jm:
                m = jm
                try:
                    value = json.loads(raw.decode("utf-8", errors="replace"))
                except Exception:
                    value = None
                tx = evm_tx_from_jsonish(value) or (value if isinstance(value, dict) else {})
                decoded = decode_legacy_gomez_image_from_input(tx.get("input") if isinstance(tx, dict) else "")
                if decoded:
                    data = decoded.get("data")
                    decoder = decoded.get("decoder")
            if not data:
                skipped.append({"name": member.name, "reason": "no image data"})
                continue
            mime, ext = image_mime_ext(data)
            if not mime:
                skipped.append({"name": member.name, "reason": "not an image"})
                continue
            chain, block, pos = m.groups()
            row = {
                "sourcePath": member.name,
                "assetId": chain + "_" + block + "_" + pos,
                "chainId": chain,
                "blockNumber": int(block),
                "transactionIndex": int(pos),
                "mime": mime,
                "bytes": len(data),
                "decoder": decoder
            }
            if not dry_run:
                asset = write_evm_image_asset(data, chain_id or chain, contract_name, contract_address, block, pos, source={"kind": decoder, "sourcePath": member.name, "sourceTar": str(source)})
                row.update(asset)
            imported.append(row)
    return {"ok": True, "source": str(source), "dryRun": bool(dry_run), "imported": imported, "skipped": skipped, "count": len(imported), "skippedCount": len(skipped)}



def normalize_coin_name(value):
    clean = safe_segment(value or "")
    aliases = {
        "dgb": "digibyte",
        "doge": "dogecoin",
        "rvn": "ravencoin",
        "raven": "ravencoin",
        "raven_coin": "ravencoin",
        "raven-coin": "ravencoin",
        "ltc": "litecoin",
        "btc": "bitcoin",
        "polygon": "evm",
        "matic": "evm",
        "eth": "evm",
        "ethereum": "evm"
    }
    return aliases.get(clean, clean)


def ticker_for_coin(value):
    coin = normalize_coin_name(value)
    return {
        "digibyte": "DGB",
        "ravencoin": "RVN",
        "litecoin": "LTC",
        "bitcoin": "BTC",
        "dogecoin": "DOGE",
        "evm": "EVM"
    }.get(coin, coin.upper() if coin else "")


def coin_is_evm(value):
    return normalize_coin_name(value) == "evm"


def coin_from_value(value, fallback=""):
    if isinstance(value, dict):
        for key in ("coin", "ticker", "chain"):
            v = normalize_coin_name(value.get(key))
            if v:
                return v
        tx = value.get("tx") if isinstance(value.get("tx"), dict) else {}
        for key in ("coin", "ticker", "chain"):
            v = normalize_coin_name(tx.get(key))
            if v:
                return v
    return normalize_coin_name(fallback)


def tx_explorer_url(coin, txid):
    clean_coin = safe_segment(coin or "unknown")
    clean_txid = str(txid or "").strip().lower()
    if not is_txid(clean_txid):
        return ""
    if clean_coin in ("dogecoin", "doge"):
        return "https://blockchair.com/dogecoin/transaction/" + clean_txid
    if clean_coin in ("litecoin", "ltc"):
        return "https://litecoinspace.org/tx/" + clean_txid
    if clean_coin in ("digibyte", "dgb"):
        return "https://digiexplorer.info/tx/" + clean_txid
    if clean_coin in ("ravencoin", "rvn"):
        return "https://explorer.rvn.zelcore.io/tx/" + clean_txid
    if clean_coin in ("bitcoin", "btc"):
        return "https://mempool.space/tx/" + clean_txid
    return ""


# Best-effort height-to-time fallback for imported UTXO feeds that only contain
# block height. Exact block header timestamps win whenever they are present in
# source JSON. These checkpoints exist only to keep old imports sorted in their
# historical neighborhood instead of at fileProxy import time. Use the hydrate
# helper in tools/bunOven for exact node-derived timestamps.
UTXO_BLOCK_TIME_CHECKPOINTS = {
    "dogecoin": [
        (0, 1386325540),        # genesis neighborhood, 2013-12-06 UTC
        (1000000, 1449583300),
        (2000000, 1510419600),
        (3000000, 1578902400),
        (4000000, 1642779000),
        (5000000, 1706100000),
        (6000000, 1769500000)
    ],
    "ravencoin": [
        (0, 1514999494),        # 2018-01-03 UTC neighborhood
        (1000000, 1575400000),
        (2000000, 1635850000),
        (3000000, 1696400000),
        (4000000, 1757000000)
    ],
    "digibyte": [
        (0, 1389388390),
        (5000000, 1460200000),
        (10000000, 1525300000),
        (15000000, 1590400000),
        (20000000, 1655600000),
        (25000000, 1720800000)
    ],
    "litecoin": [
        (0, 1317972665),
        (1000000, 1452400000),
        (2000000, 1590300000),
        (3000000, 1728000000)
    ],
    "bitcoin": [
        (0, 1231006505),
        (300000, 1399700000),
        (600000, 1573500000),
        (900000, 1749000000)
    ]
}


def estimate_utxo_block_time(coin, height):
    clean_coin = normalize_coin_name(coin or "")
    try:
        h = int(height)
    except Exception:
        return 0
    if h <= 0:
        return 0
    points = UTXO_BLOCK_TIME_CHECKPOINTS.get(clean_coin) or []
    if not points:
        return 0
    points = sorted(points)
    if h <= points[0][0]:
        h0, t0 = points[0]
        h1, t1 = points[1]
    elif h >= points[-1][0]:
        h0, t0 = points[-2]
        h1, t1 = points[-1]
    else:
        h0, t0, h1, t1 = points[0][0], points[0][1], points[-1][0], points[-1][1]
        for idx in range(len(points) - 1):
            a_h, a_t = points[idx]
            b_h, b_t = points[idx + 1]
            if a_h <= h <= b_h:
                h0, t0, h1, t1 = a_h, a_t, b_h, b_t
                break
    if h1 == h0:
        return int(t0)
    return int(t0 + ((h - h0) * (t1 - t0) / (h1 - h0)))


def best_utxo_block_time(coin, height, *candidates):
    exact = coerce_unix_time(first_present(*candidates))
    if exact:
        return exact, False
    estimated = estimate_utxo_block_time(coin, height)
    return estimated, bool(estimated)

def summarize_tx_json(value, path=None, coin=None, modified=None):
    detected_coin = detect_coin_for_path(path, coin) if path else coin_from_value(value, coin or "unknown")
    detected_coin = normalize_coin_name(detected_coin or coin_from_value(value, "unknown")) or "unknown"
    # Do not let a UTXO transaction with a generic `hash`/`input` field fall into
    # the EVM decoder. EVM is only EVM when the path/packet says so, or when the
    # packet is otherwise unknown and the EVM shape is the only strong signal.
    if coin_is_evm(detected_coin):
        evm_summary = summarize_evm_tx_json(value, path, "evm", modified)
        if evm_summary:
            return evm_summary
    elif detected_coin == "unknown":
        evm_summary = summarize_evm_tx_json(value, path, "", modified)
        if evm_summary:
            return evm_summary
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
    block_time_estimated = False
    existing_summary = value.get("summary") if isinstance(value, dict) and isinstance(value.get("summary"), dict) else {}
    if isinstance(tx, dict):
        status = tx.get("status") if isinstance(tx.get("status"), dict) else {}
        block_height = first_present(existing_summary.get("blockHeight"), existing_summary.get("block_height"), status.get("block_height"), status.get("blockHeight"), tx.get("block_height"), tx.get("blockHeight"), tx.get("blockheight"), tx.get("height"))
        block_time, block_time_estimated = best_utxo_block_time(
            detected_coin,
            block_height,
            existing_summary.get("blockTime"), existing_summary.get("block_time"), existing_summary.get("time"), existing_summary.get("timestamp"),
            status.get("block_time"), status.get("blockTime"), status.get("time"), status.get("timestamp"),
            tx.get("block_time"), tx.get("blockTime"), tx.get("blocktime"), tx.get("time"), tx.get("timestamp")
        )
    return {
        "txid": txid,
        "coin": detected_coin,
        "ticker": ticker_for_coin(detected_coin),
        "path": rel_path(Path(path)) if path else "",
        "modified": int(modified or (Path(path).stat().st_mtime if path and Path(path).exists() else time.time())),
        "summary": {
            "txid": txid,
            "coin": detected_coin,
            "ticker": ticker_for_coin(detected_coin),
            "title": title,
            "primaryUrl": urls[0] if urls else "",
            "lines": len(lines),
            "imageLines": image_lines,
            "imageChordLines": image_line_values,
            "ipfsCount": 0,
            "opReturnText": op_texts[0] if op_texts else "",
            "opReturnUrls": urls,
            "blockHeight": block_height,
            "blockTime": block_time,
            "blockTimeEstimated": block_time_estimated,
            "explorerUrl": tx_explorer_url(detected_coin, txid)
        }
    }


def index_file_path():
    # The normal Chisel datastore is data/index. In some portable release
    # tarballs, data is a symlink to the user's long-lived datastore. If that
    # symlink is not available on the current machine, fall back to the bundled
    # read-only seed index so Portal can still show the included Dogecoin import.
    try:
        bundled = ROOT / "data-bundled" / "index" / "transactions.index.json"
        if DATA_LINK.is_symlink() and not DATA_LINK_TARGET.exists() and bundled.exists():
            return safe_path("data-bundled/index/transactions.index.json")
    except Exception:
        pass
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
            detected_coin = normalize_coin_name(detect_coin_for_path(p, coin))
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
                rows = [row for row in rows if normalize_coin_name(row.get("coin")) == normalize_coin_name(coin)]
            return {"ok": True, "cached": True, "path": rel_path(idx), "coin": coin or "", "transactions": rows}
        except Exception:
            pass
    rows = build_tx_index(coin=None)
    idx.parent.mkdir(parents=True, exist_ok=True)
    payload = {"ok": True, "generated": int(time.time()), "transactions": rows}
    idx.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if coin:
        rows = [row for row in rows if normalize_coin_name(row.get("coin")) == normalize_coin_name(coin)]
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
            detected_coin = normalize_coin_name(detect_coin_for_path(p, coin))
            out.append({
                "txid": txid_value,
                "coin": detected_coin,
                "ticker": ticker_for_coin(detected_coin),
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


def parse_jist_feed_text(text):
    rows = []
    errors = []
    stripped = str(text or "").strip()
    if not stripped:
        return rows, errors
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, list):
            return [row for row in parsed if isinstance(row, dict)], errors
        if isinstance(parsed, dict):
            data = parsed.get("rows") or parsed.get("outputs") or parsed.get("transactions")
            if isinstance(data, list):
                return [row for row in data if isinstance(row, dict)], errors
    except Exception:
        pass
    for lineno, line in enumerate(stripped.splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
            if isinstance(row, dict):
                rows.append(row)
            elif isinstance(row, list):
                rows.extend([item for item in row if isinstance(item, dict)])
        except Exception as e:
            errors.append({"line": lineno, "error": str(e), "text": line[:160]})
    return rows, errors


def tx_packet_from_jist_rows(txid, rows, coin="dogecoin"):
    clean_txid = str(txid or "").lower()
    coin = normalize_coin_name(coin or "dogecoin") or "dogecoin"
    grouped = sorted(rows or [], key=lambda row: int(row.get("n") or 0))
    vout = []
    lines = []
    heights = []
    block_times = []
    scores = []
    flags = []
    words = []
    for row in grouped:
        addr = str(row.get("address") or row.get("scriptpubkey_address") or "")
        amount = str(row.get("amount_coin") or row.get("value") or "0")
        script_type = str(row.get("script_type") or row.get("scriptpubkey_type") or "unknown")
        try:
            n = int(row.get("n") or 0)
        except Exception:
            n = 0
        if addr:
            lines.append(addr)
            decoded = decode_mac_address_line(addr)
            if decoded:
                words.append(decoded)
        try:
            if row.get("block_height") not in (None, ""):
                heights.append(int(row.get("block_height")))
        except Exception:
            pass
        row_time = coerce_unix_time(first_present(
            row.get("block_time"), row.get("blockTime"), row.get("blocktime"),
            row.get("confirmed_at"), row.get("confirmedAt"), row.get("timestamp"), row.get("time")
        ))
        if row_time:
            block_times.append(row_time)
        try:
            scores.append(int(row.get("score") or 0))
        except Exception:
            pass
        flags.extend([flag for flag in str(row.get("flags") or "").split("|") if flag])
        spk = {"asm": "", "hex": "", "type": script_type, "address": addr, "addresses": [addr] if addr else []}
        vout.append({
            "n": n,
            "value": amount,
            "scriptpubkey_address": addr,
            "scriptpubkey_type": script_type,
            "scriptPubKey": spk,
            "chisel_jist": row
        })
    height = max(heights) if heights else None
    block_time = max(block_times) if block_times else 0
    block_time_estimated = False
    if not block_time and height is not None:
        block_time = estimate_utxo_block_time(coin, height)
        block_time_estimated = bool(block_time)
    title = words[0] if words else (lines[0] if lines else "transaction " + short_txid(clean_txid))
    packet = {
        "kind": "chisel-jist-transaction",
        "chain": coin,
        "coin": coin,
        "ticker": ticker_for_coin(coin),
        "txid": clean_txid,
        "status": {"confirmed": True},
        "vout": vout,
        "lines": lines,
        "summary": {
            "txid": clean_txid,
            "coin": coin,
            "ticker": ticker_for_coin(coin),
            "title": title,
            "lines": len(lines),
            "imageLines": 0,
            "imageChordLines": [],
            "ipfsCount": 0,
            "opReturnText": "",
            "opReturnUrls": [],
            "blockHeight": height,
            "blockTime": block_time,
            "blockTimeEstimated": block_time_estimated,
            "explorerUrl": tx_explorer_url(coin, clean_txid),
            "source": "bun-jist-jsonl",
            "voutCount": len(vout),
            "scoreMax": max(scores or [0]),
            "flags": sorted(set(flags)),
            "words": words
        },
        "source": {"kind": "bun-jist-jsonl", "rowCount": len(grouped)}
    }
    if height is not None:
        packet["block_height"] = height
        packet["status"]["block_height"] = height
    if block_time:
        packet["block_time"] = block_time
        packet["status"]["block_time"] = block_time
    return packet


def write_jist_feed_rows(rows, coin="dogecoin", mode="merge", source_name="bun-jist-feed"):
    clean_coin = normalize_coin_name(coin or "dogecoin") or "dogecoin"
    tx_dir = data_path("transactions", clean_coin)
    if mode == "replace" and tx_dir.exists():
        for child in tx_dir.glob("*.json"):
            if child.is_file():
                child.unlink()
    tx_dir.mkdir(parents=True, exist_ok=True)
    grouped = {}
    skipped = []
    for index, row in enumerate(rows or []):
        txid = extract_txid(row)
        if not txid:
            skipped.append({"index": index, "error": "missing txid", "row": row})
            continue
        grouped.setdefault(txid, []).append(row)
    saved = []
    for txid, group in grouped.items():
        packet = tx_packet_from_jist_rows(txid, group, clean_coin)
        filename = base58_from_hex(txid) + "-" + txid[:12] + ".json"
        out = tx_dir / filename
        out.write_text(json.dumps(packet, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        saved.append({"txid": txid, "path": rel_path(out), "outputs": len(group), "size": out.stat().st_size})
    stamp = int(time.time())
    import_dir = data_path("imports", clean_coin)
    import_dir.mkdir(parents=True, exist_ok=True)
    raw_path = import_dir / (safe_segment(source_name, "bun-jist-feed") + "-" + str(stamp) + ".jsonl")
    raw_path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in (rows or [])) + "\n", encoding="utf-8")
    chord_dir = data_path("chords", clean_coin)
    chord_dir.mkdir(parents=True, exist_ok=True)
    chord_path = chord_dir / (safe_segment(source_name, "bun-jist-feed") + "-" + str(stamp) + ".chord")
    chord_lines = [clean_coin + "() {"]
    for row in rows or []:
        addr = str(row.get("address") or row.get("scriptpubkey_address") or "")
        amount = str(row.get("amount_coin") or row.get("value") or "0")
        if addr:
            chord_lines.append("  : " + addr + " " + amount + ";")
    chord_lines.append("}")
    chord_path.write_text("\n".join(chord_lines) + "\n", encoding="utf-8")
    try:
        index_file_path().unlink(missing_ok=True)
    except Exception:
        pass
    index_payload = read_or_build_tx_index(force=True)
    return {
        "ok": True,
        "coin": clean_coin,
        "mode": mode,
        "rows": len(rows or []),
        "txids": len(grouped),
        "saved": saved,
        "savedCount": len(saved),
        "skipped": skipped,
        "skippedCount": len(skipped),
        "feedPath": rel_path(raw_path),
        "chordPath": rel_path(chord_path),
        "indexPath": index_payload.get("path", "")
    }


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
                coin = normalize_coin_name(query.get("coin", [""])[0].strip()) or None
                rows = list_txids(coin)
                send_json(self, {"ok": True, "root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS], "coin": coin or "", "transactions": rows})
                return

            if parsed.path == "/tx-index":
                coin = normalize_coin_name(query.get("coin", [""])[0].strip()) or None
                force = query.get("force", [""])[0].strip().lower() in ("1", "true", "yes")
                payload = read_or_build_tx_index(coin, force=force)
                payload.update({"root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS]})
                send_json(self, payload)
                return

            if parsed.path == "/evm-stream-status":
                chain_id = query.get("chainId", query.get("chain_id", [""]))[0].strip()
                contract_name = query.get("contractName", query.get("contract_name", [""]))[0].strip()
                contract_address = query.get("contractAddress", query.get("contract_address", [""]))[0].strip()
                payload = evm_stream_status(chain_id, contract_name, contract_address)
                payload.update({"root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS]})
                send_json(self, payload)
                return

            if parsed.path == "/evm-local-catalog":
                chain_id = query.get("chainId", query.get("chain_id", [""]))[0].strip()
                contract_name = query.get("contractName", query.get("contract_name", [""]))[0].strip()
                contract_address = query.get("contractAddress", query.get("contract_address", [""]))[0].strip()
                try:
                    limit = int(query.get("limit", ["0"])[0] or 0)
                except Exception:
                    limit = 0
                payload = evm_local_catalog(chain_id, contract_name, contract_address, limit=limit)
                payload.update({"root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS]})
                send_json(self, payload)
                return

            if parsed.path == "/evm-image-catalog":
                chain_id = query.get("chainId", query.get("chain_id", ["137"]))[0].strip()
                contract_name = query.get("contractName", query.get("contract_name", ["gomez"]))[0].strip()
                contract_address = query.get("contractAddress", query.get("contract_address", [""]))[0].strip()
                payload = read_evm_image_manifest(chain_id, contract_name, contract_address)
                payload.update({"root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS]})
                send_json(self, payload)
                return

            if parsed.path == "/reindex":
                coin = normalize_coin_name(query.get("coin", [""])[0].strip()) or None
                payload = read_or_build_tx_index(coin, force=True)
                payload.update({"root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS]})
                send_json(self, payload)
                return

            if parsed.path == "/tx":
                txid = query.get("txid", [""])[0]
                coin = normalize_coin_name(query.get("coin", [""])[0].strip()) or None
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

            if parsed.path == "/import-jist-feed":
                coin = safe_segment(body.get("coin", "dogecoin"), "dogecoin")
                mode = safe_segment(body.get("mode", "merge"), "merge")
                if mode not in ("merge", "replace"):
                    mode = "merge"
                text = body.get("text", "")
                source_name = body.get("sourceName", body.get("source", "bun-jist-feed"))
                if not text and body.get("path"):
                    source_path = safe_path(body.get("path"))
                    if not source_path.exists() or not source_path.is_file():
                        send_json(self, {"ok": False, "error": "feed path not found"}, 404)
                        return
                    text = source_path.read_text(encoding="utf-8", errors="replace")
                    source_name = source_name or source_path.stem
                if not text and isinstance(body.get("rows"), list):
                    rows = [row for row in body.get("rows") if isinstance(row, dict)]
                    errors = []
                else:
                    rows, errors = parse_jist_feed_text(text)
                payload = write_jist_feed_rows(rows, coin=coin, mode=mode, source_name=source_name)
                payload["parseErrors"] = errors
                payload["parseErrorCount"] = len(errors)
                send_json(self, payload, 200 if not errors else 207)
                return

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
                coin = normalize_coin_name(body.get("coin", "unknown")) or "unknown"
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

            if parsed.path == "/import-legacy-evm-images":
                chain_id = str(body.get("chainId", body.get("chain_id", "137"))).strip() or "137"
                contract_name = str(body.get("contractName", body.get("contract_name", "gomez"))).strip() or "gomez"
                contract_address = str(body.get("contractAddress", body.get("contract_address", ""))).strip()
                source_dir = str(body.get("sourceDir", body.get("source_dir", ""))).strip()
                source_tar = str(body.get("sourceTar", body.get("source_tar", ""))).strip()
                dry_run = bool(body.get("dryRun", body.get("dry_run", False)))
                if source_tar:
                    payload = import_legacy_evm_images_from_tar(source_tar, chain_id, contract_name, contract_address, dry_run)
                elif source_dir:
                    payload = import_legacy_evm_images_from_directory(source_dir, chain_id, contract_name, contract_address, dry_run)
                else:
                    send_json(self, {"ok": False, "error": "sourceDir or sourceTar is required"}, 400)
                    return
                payload.update({"root": str(ROOT), "data_roots": [str(p) for p in EXTRA_DATA_ROOTS]})
                try:
                    index_file_path().unlink(missing_ok=True)
                except Exception:
                    pass
                send_json(self, payload)
                return

            if parsed.path == "/save-evm-tx":
                packet = body.get("json", body.get("transaction", body))
                chain_id = body.get("chainId", body.get("chain_id", ""))
                contract_name = body.get("contractName", body.get("contract_name", ""))
                contract_address = body.get("contractAddress", body.get("contract_address", ""))
                filename_mode = safe_segment(body.get("filenameMode", "base58"), "base58")
                p = write_evm_tx_packet(packet, chain_id, contract_name, contract_address, filename_mode)
                try:
                    index_file_path().unlink(missing_ok=True)
                except Exception:
                    pass
                send_json(self, {
                    "ok": True,
                    "path": rel_path(p),
                    "directory": rel_path(p.parent),
                    "size": p.stat().st_size,
                    "txid": extract_txid(packet),
                    "coin": "evm",
                    "filename": p.name
                })
                return

            if parsed.path == "/save-evm-batch":
                packets = body.get("transactions", [])
                if not isinstance(packets, list):
                    send_json(self, {"ok": False, "error": "transactions must be a list"}, 400)
                    return
                chain_id = body.get("chainId", body.get("chain_id", ""))
                contract_name = body.get("contractName", body.get("contract_name", ""))
                contract_address = body.get("contractAddress", body.get("contract_address", ""))
                filename_mode = safe_segment(body.get("filenameMode", "base58"), "base58")
                saved = []
                errors = []
                first_dir = None
                for i, packet in enumerate(packets):
                    try:
                        p = write_evm_tx_packet(packet, chain_id, contract_name, contract_address, filename_mode)
                        if first_dir is None:
                            first_dir = p.parent
                        saved.append({"txid": extract_txid(packet), "path": rel_path(p), "size": p.stat().st_size})
                    except Exception as e:
                        errors.append({"index": i, "error": str(e)})
                if first_dir is not None:
                    manifest = {
                        "ok": True,
                        "kind": "chisel-evm-split-feed",
                        "chainId": chain_id,
                        "chainName": body.get("chainName", ""),
                        "contractName": contract_name,
                        "contractAddress": contract_address,
                        "source": body.get("source", {}),
                        "generated": int(time.time()),
                        "saved": saved,
                        "errors": errors
                    }
                    mp = first_dir / "_feed-manifest.json"
                    mp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                try:
                    index_file_path().unlink(missing_ok=True)
                except Exception:
                    pass
                send_json(self, {
                    "ok": len(errors) == 0,
                    "saved": len(saved),
                    "errors": errors,
                    "directory": rel_path(first_dir) if first_dir else "",
                    "manifest": rel_path(first_dir / "_feed-manifest.json") if first_dir else "",
                    "transactions": saved[:25],
                    "truncated": len(saved) > 25
                }, 200 if not errors else 207)
                return

            if parsed.path == "/save-links":
                txid = body.get("txid", "")
                coin = normalize_coin_name(body.get("coin", "unknown")) or "unknown"
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
    print("endpoints: /ping /config /txids /tx-index /evm-stream-status /evm-local-catalog /evm-image-catalog /reindex /tx /ipfs /find-assets /raw /list /load /save /import-jist-feed /save-tx /save-evm-tx /save-evm-batch /import-legacy-evm-images")
    HTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
