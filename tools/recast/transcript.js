(function (root) {
  'use strict';
  const MAX_SEGMENTS = 6000;
  const MAX_TIME = 86400;
  function stamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const input = String(value).trim().replace(',', '.');
    const chunks = input.split(':');
    if (!chunks.length || chunks.length > 3 || !chunks.every(piece => /^\d+(?:\.\d+)?$/.test(piece))) throw new Error('Invalid transcript timestamp: ' + input);
    return chunks.reduce((n, part) => n * 60 + Number(part), 0);
  }
  function cleanText(value) {
    return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\{\\[^}]*\}/g, '')
      .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, m => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[m])
      .replace(/\s+/g, ' ').trim();
  }
  function validate(input) {
    if (!input || typeof input !== 'object') throw new Error('Invalid transcript.');
    const segments = input.segments;
    if (!Array.isArray(segments) || !segments.length || segments.length > MAX_SEGMENTS) throw new Error('Transcript must contain 1–6000 timed segments.');
    const offset = input.offset === undefined ? 0 : Number(input.offset);
    if (!Number.isFinite(offset) || offset < -3600 || offset > 3600) throw new Error('Transcript sync offset must be within one hour.');
    let previous = -1;
    const rows = segments.map((segment, i) => {
      if (!segment || typeof segment !== 'object') throw new Error('Invalid transcript segment ' + (i + 1));
      const start = Number(segment.start), end = Number(segment.end), text = cleanText(segment.text);
      if (![start, end].every(Number.isFinite) || start < 0 || end <= start || end > MAX_TIME || start < previous)
        throw new Error('Invalid transcript timing at segment ' + (i + 1));
      if (!text || text.length > 1500) throw new Error('Transcript segment text must be 1–1500 characters.');
      previous = start;
      const row = { start, end, text, highlight: segment.highlight === true };
      if (segment.words !== undefined) {
        if (!Array.isArray(segment.words) || segment.words.length > 500) throw new Error('Invalid word timestamps in segment ' + (i + 1));
        row.words = segment.words.map(w => {
          const word = { start: Number(w.start), end: Number(w.end), text: cleanText(w.text ?? w.word) };
          if (![word.start, word.end].every(Number.isFinite) || word.start < start - 0.001 ||
              word.end > end + 0.001 || word.end <= word.start || !word.text)
            throw new Error('Invalid word timestamps in segment ' + (i + 1));
          return word;
        });
      }
      return row;
    });
    return { name: String(input.name || 'transcript').split(/[\\/]/).pop().slice(0, 240), offset, segments: rows };
  }
  function timedText(text) {
    const input = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const blocks = input.split(/\n\s*\n/);
    const segments = [];
    for (const block of blocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      if (!lines.length || /^(?:WEBVTT|NOTE(?:\s|$)|STYLE$|REGION$)/i.test(lines[0])) continue;
      const index = lines.findIndex(line => line.includes('-->'));
      if (index < 0 || index > 1) continue;
      const match = /^\s*(\d+(?::\d+){0,2}[.,]\d+)\s*-->\s*(\d+(?::\d+){0,2}[.,]\d+)(?:\s+.*)?$/.exec(lines[index]);
      if (!match) throw new Error('Invalid SRT/WebVTT timing: ' + lines[index]);
      const caption = cleanText(lines.slice(index + 1).join(' '));
      if (caption) segments.push({ start: stamp(match[1]), end: stamp(match[2]), text: caption });
    }
    if (!segments.length) throw new Error('No timed captions found. Export SRT or WebVTT, not plain text.');
    return segments;
  }
  function groupWords(words) {
    const out = [];
    let batch = [];
    function flush() {
      if (!batch.length) return;
      out.push({ start: batch[0].start, end: batch[batch.length - 1].end,
        text: batch.map(w => w.text).join(' '), words: batch });
      batch = [];
    }
    for (const raw of words) {
      const w = { start: Number(raw.start), end: Number(raw.end), text: cleanText(raw.word ?? raw.text) };
      if (!Number.isFinite(w.start) || !Number.isFinite(w.end) || !w.text) throw new Error('Invalid word-level JSON transcript.');
      if (batch.length && (batch.length >= 10 || w.start - batch[batch.length - 1].end > 0.8 ||
          /[.!?]$/.test(batch[batch.length - 1].text))) flush();
      batch.push(w);
    }
    flush(); return out;
  }
  function fromText(text, name) {
    if (typeof text !== 'string' || text.length > 8_000_000) throw new Error('Transcript must be UTF-8 and under 8 MB.');
    let segments;
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const data = JSON.parse(trimmed);
      const rows = Array.isArray(data) ? data : (data.segments || data.words || data.results?.segments);
      if (!Array.isArray(rows)) throw new Error('JSON transcript needs segments or words with start/end times.');
      segments = rows.length && rows[0].words ? rows : rows.length && (rows[0].word !== undefined || data.words === rows) ? groupWords(rows) : rows;
    } else segments = timedText(text);
    return validate({ name, offset: 0, segments });
  }
  function captionAt(transcript, seconds) {
    if (!transcript?.segments?.length || !Number.isFinite(seconds)) return null;
    const target = seconds - transcript.offset, segments = transcript.segments;
    let low = 0, high = segments.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (segments[mid].start <= target) low = mid + 1;
      else high = mid;
    }
    for (let i = low - 1; i >= 0 && i >= low - 5; i--) {
      const segment = segments[i];
      if (target >= segment.start && target < segment.end) {
        const words = segment.words || [];
        const wordIndex = words.findIndex(w => target >= w.start && target < w.end);
        return { index: i, segment, wordIndex: wordIndex < 0 ? null : wordIndex };
      }
    }
    return null;
  }
  // Offline suggestions only: a transparent ranking heuristic, not semantic AI analysis.
  function suggestHighlights(transcript) {
    const rows = transcript?.segments || [];
    const candidates = rows.map((segment, index) => {
      const text = segment.text, duration = segment.end - segment.start;
      const words = text.toLowerCase().match(/[a-z0-9']+/g) || [];
      if (words.length < 9 || duration < 1) return null;
      const score = Math.min(160, text.length) / 14 +
        (/[.!?]$/.test(text) ? 2 : 0) +
        (/\\b(because|therefore|however|means|important|actually|problem|evidence|reason|disagree|instead|conclusion)\\b/i.test(text) ? 3 : 0) -
        (/^(?:um|uh|yeah|okay|right|so|well)\\b/i.test(text) ? 2 : 0);
      return { index, score, at: segment.start };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    const target = Math.min(24, Math.max(1, Math.ceil(rows.length * 0.07)));
    const selected = [];
    for (const row of candidates) {
      if (selected.every(other => Math.abs(other.at - row.at) >= 4)) selected.push(row);
      if (selected.length >= target) break;
    }
    return selected.map(row => row.index).sort((a, b) => a - b);
  }
  root.MogwaiTranscript = Object.freeze({ stamp, cleanText, validate, fromText, captionAt, suggestHighlights });
})(typeof globalThis !== 'undefined' ? globalThis : this);
