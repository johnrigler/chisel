#!/usr/bin/env python3

from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import json
import urllib.parse
import os

HOST = "127.0.0.1"
PORT = 7799

ROOT = Path.home() / "chisel-workspace"
ROOT.mkdir(parents=True, exist_ok=True)

def safe_path(user_path):
    user_path = user_path or "."
    candidate = (ROOT / user_path).resolve()

    if not str(candidate).startswith(str(ROOT.resolve())):
        raise ValueError("Path escapes workspace")

    return candidate

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

class Handler(BaseHTTPRequestHandler):
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
                send_json(self, {
                    "ok": True,
                    "service": "chisel-fileproxy",
                    "root": str(ROOT)
                })
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
                    items.append({
                        "name": child.name,
                        "path": str(child.relative_to(ROOT)),
                        "type": "dir" if child.is_dir() else "file",
                        "size": st.st_size,
                        "modified": int(st.st_mtime)
                    })

                send_json(self, {
                    "ok": True,
                    "path": str(p.relative_to(ROOT)),
                    "items": items
                })
                return

            if parsed.path == "/load":
                rel = query.get("path", [""])[0]
                p = safe_path(rel)

                if not p.exists() or not p.is_file():
                    send_json(self, {"ok": False, "error": "File not found"}, 404)
                    return

                text = p.read_text(encoding="utf-8", errors="replace")

                send_json(self, {
                    "ok": True,
                    "path": str(p.relative_to(ROOT)),
                    "text": text
                })
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

                send_json(self, {
                    "ok": True,
                    "path": str(p.relative_to(ROOT)),
                    "size": p.stat().st_size
                })
                return

            if parsed.path == "/mkdir":
                rel = body.get("path", "")

                if not rel:
                    send_json(self, {"ok": False, "error": "Missing path"}, 400)
                    return

                p = safe_path(rel)
                p.mkdir(parents=True, exist_ok=True)

                send_json(self, {
                    "ok": True,
                    "path": str(p.relative_to(ROOT))
                })
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

                send_json(self, {
                    "ok": True,
                    "path": rel
                })
                return

            send_json(self, {"ok": False, "error": "Unknown endpoint"}, 404)

        except Exception as e:
            send_json(self, {"ok": False, "error": str(e)}, 500)

def main():
    print(f"chisel-fileproxy running at http://{HOST}:{PORT}")
    print(f"root: {ROOT}")
    HTTPServer((HOST, PORT), Handler).serve_forever()

if __name__ == "__main__":
    main()
