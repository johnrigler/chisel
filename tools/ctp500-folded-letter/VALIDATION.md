# Android Serial route · 2026-10-20 · receipt3

User observations now establish the transport boundary: Chromebook printing
advanced paper; Android BLE writes continued but paper stayed stationary,
producing a black band. Screenshot run `200715Z-1` on the older diagnostic page
submitted 26,293 bytes in 133.9 s; that is browser submission, not a successful
physical print. The receipt2 screenshot shows an active transfer at 38%.

Chrome's official 138 release notes establish Android RFCOMM support; the
phone screenshot reports Chrome 155 and `Serial: true`. Bluetooth Serial is
now the recommended route on both devices, with a standard SPP chooser filter.
BLE remains experimental. No claim of an Android hardware fix is made.

A 10-byte feed-only test sends ESC @ and eight LF bytes without any raster
or text. Tests verify the picker service UUID, Serial as the API default,
exact probe bytes, ordered transfer and port cleanup. A DOM harness checks
the feed button and short image over mocked Serial, connection reuse and UI
status. Ten transport/raster tests pass. Native browser launch was unavailable
for this revision; Android hardware tests remain open.

Reference: https://developer.chrome.com/release-notes/138#web_serial_over_bluetooth_on_android

---

# Reliability correction · 2026-10-20 · receipt2

Physical user report: the initial test activated the printer, printed only a
tiny unreadable fragment, then stopped. This supersedes the earlier software
checks as evidence of hardware compatibility. Cause remains unconfirmed.

The print wrapper now defaults to Reliable mode and uses the original single
full-width raster plus 160 explicit white feed rows for every transfer mode.
Variable-width bands and compact LF-only feed are no longer selected by the
UI. Prior byte-reduction figures are historical, not current benefits.
A separate 384 × 64-dot connection test prints two readable lines plus feed
using Reliable pacing regardless of the selected receipt transfer mode.

Regression checks compare each mode byte-for-byte with the original encoder
and verify full raster width, pixel positions and all 160 trailing feed rows.
Browser checks cover default selection, both layouts, the dedicated test's
bytes, acknowledged write method, progress, and error byte counts. Hardware
retest is still required; publishing this correction does not establish success.

---

# Receipt and speed validation · 2026-10-20

Passed in headless Chromium with the actual modules, native Canvas and
vendored QRCode.js; phone viewport 390 × 844:

- Sample receipt builds with aligned totals; upright 384 × 851-dot output.
- No horizontal page overflow; receipt preview inspected visually.
- Fast receipt: **22,818 bytes**, versus original **48,557 bytes** (53% smaller).
- Default folded letter: **46,591 bytes**, versus **161,309** (71% smaller).
- Numbered fold test: **30,967 bytes** (81% smaller than original).
- Decoding fast raster packets reproduces all baseline pixels and row positions,
  including sparse marks at both extreme columns and blank/dense test images.
- Dense images select a single raster when band headers would be larger.
- Original fallback emits the original byte count and feed; changing modes
  rebuilds bytes, editing text invalidates output, sample reload and both
  layouts work, no browser JavaScript errors.
- Simulated browser BLE printing uses fast writes, reports elapsed time/B/s,
  and recovers controls after an injected failure without retrying the chunk.
- Nine Node regression checks pass: raster/feed identity, receipt arithmetic,
  BLE packet ordering/pacing, connection reuse, Serial cleanup and no retries,
  concurrent-job rejection and wake-lock lifecycle.

No printer is attached. These are byte/layout checks, not measured physical
speed, paper-feed, QR-scan or Bluetooth-buffer acceptance on this job.

Imported source blobs from `johnrigler/chisel`:

- `ctp500.js`: `61d97ba3c3d266f978655b5ef529f21733a5e3bf`
- `ctp500-ble.js`: `35094620236bf99ac8fe44c9979adb543bb83f8c`
- `ctp500-print.js`: `21ba303c8963130936aee3c217f632e91b496940`

The local print wrapper adds automatic choice of the smaller raster and
cache-busted module imports. The historical validation below describes the
older full-width, acknowledged-only prototype.

---

# Prototype validation · 2026-10-18

Passed using the actual layout/encoder/UI modules, the vendored QRCode.js,
native canvas rendering and a minimal DOM/connection harness:

- Every sampled source-page pixel maps to the expected rotated strip panel
  in order 4, 1, 2, 3.
- Excess text throws an overflow error and disables saving/printing.
- Editing content invalidates the previously prepared bytes.
- Short QR payload retains a four-module white quiet zone and whole-dot
  modules; excessive density is rejected.
- A back-page image and QR render within their reserved column.
- Raster framing, row count and 160 blank feed rows match the existing encoder.
- Initial app build and numbered test both generate output.
- A simulated GATT connection receives the prepared bytes via ordered,
  acknowledged chunks of at most 20 bytes; success resets the UI state.
- JavaScript syntax checks pass.

The 800-dot panel test produces a 384 × 3200-dot strip and a 161,309-byte
printer stream including feed. That is substantially larger than the earlier
short CTP500 test. No actual throughput or print completion is claimed.

Full browser QA could not run: no Chromium binary was installed and its
download failed. Native canvas/module checks do not replace browser checks.
No CTP500 was connected. Physical fold alignment, legibility, QR scanning,
long-raster buffering and final paper feed remain unverified. Print the
numbered test first.

Unchanged source modules inspected before copying:

- `johnrigler/daisy_2026/42/ctp500.js` blob
  `89e720478760867e90420ca05738d6249298b040`.
- `johnrigler/daisy_2026/42/ctp500-ble.js` blob
  `12449619a7cdaeb5da560fd1a1f8118f296c8172`.
- `johnrigler/chisel/vendor/qrcode.min.js` blob
  `993e88f396640f881b69f98db7a4d17401ef83ca`.
