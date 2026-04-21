(function () {
  const CURVE_NAME = "secp256k1";
  const SIGHASH_ALL_HEX = "01000000";
  const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  class CHISEL {
    constructor(url) {
      this.url = url;
      this.rpc = {};
    }

    async call(method, params = []) {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "1.0",
          id: "chisel",
          method,
          params
        })
      });

      const json = await res.json();

      if (json.error) {
        throw new Error(json.error.message || JSON.stringify(json.error));
      }

      return json.result;
    }

    async load() {
      const groups = await fetch(this.url + "methods").then(r => r.json());

      for (const group in groups) {
        this[group] = {};

        for (const method of groups[group]) {
          this[group][method] = (...params) => this.call(method, params);
          this.rpc[method] = (...params) => this.call(method, params);
        }
      }
    }

    static installCoin(name, plugin) {
      CHISEL.coins[name] = plugin;
    }

    static getCoin(name) {
      const coin = CHISEL.coins[name];
      if (!coin) throw new Error("Coin not installed: " + name);
      return coin;
    }

    static normalizeUTXO(utxo) {
      return {
        txid: utxo.txid,
        vout: utxo.vout ?? utxo.outputIndex,
        satoshis: Number(utxo.satoshis)
      };
    }

    static buildVin(utxos) {
      return utxos.map(u => ({
        txid: u.txid,
        vout: u.vout
      }));
    }

    static sum(utxos) {
      return utxos.reduce((t, u) => t + Number(u.satoshis), 0);
    }
  }

  CHISEL.coins = {};

  //
  // ===== SHARED SIGNING INTERNALS =====
  //
  CHISEL.signing = (function () {
    function hexToBytes(hex) {
      const clean = hex.replace(/^0x/, "").toLowerCase();
      const out = [];
      for (let i = 0; i < clean.length; i += 2) {
        out.push(parseInt(clean.slice(i, i + 2), 16));
      }
      return new Uint8Array(out);
    }

    function bytesToHex(bytes) {
      return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    function varInt(n) {
      if (n < 253) return n.toString(16).padStart(2, "0");
      throw new Error("varInt too large (simplified)");
    }

    async function sha256(hex) {
      const bytes = hexToBytes(hex);
      const buf = await crypto.subtle.digest("SHA-256", bytes);
      return bytesToHex(new Uint8Array(buf));
    }

    async function doubleSha256(hex) {
      return sha256(await sha256(hex));
    }

    function parseTx(hex) {
      const vinCount = parseInt(hex.slice(8, 10), 16);
      let cursor = 10;
      const vins = [];

      for (let i = 0; i < vinCount; i++) {
        const txid = hex.slice(cursor, cursor + 64);
        const vout = hex.slice(cursor + 64, cursor + 72);
        const scriptLen = parseInt(hex.slice(cursor + 72, cursor + 74), 16);
        const scriptEnd = cursor + 74 + scriptLen * 2;

        vins.push({
          txid,
          vout,
          seq: hex.slice(scriptEnd, scriptEnd + 8),
          scriptSig: ""
        });

        cursor = scriptEnd + 8;
      }

      return {
        version: hex.slice(0, 8),
        vins,
        rest: hex.slice(cursor)
      };
    }

    return {
      parseTx,
      doubleSha256,
      varInt
    };
  })();

  globalThis.CHISEL = CHISEL;
})();
