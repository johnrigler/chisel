# Mogwai Recast

A static HTML composition tool around **one original video and one continuous audio timeline**. No account, server, framework, npm installation, upload or browser encoder is required. All runtime scripts and styles are local; the folder works on IPFS, GitHub Pages or from a local checkout.

Choose a video, press Play, then switch with the buttons or keys **1–4**:

| Key | Layout |
| --- | --- |
| 1 | Full picture, fitted without stretching or cropping. |
| 2 | Picture in the left two-thirds; notes on the right. |
| 3 | Picture in the upper-left two-thirds; notes on the right; image/message below. |
| 4 | Mirror of 3: picture on the right, notes on the left. |

The original video element remains mounted. A layout switch does not assign its source, seek it, pause it or restart its audio. Full screen shows the entire composition, including panels. The original 4:3 image will have letterboxing in a 16:9 composition.

## Timed instructions and images

With **Record layout switches** checked, pressing a layout button adds or updates a cue at the current source time. Edit the notes, bottom message or image, then **Save cue here**. Each cue is a complete snapshot, so instructions can change as the original plays. **Follow saved cues** replays them from the video's playhead, including after seeking. Uncheck it to work on a live draft.

A local PNG, JPEG or WebP can fill the bottom panel, or sit beside its message. Imported images are resized to at most 1600 pixels and embedded in the project JSON. Panels show plain text, with line breaks and wrapping; text that does not fit ends with an ellipsis. They do not execute imported HTML. This version does not export arbitrary HTML/CSS, scrolling effects or animated transitions.

**Save project JSON** keeps the cue sheet and embedded images, without the source video. Keep it beside the original in Daisy; reopening the project asks you to choose that video separately. The **Layout demo** supplies editable timing/layout placeholders, not a transcript or editorial claims about the source.

## FFmpeg export

**Export FFmpeg ZIP** contains:

- `project.json` — output dimensions and ordered timed cues;
- `overlays/000.png`, etc. — full-frame transparent panels;
- `render.py` — a small, inspectable Python standard-library helper;
- `README.txt` — the render command.

Unzip, then run:

```bash
python3 render.py /path/to/apocalypseNewscast.mp4 recast.mp4
```

FFmpeg and ffprobe must be installed. On Termux, the packages are `python` and `ffmpeg`. No Python packages are needed. The source stays outside the ZIP. The output is not allowed to overwrite an existing file.

The renderer changes video size/position with per-frame scale and overlay expressions. It maps the original audio once using **`-map 0:a? -c:a copy`**; it does not cut, concatenate, mix or re-encode it. The output container must support the original audio codec. AAC works in MP4; an incompatible source codec causes FFmpeg to fail rather than silently changing it. Video is re-encoded as H.264. A 480×360 original gains no detail from an HD canvas.

FFmpeg does not interpret HTML. The browser rasterizes the same Canvas panel layer used in the live preview, so fonts, wrapping and images are baked into PNGs before rendering. CSS/HTML can later add another live layer, but arbitrary markup would need a separate browser-capture step for file export.

## Source and validation

The reusable tool belongs to Mogwai; the source media and its cue projects belong to Daisy. The hosted Chisel copy is a static distribution of this folder. Private Daisy media is never copied into the public tool.

```bash
node --test tests/recast.test.mjs
python3 -m unittest discover -s tests -p 'test_recast.py' -v
```

Optional DOM integration testing uses jsdom 26.1.0 from `RECAST_TEST_DEPS`, with no runtime dependency added to the tool. It checks uninterrupted playback across layout changes, cue replay, safe text, portrait full-screen geometry, and offline ZIP generation. FFmpeg integration checks rendered pixels in every layout and exact equality of the encoded audio payload.

`render-source.js` is the browser-downloadable text of `render.py`, so export also works from `file://` without fetching another local file. Regenerate it after changing the renderer:

```bash
python3 tests/test_recast.py --embed
```

Primary filter reference: [FFmpeg scale and overlay documentation](https://www.ffmpeg.org/ffmpeg-filters.html). Original audio mapping uses [FFmpeg stream copy](https://www.ffmpeg.org/ffmpeg.html#Stream-copy).
