#!/usr/bin/env python3
"""Publish crawler-readable Chisel record previews from chisel-record-v1 exports.

Standard library only. Example:
  python3 tools/publish_broadcast.py record.json --site-url https://rigler.org/chisel/ \
      --output-root /srv/www/chisel --category Music --publisher John

Creates /srv/www/chisel/broadcast/<coin>/<txid>/index.html. Deploy the generated
directory to the site named by --site-url. No server-side runtime is required.
"""
import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

COINS = {"litecoin", "litecoinTestnet", "digibyte", "ravencoin",
         "bitcoin", "dogecoin", "ecash", "evm"}
HEX64 = re.compile(r"^(?:0x)?([0-9a-fA-F]{64})$")
YOUTUBE_ID = re.compile(r"^[a-zA-Z0-9_-]{11}$")


def http_url(value):
    if not isinstance(value, str):
        return ""
    parsed = urlparse(value)
    if (parsed.scheme not in {"https", "http"} or not parsed.hostname or
            parsed.username or parsed.password):
        return ""
    return value


def youtube_id(url):
    url = http_url(url)
    if not url:
        return ""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    parts = [part for part in parsed.path.split("/") if part]
    result = ""
    if host in {"youtu.be", "www.youtu.be"} and parts:
        result = parts[0]
    elif host in {"youtube.com", "www.youtube.com", "m.youtube.com",
                  "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"}:
        if parts and parts[0] == "watch":
            result = parse_qs(parsed.query).get("v", [""])[0]
        elif len(parts) >= 2 and parts[0] in {"shorts", "embed", "live", "v"}:
            result = parts[1]
    return result if YOUTUBE_ID.fullmatch(result) else ""


def media_fields(record):
    summary = record.get("summary") or {}
    cards = summary.get("mediaCards")
    card = next((c for c in cards if isinstance(c, dict)), {}) if isinstance(cards, list) else {}
    media = [card.get("url"), summary.get("primaryUrl")]
    title = (card.get("title") or summary.get("title") or
             "Chisel broadcast")
    description = (card.get("description") or card.get("text") or
                   summary.get("opReturnText") or "View this ledger-referenced broadcast on Chisel.")
    image = ""
    for candidate in media:
        vid = youtube_id(candidate)
        if vid:
            image = "https://i.ytimg.com/vi/" + vid + "/hqdefault.jpg"
            break
    if not image:
        image = http_url(card.get("thumbnailUrl") or card.get("imageUrl") or "")
    return str(title)[:180], str(description)[:400], image


def build_page(record, site_url, category="", publisher="", default_image=""):
    if record.get("schema") != "chisel-record-v1":
        raise ValueError("Input must be a chisel-record-v1 JSON export")
    coin = record.get("coin")
    tx_match = HEX64.fullmatch(str(record.get("txid", "")))
    if coin not in COINS or not tx_match:
        raise ValueError("Invalid currency or transaction ID")
    txid = tx_match.group(1).lower()
    site = urlparse(site_url)
    if site.scheme not in {"https", "http"} or not site.hostname or site.query or site.fragment:
        raise ValueError("--site-url must be a public HTTP(S) directory URL")
    base = site_url.rstrip("/") + "/"
    share_url = base + "broadcast/" + coin + "/" + txid + "/"
    # Preserve only the record route fields supported by Chisel. Never send
    # arbitrary exported query parameters or access tokens into a share URL.
    original = urlparse(str(record.get("url") or ""))
    original_qs = parse_qs(original.query)
    route = {"mode": "portal", "coin": coin, "txid": txid}
    if coin == "evm":
        source = original_qs.get("source", [""])[0]
        chain = original_qs.get("chain", [""])[0]
        if source in {"evmGomez", "evmJethro", "evmPolygonThunderword", "other"}:
            route["source"] = source
        if re.fullmatch(r"\d{1,15}", chain):
            route["chain"] = chain
    source_url = http_url(record.get("sourceUrl") or "")
    if source_url:
        source = urlparse(source_url)
        if not source.query and not source.fragment:
            route["data"] = source_url
    target = base + "?" + urlencode(route)
    title, description, image = media_fields(record)
    if not image:
        image = http_url(default_image)
    label = (publisher + " · " if publisher else "") + (category + " · " if category else "") + "Chisel broadcast"
    escape = lambda value: html.escape(str(value), quote=True)
    image_meta = ('<meta property="og:image" content="' + escape(image) + '">\n'
                  '<meta name="twitter:image" content="' + escape(image) + '">\n') if image else ""
    return share_url, """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} | Chisel</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{share}">
<meta property="og:type" content="article">
<meta property="og:url" content="{share}">
<meta property="og:site_name" content="Chisel">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta name="twitter:card" content="{card}">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
{image_meta}<meta name="referrer" content="no-referrer">
<meta http-equiv="refresh" content="0;url={target}">
</head>
<body>
<main>
<h1>{title}</h1>
<p>{label}</p>
<p>{description}</p>
<p><a href="{target}">Open this broadcast in Chisel</a></p>
</main>
<script>location.replace({target_js});</script>
</body>
</html>
""".format(title=escape(title), description=escape(description), share=escape(share_url),
           target=escape(target), target_js=json.dumps(target).replace("<", "\\u003c"),
           card="summary_large_image" if image else "summary", image_meta=image_meta,
           label=escape(label))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("record", type=Path, help="Chisel DOWNLOAD JSON file")
    parser.add_argument("--site-url", required=True, help="Public Chisel directory URL")
    parser.add_argument("--output-root", required=True, type=Path, help="Matching site filesystem root")
    parser.add_argument("--category", default="", help="Music, News, Commentary, etc.")
    parser.add_argument("--publisher", default="", help="Human-readable broadcaster label")
    parser.add_argument("--default-image", default="", help="Absolute URL to fallback social image")
    args = parser.parse_args()
    record = json.loads(args.record.read_text(encoding="utf-8"))
    url, page = build_page(record, args.site_url, args.category,
                           args.publisher, args.default_image)
    parsed = urlparse(url)
    parts = parsed.path.rstrip("/").split("/")
    coin, txid = parts[-2:]
    destination = args.output_root / "broadcast" / coin / txid / "index.html"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(page, encoding="utf-8")
    print(json.dumps({"url": url, "file": str(destination)}, indent=2))


if __name__ == "__main__":
    main()
