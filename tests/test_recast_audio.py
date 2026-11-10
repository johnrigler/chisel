"""Regression tests for audio-only Recast and transcript-backed video export."""
import importlib.util
import json
import shutil
import struct
import subprocess
import tempfile
import zlib
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1] / "tools" / "recast"
SPEC = importlib.util.spec_from_file_location("recast_renderer", ROOT / "render.py")
recast = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(recast)


def project():
    return {
        "format": "mogwai-recast-v1", "width": 1280, "height": 720,
        "source": {"name": "call.ogg", "kind": "audio"},
        "cues": [{"at": 0, "layout": "full", "right": "", "bottom": "", "image": ""}],
        "transcript": {
            "name": "call.srt", "offset": 0.5,
            "segments": [
                {"start": 1, "end": 3, "text": "Audio starts here.", "highlight": False},
                {"start": 4, "end": 5.5, "text": "This is a highlight.", "highlight": True},
                {"start": 6, "end": 7, "text": "Word aligned", "words": [
                    {"start": 6, "end": 6.5, "text": "Word"},
                    {"start": 6.5, "end": 7, "text": "aligned"},
                ]},
            ],
        },
    }


class RecastAudioTests(unittest.TestCase):
    def test_ass_timestamps_and_highlights(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            self.assertTrue(recast.write_ass(project(), folder, 10))
            content = (folder / "transcript.ass").read_text()
            self.assertIn("Dialogue: 0,0:00:01.50,0:00:03.50,Caption", content)
            self.assertIn("Dialogue: 0,0:00:04.50,0:00:06.00,Highlight", content)
            self.assertIn(r"{\k50}Word", content)
            self.assertFalse(recast.write_ass({**project(), "transcript": None}, folder, 10))

    def test_audio_only_filtergraph_has_no_video_input(self):
        result, output = recast.graph(project(), 10, "30/1", has_video=False, has_captions=True)
        self.assertNotIn("[0:v:0]", result)
        self.assertIn("[background]null[framed]", result)
        self.assertIn("ass=filename=transcript.ass", result)
        self.assertEqual(output, "captioned")


    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg not installed")
    def test_audio_only_end_to_end_mp4(self):
        filters = subprocess.check_output(["ffmpeg", "-hide_banner", "-filters"], text=True, stderr=subprocess.STDOUT)
        if not any(line.split()[1:2] == ["ass"] for line in filters.splitlines() if len(line.split()) > 1):
            self.skipTest("FFmpeg lacks the libass filter")
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder / "overlays").mkdir()
            png = folder / "overlays" / "000.png"
            def chunk(kind, data):
                return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
            width, height = 320, 240
            image = (b"\\x00" + b"\\x00\\x00\\x00\\x00" * width) * height
            png.write_bytes(b"\\x89PNG\\r\\n\\x1a\\n" +
                chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) +
                chunk(b"IDAT", zlib.compress(image)) + chunk(b"IEND", b""))
            source, destination = folder / "input.wav", folder / "output.mp4"
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                "-i", "sine=frequency=450:duration=1.2", "-c:a", "pcm_s16le", str(source)], check=True)
            p = project()
            p["width"], p["height"] = width, height
            p["transcript"]["offset"] = 0
            p["transcript"]["segments"] = [{"start": 0.2, "end": 1, "text": "A spoken caption."}]
            command, script, graph = recast.build_command(p, str(source), str(destination), folder, 1.2,
                                                          "30/1", has_video=False, audio_codec="pcm_s16le")
            script.write_text(graph + "\\n")
            subprocess.run(command, cwd=folder, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_streams",
                                                       "-of", "json", str(destination)], text=True))
            self.assertTrue(any(row["codec_type"] == "video" and row["codec_name"] == "h264" for row in info["streams"]))
            self.assertTrue(any(row["codec_type"] == "audio" and row["codec_name"] == "aac" for row in info["streams"]))
            self.assertGreater(destination.stat().st_size, 1000)

    def test_audio_only_command_transcodes_opus_but_copies_aac(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder / "overlays").mkdir()
            (folder / "overlays" / "000.png").touch()
            opus, _, _ = recast.build_command(project(), "/tmp/call.ogg", "/tmp/call.mp4",
                                               folder, 10, "30/1", has_video=False, audio_codec="opus")
            self.assertIn("-c:a", opus)
            self.assertEqual(opus[opus.index("-c:a") + 1], "aac")
            self.assertEqual(opus[opus.index("-map") + 1], "[captioned]")
            aac, _, _ = recast.build_command(project(), "/tmp/call.m4a", "/tmp/call.mp4",
                                              folder, 10, "30/1", has_video=False, audio_codec="aac")
            self.assertEqual(aac[aac.index("-c:a") + 1], "copy")


if __name__ == "__main__":
    unittest.main()
