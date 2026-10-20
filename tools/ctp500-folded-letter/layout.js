// Each landscape page is W by 384 dots. Rotate the full strip clockwise.
// Folding blank-to-blank at the middle gives the usual [4,1] / [2,3] sheet.
export const PAGE_ORDER = [4, 1, 2, 3];
export const PAGE_HEIGHT = 384;

function canvas(width, height) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  return c;
}

export function wrapText(ctx, text, width) {
  const lines = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (line && ctx.measureText(line + ' ' + word).width > width) {
        lines.push(line); line = '';
      }
      // Split long URLs/words rather than drawing outside the page.
      for (const char of word) {
        const candidate = line + char;
        if (ctx.measureText(candidate).width > width && line) { lines.push(line); line = ''; }
        line += char;
      }
      line += ' ';
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function makeQR(text) {
  if (!text.trim()) return null;
  const holder = document.createElement('div');
  // qrcodejs is vendored locally; access its matrix to use whole-dot modules.
  const qr = new globalThis.QRCode(holder, { text, width: 160, height: 160, correctLevel: globalThis.QRCode.CorrectLevel.M });
  const matrix = qr._oQRCode;
  const count = matrix.getModuleCount();
  const scale = Math.floor(176 / (count + 8));
  if (scale < 3) throw new Error('QR payload is too long for this paper. Shorten it to keep modules at least 3 dots wide.');
  const out = canvas((count + 8) * scale, (count + 8) * scale);
  const ctx = out.getContext('2d');
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
    if (matrix.isDark(row, col)) ctx.fillRect((col + 4) * scale, (row + 4) * scale, scale, scale);
  }
  return out;
}

export function buildLetter({ title, text, width = 800, fontSize = 20, image = null, qr = null, calibration = false }) {
  if (!Number.isInteger(width) || width < 640 || width > 1600) throw new Error('Page length must be 640–1600 dots.');
  if (!Number.isInteger(fontSize) || fontSize < 16 || fontSize > 28) throw new Error('Text size must be 16–28 dots.');
  const pages = [];
  let remaining = text.replace(/\r\n?/g, '\n');
  for (let page = 1; page <= 4; page++) {
    const c = canvas(width, PAGE_HEIGHT), ctx = c.getContext('2d');
    const margin = 28, lineHeight = Math.ceil(fontSize * 1.3);
    ctx.font = `${fontSize}px sans-serif`;
    let top = 28, right = width - margin;
    if (page === 1 && title.trim()) {
      ctx.font = 'bold 25px sans-serif';
      const titleLines = wrapText(ctx, title, width - 2 * margin);
      if (titleLines.length > 2) throw new Error('Title exceeds two lines. Shorten it or increase page length.');
      for (const line of titleLines) { ctx.fillText(line, margin, top + 25); top += 31; }
      top += 10;
    }
    if (page === 4 && (image || qr)) {
      const box = 176, x = width - margin - box;
      right = x - 16;
      if (image) {
        const availableHeight = qr ? 132 : 280;
        const scale = Math.min(box / image.width, availableHeight / image.height);
        ctx.drawImage(image, x + (box - image.width * scale) / 2, margin, image.width * scale, image.height * scale);
      }
      if (qr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(qr, x + (box - qr.width) / 2, image ? 168 : margin); }
    }
    ctx.font = `${fontSize}px sans-serif`;
    if (calibration) {
      ctx.font = 'bold 92px sans-serif'; ctx.fillText(String(page), margin + 10, 170);
      ctx.font = '24px sans-serif'; ctx.fillText('TOP ↑  ·  PAGE ' + page, margin + 10, 215);
      ctx.font = '18px sans-serif'; ctx.fillText(page === 1 ? 'FRONT COVER' : page === 4 ? 'BACK COVER' : 'INSIDE', margin + 10, 250);
      ctx.fillText('Spine: ' + (page % 2 ? 'left edge' : 'right edge'), margin + 10, 285);
    } else {
      // Wrap in this page's available width. Keep exact character offsets so
      // changing the width on the image page never drops or duplicates text.
      const capacity = Math.max(0, Math.floor((340 - top) / lineHeight));
      let cursor = 0;
      for (let n = 0; n < capacity && cursor < remaining.length; n++) {
        let end = cursor, lastSpace = -1;
        while (end < remaining.length && remaining[end] !== '\n' && ctx.measureText(remaining.slice(cursor, end + 1)).width <= right - margin) {
          if (/\s/.test(remaining[end])) lastSpace = end;
          end++;
        }
        if (end < remaining.length && remaining[end] !== '\n' && lastSpace > cursor) end = lastSpace;
        if (end === cursor && remaining[end] !== '\n') end++;
        ctx.fillText(remaining.slice(cursor, end).trimEnd(), margin, top + fontSize + n * lineHeight);
        cursor = end;
        if (remaining[cursor] === '\n') cursor++;
        else while (remaining[cursor] === ' ' || remaining[cursor] === '\t') cursor++;
      }
      remaining = remaining.slice(cursor);
    }
    ctx.font = '14px sans-serif'; ctx.fillText(String(page) + ' / 4', width - 60, 365);
    // Keep the binding margin clear; thin rule marks the spine edge.
    ctx.strokeStyle = '#aaa'; ctx.beginPath();
    const spine = page % 2 ? 10 : width - 10;
    ctx.moveTo(spine, 20); ctx.lineTo(spine, 364); ctx.stroke();
    pages.push(c);
  }
  if (!calibration && remaining.trim()) throw new Error('Letter exceeds four pages. Increase page length, reduce text size, or shorten the letter. Nothing was printed.');
  const strip = canvas(PAGE_HEIGHT, width * 4);
  const ctx = strip.getContext('2d');
  PAGE_ORDER.forEach((number, i) => {
    ctx.save(); ctx.translate(PAGE_HEIGHT, i * width); ctx.rotate(Math.PI / 2); ctx.drawImage(pages[number - 1], 0, 0); ctx.restore();
    if (i > 0) {
      ctx.save(); ctx.strokeStyle = '#888'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(0, i * width); ctx.lineTo(PAGE_HEIGHT, i * width); ctx.stroke(); ctx.restore();
    }
  });
  return { pages, strip };
}
