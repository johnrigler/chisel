import { buildLetter, makeQR } from './layout.js?v=20261020-receipt2';
import { buildReceipt, SAMPLE_RECEIPT } from './receipt.js?v=20261020-receipt2';
import { ctp500PreparePrint, ctp500ConnectPrinter, ctp500BeginPrintSession } from './ctp500-print.js?v=20261020-receipt2';

const $ = id => document.getElementById(id);
let image = null, prepared = null, printer = null, busy = false, revision = 0;
const status = message => { $('status').textContent = message; };
const receiptMode = () => $('layout').value === 'receipt';
const controls = ['build', 'calibrate', 'title', 'letter', 'length', 'font-size', 'image-file', 'text-file', 'qr-text', 'clear-image', 'transfer', 'layout', 'receipt-text', 'receipt-qr', 'sample'];
function buttons() {
  $('connect-ble').disabled = busy || !window.isSecureContext || !navigator.bluetooth;
  $('connect-serial').disabled = busy || !window.isSecureContext || !navigator.serial;
  $('print').disabled = busy || !prepared || !printer?.connected;
  $('connection-test').disabled = busy || !printer?.connected;
  $('save').disabled = busy || !prepared;
  $('disconnect').disabled = busy || !printer;
  for (const id of controls) $(id).disabled = busy;
}
function invalidate() {
  revision++; prepared = null; buttons();
  status('Content changed. Build the preview again before printing or saving.');
}
function layout() {
  const receipt = receiptMode();
  document.body.classList.toggle('receipt', receipt);
  $('receipt-editor').hidden = !receipt;
  $('letter-editor').hidden = receipt;
  $('calibrate').hidden = receipt;
  $('fold-help').hidden = receipt;
  $('build').textContent = receipt ? 'Build receipt' : 'Build letter';
  $('preview-title').textContent = receipt ? 'Receipt preview' : 'Reading order';
}
function build(calibration = false) {
  prepared = null;
  try {
    const receipt = receiptMode();
    const result = receipt
      ? buildReceipt({ text: $('receipt-text').value, qr: makeQR($('receipt-qr').value) })
      : buildLetter({ title: $('title').value, text: $('letter').value, width: Number($('length').value), fontSize: Number($('font-size').value), image: calibration ? null : image, qr: calibration ? null : makeQR($('qr-text').value), calibration });
    const mode = $('transfer').value;
    const job = ctp500PreparePrint(result.strip, { mode });
    prepared = { ...job, calibration, receipt };
    const preview = $('pages'); preview.replaceChildren();
    (receipt ? [job.canvas] : result.pages).forEach((page, i) => {
      const figure = document.createElement('figure'), caption = document.createElement('figcaption');
      caption.textContent = receipt ? 'Upright · 384 dots wide' : `Page ${i + 1}${i === 0 ? ' · cover' : i === 3 ? ' · back' : ''}`;
      figure.append(caption, page); preview.append(figure);
    });
    const strip = $('strip'); strip.width = job.canvas.width; strip.height = job.canvas.height;
    strip.getContext('2d').drawImage(job.canvas, 0, 0);
    status(`${receipt ? 'Receipt' : calibration ? 'Fold test' : 'Letter'} ready: 384 × ${strip.height} dots; ${job.bytes.length.toLocaleString()} bytes. Full-width raster with paper feed. ${mode === 'compatibility' ? 'Reliable pacing.' : 'Faster transfer selected.'}`);
  } catch (error) { prepared = null; status(error.message); }
  buttons();
}
async function disconnect() { const old = printer; printer = null; await old?.disconnect(); }
async function connect(transport) {
  busy = true; buttons();
  try {
    await disconnect();
    const connection = await ctp500ConnectPrinter({ transport }); printer = connection;
    connection.device?.addEventListener('gattserverdisconnected', () => {
      if (printer !== connection) return;
      printer = null; status('Printer disconnected.'); buttons();
    });
    status('Connected: ' + connection.label);
  } catch (error) { status('Connection: ' + error.message); }
  finally { busy = false; buttons(); }
}
function connectionTestCanvas() {
  const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 384, 64);
  ctx.fillStyle = '#000'; ctx.font = 'bold 22px monospace';
  ctx.fillText('CTP500 CONNECTION TEST', 12, 25);
  ctx.font = '18px monospace'; ctx.fillText('Readable text + paper feed', 12, 51);
  return canvas;
}
async function print(testOnly = false) {
  if (busy || (!testOnly && !prepared) || !printer?.connected) return;
  const job = testOnly ? ctp500PreparePrint(connectionTestCanvas()) : prepared;
  const connection = printer;
  busy = true; buttons();
  const finish = ctp500BeginPrintSession();
  const started = performance.now();
  try {
    status(testOnly ? 'Sending connection test… keep this page open.' : 'Sending… keep this page open.');
    let previous = -1;
    const stats = await connection.write(job.bytes, (sent, total) => {
      const percentage = Math.floor(sent / total * 100);
      if (percentage !== previous) { status(`Sending: ${percentage}% · ${sent.toLocaleString()} / ${total.toLocaleString()} bytes`); previous = percentage; }
    }, { mode: job.mode });
    const seconds = (performance.now() - started) / 1000;
    status(`Sent ${job.bytes.length.toLocaleString()} bytes in ${seconds.toFixed(1)} s (${Math.round(job.bytes.length / Math.max(seconds, .001)).toLocaleString()} B/s; ${stats.writeMode}). Wait for paper to finish.`);
  } catch (error) {
    const sent = error.transferStats?.bytes ?? 0;
    status(`Print interrupted after ${sent.toLocaleString()} / ${job.bytes.length.toLocaleString()} bytes: ${error.message}. Restart the printer before sending a fresh job.`);
  }
  finally { await finish(); busy = false; buttons(); }
}
for (const id of ['title', 'letter', 'length', 'font-size', 'qr-text', 'receipt-text', 'receipt-qr']) $(id).addEventListener('input', invalidate);
$('layout').addEventListener('change', () => { invalidate(); layout(); build(); });
$('transfer').addEventListener('change', () => { const calibration = prepared?.calibration; invalidate(); build(calibration); });
$('sample').addEventListener('click', () => { $('receipt-text').value = SAMPLE_RECEIPT; invalidate(); build(); });
$('text-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  invalidate(); const current = revision;
  try { const text = await file.text(); if (current === revision) { $('letter').value = text; invalidate(); } }
  catch (error) { status('Text file: ' + error.message); }
});
$('image-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  invalidate(); const current = revision;
  try {
    const bitmap = await createImageBitmap(file);
    if (current !== revision) { bitmap.close(); return; }
    image?.close(); image = bitmap; invalidate();
  } catch (error) { status('Image file: ' + error.message); }
});
$('clear-image').addEventListener('click', () => { image?.close(); image = null; $('image-file').value = ''; invalidate(); });
$('build').addEventListener('click', () => build());
$('calibrate').addEventListener('click', () => build(true));
$('connect-ble').addEventListener('click', () => connect('ble'));
$('connect-serial').addEventListener('click', () => connect('serial'));
$('disconnect').addEventListener('click', async () => {
  busy = true; buttons();
  try { await disconnect(); status('Disconnected.'); }
  catch (error) { status(error.message); }
  finally { busy = false; buttons(); }
});
$('print').addEventListener('click', () => print());
$('connection-test').addEventListener('click', () => print(true));
$('save').addEventListener('click', () => {
  if (!prepared) return;
  const name = prepared.receipt ? 'ctp500-receipt.png' : prepared.calibration ? 'ctp500-fold-test.png' : 'ctp500-folded-letter.png';
  $('strip').toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
});
window.addEventListener('pagehide', () => { void disconnect(); });
$('receipt-text').value = SAMPLE_RECEIPT;
if (new URLSearchParams(location.search).get('layout') === 'letter') $('layout').value = 'letter';
layout(); build();
