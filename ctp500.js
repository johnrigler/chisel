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

export function ctp500Encode(canvas, { threshold = 128, feedRows = 0 } = {}) {
  if (!canvas || !canvas.width || !canvas.height) {
    throw new TypeError('Expected a nonempty HTMLCanvasElement');
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) {
    throw new RangeError('threshold must be a number between 0 and 255');
  }

  if (!Number.isInteger(feedRows) || feedRows < 0) {
    throw new RangeError('feedRows must be a nonnegative integer');
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
  const bytesPerRow = width >> 3;
  const raster = new Uint8Array(bytesPerRow * height);

  // The extra raster rows remain zero (white); printing them physically
  // advances the paper even if the device ignores trailing LF commands.
  for (let y = 0; y < imageHeight; y++) {
    for (let x = 0; x < width; x++) {
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
  const setup = Uint8Array.from([
    0x1d, 0x67, 0x39,
    0x1e, 0x47, 0x03,
    0x1d, 0x67, 0x69,
    0x1b, 0x40,
    0x1d, 0x49, 0xf0, 0x19
  ]);
  const rasterHeader = Uint8Array.from([
    0x1d, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff
  ]);
  const end = Uint8Array.from([
    0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00
  ]);

  const out = new Uint8Array(setup.length + rasterHeader.length + raster.length + end.length);
  let offset = 0;
  for (const part of [setup, rasterHeader, raster, end]) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
