class CHISEL {

  constructor(url){

    this.url = url;

    this.rpc = {};
    this.local = {};
  }

  async call(method, params=[]){

    const r = await fetch(this.url,{
      method:"POST",
      headers:{ "Content-Type":"text/plain" },
      body:JSON.stringify({
        jsonrpc:"1.0",
        id:"chisel",
        method:method,
        params:params
      })
    });

    const j = await r.json();

    if(j.error) throw j.error;

    return j.result;
  }

  async load(){

    const groups = await fetch(this.url+"methods").then(r=>r.json());

    for (let group in groups){

      this[group] = {};

      for (let m of groups[group]){

        this[group][m] = (...p)=>this.call(m,p);
        this.rpc[m] = (...p)=>this.call(m,p);

      }

    }

  }

 static normalizeUTXO(u) {
    return {
      txid: u.txid,
      vout: u.vout !== undefined ? u.vout : u.outputIndex,
      satoshis: u.satoshis
    };
  }

  static buildVin(utxos) {
    return utxos.map(CHISEL.normalizeUTXO).map(u => ({
      txid: u.txid,
      vout: u.vout
    }));
  }

}
