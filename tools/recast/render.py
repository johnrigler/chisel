#!/usr/bin/env python3
"""Render a browser-exported Recast bundle. Standard library + ffmpeg/ffprobe."""
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys

LAYOUTS = {"full", "side", "desk", "right"}


def validate(project):
    if not isinstance(project, dict) or project.get("format") != "mogwai-recast-v1":
        raise ValueError("Not a Mogwai Recast project.")
    width, height = project.get("width"), project.get("height")
    if any(type(n) is not int or n < 240 or n > 3840 or n % 2 for n in (width, height)):
        raise ValueError("Output dimensions must be even integers from 240 to 3840.")
    cues = project.get("cues")
    if not isinstance(cues, list) or not 1 <= len(cues) <= 100:
        raise ValueError("Use 1–100 cues.")
    previous = -1
    for cue in cues:
        at = cue.get("at") if isinstance(cue, dict) else None
        if type(at) not in (int, float) or not math.isfinite(at) or not 0 <= at <= 86400 or at <= previous or cue.get("layout") not in LAYOUTS:
            raise ValueError("Cue times must be finite, increasing, and use a supported layout.")
        previous = at
    if cues[0]["at"] != 0:
        raise ValueError("The first cue must start at 0.")
    return project


def geometry(layout, width, height):
    w, h = width // 3 * 2, height // 3 * 2
    if layout == "full":
        return (0, 0, width, height)
    if layout == "side":
        return (0, 0, w, height)
    if layout == "right":
        return (width - w, 0, w, h)
    return (0, 0, w, h)


def expression(cues, values):
    result = str(values[0])
    for cue, value in zip(cues[1:], values[1:]):
        result = f"if(gte(t,{cue['at']:.3f}),{value},{result})"
    return result


def graph(project, duration, rate):
    width, height, cues = project["width"], project["height"], project["cues"]
    rectangles = [geometry(c["layout"], width, height) for c in cues]
    x, y, w, h = [expression(cues, [r[i] for r in rectangles]) for i in range(4)]
    filters = [
        f"color=c=0x10151c:s={width}x{height}:r={rate}:d={duration:.6f}[background]",
        f"[0:v:0]setpts=PTS-STARTPTS,scale=w='{w}':h='{h}':eval=frame:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,setsar=1[picture]",
        f"[background][picture]overlay=x='{x}+({w}-overlay_w)/2':y='{y}+({h}-overlay_h)/2':eval=frame:shortest=1[framed]",
    ]
    current = "framed"
    for i, cue in enumerate(cues):
        end = cues[i + 1]["at"] if i + 1 < len(cues) else duration + 1
        target = f"panel{i}"
        filters.append(f"[{current}][{i+1}:v:0]overlay=0:0:enable='gte(t,{cue['at']:.3f})*lt(t,{end:.3f})':shortest=1[{target}]")
        current = target
    return ";\n".join(filters), current


def build_command(project, source, destination, folder, duration, rate):
    validate(project)
    filtergraph, output = graph(project, duration, rate)
    script = folder / "filtergraph.txt"
    command = ["ffmpeg", "-hide_banner", "-n", "-filter_complex_threads", "1", "-i", str(source)]
    for i in range(len(project["cues"])):
        overlay = folder / "overlays" / f"{i:03d}.png"
        if not overlay.is_file():
            raise ValueError(f"Missing overlay {overlay.name}. Export the FFmpeg ZIP from the browser first.")
        command.extend(["-loop", "1", "-framerate", rate, "-i", str(overlay)])
    command.extend(["-filter_complex_script", str(script), "-map", f"[{output}]", "-map", "0:a?", "-map_metadata", "0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "2", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", str(destination)])
    return command, script, filtergraph


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 2:
        print("Usage: python3 render.py original.mp4 recast.mp4", file=sys.stderr)
        return 2
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise ValueError("Install ffmpeg and ffprobe first.")
    folder = Path(__file__).resolve().parent
    project = validate(json.loads((folder / "project.json").read_text(encoding="utf-8")))
    source, destination = args
    info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", source], text=True))
    video = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    if not video:
        raise ValueError("This renderer needs a video source; the selected file is audio-only.")
    duration = float(info["format"]["duration"])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Source must have a finite duration.")
    rate = video.get("avg_frame_rate", "30/1")
    parts = rate.split("/")
    if len(parts) != 2 or not all(p.isdigit() for p in parts) or not 0 < int(parts[0]) / max(1, int(parts[1])) <= 240 or int(parts[1]) == 0:
        rate = "30/1"
    command, script, filtergraph = build_command(project, source, destination, folder, duration, rate)
    script.write_text(filtergraph + "\n", encoding="utf-8")
    print("Rendering video layouts; original audio is stream-copied. Existing output files are not overwritten.", flush=True)
    return subprocess.call(command)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        print("Recast: " + str(error), file=sys.stderr)
        sys.exit(1)
