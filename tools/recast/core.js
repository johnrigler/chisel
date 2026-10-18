(function (root) {
  'use strict';
  const FORMAT = 'mogwai-recast-v1';
  const layouts = Object.freeze({ full: 'Full picture', side: 'Side notes', desk: 'Notes + bottom panel', right: 'Video on right' });
  const hasLayout = key => typeof key === 'string' && Object.prototype.hasOwnProperty.call(layouts, key);
  const emptyCue = () => ({ at: 0, layout: 'full', right: '', bottom: '', image: '' });
  function geometry(layout, width, height) {
    if (!hasLayout(layout)) throw new Error('Unknown layout.');
    const w = Math.floor(width / 3) * 2, h = Math.floor(height / 3) * 2, side = width - w;
    if (layout === 'full') return { video: [0, 0, width, height], right: null, bottom: null };
    if (layout === 'side') return { video: [0, 0, w, height], right: [w, 0, side, height], bottom: null };
    if (layout === 'right') return { video: [side, 0, w, h], right: [0, 0, side, height], bottom: [side, h, w, height - h] };
    return { video: [0, 0, w, h], right: [w, 0, side, height], bottom: [0, h, w, height - h] };
  }
  function validate(project) {
    if (!project || project.format !== FORMAT) throw new Error('Not a Mogwai Recast project.');
    const width = project.width, height = project.height;
    if (![width, height].every(n => Number.isInteger(n) && n >= 240 && n <= 3840 && n % 2 === 0)) throw new Error('Output dimensions must be even integers from 240 to 3840.');
    if (!Array.isArray(project.cues) || !project.cues.length || project.cues.length > 100) throw new Error('Use 1–100 cues.');
    const cues = project.cues.map(cue => {
      if (!cue || !Number.isFinite(cue.at) || cue.at < 0 || cue.at > 86400 || !hasLayout(cue.layout)) throw new Error('Invalid cue time or layout.');
      const right = cue.right ?? '', bottom = cue.bottom ?? '', image = cue.image ?? '';
      if (typeof right !== 'string' || typeof bottom !== 'string' || right.length > 12000 || bottom.length > 12000) throw new Error('Panel text must be plain text, at most 12000 characters.');
      if (typeof image !== 'string' || image.length > 15000000 || image && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) throw new Error('Use an embedded PNG, JPEG or WebP image.');
      return { at: cue.at, layout: cue.layout, right, bottom, image };
    }).sort((a, b) => a.at - b.at);
    if (cues[0].at !== 0 || cues.some((cue, i) => i && cue.at === cues[i - 1].at)) throw new Error('Start with a cue at 0; cue times must be unique.');
    const name = String(project.source?.name || '').split(/[\\/]/).pop().slice(0, 240);
    const source = { name }, rate = project.source?.frameRate;
    if (rate && rate !== 'auto') {
      if (typeof rate !== 'string' || !/^\d+(?:\/\d+|\.\d+)?$/.test(rate)) throw new Error('Invalid source frame rate.');
      const parts = rate.split('/').map(Number), fps = parts[0] / (parts[1] ?? 1);
      if (!Number.isFinite(fps) || fps <= 0 || fps > 240) throw new Error('Invalid source frame rate.');
      source.frameRate = rate;
    }
    return { format: FORMAT, width, height, source, cues };
  }
  function cueAt(cues, seconds) {
    let index = 0;
    for (let i = 1; i < cues.length && cues[i].at <= seconds; i++) index = i;
    return { cue: cues[index], index };
  }
  function upsert(cues, cue) {
    const copy = cues.map(row => ({ ...row }));
    const index = copy.findIndex(row => Math.abs(row.at - cue.at) < 1e-7);
    if (index >= 0) copy[index] = { ...cue, at: copy[index].at };
    else copy.push({ ...cue });
    return copy.sort((a, b) => a.at - b.at);
  }
  function time(seconds) {
    const value = Math.max(0, Number(seconds) || 0), minutes = Math.floor(value / 60);
    return minutes + ':' + (value % 60).toFixed(2).padStart(5, '0');
  }
  function preciseTime(seconds) {
    const ms = Math.round(Math.max(0, Number(seconds) || 0) * 1000);
    return Math.floor(ms / 60000) + ':' + ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
  }
  function lines(context, text, width) {
    const out = [];
    for (const paragraph of String(text).split('\n')) {
      if (!paragraph) { out.push(''); continue; }
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? line + ' ' + word : word;
        if (context.measureText(candidate).width <= width) { line = candidate; continue; }
        if (line) out.push(line);
        line = '';
        for (const letter of word) {
          if (line && context.measureText(line + letter).width > width) { out.push(line); line = ''; }
          line += letter;
        }
      }
      out.push(line);
    }
    return out;
  }
  function paintPanel(context, box, text, scale, image) {
    const [x, y, width, height] = box, padding = 26 * scale;
    context.save(); context.beginPath(); context.rect(x, y, width, height); context.clip();
    context.fillStyle = '#151e27'; context.fillRect(x, y, width, height);
    context.fillStyle = '#dca761'; context.fillRect(x, y, Math.max(2, 3 * scale), height);
    let textX = x + padding, textWidth = width - padding * 2;
    if (image) {
      const imageWidth = text ? width * 0.42 : width - padding * 2, imageHeight = height - padding * 2;
      const ratio = Math.min(imageWidth / image.width, imageHeight / image.height);
      const drawW = image.width * ratio, drawH = image.height * ratio;
      context.drawImage(image, x + padding + (imageWidth - drawW) / 2, y + padding + (imageHeight - drawH) / 2, drawW, drawH);
      if (text) { textX += imageWidth + padding; textWidth -= imageWidth + padding; }
    }
    const fontSize = 28 * scale, lineHeight = 39 * scale;
    context.font = '500 ' + fontSize + 'px sans-serif'; context.fillStyle = '#f2eee5'; context.textBaseline = 'top';
    const wrapped = lines(context, text, textWidth), max = Math.max(1, Math.floor((height - padding * 2) / lineHeight));
    wrapped.slice(0, max).forEach((line, i) => context.fillText(i === max - 1 && wrapped.length > max ? line.replace(/.$/, '…') : line, textX, y + padding + i * lineHeight));
    context.restore();
  }
  function render(canvas, cue, image) {
    const width = canvas.width, height = canvas.height, context = canvas.getContext('2d'), g = geometry(cue.layout, width, height);
    context.clearRect(0, 0, width, height);
    const scale = width / 1280;
    if (g.right) paintPanel(context, g.right, cue.right, scale, null);
    if (g.bottom) paintPanel(context, g.bottom, cue.bottom, scale, image);
    return g;
  }
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const encoder = new TextEncoder(), locals = [], directory = []; let offset = 0;
    function header(size) { const bytes = new Uint8Array(size); return { bytes, view: new DataView(bytes.buffer) }; }
    for (const file of files) {
      if (!/^[A-Za-z0-9_./-]+$/.test(file.name) || file.name.includes('..')) throw new Error('Unsafe ZIP filename.');
      const name = encoder.encode(file.name), data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data, crc = crc32(data);
      const a = header(30); a.view.setUint32(0, 0x04034b50, true); a.view.setUint16(4, 20, true); a.view.setUint16(12, 33, true);
      a.view.setUint32(14, crc, true); a.view.setUint32(18, data.length, true); a.view.setUint32(22, data.length, true); a.view.setUint16(26, name.length, true);
      locals.push(a.bytes, name, data);
      const b = header(46); b.view.setUint32(0, 0x02014b50, true); b.view.setUint16(4, 20, true); b.view.setUint16(6, 20, true); b.view.setUint16(14, 33, true);
      b.view.setUint32(16, crc, true); b.view.setUint32(20, data.length, true); b.view.setUint32(24, data.length, true); b.view.setUint16(28, name.length, true); b.view.setUint32(42, offset, true);
      directory.push(b.bytes, name); offset += 30 + name.length + data.length;
    }
    const size = directory.reduce((n, b) => n + b.length, 0), end = header(22);
    end.view.setUint32(0, 0x06054b50, true); end.view.setUint16(8, files.length, true); end.view.setUint16(10, files.length, true); end.view.setUint32(12, size, true); end.view.setUint32(16, offset, true);
    return new Blob([...locals, ...directory, end.bytes], { type: 'application/zip' });
  }
  root.MogwaiRecast = Object.freeze({ FORMAT, layouts, emptyCue, geometry, validate, cueAt, upsert, time, preciseTime, render, zip, crc32 });
})(typeof globalThis !== 'undefined' ? globalThis : this);
