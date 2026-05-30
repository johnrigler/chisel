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

2.4.3c cleanup:
- Litecoin and Litecoin Testnet unspendable modifiers are now M,N,P,Q,R.
- app.js rebuilds the unspendable modifier dropdown from the selected coin's UNSPENDABLE_MODIFIERS value.
- chisel.unspendable.js now exposes CHISEL_UNSPENDABLE.testLoop().
- tools/unspendable/testLoop.js provides a browser/Node helper for the same loop.
- CI runs the general unspendable prefix loop for Ravencoin, Digibyte, Litecoin, and Litecoin Testnet.

2.4.3c Litecoin unspendable scan update:
- The five observed Litecoin modifiers M,N,P,Q,R are no longer treated as the full set.
- chisel.unspendable.js now exposes CHISEL_UNSPENDABLE.testAllSecondCharacters(first, options).
- For Litecoin, run: await CHISEL_UNSPENDABLE.testAllSecondCharacters("L")
- tools/unspendable/testLoop.js now exposes CHISEL_UNSPENDABLE_TEST.scanLitecoinSecondCharacters().
- The scan tests every Base58 character in L?x and reports valid and invalid rows without throwing on expected invalid prefixes.
- Current L?x scan for phrase "domo arigato" found valid seconds: K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z,a,b,c,d,e,f,g,h.
- The Litecoin GUI modifier dropdown now uses that discovered valid set instead of the earlier five sampled values.



v2.6.0 elliptic integration smoke test
--------------------------------------
1. Load index.html from a local web server, GitHub Pages, or IPFS.
2. Open the browser console.
3. Confirm: window.elliptic && window.elliptic.version === "6.6.1"
4. Confirm: window.elliptic && CHISEL && CHISEL.signRawTransaction
5. Confirm no network request is made for vendor/elliptic-6-6-1.min.js.
6. Run the existing WIF/signing smoke test from the previous 2.5.2j patch notes.

Notes:
- The runtime elliptic dependency is now embedded in chisel.js.
- The vendor elliptic files remain for audit comparison and source visibility.
- THIRD_PARTY_LICENSES/elliptic.txt remains the authoritative bundled license notice.
