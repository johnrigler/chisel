(function () {

  //
  // Constants
  //
  const RPC_URL = "https://rigler.org:8769/";
  const ADDRESS = "RM5u7Qbe4sLdUnrgKQLBKvreCMRDb5FySU";
  const FEE_SATOSHIS = 50000; // 0.0005 RVN

  //
  // State
  //
  let utxos = [];

  //
  // Helpers
  //
  function normalizeUTXO(u) {
    return {
      txid: u.txid,
      vout: u.vout !== undefined ? u.vout : u.outputIndex,
      satoshis: u.satoshis
    };
  }

  function sumSatoshis(utxos) {
    return utxos.reduce((acc, u) => acc + u.satoshis, 0);
  }

  function satoshisToRVN(sats) {
    return sats / 100000000;
  }

  function buildVin(utxos) {
    return utxos.map(u => ({
      txid: u.txid,
      vout: u.vout
    }));
  }

  function buildVout(address, changeSats) {
    return {
      [address]: satoshisToRVN(changeSats)
    };
  }

  //
  // Core
  //
  async function createTransaction() {

    const rvn = new CHISEL(RPC_URL);
    await rvn.load();

    const rawUtxos = await rvn.address.getaddressutxos(ADDRESS);

    utxos = rawUtxos.map(normalizeUTXO);

    const vin = buildVin(utxos);

    const total = sumSatoshis(utxos);

    const change = total - FEE_SATOSHIS;

    if (change <= 0) {
      throw new Error("Not enough balance for fee");
    }

    const vout = buildVout(ADDRESS, change);

    const rawTx = await rvn.tx.createrawtransaction(vin, vout);

    console.log("RAW TX HEX:", rawTx);

    return rawTx;
  }

  //
  // Init
  //
  createTransaction();

})();
