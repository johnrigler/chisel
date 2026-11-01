(function () {
  "use strict";
  let active = null;

  // This function is serialized into a dedicated worker. Only canvas pixels
  // cross back to the Portal; note code never executes in the Portal window.
  function canvasWorker() {
    "use strict";
    self.onmessage = async function (event) {
      const data = event.data;
      try {
        if (typeof OffscreenCanvas !== "function") throw new Error("This browser does not support worker canvas drawing.");
        const canvas = new OffscreenCanvas(data.width, data.height);
        const draw = new Function("canvas", '"use strict";\n' + data.source + "\n;return " + data.entry + "(canvas);");
        await draw(canvas);
        const pixels = canvas.getContext("2d").getImageData(0, 0, data.width, data.height).data.buffer;
        self.postMessage({ok: true, pixels: pixels}, [pixels]);
      } catch (error) { self.postMessage({ok: false, error: String(error && error.message || error).slice(0, 500)}); }
    };
  }

  function stop() {
    if (!active) return;
    clearTimeout(active.timer); active.worker.terminate(); URL.revokeObjectURL(active.url); active = null;
  }

  addEventListener("message", function (event) {
    const data = event.data;
    if (event.source !== parent || !data || data.type !== "chisel-note-function-run") return;
    if (typeof data.id !== "string" || typeof data.source !== "string" || data.source.length > 32000 ||
        !/^[A-Za-z_$][\w$]{0,79}$/.test(data.entry || "") || data.width !== 640 || data.height !== 360) return;
    stop();
    let job = null, url;
    function reply(result) {
      if (active !== job) return;
      const message = Object.assign({type: "chisel-note-function-result", id: data.id}, result);
      if (result.ok && result.pixels instanceof ArrayBuffer && result.pixels.byteLength === 640 * 360 * 4) parent.postMessage(message, "*", [result.pixels]);
      else parent.postMessage({type: message.type, id: data.id, ok: false, error: String(result.error || "Invalid canvas result").slice(0, 500)}, "*");
      stop();
    }
    try {
      url = URL.createObjectURL(new Blob(["(" + canvasWorker.toString() + ")()"], {type: "text/javascript"}));
      const worker = new Worker(url);
      job = {worker: worker, url: url, timer: setTimeout(function () { reply({ok: false, error: "Function exceeded the 3 second runtime limit."}); }, 3000)};
      active = job;
      worker.onmessage = function (event) { reply(event.data || {ok: false}); };
      worker.onerror = function (event) { event.preventDefault(); reply({ok: false, error: event.message || "Function worker failed."}); };
      worker.postMessage({source: data.source, entry: data.entry, width: data.width, height: data.height});
    } catch (error) { if (url && !job) URL.revokeObjectURL(url); reply({ok: false, error: String(error && error.message || error)}); }
  });

  parent.postMessage({type: "chisel-note-function-ready"}, "*");
})();
