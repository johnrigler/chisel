/* Local Polygon signer. WIF and private key never cross the RPC boundary. */
(function(root) {
  "use strict";
  const CHAIN = 137, RPC = "https://polygon.drpc.org";
  const SCALAR_LIMIT = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
  function walletFromWif(wif, ethers) {
    let bytes;
    try {
      const value = String(wif || "").trim();
      if (!/^[1-9A-HJ-NP-Za-km-z]{50,53}$/.test(value)) throw Error();
      bytes = ethers.getBytes(ethers.toBeHex(ethers.decodeBase58(value)));
      if (![37,38].includes(bytes.length)) throw Error();
      const payload = bytes.slice(0,-4);
      if (payload.length === 34 && payload[33] !== 1) throw Error();
      const checksum = ethers.getBytes(ethers.sha256(ethers.sha256(payload))).slice(0,4);
      if (!checksum.every((v,i)=>v===bytes[bytes.length-4+i])) throw Error();
      const hex = ethers.hexlify(payload.slice(1,33));
      const scalar = BigInt(hex);
      if (scalar === 0n || scalar >= SCALAR_LIMIT) throw Error();
      return new ethers.Wallet(hex);
    } catch (_) { throw new Error("Invalid WIF checksum, format or private key."); }
    finally { if (bytes) bytes.fill(0); }
  }
  function createLocalWallet(ethers, rpc) {
    const transport = rpc || new ethers.JsonRpcProvider(RPC, CHAIN, {batchMaxCount:1});
    let wallet = null, generation = 0, plan = null, sending = false;
    const call = (method, params=[]) => transport.send(method, params);
    async function chain() {
      const id = await call("eth_chainId");
      if (BigInt(id) !== 137n) throw Error("RPC is not Polygon mainnet (137).");
      return "0x89";
    }
    function requireWallet() {
      if (!wallet) throw Error("Load a WIF into Chisel first.");
      return wallet;
    }
    function lock() { generation++; wallet = null; plan = null; }
    function unlock(wif) {
      if (sending) throw Error("Wait for the current submission to finish.");
      lock(); wallet = walletFromWif(wif,ethers); return wallet.address;
    }
    async function balance() {
      const active = requireWallet();
      await chain();
      return ethers.formatEther(BigInt(await call("eth_getBalance",[active.address,"pending"])));
    }
    const quantity = x => ethers.toQuantity(x);
    function fingerprint(tx) {
      return [String(tx.from).toLowerCase(),String(tx.to).toLowerCase(),String(tx.data).toLowerCase(),BigInt(tx.value || 0).toString()].join("|");
    }
    async function quote(tx, estimate) {
      if (sending) throw Error("Submission in progress.");
      plan = null;
      const active = requireWallet(), epoch = generation;
      if (active.address.toLowerCase() !== String(tx.from).toLowerCase()) throw Error("Account mismatch.");
      await chain();
      const [nonce, fees, funds] = await Promise.all([
        call("eth_getTransactionCount",[active.address,"pending"]),
        transport.getFeeData(),
        call("eth_getBalance",[active.address,"pending"])
      ]);
      if (fees.maxFeePerGas == null || fees.maxPriorityFeePerGas == null) throw Error("RPC did not supply EIP-1559 fees.");
      const maxFeePerGas = BigInt(fees.maxFeePerGas), maxPriorityFeePerGas = BigInt(fees.maxPriorityFeePerGas);
      if (maxFeePerGas <= 0n || maxPriorityFeePerGas < 0n || maxPriorityFeePerGas > maxFeePerGas) throw Error("Invalid RPC fee quote.");
      const gasLimit = (BigInt(estimate)*120n+99n)/100n;
      if (gasLimit <= 0n) throw Error("Invalid gas estimate.");
      const value = BigInt(tx.value || 0), maxCost = value + gasLimit*maxFeePerGas;
      const n = Number(BigInt(nonce));
      if (!Number.isSafeInteger(n) || n < 0) throw Error("Invalid RPC nonce.");
      if (epoch !== generation || wallet !== active) throw Error("Local identity changed.");
      if (BigInt(funds) < maxCost) throw Error("Insufficient POL. Balance "+ethers.formatEther(BigInt(funds))+"; maximum required "+ethers.formatEther(maxCost)+".");
      plan = {fingerprint:fingerprint(tx), tx:Object.freeze({type:2, chainId:CHAIN, nonce:n, to:ethers.getAddress(tx.to), data:tx.data, value, gasLimit, maxFeePerGas, maxPriorityFeePerGas})};
      return {nonce:n, gasLimit:gasLimit.toString(), maxFeePerGasWei:maxFeePerGas.toString(), maxPriorityFeePerGasWei:maxPriorityFeePerGas.toString(), maximumFeePOL:ethers.formatEther(gasLimit*maxFeePerGas), maximumTotalPOL:ethers.formatEther(maxCost), balancePOL:ethers.formatEther(BigInt(funds)), rpc:RPC};
    }
    async function send(tx) {
      if (sending) throw Error("Submission in progress.");
      const active = requireWallet(), epoch = generation, reviewed = plan;
      if (!reviewed || reviewed.fingerprint !== fingerprint(tx)) throw Error("Local fee review required.");
      plan = null; sending = true;
      try {
        await chain();
        const nonce = await call("eth_getTransactionCount",[active.address,"pending"]);
        if (BigInt(nonce) !== BigInt(reviewed.tx.nonce)) throw Error("Nonce changed; review again.");
        const balance = BigInt(await call("eth_getBalance",[active.address,"pending"]));
        if (balance < reviewed.tx.value + reviewed.tx.gasLimit*reviewed.tx.maxFeePerGas) throw Error("POL balance changed; review again.");
        if (epoch !== generation || wallet !== active) throw Error("Local identity changed.");
        let raw;
        try { raw = await active.signTransaction(reviewed.tx); }
        catch (_) { throw Error("Local signing failed."); }
        if (epoch !== generation || wallet !== active) throw Error("Local identity changed before broadcast.");
        const hash = ethers.keccak256(raw);
        try {
          const result = await call("eth_sendRawTransaction",[raw]);
          if (String(result).toLowerCase() !== hash.toLowerCase()) throw Error("Hash mismatch.");
          return hash;
        } catch (_) { throw Error("Broadcast outcome uncertain. Check "+hash+" on Polygon before attempting another send."); }
      } finally { sending = false; }
    }
    const reads = new Set(["eth_getCode","eth_call","eth_estimateGas","eth_getTransactionReceipt"]);
    async function request({method,params=[]}) {
      if (method==="eth_accounts" || method==="eth_requestAccounts") return wallet?[wallet.address]:[];
      if (method==="eth_chainId") return chain();
      if (method==="wallet_switchEthereumChain") {
        if (params[0]?.chainId !== "0x89") throw Error("Only Polygon mainnet is supported.");
        return chain().then(()=>null);
      }
      if (method==="eth_sendTransaction") return send(params[0]);
      if (!reads.has(method)) throw Error("Unsupported local adapter RPC method.");
      await chain();
      return call(method,params);
    }
    return Object.freeze({request,unlock,lock,balance,quote,invalidate(){plan=null;},get address(){return wallet?.address || "";}});
  }
  root.CHISEL_EVM_LOCAL=Object.freeze({walletFromWif,createLocalWallet,RPC,CHAIN});
})(typeof window !== "undefined" ? window : globalThis);
