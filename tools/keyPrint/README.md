# Chisel key and image printer

Open https://johnrigler.github.io/chisel/tools/keyPrint/index.html?v=20261017-menu1
or choose **Tools → Key and image printer** in Chisel.

This merges the former Key InstaPrint PNG tool with the CTP500 BLE transport
verified on Teal Printer. It is plain browser JavaScript for HTTPS/static/IPFS
hosting. No printing server, package install, or native app is required.

1. Choose **Key receipt**, paste a WIF/private hex value, and press **Continue**.
   Or choose **Image or photo** and select a file. A scanner handoff prepares
   its key receipt automatically.
2. Choose **Connect printer** and select **Teal Printer** on the phone. On a
   Chromebook, the Serial connection is available after system Bluetooth pairing.
3. Check the displayed receipt or image, then press the large **Print** button.
   Keep the page open until the transfer finishes. The connection can be reused.

The next action and its numbered step are highlighted. Continue moves to
connection, or directly to Print if the printer is already connected. Only the
final Print button sends data to the printer. The full receipt is visible on the page. Folded key receipts start in a readable
sideways view. **Rotate preview 90°** turns the displayed copy; **Open image**
opens the current view at full size. Saving and printing use the original
384-dot paper-feed layout.

**Save image** exports the same black-and-white, 384-dot PNG. Key saving and printer settings are expandable. Unsupported
browsers can still save images. Normal prints contain only the displayed image
and final paper feed. The diagnostic receipt remains under Printer settings and
help. Connection controls for unavailable transports are hidden.

The default uses the measured ble3 setting: eight-row trimmed raster bands,
20-byte writes without responses at a minimum 25 ms start interval, and eight
LF bytes for final feed. Acknowledged and original-pacing presets are available.
The transfer estimate uses 800 bytes/second; actual duration is reported
after transmission.

The folded key receipt contains only a WIF QR/text panel and an address QR/text
panel, with the currency printed on both sides. Raw private hex, public keys,
and JSON are not printed. Two equal panels are laid out sideways and rotated
into a 384 × 1280-dot strip. The private panel folds behind the address panel.
The full WIF and address each occupy one line. QR modules remain whole pixels
with at least four quiet modules on each side. Editing the key, label, or
currency invalidates the old receipt. Printing requires a prepared image
and an explicit button press. A failed transfer disconnects and is never retried
automatically; restart the printer before another attempt.

Existing saved packets and one-shot recorder handoffs keep their original
storage names and packet schema for compatibility. The recorder's **PRINT / PNG**
button opens this tool; its **READY TO PRINT** badge records a prepared receipt,
rather than proof of physical printing. Images are not automatically added to device
storage or uploaded to a server.

## Reuse from another browser page

`../../ctp500-print.js` provides the image preparation and connection adapter.
Call the connection function from the user's Connect button. Keep that returned
connection for subsequent print jobs:

```js
import { ctp500ConnectPrinter, ctp500PreparePrint } from '../../ctp500-print.js?v=20261016-print4';

let printer;
connectButton.onclick = async () => {
  printer = await ctp500ConnectPrinter({ transport: 'ble' });
};
printButton.onclick = async () => {
  const job = ctp500PreparePrint(myCanvas, { mode: 'fast' });
  await printer.write(job.bytes, (sent, total) => {
    status.textContent = `${sent}/${total} bytes`;
  }, { mode: job.mode });
};
```

The returned `job.canvas` is the monochrome export/preview. Use `serial` for the
Chromebook chooser. `printer.connected`, `printer.label`, `printer.describe()`
and `printer.disconnect()` are also available. Keep the encoder and BLE module
alongside the shared printing module when copying these static files.

## Validation and driver scope

Repository tests cover connection reuse, packet ordering/pacing, serial cleanup,
concurrent-job rejection, and failure byte counts. Additional native-canvas and
simulated-radio checks cover the rendered QR grid/quiet margins, pixel equality
between preview and raster, image transparency, scanner handoff, key-edit
invalidation, reconnect, export fallback, and no diagnostic footer on normal
prints. These checks do not substitute for scanning a physical printed QR.
The shorter ble3 phone receipt is the confirmed hardware baseline; the merged
key/image workflow still needs a phone print check.

A system-wide Android printer would require an installed native PrintService;
this page uses an explicit browser Bluetooth connection. John deferred native
driver work in favor of one-time browser use.
Android reference: https://developer.android.com/reference/android/printservice/PrintService

## Page lifetime and buffering

The whole job is prepared in browser memory before transmission. The verified
BLE pacing remains unchanged; device buffer capacity is unknown. Closing or
navigating away from the page can stop a transfer. Web Bluetooth is unavailable
in service workers, so a service worker cannot own this connection. Reliable
printing after the page closes would require a separate native/local spooler.

While sending, the page requests a screen wake lock, reacquires it when visible
again, and registers a browser leave confirmation. Wake lock denial never stops
a print. Both resources are released when the transfer succeeds or fails. Mobile
browsers may omit leave prompts; these measures do not promise background printing.

WIF contains the private scalar and compression/network information, but its
prefix is not currency-unique: Ravencoin and DigiByte mainnet both use 128. The
selected currency label is therefore retained on both printed panels. Existing
internal packet/storage formats remain compatible; their JSON is not shown or printed.

References: [Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API),
[Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).
