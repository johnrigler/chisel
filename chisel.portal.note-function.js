(function (root) {
  "use strict";
  const TOKENS = ['.getContext("2d")', '.beginPath()', '.closePath()', '.lineTo(', '.moveTo(', '.fill()',
    'function', 'const', 'return', 'canvas', 'width', 'height', 'ctx', '(', ')', '{', '}', ';', ',', '=', '.', '*', '+'];
  const WIDTH = 640, HEIGHT = 360, instances = new Set(), proofs = new WeakMap(), results = new WeakMap();

  function descriptor(annotation) {
    const metadata = annotation && annotation.metadata || {}, source = metadata.canonicalJavaScript;
    if (typeof source !== "string" || !source.trim() || source.length > 32000) return null;
    if (metadata.runtime && metadata.runtime !== "canvas") return null;
    const entry = metadata.entry || (source.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/) || [])[1];
    if (!/^[A-Za-z_$][\w$]{0,79}$/.test(entry || "")) return null;
    return {source: source, entry: entry, metadata: metadata};
  }

  function payload(raw) {
    const tx = raw && (raw.tx || raw), outputs = tx && (tx.vout || tx.outputs);
    const value = (Array.isArray(outputs) ? outputs : []).map(root.CHISEL_PORTAL_PAYLOAD.fromOutput).find(Boolean);
    if (!value || value.kind === "invalid" || !value.hex) throw new Error("Transaction has no complete OP_RETURN payload.");
    let hex = value.hex;
    if (value.text && /^[0-9a-f]{8,}$/i.test(value.text) && value.text.length % 2 === 0) hex = value.text;
    return Uint8Array.from(hex.match(/../g), function (pair) { return parseInt(pair, 16); });
  }

  function reconstruct(first, continuation, metadata) {
    const id = function (raw) { const tx = raw && (raw.tx || raw); return String(tx && (tx.txid || tx.hash) || "").replace(/^0x/i, "").toLowerCase(); };
    if (metadata.canonicalRoot && id(continuation) !== metadata.canonicalRoot.txid.toLowerCase()) throw new Error("Continuation TXID does not match the note.");
    const head = payload(first), rootBytes = payload(continuation), offset = rootBytes[0] === 1 ? 1 : 0;
    if (rootBytes.length < offset + 4) throw new Error("Continuation has no predecessor locator.");
    const height = rootBytes[offset] * 65536 + rootBytes[offset + 1] * 256 + rootBytes[offset + 2];
    const locator = height + ":" + rootBytes[offset + 3];
    if (metadata.locator && locator !== metadata.locator) throw new Error("Continuation points to another predecessor.");
    const tail = rootBytes.slice(offset + 4), bytes = new Uint8Array(head.length + tail.length);
    bytes.set(head); bytes.set(tail, head.length);
    let source = "";
    for (const byte of bytes) {
      if (byte < 128) source += String.fromCharCode(byte);
      else if (TOKENS[byte - 128] !== undefined) source += TOKENS[byte - 128];
      else throw new Error("Unknown McDougall token 0x" + byte.toString(16));
    }
    return {source: source, predecessor: id(first), previousLocator: locator, headBytes: head.length, tailBytes: tail.length, bytes: bytes.length};
  }

  // Preserve strings verbatim. Sources with regexes/comments/templates retain
  // their original formatting; this small formatter handles the specimen.
  function pretty(source) {
    if (/[\r\n/`]/.test(source)) return source;
    let out = "", depth = 0, quote = "", escape = false;
    for (const character of source) {
      if (quote) {
        out += character;
        if (escape) escape = false;
        else if (character === "\\") escape = true;
        else if (character === quote) quote = "";
      } else if (character === '"' || character === "'") { quote = character; out += character; }
      else if (character === "{") { depth += 1; if (depth > 32) return source; out += "{\n" + "  ".repeat(depth); }
      else if (character === "}") { depth = Math.max(0, depth - 1); out = out.replace(/\s+$/, "") + "\n" + "  ".repeat(depth) + "}"; }
      else if (character === ";") out += ";\n" + "  ".repeat(depth);
      else out += character;
    }
    return out.trim();
  }

  function disposeWithin(container) {
    for (const instance of Array.from(instances)) {
      if (container === instance.block || container.contains && container.contains(instance.block)) instance.dispose();
    }
  }

  function render(container, row, annotation, options) {
    const spec = descriptor(annotation);
    if (!spec) return null;
    const doc = container.ownerDocument || root.document, block = doc.createElement("section");
    block.className = "portalNoteFunction";
    const heading = doc.createElement("h5"); heading.textContent = "Reconstructed function"; block.appendChild(heading);
    const code = doc.createElement("pre"); code.className = "portalNoteFunctionSource"; block.appendChild(code);
    const provenance = doc.createElement("p"); provenance.className = "muted"; block.appendChild(provenance);
    const run = doc.createElement("button"); run.type = "button"; run.className = "secondaryButton"; run.textContent = "RUN FUNCTION"; block.appendChild(run);
    const status = doc.createElement("p"); status.className = "portalNoteFunctionStatus"; status.setAttribute("role", "status"); block.appendChild(status);
    const canvas = doc.createElement("canvas"); canvas.width = WIDTH; canvas.height = HEIGHT; canvas.hidden = true;
    canvas.className = "portalNoteFunctionCanvas"; canvas.setAttribute("aria-label", "Output from the reconstructed function"); block.appendChild(canvas);
    const frame = doc.createElement("iframe"); frame.hidden = true; frame.setAttribute("sandbox", "allow-scripts");
    frame.title = "Note function runtime"; frame.referrerPolicy = "no-referrer";
    frame.src = new URL("tools/noteRunner/index.html", root.location.href).href;
    let source = spec.source, ready = false, pending = null, timer = null, disposed = false;
    function engaged(action) { try { if (options && options.onEngage) options.onEngage(action); } catch (_) {} }
    function paint(result) {
      if (!canvas.getContext || typeof root.ImageData !== "function") return;
      canvas.getContext("2d").putImageData(new root.ImageData(new Uint8ClampedArray(result.pixels), WIDTH, HEIGHT), 0, 0);
      canvas.hidden = false;
    }
    function showSource(value, caption) {
      source = value; code.textContent = pretty(value); provenance.textContent = caption;
      const saved = results.get(row);
      if (saved && saved.source === value) { paint(saved); status.textContent = "Function ran."; }
      else { canvas.hidden = true; status.textContent = "Run the function to draw its output."; }
    }
    function send() {
      if (ready && pending) frame.contentWindow.postMessage(Object.assign({type: "chisel-note-function-run"}, pending), "*");
    }
    function finish() { run.disabled = false; pending = null; if (timer !== null) root.clearTimeout(timer); timer = null; }
    function message(event) {
      if (disposed || event.source !== frame.contentWindow || !event.data) return;
      const data = event.data;
      if (data.type === "chisel-note-function-ready") { ready = true; send(); return; }
      if (data.type !== "chisel-note-function-result" || !pending || data.id !== pending.id) return;
      const executedSource = pending.source;
      if (data.ok && data.pixels instanceof ArrayBuffer && data.pixels.byteLength === WIDTH * HEIGHT * 4) {
        const result = {source: executedSource, pixels: data.pixels}; results.set(row, result);
        if (source === executedSource) { paint(result); status.textContent = "Function ran."; }
        else status.textContent = "Source updated. Run again to draw the reconstructed version.";
        engaged("function_drawn");
      } else { status.textContent = "Function error: " + String(data.error || "Invalid canvas result").slice(0, 500); engaged("function_failed"); }
      finish();
    }
    run.onclick = function () {
      engaged("run_function");
      pending = {id: String(Date.now()) + ":" + Math.random().toString(36).slice(2), source: source, entry: spec.entry, width: WIDTH, height: HEIGHT};
      run.disabled = true; status.textContent = "Running function…";
      timer = root.setTimeout(function () { status.textContent = "Function runtime timed out."; finish(); frame.remove(); ready = false; block.appendChild(frame); }, 6000);
      send();
    };
    const instance = {block: block, dispose: function () {
      disposed = true; finish(); root.removeEventListener("message", message); frame.remove(); instances.delete(instance);
    }};
    root.addEventListener("message", message); instances.add(instance);
    showSource(source, "Saved reconstruction from the transaction note.");
    block.appendChild(frame); container.appendChild(block);
    const metadata = spec.metadata, continuation = metadata.canonicalRoot;
    if (metadata.protocol === "mcdougall-ltc-v1" && continuation && options && options.loadTransaction) {
      const key = [annotation.updatedAt, continuation.txid, metadata.locator].join(":");
      let cached = proofs.get(row);
      if (!cached || cached.key !== key) {
        const promise = Promise.all([
          row.raw ? Promise.resolve(row.raw) : options.loadTransaction(row.txid, row.staticRawUrl),
          options.loadTransaction(continuation.txid, continuation.rawUrl)
        ]).then(function (records) {
          const first = records[0], firstTx = first && (first.tx || first);
          if (String(firstTx && (firstTx.txid || firstTx.hash) || "").replace(/^0x/i, "").toLowerCase() !== row.txid.toLowerCase()) throw new Error("Predecessor TXID does not match this record.");
          return reconstruct(first, records[1], metadata);
        });
        cached = {key: key, promise: promise}; proofs.set(row, cached);
      }
      cached.promise.then(function (proof) {
        if (!disposed) showSource(proof.source, "Reconstructed from transaction payloads: " + proof.headBytes + " + " + proof.tailBytes + " = " + proof.bytes + " McDougall bytes.");
      }).catch(function () { /* The saved reconstruction remains runnable offline. */ });
    }
    return block;
  }

  root.CHISEL_NOTE_FUNCTION = {descriptor: descriptor, payload: payload, reconstruct: reconstruct, pretty: pretty, render: render, disposeWithin: disposeWithin};
})(window);
