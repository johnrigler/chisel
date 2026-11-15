"""Unit tests for Chisel static social preview generation.

Run from the repository root:
    python3 -m unittest discover -s tests -p "test_broadcast_sharing.py"
"""
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "tools" / "publish_broadcast.py"
spec = importlib.util.spec_from_file_location("publish_broadcast", MODULE)
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)

TXID = "a" * 64
RECORD = {
    "schema": "chisel-record-v1",
    "coin": "digibyte",
    "txid": TXID,
    "url": "https://example.org/chisel/?mode=portal&coin=digibyte&txid=" + TXID,
    "summary": {
        "title": "Ledger media",
        "primaryUrl": "https://www.youtube.com/watch?v=F4fQhHBuvc0",
        "mediaCards": [{"title": "Eye in the Sky & <media>",
                        "url": "https://www.youtube.com/watch?v=F4fQhHBuvc0",
                        "description": 'Watch on Chisel, not "YouTube"'}],
    },
}


class BroadcastTests(unittest.TestCase):
    def test_youtube_thumbnail_and_social_preview(self):
        url, page = publisher.build_page(RECORD, "https://example.org/chisel/", "Music", "John")
        self.assertEqual(url, "https://example.org/chisel/broadcast/digibyte/" + TXID + "/")
        self.assertIn("https://i.ytimg.com/vi/F4fQhHBuvc0/hqdefault.jpg", page)
        self.assertIn('name="twitter:card" content="summary_large_image"', page)
        self.assertIn("Eye in the Sky &amp; &lt;media&gt;", page)
        self.assertIn("Watch on Chisel, not &quot;YouTube&quot;", page)
        self.assertIn('href="https://example.org/chisel/?mode=portal&amp;coin=digibyte&amp;txid=', page)

    def test_no_media_degrades_to_text_card(self):
        record = {**RECORD, "summary": {"title": "Plain text"}}
        _, page = publisher.build_page(record, "https://example.org/chisel/")
        self.assertIn('name="twitter:card" content="summary"', page)
        self.assertNotIn('property="og:image"', page)

    def test_invalid_identity_rejected(self):
        with self.assertRaises(ValueError):
            publisher.build_page({**RECORD, "txid": "../../escape"}, "https://example.org/chisel/")

    def test_youtube_rejects_lookalike_host(self):
        self.assertEqual(publisher.youtube_id("https://youtube.com.evil.test/watch?v=F4fQhHBuvc0"), "")

    def test_record_route_does_not_retain_unrelated_query_params(self):
        record = {**RECORD, "url": RECORD["url"] + "&token=secret"}
        _, page = publisher.build_page(record, "https://example.org/chisel/")
        self.assertNotIn("secret", page)

    def test_non_youtube_thumbnail(self):
        record = {**RECORD, "summary": {"mediaCards": [{
            "url": "https://example.org/video.mp4",
            "thumbnailUrl": "https://example.org/preview.png"}]}}
        _, page = publisher.build_page(record, "https://example.org/chisel/")
        self.assertIn('og:image" content="https://example.org/preview.png"', page)


if __name__ == "__main__":
    unittest.main()
