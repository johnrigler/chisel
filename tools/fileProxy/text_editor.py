#!/usr/bin/env python3

from pathlib import Path
import hashlib
import hmac
import os
import shutil


def _truthy(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


class TextEditor:
    """Temporary, single-file HTML editor for fileProxy.

    The feature is off unless CHISEL_TEXT_EDITOR is true and a non-empty
    CHISEL_EDITOR_TOKEN is supplied.  The browser never gets to select an
    arbitrary filesystem path: one server-side allowlisted file is exposed.
    """

    def __init__(self, default_root):
        self.requested = _truthy(os.environ.get("CHISEL_TEXT_EDITOR"))
        self.token = os.environ.get("CHISEL_EDITOR_TOKEN", "")
        self.root = Path(
            os.environ.get("CHISEL_EDITOR_ROOT", str(default_root))
        ).expanduser().resolve()
        self.relative_file = os.environ.get(
            "CHISEL_EDITOR_FILE", "technical-paper.html"
        ).strip().lstrip("/\\")
        self.public_url = os.environ.get("CHISEL_EDITOR_PUBLIC_URL", "").strip()
        self.max_bytes = int(os.environ.get("CHISEL_EDITOR_MAX_BYTES", str(2 * 1024 * 1024)))
        self.backup = _truthy(os.environ.get("CHISEL_EDITOR_BACKUP", "1"))
        self.page_path = Path(__file__).with_name("text-editor.html")
        self.error = ""

        if self.requested and not self.token:
            self.error = "CHISEL_EDITOR_TOKEN is required when CHISEL_TEXT_EDITOR is enabled"
        if self.requested and not self.relative_file:
            self.error = "CHISEL_EDITOR_FILE must name one file"

    @property
    def enabled(self):
        return self.requested and not self.error

    def target(self):
        candidate = (self.root / self.relative_file).resolve()
        if candidate == self.root or self.root not in candidate.parents:
            raise ValueError("Editor file escapes CHISEL_EDITOR_ROOT")
        return candidate

    def authorized(self, headers):
        supplied = str(headers.get("X-Chisel-Editor-Token", ""))
        return bool(self.token) and hmac.compare_digest(supplied, self.token)

    def status_payload(self):
        return {
            "ok": self.enabled,
            "enabled": self.enabled,
            "file": self.relative_file if self.enabled else "",
            "publicUrl": self.public_url if self.enabled else "",
            "error": self.error,
        }

    def send_page(self, handler):
        if not self.enabled:
            handler.send_response(404)
            handler.send_header("Content-Type", "text/plain; charset=utf-8")
            handler.send_header("Cache-Control", "no-store")
            handler.end_headers()
            handler.wfile.write(b"Text editor is disabled.\n")
            return
        data = self.page_path.read_bytes()
        handler.send_response(200)
        handler.send_header("Content-Type", "text/html; charset=utf-8")
        handler.send_header("Content-Length", str(len(data)))
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
        handler.wfile.write(data)

    def load(self, headers):
        if not self.enabled:
            return self.status_payload(), 404
        if not self.authorized(headers):
            return {"ok": False, "error": "Unauthorized"}, 401
        target = self.target()
        if not target.exists() or not target.is_file():
            return {"ok": False, "error": "Editor file not found"}, 404
        raw = target.read_bytes()
        if len(raw) > self.max_bytes:
            return {"ok": False, "error": "Editor file exceeds CHISEL_EDITOR_MAX_BYTES"}, 413
        text = raw.decode("utf-8")
        return {
            "ok": True,
            "file": self.relative_file,
            "text": text,
            "sha256": hashlib.sha256(raw).hexdigest(),
            "size": len(raw),
            "modified": int(target.stat().st_mtime),
            "publicUrl": self.public_url,
        }, 200

    def save(self, headers, body):
        if not self.enabled:
            return self.status_payload(), 404
        if not self.authorized(headers):
            return {"ok": False, "error": "Unauthorized"}, 401

        text = body.get("text")
        expected = str(body.get("expectedSha256", "")).strip().lower()
        if not isinstance(text, str):
            return {"ok": False, "error": "text must be a string"}, 400
        raw = text.encode("utf-8")
        if len(raw) > self.max_bytes:
            return {"ok": False, "error": "Edited file is too large"}, 413

        target = self.target()
        if not target.exists() or not target.is_file():
            return {"ok": False, "error": "Editor file not found"}, 404
        current = target.read_bytes()
        current_sha = hashlib.sha256(current).hexdigest()
        if expected and not hmac.compare_digest(expected, current_sha):
            return {
                "ok": False,
                "error": "File changed on disk; reload before saving",
                "sha256": current_sha,
            }, 409

        if self.backup:
            backup = target.with_name("." + target.name + ".bak")
            shutil.copy2(target, backup)

        temporary = target.with_name("." + target.name + ".tmp")
        try:
            temporary.write_bytes(raw)
            os.replace(temporary, target)
        finally:
            if temporary.exists():
                temporary.unlink()

        return {
            "ok": True,
            "file": self.relative_file,
            "size": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "backup": self.backup,
            "publicUrl": self.public_url,
        }, 200
