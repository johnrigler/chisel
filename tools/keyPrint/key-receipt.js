/* Two-sided paper wallet artwork. Browser JavaScript; no network or dependencies. */
function browserCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

function drawValue(ctx, value, y, startSize, maxWidth) {
  let size = startSize;
  do { ctx.font = size + 'px ui-monospace, Menlo, Consolas, monospace'; }
  while (ctx.measureText(value).width > maxWidth && --size >= 14);
  if (ctx.measureText(value).width > maxWidth) throw new RangeError('Key or address is too long for this receipt.');
  ctx.fillText(value, 320, y);
}

export function createKeyReceipt(packet, { makeQrCanvas, createCanvas = browserCanvas } = {}) {
  if (!packet?.wif || !packet?.address) throw new TypeError('The receipt needs a WIF and an address.');
  if (typeof makeQrCanvas !== 'function') throw new TypeError('A QR renderer is required.');
  // Lay out across the paper's length, then rotate once into the 384-dot roll.
  // Equal 640-dot panels line up when the private side is folded behind the address.
  const landscape = createCanvas(1280, 384);
  const ctx = landscape.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1280, 384);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
  ctx.imageSmoothingEnabled = false;
  let coin = (packet.displayName || packet.currency) + (packet.ticker ? ' (' + packet.ticker + ')' : '');
  if (packet.network && packet.network !== 'mainnet' && !coin.toLowerCase().includes(packet.network.toLowerCase())) coin += ' · ' + packet.network;
  const label = String(packet.label || '').trim();
  let caption = coin;
  if (label && label !== 'Chisel key packet') {
    let shortLabel = label.slice(0, 80);
    ctx.font = '18px sans-serif';
    while (shortLabel && ctx.measureText(coin + ' · ' + shortLabel + '…').width > 592) shortLabel = shortLabel.slice(0, -1);
    if (shortLabel) caption += ' · ' + shortLabel + (shortLabel === label ? '' : '…');
  }

  const panels = [
    { title: 'PRIVATE KEY (WIF)', value: packet.wif, fontSize: 22, footer: 'KEEP COVERED · DO NOT SHARE' },
    { title: 'YOUR ADDRESS', value: packet.address, fontSize: 28, footer: 'SHARE THIS TO RECEIVE ' + (packet.ticker || '').toUpperCase() },
  ];
  panels.forEach((panel, index) => {
    ctx.save(); ctx.translate(index * 640, 0);
    ctx.font = 'bold 28px sans-serif'; ctx.fillText(panel.title, 320, 14);
    ctx.font = '18px sans-serif'; ctx.fillText(caption, 320, 52);
    const qr = makeQrCanvas(panel.value, 224);
    ctx.drawImage(qr, 208, 84);
    drawValue(ctx, panel.value, 326, panel.fontSize, 592);
    ctx.font = 'bold 15px sans-serif'; ctx.fillText(panel.footer, 320, 362);
    ctx.restore();
  });

  ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
  ctx.beginPath(); ctx.moveTo(640, 0); ctx.lineTo(640, 384); ctx.stroke();
  ctx.setLineDash([]);
  ctx.save(); ctx.translate(640, 192); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(-65, -11, 130, 22);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px sans-serif';
  ctx.fillText('FOLD HERE', 0, 0); ctx.restore();

  const canvas = createCanvas(384, 1280);
  const output = canvas.getContext('2d');
  output.imageSmoothingEnabled = false;
  output.translate(384, 0); output.rotate(Math.PI / 2); output.drawImage(landscape, 0, 0);
  return canvas;
}
