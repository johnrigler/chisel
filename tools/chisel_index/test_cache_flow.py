#!/usr/bin/env python3

import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
import urllib.request


HERE = Path(__file__).resolve().parent
INDEXER_SPEC = importlib.util.spec_from_file_location("cache_flow_indexer", HERE / "indexer.py")
INDEXER = importlib.util.module_from_spec(INDEXER_SPEC)
INDEXER_SPEC.loader.exec_module(INDEXER)

TXID = "8" * 64
LEGACY_TXID = "9" * 64


def raw_transaction(block_time):
    return {
        "txid": TXID,
        "height": 4312345,
        "blockhash": "a" * 64,
        "blocktime": block_time,
        "vin": [],
        "vout": [{"n": 0, "value": 0, "scriptPubKey": {"asm": "OP_RETURN 48656c6c6f"}}],
    }


def make_legacy_jist(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE txs(chain TEXT, txid TEXT, block_height INTEGER, block_hash TEXT, time INTEGER, "
        "vin_count INTEGER, vout_count INTEGER, source TEXT, created_at INTEGER, PRIMARY KEY(chain,txid))"
    )
    conn.execute(
        "INSERT INTO txs VALUES (?,?,?,?,?,?,?,?,?)",
        ("ravencoin", LEGACY_TXID, 23003500, "", 1771459200, 0, 0, "suspect-fixture", 1),
    )
    conn.commit()
    conn.close()


class CacheFlowTests(unittest.TestCase):
    def test_legacy_jist_is_quarantined_by_default(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp) / "data"
            tx_path = data / "transactions/ravencoin/tx.json"
            tx_path.parent.mkdir(parents=True)
            tx_path.write_text(json.dumps(raw_transaction(1777953600)), encoding="utf-8")
            make_legacy_jist(data / "jist/rvn.sqlite3")

            safe = INDEXER.rebuild_index(data)
            self.assertEqual(safe["counts"]["transactions"], 1)
            self.assertFalse(safe["legacyJistIncluded"])

            explicit = INDEXER.rebuild_index(data, include_legacy_jist=True)
            self.assertEqual(explicit["counts"]["transactions"], 2)
            self.assertTrue(explicit["legacyJistIncluded"])
            legacy_result = INDEXER.search_index(LEGACY_TXID, data, include_legacy_jist=True)
            self.assertIn(LEGACY_TXID, {row.get("txid") for row in legacy_result["results"]})

            safe_result = INDEXER.search_index(LEGACY_TXID, data)
            self.assertNotIn(LEGACY_TXID, {row.get("txid") for row in safe_result["results"]})

    def test_fileproxy_save_then_single_reindex_corrects_sqlite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "project"
            data = Path(tmp) / "data"
            root.mkdir()
            data.mkdir()
            (root / "data").symlink_to(data, target_is_directory=True)

            old_root = os.environ.get("CHISEL_FILE_ROOT")
            old_data = os.environ.get("CHISEL_DATA_ROOT")
            os.environ["CHISEL_FILE_ROOT"] = str(root)
            os.environ["CHISEL_DATA_ROOT"] = str(data)
            try:
                proxy_path = HERE.parent / "fileProxy/proxy.py"
                spec = importlib.util.spec_from_file_location("cache_flow_proxy", proxy_path)
                proxy = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(proxy)
                server = proxy.HTTPServer(("127.0.0.1", 0), proxy.Handler)
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                base = "http://127.0.0.1:" + str(server.server_port)
                try:
                    first = self.post_json(base + "/save-tx", {
                        "txid": TXID,
                        "coin": "ravencoin",
                        "json": raw_transaction(1777953600),
                        "filenameMode": "txid",
                        "refreshIndex": False,
                    })
                    self.assertTrue(first["indexRefresh"]["deferred"])
                    self.assertFalse((data / "index/chisel.sqlite3").exists())

                    with urllib.request.urlopen(base + "/reindex", timeout=20) as response:
                        indexed = json.load(response)
                    self.assertTrue(indexed["sqlite"]["ok"])
                    self.assertFalse(indexed["sqlite"]["legacyJistIncluded"])
                    self.assertEqual(indexed["sqlite"]["counts"]["transactions"], 1, indexed)
                    self.assertEqual(self.sqlite_integrity(data), "ok")
                    self.assertEqual(self.sqlite_block_time(data), 1777953600, self.sqlite_rows(data))

                    loaded = json.load(urllib.request.urlopen(base + "/tx?coin=ravencoin&txid=" + TXID, timeout=20))
                    self.assertEqual(loaded["json"]["blocktime"], 1777953600)

                    self.post_json(base + "/save-tx", {
                        "txid": TXID,
                        "coin": "ravencoin",
                        "json": raw_transaction(1777957200),
                        "filenameMode": "txid",
                        "refreshIndex": True,
                    })
                    self.assertEqual(self.sqlite_block_time(data), 1777957200)
                finally:
                    server.shutdown()
                    server.server_close()
                    thread.join()
            finally:
                if old_root is None:
                    os.environ.pop("CHISEL_FILE_ROOT", None)
                else:
                    os.environ["CHISEL_FILE_ROOT"] = old_root
                if old_data is None:
                    os.environ.pop("CHISEL_DATA_ROOT", None)
                else:
                    os.environ["CHISEL_DATA_ROOT"] = old_data

    @staticmethod
    def post_json(url, value):
        request = urllib.request.Request(
            url,
            data=json.dumps(value).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)

    @staticmethod
    def sqlite_block_time(data):
        conn = sqlite3.connect(data / "index/chisel.sqlite3")
        try:
            row = conn.execute(
                "SELECT block_time FROM transactions WHERE chain='ravencoin' AND txid=?",
                (TXID,),
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    @staticmethod
    def sqlite_rows(data):
        conn = sqlite3.connect(data / "index/chisel.sqlite3")
        try:
            return conn.execute("SELECT chain,txid,block_height,block_time,source_path FROM transactions").fetchall()
        finally:
            conn.close()

    @staticmethod
    def sqlite_integrity(data):
        conn = sqlite3.connect(data / "index/chisel.sqlite3")
        try:
            return conn.execute("PRAGMA integrity_check").fetchone()[0]
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
