(function () {
  //
  // Constants
  //
  const JSON_RPC_VERSION = "1.0";
  const REQUEST_ID = "chisel";

  //
  // Class
  //
  class CHISEL {
    constructor(url) {
      this.url = url;
      this.rpc = {};
    }

    async call(method, params = []) {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: JSON_RPC_VERSION,
          id: REQUEST_ID,
          method: method,
          params: params
        })
      });

      const json = await response.json();

      if (json.error) {
        throw new Error(json.error.message || JSON.stringify(json.error));
      }

      return json.result;
    }

    async load() {
      const groups = await fetch(this.url + "methods").then(function onResponse(response) {
        return response.json();
      });

      for (const groupName in groups) {
        this[groupName] = this[groupName] || {};

        groups[groupName].forEach((methodName) => {
          this[groupName][methodName] = (...params) => this.call(methodName, params);
          this.rpc[methodName] = (...params) => this.call(methodName, params);
        });
      }
    }

    static installCoin(name, plugin) {
      if (!name) {
        throw new Error("Coin name is required.");
      }

      if (!plugin || typeof plugin !== "object") {
        throw new Error("Coin plugin is required.");
      }

      CHISEL.coins[name] = plugin;
    }

    static getCoin(name) {
      const coin = CHISEL.coins[name];

      if (!coin) {
        throw new Error("Coin not installed: " + name);
      }

      return coin;
    }

    static getCoins() {
      return Object.values(CHISEL.coins).sort(function sortCoins(a, b) {
        const aOrder = Number(a.ORDER || 0);
        const bOrder = Number(b.ORDER || 0);

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        return String(a.DISPLAY_NAME || a.NAME).localeCompare(String(b.DISPLAY_NAME || b.NAME));
      });
    }

    static normalizeUTXO(utxo) {
      return {
        txid: utxo.txid,
        vout: utxo.vout !== undefined ? utxo.vout : utxo.outputIndex,
        satoshis: Number(utxo.satoshis),
        scriptPubKey: utxo.scriptPubKey || utxo.scriptpubkey || "",
        address: utxo.address || ""
      };
    }

    static buildVin(utxos) {
      return utxos.map(function mapUtxoToVin(utxo) {
        const normalized = CHISEL.normalizeUTXO(utxo);

        return {
          txid: normalized.txid,
          vout: normalized.vout
        };
      });
    }

    static sumUtxoSatoshis(utxos) {
      return utxos.reduce(function reduceTotal(total, utxo) {
        return total + Number(utxo.satoshis);
      }, 0);
    }
  }

  CHISEL.coins = {};

  window.CHISEL = CHISEL;
})();
