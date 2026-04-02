class CHISEL {
  constructor(url) {
    this.url = url;
    this.rpc = {};
    this.local = {};
    this.tablets = {};
    this.slabs = {};
    this.etchings = {};
  }

  async call(method, params = []) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        jsonrpc: "1.0",
        id: "chisel",
        method: method,
        params: params
      })
    });

    const json = await response.json();

    if (json.error) {
      throw json.error;
    }

    return json.result;
  }

  async load() {
    const groups = await fetch(this.url + "methods").then(function onResponse(response) {
      return response.json();
    });

    for (const group in groups) {
      this[group] = {};

      for (const methodName of groups[group]) {
        this[group][methodName] = (...params) => this.call(methodName, params);
        this.rpc[methodName] = (...params) => this.call(methodName, params);
      }
    }
  }

  static normalizeUTXO(utxo) {
    return {
      txid: utxo.txid,
      vout: utxo.vout !== undefined ? utxo.vout : utxo.outputIndex,
      satoshis: utxo.satoshis
    };
  }

  static buildVin(utxos) {
    return utxos.map(function mapUTXO(utxo) {
      const normalized = CHISEL.normalizeUTXO(utxo);

      return {
        txid: normalized.txid,
        vout: normalized.vout
      };
    });
  }
}
