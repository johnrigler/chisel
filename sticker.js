(function () {
  "use strict";
  const id = ChiselSticker.parse(location.href);
  const status = document.getElementById("status");
  const publicButton = document.getElementById("public-page");
  const privateButton = document.getElementById("private-key");
  if (!id) {
    status.textContent = "Invalid sticker. Expected eight bytes (16 hex characters).";
    return;
  }
  document.getElementById("sticker-id").textContent = id.toUpperCase();
  const swatch = document.getElementById("swatch");
  swatch.style.background = "#" + id.slice(0, 6);
  swatch.hidden = false;
  publicButton.disabled = false;
  try { ChiselSticker.assertPrivate(id); privateButton.disabled = false; }
  catch (error) { status.textContent = error.message; }

  function scan(mode) {
    const target = new URL("tools/recorder/index.html", location.href);
    target.searchParams.set("scanMode", mode);
    target.searchParams.set("currency", new URL(location.href).searchParams.get("currency") || "litecoin");
    target.hash = new URLSearchParams({sticker: id, ...(mode === "artifact1" ? {open: "1"} : {})}).toString();
    location.replace(target.href);
  }
  publicButton.addEventListener("click", () => {
    try { ChiselSticker.markPublic(id); scan("artifact1"); }
    catch (error) { status.textContent = error.message; }
  });
  privateButton.addEventListener("click", () => {
    try { ChiselSticker.assertPrivate(id); scan("key4"); }
    catch (error) { privateButton.disabled = true; status.textContent = error.message; }
  });
})();
