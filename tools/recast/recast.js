(function () {
  'use strict';
  const C = window.MogwaiRecast, T = window.MogwaiFrameTiming, X = window.MogwaiTranscript, S = window.MogwaiRecastStorage, $ = id => document.getElementById(id);
  const video = $('video'), canvas = $('overlay');
  const state = { project: C.validate({ format: C.FORMAT, width: 1280, height: 720, source: { name: '' }, cues: [C.emptyCue()] }), draft: C.emptyCue(), active: -1, selected: null, pinned: false, sourceTiming: null, timingPending: false, sourceVersion: 0, url: '', loaded: false, images: new Map(), renderVersion: 0, captionKey: '', transcriptActive: -1 };
  function status(text, error) { $('status').textContent = text; $('status').classList.toggle('error', Boolean(error)); }
  async function run(fn) { try { await fn(); } catch (error) { status(error.message || String(error), true); } }
  function imageFor(data) {
    if (!data) return Promise.resolve(null);
    if (!state.images.has(data)) state.images.set(data, new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Image could not be decoded.')); img.src = data; }));
    return state.images.get(data);
  }
  function positionVideo() {
    const p = state.project, g = C.geometry(state.draft.layout, p.width, p.height), stage = $('stage');
    const areaW = stage.clientWidth || p.width, areaH = stage.clientHeight || p.height, scale = Math.min(areaW / p.width, areaH / p.height);
    const left = (areaW - p.width * scale) / 2, top = (areaH - p.height * scale) / 2;
    Object.assign(canvas.style, { left: left + 'px', top: top + 'px', width: p.width * scale + 'px', height: p.height * scale + 'px' });
    Object.assign(video.style, { left: left + g.video[0] * scale + 'px', top: top + g.video[1] * scale + 'px', width: g.video[2] * scale + 'px', height: g.video[3] * scale + 'px', visibility: state.project.source.kind === 'audio' ? 'hidden' : 'visible' });
  }
  async function paint() {
    const revision = ++state.renderVersion, cue = { ...state.draft }, image = await imageFor(cue.image);
    if (revision !== state.renderVersion) return;
    canvas.width = state.project.width; canvas.height = state.project.height;
    C.render(canvas, cue, image, { audioOnly: state.project.source.kind === 'audio', caption: X.captionAt(state.project.transcript, currentTime()) }); positionVideo();
    canvas.setAttribute('aria-label', [cue.right, cue.bottom].filter(Boolean).join('. ') || 'No text overlay');
    $('mode').textContent = C.layouts[cue.layout];
    document.querySelectorAll('[data-layout]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.layout === cue.layout)));
    $('removeImage').hidden = !cue.image;
  }
  function editors(cue) { $('rightText').value = cue.right; $('bottomText').value = cue.bottom; }
  function renderCues() {
    $('cues').replaceChildren();
    state.project.cues.forEach((cue, index) => {
      const row = document.createElement('div'), jump = document.createElement('button'), remove = document.createElement('button'), at = document.createElement('span');
      row.className = 'cue' + (index === state.active ? ' active' : '') + (index === state.selected ? ' selected' : ''); at.textContent = C.preciseTime(cue.at);
      jump.setAttribute('aria-pressed', String(index === state.selected));
      jump.type = remove.type = 'button'; jump.append(at, document.createTextNode(C.layouts[cue.layout]));
      jump.addEventListener('click', () => selectCue(index));
      remove.textContent = '×'; remove.setAttribute('aria-label', 'Delete cue at ' + C.time(cue.at)); remove.disabled = index === 0;
      remove.addEventListener('click', () => { stopNudge(); state.project.cues.splice(index, 1); if (state.selected === index) { state.selected = null; state.pinned = false; } else if (state.selected > index) state.selected--; state.active = -1; updateClock(); renderCues(); status('Cue removed.'); });
      row.append(jump, remove); $('cues').appendChild(row);
    });
    updateNudge();
  }
  function currentTime() { return state.loaded ? video.currentTime : 0; }
  function renderTranscriptList() {
    const list = $('transcriptList'); list.replaceChildren();
    const transcript = state.project.transcript;
    $('transcriptOffset').disabled = !transcript;
    $('clearTranscript').disabled = !transcript;
    $('suggestHighlights').disabled = !transcript;
    if (!transcript) { $('transcriptInfo').textContent = 'No transcript imported. Segment timestamps are used as provided.'; return; }
    $('transcriptOffset').value = String(transcript.offset);
    $('transcriptInfo').textContent = transcript.name + ' · ' + transcript.segments.length + ' timed lines' +
      (transcript.segments.some(row => row.words?.length) ? ' · word timestamps present' : ' · phrase-level timing');
    const fragment = document.createDocumentFragment();
    transcript.segments.forEach((segment, index) => {
      const row = document.createElement('div'), jump = document.createElement('button'), flag = document.createElement('button');
      row.className = 'transcriptRow'; row.dataset.segment = String(index); row.setAttribute('role', 'listitem');
      jump.type = flag.type = 'button';
      jump.textContent = C.time(segment.start + transcript.offset) + '  ' + segment.text;
      jump.title = 'Seek to transcript line'; jump.addEventListener('click', () => {
        if (!state.loaded) { status('Choose the original recording to seek within it.'); return; }
        video.currentTime = Math.max(0, Math.min(video.duration, segment.start + transcript.offset));
        state.pinned = false; state.active = -1; updateClock();
      });
      flag.textContent = segment.highlight ? '★' : '☆'; flag.title = 'Toggle editorial highlight';
      flag.setAttribute('aria-label', 'Highlight transcript line ' + (index + 1));
      flag.setAttribute('aria-pressed', String(segment.highlight));
      flag.addEventListener('click', () => {
        segment.highlight = !segment.highlight;
        flag.textContent = segment.highlight ? '★' : '☆';
        flag.setAttribute('aria-pressed', String(segment.highlight));
        run(paint); status('Highlight ' + (segment.highlight ? 'added' : 'removed') + '. Save project JSON to keep it.');
      });
      row.append(jump, flag); fragment.appendChild(row);
    });
    list.appendChild(fragment); state.transcriptActive = -1;
  }
  function updateTranscriptPosition(caption) {
    const index = caption ? caption.index : -1;
    if (index === state.transcriptActive) return;
    const previous = $('transcriptList').querySelector('[data-segment="' + state.transcriptActive + '"]');
    if (previous) previous.classList.remove('current');
    const next = $('transcriptList').querySelector('[data-segment="' + index + '"]');
    if (next) next.classList.add('current');
    state.transcriptActive = index;
  }
  function saveCue() {
    const timing = frameTiming(), at = state.pinned && state.selected !== null ? state.project.cues[state.selected].at : timing ? T.floor(timing, currentTime()) : currentTime();
    const cue = { ...state.draft, at };
    const next = C.upsert(state.project.cues, cue);
    state.project = C.validate({ ...state.project, cues: next });
    state.active = C.cueAt(state.project.cues, cue.at).index; state.selected = state.active; state.draft = { ...state.project.cues[state.active] };
    $('follow').checked = true; renderCues(); status('Cue saved at ' + C.preciseTime(state.draft.at) + '.');
  }
  function chooseLayout(layout) {
    state.draft = { ...state.draft, layout }; $('follow').checked = false;
    if ($('record').checked) saveCue();
    else status(C.layouts[layout] + ' · live preview. Save a cue to keep it.');
    run(paint);
  }
  function updateClock() {
    document.body.classList.toggle('adjustingCue', state.pinned && state.selected !== null);
    $('clock').textContent = C.time(currentTime()) + ' / ' + C.time(state.loaded ? video.duration : 0);
    $('seek').value = String(currentTime());
    const caption = X.captionAt(state.project.transcript, currentTime());
    const captionKey = caption ? caption.index + ':' + caption.wordIndex + ':' + caption.segment.highlight : '';
    if (captionKey !== state.captionKey) { state.captionKey = captionKey; run(paint); }
    updateTranscriptPosition(caption);
    if ($('follow').checked && !state.pinned) {
      const found = C.cueAt(state.project.cues, currentTime());
      if (found.index !== state.active) { state.active = found.index; state.draft = { ...found.cue }; editors(found.cue); run(paint); renderCues(); }
    }
  }
  function frameTiming() {
    return $('frameRate').value === 'auto' ? state.sourceTiming : T.manual($('frameRate').value);
  }
  function updateNudge() {
    const cue = state.project.cues[state.selected], timing = frameTiming(), ready = state.loaded && timing && state.selected > 0;
    $('nudgeSelection').textContent = cue ? 'Cue ' + (state.selected + 1) + ' · ' + C.layouts[cue.layout] : 'Tap a cue in the cue sheet.';
    $('nudgeTime').textContent = cue ? C.preciseTime(cue.at) : '—';
    if (cue && timing) {
      const frame = T.indexAt(timing, cue.at);
      $('nudgeFrame').textContent = 'Frame ' + (frame + 1) + (timing.times ? ' / ' + timing.times.length : '') + ' · ' + (timing.fps ? timing.fps.toFixed(3) + ' fps' : 'source timing');
    } else $('nudgeFrame').textContent = state.timingPending ? 'Reading source frames…' : timing ? 'No cue selected' : 'Choose source FPS';
    $('cueEarlier').disabled = !ready || !T.move(state.project.cues, state.selected, -1, timing, video.duration);
    $('cueLater').disabled = !ready || !T.move(state.project.cues, state.selected, 1, timing, video.duration);
    $('nudgeHint').textContent = state.selected === 0 ? 'The first cue stays at 0. Select another cue to adjust it.' : !state.loaded ? 'Choose the source video, then tap a saved cue.' : !timing ? (state.timingPending ? 'Reading MP4 frame timestamps…' : 'Select the source frame rate to enable stepping.') : 'Tap one frame. Hold to move faster. Save project JSON to keep changes.';
  }
  function selectCue(index) {
    stopNudge(); state.selected = index; state.pinned = true; state.active = index;
    const cue = state.project.cues[index], timing = frameTiming();
    state.draft = { ...cue }; editors(cue);
    if (state.loaded) { video.pause(); video.currentTime = timing ? T.previewTime(timing, cue.at, video.duration) : Math.min(cue.at, video.duration); }
    run(paint); renderCues(); updateClock();
    if (typeof window.matchMedia === 'function' && window.matchMedia('(orientation: landscape) and (max-height: 650px)').matches) $('stage').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function nudgeCue(direction) {
    const timing = frameTiming();
    if (!state.loaded || !timing || state.selected === null) return false;
    const move = T.move(state.project.cues, state.selected, direction, timing, video.duration);
    if (!move) return false;
    const index = state.selected, cues = state.project.cues.map((cue, i) => i === index ? { ...cue, at: move.time } : cue);
    state.project = C.validate({ ...state.project, cues }); state.draft = { ...state.draft, at: move.time }; state.active = index; state.pinned = true;
    video.pause(); video.currentTime = T.previewTime(timing, move.time, video.duration);
    editors(state.draft); run(paint); renderCues(); updateClock();
    status('Cue ' + (index + 1) + ' · ' + C.preciseTime(move.time) + ' · frame ' + (move.frame + 1));
    return true;
  }
  let nudgeTimer = null, nudgePointer = null, lastPointer = -Infinity;
  function stopNudge(event) {
    if (event && nudgePointer !== null && event.pointerId !== nudgePointer) return;
    if (nudgePointer !== null) lastPointer = performance.now();
    clearTimeout(nudgeTimer); nudgeTimer = null; nudgePointer = null;
  }
  function bindNudge(id, direction) {
    const button = $(id);
    // Keep a thumb hold in the control instead of opening mobile selection/search UI.
    button.addEventListener('touchstart', event => event.preventDefault(), { passive: false });
    for (const name of ['contextmenu', 'selectstart', 'dragstart']) button.addEventListener(name, event => event.preventDefault());
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || button.disabled) return;
      event.preventDefault(); stopNudge(); nudgePointer = event.pointerId; lastPointer = performance.now();
      if (typeof button.setPointerCapture === 'function') { try { button.setPointerCapture(event.pointerId); } catch (_) {} }
      button.focus({ preventScroll: true });
      if (!nudgeCue(direction)) { stopNudge(); return; }
      const started = performance.now();
      const repeat = () => { if (nudgePointer === null || !nudgeCue(direction)) { stopNudge(); return; } nudgeTimer = setTimeout(repeat, performance.now() - started < 1000 ? 80 : 30); };
      nudgeTimer = setTimeout(repeat, 300);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) button.addEventListener(name, stopNudge);
    button.addEventListener('click', event => { if (event.detail === 0 && performance.now() - lastPointer > 400) nudgeCue(direction); });
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  let workTarget = null;
  function setWorkTarget(target) {
    workTarget = target;
    $('workTarget').textContent = target ? target.label : 'Browser downloads';
    $('useDownloads').hidden = !target;
    $('export').textContent = target ? 'Save FFmpeg render folder' : 'Export FFmpeg ZIP';
    $('workHelp').textContent = target ? 'Project snapshots and render files go here. Existing files are kept.' : 'Choose daisy_' + S.defaults().year + ' to use this week’s folder, or choose an exact working folder.';
  }
  async function saveProject() {
    const target = workTarget, text = JSON.stringify(C.validate(state.project), null, 2) + '\n';
    if (!target) { download(new Blob([text], { type: 'application/json' }), 'recast-project.json'); status('Project JSON downloaded.'); return; }
    const name = S.snapshot(state.project.source.name) + '.json';
    $('saveProject').disabled = true;
    try { await target.write(name, text); status('Project saved: ' + target.label + '/' + name); }
    finally { $('saveProject').disabled = false; }
  }
  async function loadProject(project) {
    const clean = C.validate(project);
    // Decode embedded images before replacing the current project.
    await Promise.all(clean.cues.filter(c => c.image).map(c => imageFor(c.image)));
    stopNudge(); state.project = clean; state.active = -1; state.selected = null; state.pinned = false;
    const rate = clean.source.frameRate || 'auto';
    if (![...$('frameRate').options].some(option => option.value === rate)) { const option = document.createElement('option'); option.value = rate; option.textContent = rate + ' fps'; $('frameRate').appendChild(option); }
    $('frameRate').value = rate; state.draft = { ...clean.cues[0] };
    const size = clean.width + 'x' + clean.height;
    if (![...$('size').options].some(option => option.value === size)) { const option = document.createElement('option'); option.value = size; option.textContent = clean.width + ' × ' + clean.height; $('size').appendChild(option); }
    $('size').value = size; $('follow').checked = true; editors(state.draft); state.captionKey = ''; renderTranscriptList(); updateClock(); renderCues(); await paint();
    status('Project opened. Choose ' + (clean.source.name || 'the source recording') + ' separately.');
  }
  async function exportFiles() {
    const project = C.validate(state.project);
    if (!state.loaded || !Number.isFinite(video.duration) || video.duration <= 0) throw new Error('Choose a playable audio or video source before exporting.');
    const files = [{ name: 'project.json', data: JSON.stringify(project, null, 2) + '\n' }, { name: 'render.py', data: window.RecastRenderPython }];
    const exported = document.createElement('canvas'); exported.width = project.width; exported.height = project.height;
    for (let i = 0; i < project.cues.length; i++) {
      const cue = project.cues[i]; C.render(exported, cue, await imageFor(cue.image), { audioOnly: project.source.kind === 'audio' });
      const blob = await new Promise((resolve, reject) => exported.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed.')), 'image/png'));
      files.push({ name: 'overlays/' + String(i).padStart(3, '0') + '.png', data: new Uint8Array(await blob.arrayBuffer()) });
    }
    files.push({ name: 'README.txt', data: 'Mogwai Recast\\n\\nThe original recording is not included. Keep it separately.\\n\\nInstall Python 3, FFmpeg and ffprobe (including libass subtitle support). In this folder run:\\n\\npython3 render.py "path/to/original.ogg" "recast.mp4"\\n\\nAudio-only and video sources are supported. Timed captions are burned into the video using an ASS subtitle filter.\\nAAC source audio is stream copied; other codecs are encoded to AAC for MP4 compatibility. The original recording is never modified.\\nExisting output files are not overwritten.\\n\\nProject JSON is editable and can be reopened in the static HTML tool.\\nPanels are exported as transparent PNGs.\\nThe original source file and embedded images stay private unless you share them.\\n' });
    return files;
  }
  async function exportPackage() { return C.zip(await exportFiles()); }
  $('source').addEventListener('change', () => run(async () => {
    const file = $('source').files[0]; if (!file) return;
    stopNudge(); state.sourceTiming = null; state.timingPending = true; state.pinned = false; const version = ++state.sourceVersion;
    if (file.type.startsWith('audio/') || /\\.(?:ogg|opus|m4a|mp3|wav|flac)$/i.test(file.name)) {
      state.sourceTiming = T.manual('30'); state.timingPending = false;
    } else T.read(file).then(timing => { if (version === state.sourceVersion) { state.sourceTiming = timing; state.timingPending = false; updateNudge(); } }).catch(() => { if (version === state.sourceVersion) { state.timingPending = false; updateNudge(); } });
    video.pause(); if (state.url) URL.revokeObjectURL(state.url);
    state.url = URL.createObjectURL(file); state.loaded = false; state.project.source.name = file.name; video.src = state.url; video.load();
    updateNudge(); status('Opening ' + file.name + '…');
  }));
  video.addEventListener('loadedmetadata', () => {
    state.loaded = true; state.project.source.kind = video.videoWidth ? 'video' : 'audio'; state.active = -1; $('empty').hidden = true; $('play').disabled = false; $('seek').disabled = false; $('seek').max = String(video.duration);
    $('sourceInfo').textContent = state.project.source.name + (video.videoWidth ? ' · ' + video.videoWidth + ' × ' + video.videoHeight : ' · audio only') + ' · ' + C.time(video.duration);
    if (!video.videoWidth && !state.sourceTiming) state.sourceTiming = T.manual('30');
    state.captionKey = ''; updateClock(); updateNudge(); run(paint); status(video.videoWidth ? 'Video ready. Press Play.' : 'Audio ready. Import a timed transcript, or compose panels.');
  });
  video.addEventListener('error', () => status('The browser could not decode the selected audio or video file.', true));
  if (typeof video.requestVideoFrameCallback === 'function') {
    const onFrame = function () { updateClock(); video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  }
  video.addEventListener('timeupdate', updateClock); video.addEventListener('seeked', () => { state.active = -1; updateClock(); });
  video.addEventListener('play', () => { stopNudge(); state.pinned = false; state.active = -1; updateClock(); $('play').textContent = 'Pause'; }); video.addEventListener('pause', () => { $('play').textContent = 'Play'; });
  async function togglePlay() { if (!state.loaded) return; if (video.paused) await video.play(); else video.pause(); }
  $('play').addEventListener('click', () => run(togglePlay)); $('seek').addEventListener('input', () => { stopNudge(); state.pinned = false; video.currentTime = Number($('seek').value); state.active = -1; updateClock(); });
  document.querySelectorAll('[data-layout]').forEach(button => button.addEventListener('click', () => run(() => chooseLayout(button.dataset.layout))));
  for (const [id, property] of [['rightText', 'right'], ['bottomText', 'bottom']]) $(id).addEventListener('input', () => { state.draft[property] = $(id).value; $('follow').checked = false; run(paint); status('Panel changed. Save a cue here to keep it.'); });
  $('image').addEventListener('change', () => run(async () => {
    const file = $('image').files[0]; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10000000) throw new Error('Choose a PNG, JPEG or WebP image under 10 MB.');
    const url = URL.createObjectURL(file), img = new Image();
    try {
      img.src = url; await img.decode();
      const image = document.createElement('canvas'), ratio = Math.min(1, 1600 / Math.max(img.width, img.height));
      image.width = Math.max(1, Math.round(img.width * ratio)); image.height = Math.max(1, Math.round(img.height * ratio)); image.getContext('2d').drawImage(img, 0, 0, image.width, image.height);
      state.draft.image = image.toDataURL('image/png'); $('follow').checked = false; await paint(); status('Image added. Save a cue here to keep it.');
    } finally { URL.revokeObjectURL(url); }
  }));
  $('removeImage').addEventListener('click', () => { state.draft.image = ''; $('image').value = ''; $('follow').checked = false; run(paint); });
  bindNudge('cueEarlier', -1); bindNudge('cueLater', 1);
  window.addEventListener('pointerup', stopNudge); window.addEventListener('pointercancel', stopNudge);
  window.addEventListener('blur', () => stopNudge()); document.addEventListener('visibilitychange', () => { if (document.hidden) stopNudge(); });
  $('frameRate').addEventListener('change', () => { stopNudge(); state.project = C.validate({ ...state.project, source: { ...state.project.source, frameRate: $('frameRate').value } }); updateNudge(); });
  $('transcriptFile').addEventListener('change', () => run(async () => {
    const file = $('transcriptFile').files[0]; if (!file) return;
    if (file.size > 8_000_000) throw new Error('Transcript exceeds 8 MB.');
    const transcript = X.fromText(await file.text(), file.name);
    state.project = C.validate({ ...state.project, transcript });
    state.captionKey = ''; renderTranscriptList(); updateClock(); await paint();
    status('Imported ' + transcript.segments.length + ' timed transcript lines. Save project JSON to preserve them.');
    $('transcriptFile').value = '';
  }));
  $('transcriptOffset').addEventListener('change', () => run(async () => {
    if (!state.project.transcript) return;
    state.project = C.validate({ ...state.project, transcript: { ...state.project.transcript, offset: Number($('transcriptOffset').value) } });
    state.captionKey = ''; renderTranscriptList(); updateClock(); await paint();
    status('Transcript offset updated. Save project JSON to keep the synchronization.');
  }));
  $('suggestHighlights').addEventListener('click', () => run(async () => {
    if (!state.project.transcript) return;
    const selected = X.suggestHighlights(state.project.transcript);
    selected.forEach(index => { state.project.transcript.segments[index].highlight = true; });
    renderTranscriptList(); state.captionKey = ''; updateClock(); await paint();
    status('Suggested ' + selected.length + ' transcript highlights using an offline heuristic. Review each selection before publishing.');
  }));
  $('clearTranscript').addEventListener('click', () => run(async () => {
    state.project = C.validate({ ...state.project, transcript: null });
    state.captionKey = ''; renderTranscriptList(); updateClock(); await paint(); status('Transcript removed from this project.');
  }));
  $('saveCue').addEventListener('click', () => run(saveCue));
  $('follow').addEventListener('change', () => { state.pinned = false; state.active = -1; updateClock(); });
  $('size').addEventListener('change', () => run(async () => { const [width, height] = $('size').value.split('x').map(Number); state.project = C.validate({ ...state.project, width, height }); await paint(); }));
  $('chooseWorkDir').disabled = typeof window.showDirectoryPicker !== 'function';
  $('folderSupport').hidden = !$('chooseWorkDir').disabled;
  const workDefaults = S.defaults(); $('proxyRoot').value = workDefaults.root; $('proxyFolder').value = workDefaults.folder;
  $('chooseWorkDir').addEventListener('click', () => run(async () => {
    try { const handle = await window.showDirectoryPicker({ id: 'mogwai-recast-work', mode: 'readwrite' }); setWorkTarget(await S.directory(handle)); status('Working directory: ' + workTarget.label); }
    catch (error) { if (error.name !== 'AbortError') throw error; }
  }));
  $('connectWorkDir').addEventListener('click', () => run(async () => {
    $('connectWorkDir').disabled = true;
    try {
      const target = await S.proxy({ url: $('proxyUrl').value, root: $('proxyRoot').value.trim(), folder: $('proxyFolder').value.trim(), token: $('proxyToken').value });
      setWorkTarget(target); $('proxyToken').value = ''; status('Working directory: ' + target.label + '. Missing folders are created on save.');
    } finally { $('connectWorkDir').disabled = false; }
  }));
  $('useDownloads').addEventListener('click', () => { setWorkTarget(null); status('Save target: browser downloads.'); });
  $('saveProject').addEventListener('click', () => run(saveProject));
  $('openProject').addEventListener('change', () => run(async () => { const file = $('openProject').files[0]; if (!file) return; if (file.size > 30000000) throw new Error('Project file is too large.'); await loadProject(JSON.parse(await file.text())); $('openProject').value = ''; }));
  $('export').addEventListener('click', () => run(async () => {
    const target = workTarget, folder = S.snapshot(state.project.source.name);
    $('export').disabled = true; status(target ? 'Saving the project, panels and renderer…' : 'Rasterizing panels and building the ZIP…');
    try {
      const files = await exportFiles();
      if (target) status('Render folder saved: ' + await S.bundle(target, folder, files) + '. Run render.py with the original video.');
      else { download(C.zip(files), 'recast-ffmpeg.zip'); status('ZIP ready. Unzip it and run python3 render.py original.mp4 recast.mp4.'); }
    } finally { $('export').disabled = false; }
  }));
  $('demo').addEventListener('click', () => run(async () => {
    if (!window.confirm('Replace the current cue sheet with an editable layout demonstration?')) return;
    const right = 'YOUR NOTES\n\nAdd a sequence of instructions here.\n\nEach cue can change this panel while the source audio continues.';
    await loadProject({ ...state.project, cues: [C.emptyCue(), { at: 8, layout: 'side', right, bottom: '', image: '' }, { at: 16, layout: 'desk', right, bottom: 'Your message or image appears below the video.', image: '' }, { at: 24, layout: 'right', right, bottom: 'The same picture moves to the right. Audio is uninterrupted.', image: '' }, { ...C.emptyCue(), at: 32 }] });
    status('Editable demo cues: 0, 8, 16, 24 and 32 seconds. These are layout placeholders, not a transcript.');
  }));
  $('fullscreen').addEventListener('click', () => run(async () => { if (!document.fullscreenElement) await $('stage').requestFullscreen(); else await document.exitFullscreen(); }));
  window.addEventListener('resize', positionVideo); document.addEventListener('fullscreenchange', positionVideo);
  if (window.ResizeObserver) new ResizeObserver(positionVideo).observe($('stage'));
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable]')) return;
    const layout = Object.keys(C.layouts)[Number(event.key) - 1];
    if (layout) { event.preventDefault(); run(() => chooseLayout(layout)); }
    else if (event.code === 'Space' && !event.target.closest('button')) { event.preventDefault(); run(togglePlay); }
  });
  window.MOGWAI_RECAST = { state, loadProject, chooseLayout, saveCue, exportPackage, exportFiles, selectCue, nudgeCue, renderTranscriptList };
  setWorkTarget(null); renderCues(); run(paint);
})();
