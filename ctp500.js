/*
 * Minimal Core Innovations CTP500 raster encoder.
 * Vanilla browser JavaScript; no libraries; suitable for static/IPFS hosting.
 *
 * This ONLY creates the printer byte stream. It does not connect to Bluetooth.
 * The raster framing and command preamble follow the independently published
 * CTP500 RFCOMM example by parkerlreed:
 * https://gist.github.com/parkerlreed/8f77bdb08e260b5d0fe795e70d8fd6b0
 *
 * Transport is separate: desktop Web Serial can use Bluetooth Classic SPP;
 * ctp500-ble.js uses the BLE service verified on Teal Printer (2026-10-16).
 */

export function ctp500Encode(canvas, {
  threshold = 128, feedRows = 0, feedLines = 3,
  initialize = true, cut = true, trimRight = false,
} = {}) {
  if (!canvas || !canvas.width || !canvas.height) {
    throw new TypeError('Expected a nonempty HTMLCanvasElement');
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) {
    throw new RangeError('threshold must be a number between 0 and 255');
  }

  if (!Number.isInteger(feedRows) || feedRows < 0) {
    throw new RangeError('feedRows must be a nonnegative integer');
  }
  if (!Number.isInteger(feedLines) || feedLines < 0 || feedLines > 255) {
    throw new RangeError('feedLines must be an integer from 0 to 255');
  }
  const width = 384; // Printer width in dots, 48 bytes per row.
  const imageHeight = Math.max(1, Math.round(canvas.height * width / canvas.width));
  const height = imageHeight + feedRows;
  if (height > 65535) throw new RangeError('Image plus feed exceeds raster height limit');

  const mono = document.createElement('canvas');
  mono.width = width;
  mono.height = imageHeight;
  const ctx = mono.getContext('2d', { willReadFrequently: true });
  // Composite transparent areas onto white before thresholding.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, imageHeight);
  // Best for QR codes and other deliberately pixel-aligned artwork.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, width, imageHeight);

  const { data } = ctx.getImageData(0, 0, width, imageHeight);
  // Preserve the left origin; omit only unused columns at the right.
  // The original default remains the full 384-dot raster.
  let rightmost = trimRight ? 0 : width - 1;
  if (trimRight) {
    for (let y = 0; y < imageHeight; y++) {
      for (let x = width - 1; x > rightmost; x--) {
        const i = (y * width + x) * 4;
        if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] < threshold) {
          rightmost = x;
          break;
        }
      }
    }
  }
  const bytesPerRow = Math.ceil((rightmost + 1) / 8);
  const raster = new Uint8Array(bytesPerRow * height);

  // The extra raster rows remain zero (white); printing them physically
  // advances the paper even if the device ignores trailing LF commands.
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < bytesPerRow * 8; x++) {
      const i = (y * width + x) * 4;
      const luminance = 0.2126 * data[i]
                      + 0.7152 * data[i + 1]
                      + 0.0722 * data[i + 2];
      if (luminance < threshold) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  // Observed working sequence from the CTP500 RFCOMM printing example.
  const setup = Uint8Array.from(initialize ? [
    0x1d, 0x67, 0x39,
    0x1e, 0x47, 0x03,
    0x1d, 0x67, 0x69,
    0x1b, 0x40,
    0x1d, 0x49, 0xf0, 0x19
  ] : []);
  const rasterHeader = Uint8Array.from([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff
  ]);
  const end = Uint8Array.from([
    ...Array(feedLines).fill(0x0a), ...(cut ? [0x1d, 0x56, 0x00] : []),
  ]);

  const out = new Uint8Array(setup.length + rasterHeader.length + raster.length + end.length);
  let offset = 0;
  for (const part of [setup, rasterHeader, raster, end]) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// Short, independently framed bands retain vertical positions while allowing
// each band to omit its own unused right-hand columns. White bands still
// contain raster rows, so their height advances the paper normally.
export function ctp500EncodeBands(canvas, { bandRows = 8, ...options } = {}) {
  if (!canvas || !canvas.width || !canvas.height) throw new TypeError('Expected a nonempty canvas');
  if (!Number.isInteger(bandRows) || bandRows < 1 || bandRows > 256) {
    throw new RangeError('bandRows must be an integer from 1 to 256');
  }
  const height = Math.max(1, Math.round(canvas.height * 384 / canvas.width));
  if (height + (options.feedRows || 0) > 65535) throw new RangeError('Image plus feed exceeds raster height limit');
  const scaled = document.createElement('canvas');
  scaled.width = 384; scaled.height = height;
  const ctx = scaled.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 384, height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, 384, height);
  const parts = [];
  for (let y = 0; y < height; y += bandRows) {
    const rows = Math.min(bandRows, height - y), last = y + rows === height;
    const band = document.createElement('canvas');
    band.width = 384; band.height = rows;
    band.getContext('2d').drawImage(scaled, 0, y, 384, rows, 0, 0, 384, rows);
    parts.push(ctp500Encode(band, {
      ...options, trimRight: true,
      initialize: y === 0 && options.initialize !== false,
      feedRows: last ? (options.feedRows ?? 0) : 0,
      feedLines: last ? (options.feedLines ?? 3) : 0,
      cut: last && (options.cut ?? true),
    }));
  }
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}
