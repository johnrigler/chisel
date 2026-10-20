# CTP500 receipts and folded letters

Vanilla browser JavaScript, static/IPFS compatible. The default view builds an
upright 384-dot receipt inspired by the supplied 2026-10-20 receipt photos.
The original four-page folded letter remains available under **Print layout**
or `?layout=letter`. No build, Node runtime, CDN, or server-side conversion.

[Open the hosted tool](https://johnrigler.github.io/chisel/tools/ctp500-folded-letter/).
Mogwai owns this source; Chisel serves an identical tool directory for phones.
Use HTTPS or localhost in a Chromium browser supporting BLE or Web Serial.
Keep this directory together when serving it or adding it to IPFS.

## Receipts

Edit the sample, **Build receipt**, connect BLE or Serial, then **Print strip**.
Preview and PNG show the black/white raster actually encoded for the printer.
The 32-column sample includes a demo header, order, item modifiers, aligned
prices, subtotal, tax, total, closing and QR. It uses the photographed totals
($33.45 + $2.20 = $35.65), with demo merchant, order and payment data. It is
explicitly marked as a sample. Source photos and payment details are not shipped.

`receipt.js` separates `receiptText(record)` from `buildReceipt({text, qr})`.
Records use integer cents and quantities. This is a starting point for real
receipt generation; manually edited text prints as entered and is not recalculated.
Receipt text wraps instead of clipping and uses only the rows it needs. Clear
the receipt QR field to omit the code. The demo QR points to this repository,
not a stored transaction. No order storage or payment processing is implemented.

## Printing reliability and measurements

**Reliable / original pacing** is the default. All modes now send one full-width
384-dot raster plus 160 explicit white feed rows, followed by the original
ending commands. The connection test uses the same framing and default pacing,
prints two short lines and advances them to the tear bar. Connect the printer,
then select **Print connection test** before sending a full receipt.

On 2026-10-20 the user reported only a tiny fragment printing before stopping.
The initial default had combined variable-width 8-row bands, LF-only trailing
feed and faster writes. Software pixel equivalence did not establish printer
firmware acceptance or buffer capacity. Those framing changes have been
removed from this tool's print path; the exact cause is not yet established.
The earlier 53% / 71% byte reductions do not apply to this version.

Reliable mode uses acknowledged 20-byte writes plus a 20 ms pause when the
characteristic supports acknowledgments. Acknowledged mode removes the extra
pause. Fast uses writes without responses when supported and the earlier
25 ms minimum start interval; it is explicitly experimental for this receipt.
Changing transfer mode changes pacing only. No banded raster or LF-only feed
is selected by this page. The reusable band encoder remains exported for other
callers but is unused here.

The ready message reports byte count. Sending reports progress, elapsed time,
B/s and the write method. Errors include accepted byte count. These measure
submission to the browser transport, not successful printing. If paper stops,
retain the final status message to distinguish a failed/stalled transfer from
printer rejection after submission. Restart the printer before retrying a
partial job. There are no automatic retries. Screen wake lock is best-effort;
keep the tab visible.

## Folded-letter use

1. Print **Numbered fold test** first.
2. Paste a letter, or load a text file. Set its title and optionally choose an
   image and enter QR text or a URL. Images and QR codes occupy page 4.
3. **Build letter** previews pages in reading order. Overflow blocks printing;
   increase page length, reduce text size, or shorten the letter to fit.
4. **Connect BLE (phone)**, select the printer, then **Print strip**. Serial
   is also available. Use the default Reliable mode first.
5. Leave the page open until all bytes have been sent and printing completes.
   Tear off the extra blank feed. If transmission fails, restart the printer
   before sending a new raster; the tool does not retry interrupted jobs.

## Layout and folds

Each page is `pageLength × 384` dots, with text, fold and binding margins.
The default page length is 800 dots; it can be 640–1600. Body type is
16–28 dots, default 20. This is reflowed text, not a shrunken US Letter page.

Pages are placed in strip order **4, 1, 2, 3**, each rotated clockwise by 90°.
Dashed fold lines lie between panels. The printer canvas is 384 dots wide and
four page lengths long. Every mode adds 160 white feed rows.

Fold at the central line with the blank backs together, pairing page 2 behind
page 1 and page 3 behind page 4. Then fold at the remaining page boundary to
put page 1 on the front and page 4 on the back. Open at the second fold to
read pages 2 and 3. Staple close to this spine if desired, clear of the text.
This creates visible printing on both sides of the finished object from one
printable face; the printer does not perform duplex printing.

The numbered test has top markers, page numbers, cover/back labels and spine
edges. Validate that physical fold order before printing a real letter. A
simple two-fold strip creates four readable pages, not an eight-page zine.

## Limits and verification

Content exists in memory only; no automatic saving or uploading. The PNG
download contains the printed strip (without the trailing feed). The app
invalidates a prepared strip after edits, so stale text cannot be sent.
QR codes have a four-module white border, integer scaling and a minimum of
three dots per module; longer payloads are rejected. Images are thresholded
to black and white by the existing encoder; photographic detail may be lost.

Browser/layout checks do not establish paper dimensions, mechanical feed
accuracy, readable type, successful long-raster printing, or physical QR
scanning. Those remain physical acceptance checks for this prototype. The
previous short-image BLE/Serial tests are not evidence that this longer job
has already printed. Keep the tab open: printing does not continue after
navigation or app suspension.

Project record: `johnrigler/daisy_2026/427/ctp500-folded-letter/`.
