# Base57 image encoder

Open `index.html` through the Chisel Tools page or Etch’s `BASE57 IMAGE` button. The encoder reads a local image, resizes it onto a working raster, applies Top/Bottom/Left/Right margins, quantizes the remaining box with `b57.json`, and hands the ordered Digibyte outputs back to Etch.

The full address has a 28-character pre-checksum stem, but the first two characters are the `S*` image prefix. The crop itself is always 26 cells wide. Changing Left automatically changes Right, and vice versa, so the crop box can move without changing the address payload width.

To reproduce V1 advanced settings quickly, paste `Top,Bottom,Left,Right` into the V1 parameter field. The encoder infers raster width as `Left + 26 + Right`, infers raster height from the source image ratio exactly as V1 did, and unlocks the raster controls for further adjustment. The default preview scale is 5 and has no effect on encoded rows or addresses.

`Write to Chisel Etch` replaces the current recipient list with the ordered image addresses. Chisel still requires review and explicit signing/broadcast.

The file picker is local-only. No image bytes are uploaded by this page.

Run the protocol-level regression test with:

```bash
node tools/imageEncoder/image-encoder.test.js
```

The same encoder → Etch → Portal contract is also covered by Chisel’s browser self-test.
