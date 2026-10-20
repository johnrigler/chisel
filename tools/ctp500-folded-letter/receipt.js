// Receipt text and layout are independent of printer transport. Integer cents.
export const RECEIPT_COLUMNS = 32;

function money(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new RangeError('Amounts must be nonnegative integer cents.');
  return '$' + (cents / 100).toFixed(2);
}
function pair(label, value) {
  const space = RECEIPT_COLUMNS - label.length - value.length;
  return space > 0 ? label + ' '.repeat(space) + value : label + '\n' + value.padStart(RECEIPT_COLUMNS);
}
function center(text) { return text.padStart(Math.floor((RECEIPT_COLUMNS + text.length) / 2)); }

export function receiptText({ merchant, location, date, order, items, taxCents, payment = 'DEMO PAYMENT' }) {
  let subtotal = 0;
  const lines = [center(merchant), center(location), '', center('SAMPLE / NOT A PAYMENT RECEIPT'), '', date, 'Order: ' + order, '-'.repeat(32)];
  for (const { description, quantity = 1, unitCents, notes = [] } of items) {
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new RangeError('Quantity must be a positive integer.');
    const amount = unitCents * quantity;
    money(unitCents); money(amount); subtotal += amount;
    lines.push(pair(quantity + ' ' + description, money(amount)), ...notes.map(note => '  ' + note));
  }
  money(subtotal); money(taxCents); const total = subtotal + taxCents;
  lines.push('-'.repeat(32), pair('Subtotal', money(subtotal)), pair('Sales tax', money(taxCents)), '', pair('TOTAL', money(total)), '', pair(payment, money(total)), '', center('ORDER CLOSED'), center('Thank you!'), '', center('Demo receipt record below.'));
  return lines.join('\n');
}

// Photo-inspired hierarchy and totals. Merchant, order and payment are demo data.
export const SAMPLE_RECEIPT = receiptText({
  merchant: 'MOGWAI DEMO', location: 'Bluewater, New Mexico',
  date: '10/20/2026   11:43 AM', order: 'DEMO-0036 / TO GO',
  items: [
    { description: '4PC CHICKEN STRIP', unitCents: 1299, notes: ['REG FRY / GRAVY DIP'] },
    { description: 'SM BLIZZARD', unitCents: 299, notes: ['BUTTERFINGER'] },
    { description: '4PC CHICKEN S&T', unitCents: 1369, notes: ['HONEY BBQ / BUFFALO DIP'] },
    { description: 'ONION RINGS UPGRADE', unitCents: 79 },
    { description: 'SM BLIZZARD', unitCents: 299, notes: ['HEATH'] },
  ], taxCents: 220,
});

export function buildReceipt({ text, qr = null }) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Enter receipt text first.');
  if (text.length > 20000) throw new Error('Receipt is too long. Split it into smaller receipts.');
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = '18px monospace';
  const lines = [];
  for (const original of text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n')) {
    let line = '';
    for (const char of original) {
      if (line && probe.measureText(line + char).width > 360) { lines.push(line); line = ''; }
      line += char;
    }
    lines.push(line);
  }
  const height = 24 + lines.length * 23 + (qr ? qr.height + 12 : 0);
  if (height > 16384) throw new Error('Receipt exceeds 16,384 rows. Split it into sections.');
  const strip = document.createElement('canvas'); strip.width = 384; strip.height = height;
  const ctx = strip.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 384, height);
  ctx.fillStyle = '#000'; ctx.font = '18px monospace'; ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, 12, 12 + i * 23));
  if (qr) { ctx.imageSmoothingEnabled = false; ctx.drawImage(qr, Math.floor((384 - qr.width) / 2), 12 + lines.length * 23); }
  return { pages: [strip], strip };
}
