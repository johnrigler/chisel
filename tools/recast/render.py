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
        result = f"if(gte(t,{max(0, cue['at'] - 1e-7):.9f}),{value},{result})"
    return result



def ass_time(seconds):
    cs = max(0, round(seconds * 100))
    hours, rem = divmod(cs, 360000)
    minutes, rem = divmod(rem, 6000)
    secs, centis = divmod(rem, 100)
    return f"{hours}:{minutes:02}:{secs:02}.{centis:02}"


def ass_escape(value):
    # Captions are plain text, never user-authored ASS commands.
    return str(value).replace("\\", " ").replace("{", "(").replace("}", ")").replace("\n", " ").replace("\r", " ")


def write_ass(project, folder, duration):
    transcript = project.get("transcript")
    if not transcript or not transcript.get("segments"):
        return False
    width, height = project["width"], project["height"]
    font = max(19, round(width * 36 / 1280))
    margin = max(12, round(height * 30 / 720))
    header = [
        "[Script Info]", "ScriptType: v4.00+", "WrapStyle: 0", "ScaledBorderAndShadow: yes",
        f"PlayResX: {width}", f"PlayResY: {height}", "",
        "[V4+ Styles]",
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
        f"Style: Caption,DejaVu Sans,{font},&H00F5F5F5,&H0074C2F8,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,3,2,0,2,{margin},{margin},{margin},1",
        f"Style: Highlight,DejaVu Sans,{font},&H0074C2F8,&H00F5F5F5,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,3,2,0,2,{margin},{margin},{margin},1",
        "", "[Events]",
        "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ]
    offset = float(transcript.get("offset", 0))
    for segment in transcript["segments"]:
        start, end = float(segment["start"]) + offset, float(segment["end"]) + offset
        if end <= 0 or start >= duration:
            continue
        start, end = max(0, start), min(duration, end)
        if end - start < 0.01:
            continue
        style = "Highlight" if segment.get("highlight") else "Caption"
        words = segment.get("words") or []
        if words:
            # ASS karaoke timing follows the supplied word timestamps, never guessed times.
            chunks = []
            cursor = start
            for word in words:
                word_start = max(start, min(end, float(word["start"]) + offset))
                word_end = max(word_start, min(end, float(word["end"]) + offset))
                if word_start > cursor:
                    chunks.append(r"{\k" + str(max(1, round((word_start - cursor) * 100))) + "}")
                chunks.append(r"{\k" + str(max(1, round((word_end - word_start) * 100))) + "}" + ass_escape(word["text"]) + " ")
                cursor = word_end
            content = "".join(chunks).strip()
        else:
            content = ass_escape(segment["text"])
        header.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{content}")
    (folder / "transcript.ass").write_text("\n".join(header) + "\n", encoding="utf-8")
    return True


def graph(project, duration, rate, has_video=True, has_captions=False):
    width, height, cues = project["width"], project["height"], project["cues"]
    rectangles = [geometry(c["layout"], width, height) for c in cues]
    x, y, w, h = [expression(cues, [r[i] for r in rectangles]) for i in range(4)]
    filters = [
        f"color=c=0x10151c:s={width}x{height}:r={rate}:d={duration:.6f}[background]",
    ]
    if has_video:
        filters.extend([
            f"[0:v:0]setpts=PTS-STARTPTS,scale=w='{w}':h='{h}':eval=frame:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,setsar=1[picture]",
            f"[background][picture]overlay=x='{x}+({w}-overlay_w)/2':y='{y}+({h}-overlay_h)/2':eval=frame:shortest=1[framed]",
        ])
    else:
        filters.append("[background]null[framed]")
    current = "framed"
    for i, cue in enumerate(cues):
        end = cues[i + 1]["at"] if i + 1 < len(cues) else duration + 1
        target = f"panel{i}"
        filters.append(f"[{current}][{i+1}:v:0]overlay=0:0:enable='gte(t,{max(0, cue['at'] - 1e-7):.9f})*lt(t,{max(0, end - 1e-7):.9f})':shortest=1[{target}]")
        current = target
    if has_captions:
        filters.append(f"[{current}]ass=filename=transcript.ass[captioned]")
        current = "captioned"
    return ";\n".join(filters), current


def build_command(project, source, destination, folder, duration, rate, has_video=True, audio_codec=None):
    validate(project)
    has_captions = write_ass(project, folder, duration)
    filtergraph, output = graph(project, duration, rate, has_video=has_video, has_captions=has_captions)
    script = folder / "filtergraph.txt"
    command = ["ffmpeg", "-hide_banner", "-n", "-filter_complex_threads", "1", "-i", str(source)]
    for i in range(len(project["cues"])):
        overlay = folder / "overlays" / f"{i:03d}.png"
        if not overlay.is_file():
            raise ValueError(f"Missing overlay {overlay.name}. Export the FFmpeg ZIP from the browser first.")
        command.extend(["-loop", "1", "-framerate", rate, "-i", str(overlay)])
    command.extend(["-filter_complex_script", str(script), "-map", f"[{output}]"])
    if audio_codec:
        command.extend(["-map", "0:a:0", "-c:a", "copy"] if audio_codec == "aac" else
                       ["-map", "0:a:0", "-c:a", "aac", "-b:a", "192k"])
    else:
        command.append("-an")
    command.extend(["-map_metadata", "0", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "2", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(destination)])
    return command, script, filtergraph


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 2:
        print("Usage: python3 render.py original_audio_or_video recast.mp4", file=sys.stderr)
        return 2
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise ValueError("Install ffmpeg and ffprobe first.")
    folder = Path(__file__).resolve().parent
    project = validate(json.loads((folder / "project.json").read_text(encoding="utf-8")))
    source, destination = (str(Path(name).expanduser().resolve()) for name in args)
    info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", source], text=True))
    video = next((stream for stream in info["streams"] if stream["codec_type"] == "video"), None)
    audio = next((stream for stream in info["streams"] if stream["codec_type"] == "audio"), None)
    if not video and not audio:
        raise ValueError("Source must contain audio or video.")
    duration = float(info["format"].get("duration") or (audio or video).get("duration") or 0)
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Source must have a finite duration.")
    rate = video.get("avg_frame_rate", "30/1") if video else "30/1"
    parts = rate.split("/")
    if len(parts) != 2 or not all(p.isdigit() for p in parts) or not 0 < int(parts[0]) / max(1, int(parts[1])) <= 240 or int(parts[1]) == 0:
        rate = "30/1"
    command, script, filtergraph = build_command(project, source, destination, folder, duration, rate,
                                                has_video=video is not None,
                                                audio_codec=audio.get("codec_name") if audio else None)
    script.write_text(filtergraph + "\n", encoding="utf-8")
    print("Rendering composition. AAC audio is copied; other codecs are encoded for MP4. Source remains untouched.", flush=True)
    return subprocess.call(command, cwd=folder)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError) as error:
        print("Recast: " + str(error), file=sys.stderr)
        sys.exit(1)
