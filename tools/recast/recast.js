(function () {
  'use strict';
  const C = window.MogwaiRecast, $ = id => document.getElementById(id);
  const video = $('video'), canvas = $('overlay');
  const state = { project: C.validate({ format: C.FORMAT, width: 1280, height: 720, source: { name: '' }, cues: [C.emptyCue()] }), draft: C.emptyCue(), active: -1, url: '', loaded: false, images: new Map(), renderVersion: 0 };
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
    Object.assign(video.style, { left: left + g.video[0] * scale + 'px', top: top + g.video[1] * scale + 'px', width: g.video[2] * scale + 'px', height: g.video[3] * scale + 'px' });
  }
  async function paint() {
    const revision = ++state.renderVersion, cue = { ...state.draft }, image = await imageFor(cue.image);
    if (revision !== state.renderVersion) return;
    canvas.width = state.project.width; canvas.height = state.project.height;
    C.render(canvas, cue, image); positionVideo();
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
      row.className = 'cue' + (index === state.active ? ' active' : ''); at.textContent = C.time(cue.at);
      jump.type = remove.type = 'button'; jump.append(at, document.createTextNode(C.layouts[cue.layout]));
      jump.addEventListener('click', () => { if (state.loaded) video.currentTime = Math.min(cue.at, video.duration); state.active = index; state.draft = { ...cue }; $('follow').checked = true; editors(cue); run(paint); renderCues(); });
      remove.textContent = '×'; remove.setAttribute('aria-label', 'Delete cue at ' + C.time(cue.at)); remove.disabled = index === 0;
      remove.addEventListener('click', () => { state.project.cues.splice(index, 1); state.active = -1; updateClock(); renderCues(); status('Cue removed.'); });
      row.append(jump, remove); $('cues').appendChild(row);
    });
  }
  function currentTime() { return state.loaded ? video.currentTime : 0; }
  function saveCue() {
    const cue = { ...state.draft, at: Math.round(currentTime() * 1000) / 1000 };
    const next = C.upsert(state.project.cues, cue);
    state.project = C.validate({ ...state.project, cues: next });
    state.active = C.cueAt(state.project.cues, cue.at).index; state.draft = { ...state.project.cues[state.active] };
    $('follow').checked = true; renderCues(); status('Cue saved at ' + C.time(state.draft.at) + '.');
  }
  function chooseLayout(layout) {
    state.draft = { ...state.draft, layout }; $('follow').checked = false;
    if ($('record').checked) saveCue();
    else status(C.layouts[layout] + ' · live preview. Save a cue to keep it.');
    run(paint);
  }
  function updateClock() {
    $('clock').textContent = C.time(currentTime()) + ' / ' + C.time(state.loaded ? video.duration : 0);
    $('seek').value = String(currentTime());
    if ($('follow').checked) {
      const found = C.cueAt(state.project.cues, currentTime());
      if (found.index !== state.active) { state.active = found.index; state.draft = { ...found.cue }; editors(found.cue); run(paint); renderCues(); }
    }
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function loadProject(project) {
    const clean = C.validate(project);
    // Decode embedded images before replacing the current project.
    await Promise.all(clean.cues.filter(c => c.image).map(c => imageFor(c.image)));
    state.project = clean; state.active = -1; state.draft = { ...clean.cues[0] };
    const size = clean.width + 'x' + clean.height;
    if (![...$('size').options].some(option => option.value === size)) { const option = document.createElement('option'); option.value = size; option.textContent = clean.width + ' × ' + clean.height; $('size').appendChild(option); }
    $('size').value = size; $('follow').checked = true; editors(state.draft); updateClock(); renderCues(); await paint();
    status('Project opened. Choose ' + (clean.source.name || 'the source video') + ' separately.');
  }
  async function exportPackage() {
    const project = C.validate(state.project);
    if (!state.loaded || !video.videoWidth) throw new Error('Choose a video source before exporting.');
    const files = [{ name: 'project.json', data: JSON.stringify(project, null, 2) + '\n' }, { name: 'render.py', data: window.RecastRenderPython }];
    const exported = document.createElement('canvas'); exported.width = project.width; exported.height = project.height;
    for (let i = 0; i < project.cues.length; i++) {
      const cue = project.cues[i]; C.render(exported, cue, await imageFor(cue.image));
      const blob = await new Promise((resolve, reject) => exported.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed.')), 'image/png'));
      files.push({ name: 'overlays/' + String(i).padStart(3, '0') + '.png', data: new Uint8Array(await blob.arrayBuffer()) });
    }
    files.push({ name: 'README.txt', data: 'Mogwai Recast\n\nThe original video is not included. Keep it separately.\n\nInstall Python 3, FFmpeg and ffprobe. In this folder run:\n\npython3 render.py "path/to/original.mp4" "recast.mp4"\n\nVideo is recomposed; audio is copied from the original as a single stream.\nThe output container must support the original audio codec (AAC works in MP4).\nExisting output files are not overwritten.\n\nProject JSON is editable and can be reopened in the static HTML tool.\nPanels are exported as transparent PNGs so FFmpeg needs no HTML renderer.\nThe original source file and embedded images stay private unless you share them.\n' });
    return C.zip(files);
  }
  $('source').addEventListener('change', () => run(async () => {
    const file = $('source').files[0]; if (!file) return;
    video.pause(); if (state.url) URL.revokeObjectURL(state.url);
    state.url = URL.createObjectURL(file); state.loaded = false; state.project.source.name = file.name; video.src = state.url; video.load();
    status('Opening ' + file.name + '…');
  }));
  video.addEventListener('loadedmetadata', () => {
    state.loaded = true; state.active = -1; $('empty').hidden = true; $('play').disabled = false; $('seek').disabled = false; $('seek').max = String(video.duration);
    $('sourceInfo').textContent = state.project.source.name + ' · ' + video.videoWidth + ' × ' + video.videoHeight + ' · ' + C.time(video.duration);
    updateClock(); run(paint); status(video.videoWidth ? 'Ready. Press Play; keys 1–4 change layouts.' : 'This is audio-only. FFmpeg export needs a video source.', !video.videoWidth);
  });
  video.addEventListener('error', () => status('The browser could not open this video. Try an MP4 with H.264 video and AAC audio.', true));
  if (typeof video.requestVideoFrameCallback === 'function') {
    const onFrame = function () { updateClock(); video.requestVideoFrameCallback(onFrame); };
    video.requestVideoFrameCallback(onFrame);
  }
  video.addEventListener('timeupdate', updateClock); video.addEventListener('seeked', () => { state.active = -1; updateClock(); });
  video.addEventListener('play', () => { $('play').textContent = 'Pause'; }); video.addEventListener('pause', () => { $('play').textContent = 'Play'; });
  async function togglePlay() { if (!state.loaded) return; if (video.paused) await video.play(); else video.pause(); }
  $('play').addEventListener('click', () => run(togglePlay)); $('seek').addEventListener('input', () => { video.currentTime = Number($('seek').value); state.active = -1; updateClock(); });
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
  $('saveCue').addEventListener('click', () => run(saveCue));
  $('follow').addEventListener('change', () => { state.active = -1; updateClock(); });
  $('size').addEventListener('change', () => run(async () => { const [width, height] = $('size').value.split('x').map(Number); state.project = C.validate({ ...state.project, width, height }); await paint(); }));
  $('saveProject').addEventListener('click', () => run(() => download(new Blob([JSON.stringify(C.validate(state.project), null, 2) + '\n'], { type: 'application/json' }), 'recast-project.json')));
  $('openProject').addEventListener('change', () => run(async () => { const file = $('openProject').files[0]; if (!file) return; if (file.size > 30000000) throw new Error('Project file is too large.'); await loadProject(JSON.parse(await file.text())); $('openProject').value = ''; }));
  $('export').addEventListener('click', () => run(async () => { $('export').disabled = true; status('Rasterizing panels and building the ZIP…'); try { download(await exportPackage(), 'recast-ffmpeg.zip'); status('ZIP ready. Unzip it and run python3 render.py original.mp4 recast.mp4.'); } finally { $('export').disabled = false; } }));
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
    else if (event.code === 'Space') { event.preventDefault(); run(togglePlay); }
  });
  window.MOGWAI_RECAST = { state, loadProject, chooseLayout, saveCue, exportPackage };
  renderCues(); run(paint);
})();
