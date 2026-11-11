/* Commons Litecoin SHA-256 handoff. No key operations, network calls or broadcasting. */
globalThis.ChiselCommons = (() => {
  "use strict";
  const ROOT = "LLLLLLLLLLLLLLLLLLLLLLLLLLLLXgkk2V";
  const ADDRESS = "LMxCoMMoNSzzzzzzzzzzzzzzzzzzZU8MFW";
  const STORAGE_KEY = "chisel.pendingPayloadAnalyzer.v1";
  const SCHEMA = "chisel-commons-sha256-anchor-v1";
  function digest(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error("Enter exactly 64 hexadecimal SHA-256 characters.");
    }
    return normalized;
  }
  function amountUnits(value) {
    const amount = String(value || "").trim();
    if (!/^\d+\.\d{1,8}$/.test(amount)) {
      throw new Error("Enter an LTC amount with 1–8 decimal places.");
    }
    const [whole, fractional] = amount.split(".");
    const units = BigInt(whole) * 100000000n + BigInt(fractional.padEnd(8, "0"));
    if (units < 547n || units > 100000n) {
      throw new Error("Use between 0.00000547 and 0.00100000 LTC per tag.");
    }
    return units;
  }
  function payload(hashInput, amountInput) {
    const hash = digest(hashInput);
    const amount = String(amountInput).trim();
    amountUnits(amount);
    return {
      schema: SCHEMA,
      currency: "litecoin",
      replaceRecipients: true,
      opReturnAscii: "sha256:" + hash,
      recipients: [
        {address: ROOT, amount, outputType: "unspendable", note: "Litecoin general index"},
        {address: ADDRESS, amount, outputType: "unspendable", note: "Commons transport index"}
      ]
    };
  }
  return { ROOT, ADDRESS, STORAGE_KEY, SCHEMA, digest, amountUnits, payload };
})();
