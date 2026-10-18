(function (root) {
  'use strict';
  const EPSILON = 1e-7, MAX_FRAMES = 1000000;
  function boxes(view, start, end) {
    const out = [];
    for (let at = start; at < end;) {
      if (at + 8 > end) throw new Error('Truncated MP4 box.');
      let size = view.getUint32(at), header = 8;
      const type = String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + at + 4, 4));
      if (size === 1) { if (at + 16 > end) throw new Error('Truncated MP4 box.'); size = Number(view.getBigUint64(at + 8)); header = 16; }
      if (size === 0) size = end - at;
      if (!Number.isSafeInteger(size) || size < header || at + size > end) throw new Error('Invalid MP4 box size.');
      out.push({ type, data: at + header, end: at + size }); at += size;
    }
    return out;
  }
  function child(view, box, type) { return boxes(view, box.data, box.end).find(item => item.type === type); }
  function need(box, message) { if (!box) throw new Error(message || 'MP4 frame timing is unavailable.'); return box; }
  function requireBytes(box, at, count) { if (at < box.data || at + count > box.end) throw new Error('Truncated MP4 timing table.'); }
  function timescale(view, box) {
    const version = view.getUint8(box.data), at = box.data + (version === 1 ? 20 : 12);
    if (version > 1) throw new Error('Unsupported MP4 clock.'); requireBytes(box, at, 4);
    const value = view.getUint32(at); if (!value) throw new Error('Invalid MP4 clock.'); return value;
  }
  function entries(view, box, callback) {
    requireBytes(box, box.data, 8); const count = view.getUint32(box.data + 4);
    requireBytes(box, box.data + 8, count * 8);
    for (let i = 0; i < count; i++) callback(view.getUint32(box.data + 8 + i * 8), box.data + 12 + i * 8);
  }
  function parseMoov(buffer) {
    const view = new DataView(buffer), moov = need(boxes(view, 0, view.byteLength).find(b => b.type === 'moov'));
    const movieClock = timescale(view, need(child(view, moov, 'mvhd')));
    for (const trak of boxes(view, moov.data, moov.end).filter(b => b.type === 'trak')) {
      const mdia = child(view, trak, 'mdia'); if (!mdia) continue;
      const handler = child(view, mdia, 'hdlr'); if (!handler) continue;
      requireBytes(handler, handler.data + 8, 4);
      if (String.fromCharCode(...new Uint8Array(buffer, handler.data + 8, 4)) !== 'vide') continue;
      const clock = timescale(view, need(child(view, mdia, 'mdhd'))), minf = need(child(view, mdia, 'minf'));
      const stbl = need(child(view, minf, 'stbl')), stts = need(child(view, stbl, 'stts'), 'Fragmented or empty MP4 timing. Choose source FPS.');
      let count = 0, duration = 0, delta = null, constant = true;
      entries(view, stts, (samples, at) => {
        const step = view.getUint32(at); if (!samples || !step) throw new Error('Invalid MP4 sample duration.');
        count += samples; duration += samples * step;
        if (delta !== null && step !== delta) constant = false; delta = step;
      });
      if (!count || count > MAX_FRAMES || !Number.isSafeInteger(duration)) throw new Error('MP4 timing table is too large or empty.');
      const presentation = new Float64Array(count); let index = 0, decode = 0;
      entries(view, stts, (samples, at) => { const step = view.getUint32(at); for (let i = 0; i < samples; i++) { presentation[index++] = decode; decode += step; } });
      const ctts = child(view, stbl, 'ctts');
      if (ctts) {
        const version = view.getUint8(ctts.data); if (version > 1) throw new Error('Unsupported MP4 composition timing.'); index = 0;
        entries(view, ctts, (samples, at) => {
          const offset = version === 1 ? view.getInt32(at) : view.getUint32(at);
          if (index + samples > count) throw new Error('Inconsistent MP4 composition timing.');
          for (let i = 0; i < samples; i++) presentation[index++] += offset;
        });
        if (index !== count) throw new Error('Incomplete MP4 composition timing.');
      }
      let mediaStart = 0, delay = 0, limit = Infinity;
      const edits = child(view, trak, 'edts'), elst = edits && child(view, edits, 'elst');
      if (elst) {
        requireBytes(elst, elst.data, 8); const version = view.getUint8(elst.data), editCount = view.getUint32(elst.data + 4), size = version === 1 ? 20 : 12;
        if (version > 1 || editCount > 2) throw new Error('Complex MP4 edits need an explicit source FPS.');
        requireBytes(elst, elst.data + 8, editCount * size); let content = false;
        for (let i = 0; i < editCount; i++) {
          const at = elst.data + 8 + i * size, span = version === 1 ? Number(view.getBigUint64(at)) : view.getUint32(at);
          const media = version === 1 ? Number(view.getBigInt64(at + 8)) : view.getInt32(at + 4);
          const rateAt = at + (version === 1 ? 16 : 8);
          if (!Number.isSafeInteger(span) || !Number.isSafeInteger(media) || view.getInt16(rateAt) !== 1 || view.getInt16(rateAt + 2) !== 0) throw new Error('Unsupported MP4 edit rate.');
          if (media === -1 && !content) delay += span / movieClock;
          else { if (content || media < 0) throw new Error('Complex MP4 edits need an explicit source FPS.'); content = true; mediaStart = media; if (span) limit = media / clock + span / movieClock; }
        }
      }
      presentation.sort(); const times = [];
      for (const stamp of presentation) {
        if (stamp / clock < mediaStart / clock - EPSILON || stamp / clock >= limit - EPSILON) continue;
        const time = (stamp - mediaStart) / clock + delay;
        if (!times.length || time - times[times.length - 1] > EPSILON) times.push(Math.max(0, time));
      }
      if (!times.length) throw new Error('No displayable video frames.');
      return { times: Float64Array.from(times), fps: constant ? clock / delta : null, origin: 'mp4', variable: !constant };
    }
    throw new Error('No MP4 video track.');
  }
  async function read(file) {
    if (!file || typeof file.slice !== 'function' || !Number.isSafeInteger(file.size)) throw new Error('Select the source FPS to enable frame steps.');
    for (let at = 0; at + 8 <= file.size;) {
      const header = new DataView(await file.slice(at, at + 16).arrayBuffer());
      let size = header.getUint32(0), head = 8;
      const type = String.fromCharCode(...new Uint8Array(header.buffer, 4, 4));
      if (size === 1) { size = Number(header.getBigUint64(8)); head = 16; }
      if (size === 0) size = file.size - at;
      if (!Number.isSafeInteger(size) || size < head || at + size > file.size) throw new Error('Not a readable MP4 timing index. Choose source FPS.');
      if (type === 'moov') {
        if (size > 32000000) throw new Error('MP4 timing index exceeds 32 MB. Choose source FPS.');
        return parseMoov(await file.slice(at, at + size).arrayBuffer());
      }
      at += size;
    }
    throw new Error('Source-frame detection supports MP4. Select source FPS for other formats.');
  }
  function manual(rate) {
    if (typeof rate !== 'string' || !/^\d+(?:\/\d+|\.\d+)?$/.test(rate)) throw new Error('Invalid frame rate.');
    const parts = rate.split('/').map(Number), fps = parts[0] / (parts[1] ?? 1);
    if (!Number.isFinite(fps) || fps <= 0 || fps > 240) throw new Error('Invalid frame rate.');
    return { times: null, fps, origin: 'manual' };
  }
  function indexAt(timing, time) {
    if (!timing.times) return Math.max(0, Math.ceil((time - EPSILON) * timing.fps));
    let left = 0, right = timing.times.length;
    while (left < right) { const mid = (left + right) >>> 1; if (timing.times[mid] < time - EPSILON) left = mid + 1; else right = mid; }
    return Math.min(left, timing.times.length - 1);
  }
  function at(timing, index) { return timing.times ? timing.times[index] : index / timing.fps; }
  function floor(timing, time) { let i = indexAt(timing, time); if (at(timing, i) > time + EPSILON && i) i--; return at(timing, i); }
  function move(cues, index, direction, timing, duration) {
    if (index <= 0 || index >= cues.length || ![-1, 1].includes(direction)) return null;
    const frame = indexAt(timing, cues[index].at) + direction;
    if (frame < 0 || timing.times && frame >= timing.times.length) return null;
    const time = at(timing, frame);
    if (!Number.isFinite(time) || time >= duration - EPSILON || time <= cues[index - 1].at + EPSILON || index + 1 < cues.length && time >= cues[index + 1].at - EPSILON) return null;
    return { time, frame };
  }
  function previewTime(timing, time, duration) {
    const frame = indexAt(timing, time), start = at(timing, frame), next = at(timing, frame + 1);
    const end = Math.min(duration, Number.isFinite(next) ? next : start + 1 / (timing.fps || 30));
    return Math.max(0, start + Math.max(0, end - start) / 2);
  }
  root.MogwaiFrameTiming = Object.freeze({ read, parseMoov, manual, indexAt, at, floor, move, previewTime, EPSILON });
})(typeof globalThis !== 'undefined' ? globalThis : this);
