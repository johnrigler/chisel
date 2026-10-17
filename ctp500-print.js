/* Reusable browser-only CTP500 image printing. No backend or native app. */
import { ctp500Encode, ctp500EncodeBands } from './ctp500.js?v=20261016-ble3';
import { ctp500ConnectBLE } from './ctp500-ble.js?v=20261016-ble3';

export const CTP500_PRINT_VERSION = '20261016-print1';

// The returned canvas is the black/white, 384-dot image sent to the printer.
export function ctp500PreparePrint(source, { mode = 'fast', threshold = 128 } = {}) {
  if (!['fast', 'acknowledged', 'compatibility'].includes(mode)) throw new RangeError('Unknown print mode.');
  if (!source?.width || !source?.height) throw new TypeError('Choose a nonempty image first.');
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) throw new RangeError('Invalid image threshold.');
  const height = Math.max(1, Math.round(source.height * 384 / source.width));
  if (height > 16384) throw new RangeError('Image is too tall. Split it into sections below 16,384 printer rows.');
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 384, height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, 384, height);
  const image = ctx.getImageData(0, 0, 384, height);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = 0.2126 * image.data[i] + 0.7152 * image.data[i + 1] + 0.0722 * image.data[i + 2] < threshold ? 0 : 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const original = mode === 'compatibility';
  const encode = mode === 'fast' ? ctp500EncodeBands : ctp500Encode;
  const bytes = encode(canvas, { threshold, feedRows: original ? 160 : 0, feedLines: original ? 3 : 8, cut: original });
  return { canvas, bytes, mode };
}

// Call this directly from a Connect button: browsers require a user gesture.
// The connection is reused until disconnect; printing never opens a chooser.
export async function ctp500ConnectPrinter({ transport = 'ble' } = {}) {
  if (transport === 'ble') {
    const ble = await ctp500ConnectBLE();
    return {
      transport, label: ble.device.name || 'CTP500', device: ble.device,
      get connected() { return ble.device.gatt.connected; },
      describe: options => ble.describe(options),
      write: (bytes, onProgress, options) => ble.write(bytes, onProgress, options),
      disconnect: () => ble.disconnect(),
    };
  }
  if (transport !== 'serial') throw new RangeError('Unknown printer connection.');
  if (!globalThis.isSecureContext || !navigator.serial) throw new Error('Web Serial requires a supported browser on HTTPS or localhost.');
  const port = await navigator.serial.requestPort();
  let selected = true, writing = false;
  return {
    transport, label: 'Web Serial printer',
    get connected() { return selected; },
    describe: () => ({ writeMode: 'serial', chunkBytes: 512, delayMs: 20, pacing: 'after-write' }),
    async disconnect() {
      selected = false;
      if (port.writable && !writing) await port.close();
    },
    async write(bytes, onProgress = () => {}) {
      if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected printer bytes.');
      if (!selected) throw new Error('Choose the Serial printer again.');
      if (writing) throw new Error('A print job is already running.');
      writing = true;
      const started = performance.now();
      let writer, sent = 0, packets = 0;
      try {
        await port.open({ baudRate: 9600 });
        writer = port.writable.getWriter();
        for (let offset = 0; offset < bytes.length; offset += 512) {
          if (!selected) throw new Error('Printer disconnected during output.');
          const part = bytes.subarray(offset, offset + 512);
          await writer.write(part);
          sent += part.length; packets++;
          onProgress(sent, bytes.length);
          if (sent < bytes.length) await new Promise(resolve => setTimeout(resolve, 20));
        }
        return { bytes: sent, packets, elapsedMs: performance.now() - started, writeMode: 'serial' };
      } catch (cause) {
        const error = new Error(cause.message || String(cause));
        error.name = cause.name || 'Error';
        error.transferStats = { bytes: sent, packets, elapsedMs: performance.now() - started };
        throw error;
      } finally {
        writer?.releaseLock();
        try { if (port.writable) await port.close(); } finally { writing = false; }
      }
    },
  };
}
