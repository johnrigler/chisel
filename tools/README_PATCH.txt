Patch contents:

- tools/qrField/index.html
  Added to the main Chisel Tools panel.
  Fixed nested vendor path to load ../../vendor/qrcode.min.js.

- tools/boxLabels.html
  Chisel tools version of the 2x2 Base64/RVN label builder.
  It loads the shared qrcodejs library from:
  vendor/qrcode.min.js

- vendor/qrcode.min.js
  Included only so the path is present if your branch does not already have it.

Changes:
- Removed the printed CERTLEDGER header from each label.
- Removed the printed NO CLIENT CONTENT ON-CHAIN footer from each label.
- Enlarged both QR codes from roughly 0.72in to 0.90in inside each 2x2 label.
- Removed QR canvas borders/extra box whitespace.
- Replaced the custom inline QR encoder with the shared qrcodejs package used by tools/qrField/index.html.
- Fixed printed Ravencoin locator format to literal |RVN|:<block>:<pos>.
