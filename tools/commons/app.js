(() => {
  "use strict";
  const C = ChiselCommons;
  const $ = id => document.getElementById(id);
  let pending = null;
  function review() {
    pending = null;
    $("load-send").disabled = true;
    $("op-return").textContent = "Enter a digest to prepare the plan.";
    $("status").textContent = "";
    try {
      const plan = C.payload($("hash").value, $("amount").value);
      pending = plan;
      $("hash").setCustomValidity("");
      $("op-return").textContent = plan.opReturnAscii;
      $("cost").textContent = "Two unspendable outputs of " + $("amount").value.trim() + " LTC each, plus network fee.";
      $("status").textContent = "Ready for review in Chisel Send. No transaction has been made.";
      $("load-send").disabled = false;
    } catch (error) {
      $("status").textContent = error.message;
    }
  }
  $("hash").addEventListener("input", review);
  $("amount").addEventListener("input", review);
  $("load-send").addEventListener("click", () => {
    if (!pending) return;
    try {
      sessionStorage.setItem(C.STORAGE_KEY, JSON.stringify(pending));
      location.href = "../../index.html?mode=send";
    } catch (error) {
      $("status").textContent = "Unable to stage the Send plan: " + error.message;
    }
  });
  const fragment = new URLSearchParams(location.hash.slice(1));
  $("hash").value = fragment.get("sha256") || "";
  review();
})();
