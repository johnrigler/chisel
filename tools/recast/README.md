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

## Save into your Daisy working directory

Open **Keep / render → Working directory → Choose working folder**. If you choose the current ISO-year folder, such as `daisy_2026`, Recast checks for this week's two-digit directory and creates it when missing: `daisy_2026/42` on October 17, 2026. If you choose an exact working folder, such as `42` or `daisy_2026-42`, it saves directly there. This preserves the existing weekly Recast records; it does not change Daisy's separate WWD/day directories.

The browser needs explicit directory permission and does not inherit your shell's `$PWD`. Folder access is selected for the current page session. Where the writable directory picker is unavailable, use the existing standalone FileProxy service below. See the [native directory API](https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle).

With a working directory selected:

- **Save project JSON** writes a new dated snapshot, named after the source video.
- **Save FFmpeg render folder** writes a new subdirectory containing `project.json`, `render.py`, `README.txt` and `overlays/*.png`. Run the renderer there with the original video's path; no ZIP extraction is needed.

Snapshot names are whitespace-free and distinct; existing files are not silently replaced. The original video stays where it was selected. No save happens merely by choosing a layout or moving a cue: use the save actions to persist changes. With **Browser downloads** selected, the original JSON/ZIP download actions remain available. A failed directory save reports the error and does not silently download elsewhere. A partially saved render folder is kept with the number of completed files in the error message.

### FileProxy and shell / Termux directories

Register your existing year checkout with the **standalone** `johnrigler/fileProxy` installation:

```bash
cd ~/fileProxy
python3 fp.py add-root daisy2026 "$HOME/daisy_2026"
export FILEPROXY_WRITE_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
python3 fp.py serve
```

Use the service you already run if applicable; do not start a second instance on its port. In Recast, open **Working directory → Use FileProxy / shell directory**. Set the URL (default `http://127.0.0.1:7799`), registered root `daisy2026`, this week's folder `42`, and the local write token, then press **Use FileProxy folder**. The service's existing `/v1/put` creates missing parent directories on save. These fields select an existing registration; the browser cannot register arbitrary absolute shell paths. Chrome may ask to allow local-network access. Use HTTPS for a non-local service.

To save to the exact directory currently selected in your shell instead, register that directory, then use root `work` and leave the week-folder field blank:

```bash
python3 ~/fileProxy/fp.py add-root work "$PWD"
```

The write token remains in page memory, is cleared from its input after connection, and is never put in the project, URLs or browser storage. The client uses the token-protected `/v1/put` route, refuses overwrites, and checks FileProxy's 12 MiB JSON request limit before sending. A large individual panel can use the native folder target or normal ZIP download instead. This does not scan the FileProxy catalog, commit to Git, push to GitHub or pin to IPFS; those remain separate shell operations.

You can create all weekly folders ahead of time. ISO-year 2026 has **53** weeks:

```bash
mkdir -p "$HOME/daisy_2026"/{01..53}
```

This is idempotent and leaves existing contents alone. Git does not track empty directories, so precreating them is a local filesystem step. The per-save workflow does not require precreation. Use ISO year/week (`date +%G`, `date +%V`) in shell helpers so the first days of January stay in the correct year archive.

## Adjust a cue with your thumbs

Tap an existing cue in the cue sheet to select it and pause the preview. Each tap of **Earlier** or **Later** moves that cue by one source frame. Holding a pad begins repeating after 300 ms, at one frame every 80 ms; after one second held, it accelerates to one frame every 30 ms. Releasing or sliding off the pad stops it. The pads suppress the browser's long-press menu, text selection and touch callout. The selected cue stays selected, and its time and frame number appear between the pads. The first cue stays at zero; other cues cannot cross their neighbors or the end of the source. Save the project JSON to keep your adjustments.

For ordinary MP4 files, the tool reads presentation timestamps from the local video index, including reordered H.264 frames and variable frame timing. It reads the timing index without loading the whole video into memory. For other formats or unsupported MP4 edits, choose the actual source FPS in **Frame timing**; fractional rates such as 30000/1001 are supported and remembered in the project. Saved cue timestamps retain their full precision. New cues snap to the containing source frame when frame timing is available.

The preview seeks into the selected frame. Native browser video seeking is best effort; see [video frame callback guidance](https://web.dev/articles/requestvideoframecallback-rvfc). The FFmpeg renderer retains fractional cue precision; its output uses the source average frame rate, so variable-rate sources may repeat or drop frames in the export.

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
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -p 'test_recast.py' -v
```

Optional DOM integration testing uses jsdom 26.1.0 from `RECAST_TEST_DEPS`, with no runtime dependency added to the tool. It checks uninterrupted playback across layout changes, cue replay, thumb taps/holds/releases, cue limits, safe text, portrait full-screen geometry, offline ZIP generation, and native/FileProxy save actions. Storage checks cover ISO-year boundaries, creating/reusing weekly directories, exact binary/UTF-8 HTTP writes, no-overwrite behavior and partial-save reporting. Timing-index tests compare constant- and variable-rate MP4 presentation timestamps with ffprobe. FFmpeg integration checks rendered pixels in every layout, exact fractional-frame cue boundaries, and equality of the encoded audio payload.

`render-source.js` is the browser-downloadable text of `render.py`, so export also works from `file://` without fetching another local file. Regenerate it after changing the renderer:

```bash
python3 tests/test_recast.py --embed
```

Primary filter reference: [FFmpeg scale and overlay documentation](https://www.ffmpeg.org/ffmpeg-filters.html). Original audio mapping uses [FFmpeg stream copy](https://www.ffmpeg.org/ffmpeg.html#Stream-copy).
