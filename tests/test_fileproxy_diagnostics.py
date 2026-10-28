"""The ping endpoint exposes the effective datastore without touching its contents."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import urllib.request
from unittest.mock import patch

PROXY_DIR = Path(__file__).resolve().parents[1] / "tools" / "fileProxy"
sys.path.insert(0, str(PROXY_DIR))


class StorageDiagnosticsTests(unittest.TestCase):
    def load_proxy(self, root, data_root=""):
        environment = {"CHISEL_FILE_ROOT": str(root), "CHISEL_DATA_ROOT": str(data_root)}
        context = patch.dict(os.environ, environment)
        context.start()
        self.addCleanup(context.stop)
        spec = importlib.util.spec_from_file_location("diagnostics_fileproxy", PROXY_DIR / "proxy.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_symlink_reports_both_configured_and_resolved_data_roots(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, data = Path(tmp) / "chisel", Path(tmp) / "chisel-data"
            root.mkdir()
            data.mkdir()
            (root / "data").symlink_to(data, target_is_directory=True)
            proxy = self.load_proxy(root)
            status = proxy.data_storage_status()
            self.assertEqual(status["configured"], str(root / "data"))
            self.assertEqual(status["resolved"], str(data))
            self.assertTrue(status["isSymlink"])
            self.assertTrue(status["isDirectory"])
            self.assertTrue(status["workspaceDataMatches"])
            self.assertEqual(list(data.iterdir()), [], "diagnostics must not create indexes or caches")

    def test_missing_data_link_target_stays_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, missing = Path(tmp) / "chisel", Path(tmp) / "missing-chisel-data"
            root.mkdir()
            (root / "data").symlink_to(missing, target_is_directory=True)
            proxy = self.load_proxy(root)
            status = proxy.data_storage_status()
            self.assertFalse(status["exists"])
            self.assertFalse(status["isDirectory"])
            self.assertTrue(status["isSymlink"])
            self.assertFalse(missing.exists())

    def test_explicit_environment_root_can_disagree_with_workspace_link(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, active, alternate = [Path(tmp) / name for name in ("chisel", "chisel-data", "chisel_data")]
            for path in (root, active, alternate):
                path.mkdir()
            (root / "data").symlink_to(alternate, target_is_directory=True)
            proxy = self.load_proxy(root, active)
            status = proxy.data_storage_status()
            self.assertEqual(status["source"], "CHISEL_DATA_ROOT")
            self.assertEqual(status["resolved"], str(active))
            self.assertEqual(status["workspaceDataResolved"], str(alternate))
            self.assertFalse(status["workspaceDataMatches"])

    def test_environment_alias_spelling_is_preserved_before_resolution(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, data, alias = [Path(tmp) / name for name in ("chisel", "chisel-data", "chisel_data")]
            root.mkdir()
            data.mkdir()
            alias.symlink_to(data, target_is_directory=True)
            proxy = self.load_proxy(root, alias)
            status = proxy.data_storage_status()
            self.assertEqual(status["configured"], str(alias))
            self.assertEqual(status["resolved"], str(data))
            self.assertTrue(status["isSymlink"])

    def test_ping_preserves_service_health_and_includes_missing_storage(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, missing = Path(tmp) / "chisel", Path(tmp) / "missing"
            root.mkdir()
            proxy = self.load_proxy(root, missing)
            server = proxy.HTTPServer(("127.0.0.1", 0), proxy.Handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with urllib.request.urlopen("http://127.0.0.1:" + str(server.server_port) + "/ping", timeout=5) as response:
                    self.assertEqual(response.status, 200)
                    payload = json.load(response)
                self.assertTrue(payload["ok"])
                self.assertEqual(payload["service"], "chisel-fileproxy")
                self.assertFalse(payload["storage"]["exists"])
                self.assertEqual(payload["storage"]["resolved"], str(missing))
                self.assertFalse(missing.exists())
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
