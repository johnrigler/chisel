Patch contents:

- tools/boxLabels4.html
  Chisel tools version of the 2x2 Base64/RVN label builder.
  It loads the shared qrcodejs library from:
  tools/qrField/lib/davidshimjs-qrcodejs-04f46c6/qrcode.min.js

- tools/qrField/lib/davidshimjs-qrcodejs-04f46c6/qrcode.min.js
  Included only so the path is present if your branch does not already have it.

Changes:
- Removed the printed CERTLEDGER header from each label.
- Removed the printed NO CLIENT CONTENT ON-CHAIN footer from each label.
- Enlarged both QR codes from roughly 0.72in to 0.90in inside each 2x2 label.
- Removed QR canvas borders/extra box whitespace.
- Replaced the custom inline QR encoder with the shared qrcodejs package used by tools/qrField/index.html.
- Fixed printed Ravencoin locator format to literal |RVN|:<block>:<pos>.
