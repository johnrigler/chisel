(function () {
  "use strict";

  function getApi() {
    if (typeof window !== "undefined" && window.CHISEL_UNSPENDABLE) {
      return window.CHISEL_UNSPENDABLE;
    }

    if (typeof globalThis !== "undefined" && globalThis.CHISEL_UNSPENDABLE) {
      return globalThis.CHISEL_UNSPENDABLE;
    }

    throw new Error("Load chisel.unspendable.js before running the unspendable test loop.");
  }

  function printRows(rows) {
    if (typeof console !== "undefined" && console.table) {
      console.table(rows);
    } else if (typeof console !== "undefined") {
      console.log(JSON.stringify(rows, null, 2));
    }
  }

  async function runUnspendableTestLoop(cases) {
    const api = getApi();
    const results = await api.testLoop(cases);

    printRows(results);

    return results;
  }

  async function scanLitecoinSecondCharacters(phrase) {
    const api = getApi();
    const report = await api.testAllSecondCharacters("L", { phrase: phrase || "domo arigato" });

    printRows(report.rows);

    if (typeof console !== "undefined") {
      console.log("valid L?x seconds:", report.valid.join(""));
      console.log("invalid L?x seconds:", report.invalid.join(""));
    }

    return report;
  }

  if (typeof window !== "undefined") {
    window.CHISEL_UNSPENDABLE_TEST = {
      runUnspendableTestLoop: runUnspendableTestLoop,
      scanLitecoinSecondCharacters: scanLitecoinSecondCharacters
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      runUnspendableTestLoop: runUnspendableTestLoop,
      scanLitecoinSecondCharacters: scanLitecoinSecondCharacters
    };
  }
})();
