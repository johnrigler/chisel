import { ctp500Encode, ctp500EncodeBands } from './ctp500.js?v=20261016-ble3';
import { ctp500ConnectBLE } from './ctp500-ble.js?v=20261016-ble3';

const VERSION = '20261016-ble3';
const get = id => document.getElementById(id);
const paper = get('paper'), status = get('status'), progress = get('progress');
const chooseBLE = get('choose-ble'), choose = get('choose'), print = get('print');
const disconnect = get('disconnect'), save = get('save'), transfer = get('transfer');
const bleSupported = window.isSecureContext && !!navigator.bluetooth;
const serialSupported = window.isSecureContext && !!navigator.serial;
const seconds = ms => (ms / 1000).toFixed(1);
const ascii = value => String(value).replace(/[^\x20-\x7e]/g, '?');
const browser = (navigator.userAgent.match(/(?:Chrome|Chromium)\/([\d.]+)/) || [])[1] || 'unknown';
let ble = null, port = null, busy = false, lastRun = null, sequence = 0;
const log = message => { status.textContent += '\n' + message; };

function buttons() {
  chooseBLE.disabled = busy || !bleSupported;
  choose.disabled = busy || !serialSupported;
  print.disabled = busy || !(port || ble?.device.gatt.connected);
  disconnect.disabled = busy || !ble?.device.gatt.connected;
  transfer.disabled = busy || !bleSupported;
  save.disabled = !lastRun;
}
function releaseBLE() {
  const previous = ble;
  ble = null;
  previous?.disconnect();
  buttons();
}
function newCanvas(height) {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  return { canvas, ctx };
}
function sample(run) {
  const { canvas, ctx } = newCanvas(128);
  ctx.font = 'bold 28px monospace'; ctx.fillText('CTP500 TEST', 12, 29);
  ctx.font = '13px monospace';
  ctx.fillText(VERSION + ' / ' + (run?.id || 'ready'), 12, 49);
  const label = run ? (run.transport === 'BLE' ? run.policy.writeMode + ' 20B / ' + run.policy.delayMs + 'ms' : 'Browser > Web Serial') : 'Connect, then print the receipt';
  ctx.fillText(label, 12, 67);
  ctx.fillRect(12, 83, 360, 5);
  for (let x = 12; x < 372; x += 24) ctx.fillRect(x, 98, 12, 17);
  return canvas;
}
function textImage(title, lines) {
  // Fixed-width wrapping keeps all printed diagnostics inside the paper.
  const wrapped = lines.flatMap(line => {
    const value = ascii(line);
    const rows = [];
    for (let i = 0; i < value.length; i += 42) rows.push(value.slice(i, i + 42));
    return rows.length ? rows : [''];
  });
  const { canvas, ctx } = newCanvas(32 + wrapped.length * 17 + 6);
  ctx.fillRect(12, 1, 240, 2);
  ctx.font = 'bold 15px monospace'; ctx.fillText(title, 12, 23);
  ctx.font = 'bold 14px monospace';
  wrapped.forEach((line, index) => ctx.fillText(line, 12, 43 + index * 17));
  return canvas;
}
function preview(parts) {
  paper.height = parts.reduce((sum, part) => sum + part.height, 0);
  const ctx = paper.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, paper.width, paper.height);
  let y = 0;
  for (const part of parts) { ctx.drawImage(part, 0, y); y += part.height; }
}
function watchVisibility() {
  let hiddenStarted = document.hidden ? performance.now() : null;
  let total = 0;
  const change = () => {
    if (document.hidden && hiddenStarted === null) hiddenStarted = performance.now();
    if (!document.hidden && hiddenStarted !== null) {
      total += performance.now() - hiddenStarted; hiddenStarted = null;
    }
  };
  document.addEventListener('visibilitychange', change);
  return () => {
    document.removeEventListener('visibilitychange', change);
    return total + (hiddenStarted === null ? 0 : performance.now() - hiddenStarted);
  };
}
function reportLines(run) {
  const stats = run.main;
  return [
    run.at.replace(/\.\d+Z$/, 'Z') + ' / ' + run.id,
    'MAIN ' + stats.bytes + 'B / ' + seconds(stats.elapsedMs) + 's / ' + Math.round(stats.bytes * 1000 / Math.max(1, stats.elapsedMs)) + 'B/s',
    stats.writeMode + '; chunk ' + stats.chunkBytes + 'B',
    stats.packets + ' writes; ' + (stats.pacing === 'minimum-interval' ? 'interval ' : 'pause ') + stats.delayMs + 'ms',
    'Call avg/p50/p95 ms: ' + [stats.latency.meanMs, stats.latency.p50Ms, stats.latency.p95Ms].map(n => n.toFixed(1)).join('/'),
    'Max call ' + stats.latency.maxMs.toFixed(1) + 'ms; pause ' + seconds(stats.pauseMs) + 's',
    '25/50/75/100% elapsed seconds:',
    run.milestones.map(ms => seconds(ms)).join(' / '),
    'Hidden ' + seconds(run.hiddenMs) + 's; feed ' + run.feed,
    'Raster: ' + (run.banded ? '8-row bands, trimmed' : 'full width'),
    ascii(run.device).slice(0, 40),
    'Chrome ' + browser + ' / secure ' + window.isSecureContext,
    'Main timing excludes this footer.',
  ];
}
async function sendSerial(writer, bytes, onProgress) {
  const start = performance.now(), latency = [];
  let packets = 0, writeMs = 0, pauseMs = 0;
  for (let offset = 0; offset < bytes.length; offset += 512) {
    const before = performance.now();
    await writer.write(bytes.subarray(offset, offset + 512));
    const elapsed = performance.now() - before;
    latency.push(elapsed); writeMs += elapsed; packets++;
    onProgress(Math.min(offset + 512, bytes.length), bytes.length);
    if (offset + 512 < bytes.length) {
      const paused = performance.now();
      await new Promise(resolve => setTimeout(resolve, 20));
      pauseMs += performance.now() - paused;
    }
  }
  const sorted = latency.slice().sort((a, b) => a - b);
  return {
    bytes: bytes.length, packets, elapsedMs: performance.now() - start,
    writeMode: 'serial', chunkBytes: 512, delayMs: 20, writeMs, pauseMs,
    latency: { samples: sorted.length, meanMs: writeMs / packets,
      p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
      p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1], maxMs: sorted.at(-1) },
  };
}

status.textContent = VERSION + '\nSecure: ' + window.isSecureContext + '\nBLE: ' + !!navigator.bluetooth + '; Serial: ' + !!navigator.serial;
progress.textContent = 'Connect a printer, then print a diagnostic receipt.';
preview([sample()]); buttons();

chooseBLE.addEventListener('click', async () => {
  if (busy) return;
  busy = true; buttons(); releaseBLE(); port = null;
  try {
    const connection = await ctp500ConnectBLE();
    ble = connection;
    connection.device.addEventListener('gattserverdisconnected', () => {
      if (ble !== connection) return;
      ble = null; log('BLE disconnected.'); buttons();
    });
    log('BLE connected: ' + (ble.device.name || 'printer'));
    progress.textContent = 'Ready to print.';
  } catch (error) { log('BLE: ' + error.name + ': ' + error.message); }
  finally { busy = false; buttons(); }
});
choose.addEventListener('click', async () => {
  if (busy) return;
  busy = true; buttons(); releaseBLE(); port = null;
  try { port = await navigator.serial.requestPort(); log('Serial selected.'); progress.textContent = 'Ready to print.'; }
  catch (error) { log('Serial: ' + error.name + ': ' + error.message); }
  finally { busy = false; buttons(); }
});
print.addEventListener('click', async () => {
  if (busy || !(ble || port)) return;
  busy = true;
  const connection = ble, serialPort = port, mode = transfer.value;
  const compatibility = mode === 'compatibility';
  const at = new Date().toISOString();
  const run = {
    id: at.slice(11, 19).replaceAll(':', '') + 'Z-' + (++sequence), at, version: VERSION,
    transport: connection ? 'BLE' : 'Serial', device: connection?.device.name || 'Serial printer',
    policy: connection ? connection.describe({ mode }) : { writeMode: 'serial', delayMs: 20 },
    feed: compatibility ? '160 raster rows' : 'LF x8', milestones: [], hiddenMs: 0,
    banded: mode === 'fast',
  };
  lastRun = run; buttons();
  const mainCanvas = sample(run);
  preview([mainCanvas]);
  let writer, endVisibility;
  const totalStarted = performance.now();
  let phase = 'main';
  try {
    if (serialPort) { await serialPort.open({ baudRate: 9600 }); writer = serialPort.writable.getWriter(); }
    const send = (bytes, callback = () => {}) => connection ? connection.write(bytes, callback, { mode }) : sendSerial(writer, bytes, callback);
    // No blank feed raster and no reset/cut between the main image and footer.
    const encode = run.banded ? ctp500EncodeBands : ctp500Encode;
    const bytes = encode(mainCanvas, { feedLines: 0, cut: false });
    run.mainPlannedBytes = bytes.length;
    const started = performance.now();
    endVisibility = watchVisibility();
    let lastDraw = -Infinity, nextMilestone = 1;
    log('Run ' + run.id + ': main ' + bytes.length + 'B; ' + run.policy.writeMode + '.');
    run.main = await send(bytes, (sent, total) => {
      const elapsed = performance.now() - started;
      run.progressBytes = sent;
      while (nextMilestone <= 4 && sent * 4 >= total * nextMilestone) {
        run.milestones.push(elapsed); nextMilestone++;
      }
      progress.textContent = 'Main image: ' + sent + '/' + total + ' bytes, ' + seconds(elapsed) + ' s';
      if (elapsed - lastDraw >= 1500 || sent === total) {
        preview([mainCanvas, textImage('LIVE - footer not printed yet', [
          run.id + ' / ' + run.policy.writeMode,
          sent + '/' + total + 'B / ' + seconds(elapsed) + 's',
          'Final measurements print next.',
        ])]);
        lastDraw = elapsed;
      }
    });
    run.hiddenMs = endVisibility(); endVisibility = null;
    phase = 'footer';
    const footer = textImage('DIAGNOSTICS - ble3', reportLines(run));
    preview([mainCanvas, footer]);
    const footerBytes = encode(footer, {
      initialize: false, cut: compatibility, trimRight: !compatibility,
      feedRows: compatibility ? 160 : 0, feedLines: compatibility ? 3 : 8,
    });
    run.footerPlannedBytes = footerBytes.length;
    progress.textContent = 'Main sent. Printing measured diagnostic footer…';
    run.footer = await send(footerBytes, (sent, total) => {
      run.footerProgressBytes = sent;
      progress.textContent = 'Diagnostic footer: ' + sent + '/' + total + ' bytes';
    });
    run.elapsedMs = performance.now() - totalStarted;
    run.complete = true;
    const totalBytes = run.main.bytes + run.footer.bytes;
    progress.textContent = 'Receipt submitted. Photograph the paper or save the PNG.';
    log('Main: ' + run.main.bytes + 'B in ' + seconds(run.main.elapsedMs) + 's.');
    log('Footer: ' + run.footer.bytes + 'B in ' + seconds(run.footer.elapsedMs) + 's.');
    log('Total send: ' + totalBytes + 'B / ' + seconds(run.elapsedMs) + 's. Printed timing covers main only.');
  } catch (error) {
    run.error = error.name + ': ' + error.message;
    run.failedPhase = phase;
    run.partial = error.transferStats || null;
    if (endVisibility) { run.hiddenMs = endVisibility(); endVisibility = null; }
    // A partial raster may still be awaiting bytes: never send an error footer.
    const lines = ['NOT PRINTED: ' + phase + ' transfer failed', run.id, run.error,
      'Main submitted: ' + (run.main?.bytes ?? run.partial?.bytes ?? run.progressBytes ?? 0) + 'B',
      'Failed-phase submitted: ' + (run.partial?.bytes ?? (phase === 'main' ? run.progressBytes : run.footerProgressBytes) ?? 0) + 'B',
      'Restart printer before a new attempt.'];
    if (run.main) lines.push(...reportLines(run));
    preview([mainCanvas, textImage('PNG DIAGNOSTICS - NOT PRINTED', lines)]);
    progress.textContent = 'Transfer failed. Save PNG for diagnosis; restart printer before retrying.';
    log(run.error);
  } finally {
    if (endVisibility) endVisibility();
    if (writer) writer.releaseLock();
    if (serialPort) {
      try { if (serialPort.readable || serialPort.writable) await serialPort.close(); }
      catch (error) { log('Close: ' + error.message); }
    }
    busy = false; buttons();
  }
});
disconnect.addEventListener('click', () => { releaseBLE(); log('BLE disconnected.'); });
window.addEventListener('pagehide', releaseBLE);
save.addEventListener('click', () => {
  // toBlob snapshots the visible receipt, including live or final diagnostics.
  paper.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'ctp500-' + VERSION + '-' + (lastRun?.id || 'preview') + '.png';
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
});
