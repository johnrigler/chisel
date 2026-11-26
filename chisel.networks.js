/* Phase one: public Bitcoin/BSV accounts. Signing and inscriptions are separate capabilities. */
(function (root) {
  "use strict";
  const C = root.CHISEL;
  if (!C) throw new Error("Load CHISEL before chisel.networks.js.");

  function integer(value, label, signed) {
    if (!Number.isSafeInteger(value) || (!signed && value < 0)) throw new Error("Invalid " + label + ".");
    return value;
  }

  C.privateKeyToCoinWif = async function (privateKeyHex, coin, compressed) {
    const key = String(privateKeyHex || "").trim().replace(/^0x/i, "").toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(key)) throw new Error("Expected a 32-byte private key.");
    // Validate the scalar before encoding. A checksum alone does not validate a private key.
    C.privateKeyHexToPublicKeyHex(key, compressed !== false);
    if (!coin || !Number.isInteger(coin.WIF_PREFIX) || coin.WIF_PREFIX < 0 || coin.WIF_PREFIX > 255) throw new Error("Unknown WIF network.");
    const bytes = new Uint8Array(compressed === false ? 33 : 34);
    bytes[0] = coin.WIF_PREFIX;
    bytes.set(C.hexToUint8Array(key), 1);
    if (compressed !== false) bytes[33] = 1;
    return C.base58CheckEncode(bytes);
  };

  C.accountFromSharedWif = async function (wif, coin) {
    const decoded = await C.wifToPrivateKey(wif);
    const known = C.getCoins().some(function (entry) {
      return entry.WIF_PREFIX === decoded.version || (entry.WIF_PREFIXES || []).includes(decoded.version);
    });
    if (!known) throw new Error("WIF version is not used by an installed chain.");
    const converted = await C.privateKeyToCoinWif(decoded.privateKeyHex, coin, decoded.compressed);
    return { wif: converted, account: await coin.wifToAccount(converted) };
  };

  async function publicAddress(address, prefix) {
    const bytes = await C.base58CheckDecode(String(address || ""));
    if (bytes.length !== 21 || bytes[0] !== prefix) throw new Error("Expected a P2PKH public address for the selected network.");
    return String(address);
  }

  async function read(url, text) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, 12000);
    try {
      const options = { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" };
      return await (text ? C.fetchText(url, options) : C.fetchJson(url, options));
    } finally { clearTimeout(timer); }
  }

  // Read only public addresses, with bounded requests and independent BSV fallback.
  C.readBsvAddressBalance = async function (address, network) {
    const main = network === "mainnet";
    if (!main && network !== "testnet") throw new Error("Unsupported BSV network");
    await publicAddress(address, main ? 0 : 111);
    const providers = [{name:"WhatsOnChain", base:"https://api.whatsonchain.com/v1/bsv/" + (main ? "main" : "test")}];
    if (main) providers.push({name:"BananaBlocks", base:"https://bananablocks.com/api/v1/bsv/main"});
    const errors = [];
    let partial = null;
    async function get(provider, field) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(provider.base + "/address/" + encodeURIComponent(address) + "/" + field + "/balance", {
          signal:controller.signal, credentials:"omit", referrerPolicy:"no-referrer", cache:"no-store"
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        if (data?.address !== address || data.error) throw new Error(data?.error ? "Provider reported an address error" : "Unexpected address response");
        return integer(data[field], field + " balance", field === "unconfirmed");
      } finally { clearTimeout(timer); }
    }
    for (const provider of providers) {
      const [confirmed, pending] = await Promise.allSettled([get(provider,"confirmed"),get(provider,"unconfirmed")]);
      const describe = result => result.reason?.name === "AbortError" ? "timeout" : (result.reason?.message || "request failed");
      if (confirmed.status === "fulfilled") {
        const value = {chain:"bsv",network,address,confirmedSats:confirmed.value,unconfirmedSats:null,totalSats:null,provider:provider.name};
        if (pending.status === "fulfilled") {
          value.unconfirmedSats = pending.value;
          value.totalSats = integer(confirmed.value + pending.value,"total balance");
          return value;
        }
        if (!partial) partial = value;
      }
      errors.push(provider.name + ": " + [confirmed,pending].map(r => r.status === "fulfilled" ? "OK" : describe(r)).join(" / "));
    }
    if (partial) return Object.assign(partial,{warning:errors.join("; ")});
    throw new Error(errors.join("; "));
  };

  function accountCoin(config) {
    const prefix = config.testnet ? 111 : 0;
    const coin = {
      NAME: config.name, DISPLAY_NAME: config.label, TICKER: config.ticker, ORDER: config.order,
      CHAIN: config.chain, NETWORK: config.network, IS_TESTNET: !!config.testnet,
      ACCOUNT_ONLY: true, CAN_SEND: false, BASE_UNITS: 100000000,
      P2PKH_PREFIX: prefix, WIF_PREFIX: config.testnet ? 239 : 128,
      WIF_PREFIXES: [config.testnet ? 239 : 128],
      DEFAULT_RPC_URL: config.api, DEFAULT_EXPLORER_URL: config.explorer + "/tx/",
      USES_THIRD_PARTY_PROVIDERS: true, REQUIRES_EXPLORER: false, SUPPORTS_IPFS_FIELD: false,
      DEFAULT_FEE: "0", DEFAULT_BURN_AMOUNT: "0", UNSPENDABLE_PREFIX: config.testnet ? "m" : "1",
      HERO_TEXT: "Phase one supports public addresses, receiving and balance checks. Transaction signing and inscription publishing follow in later phases.",
      HELP_TEXT: "Legacy P2PKH addresses. The same private key can be used on other networks; coins and histories belong to the selected chain and network.",
      FUNDING_LINKS: config.faucets || [],
      coinToUnits: function (value) { return C.parseAmountUnits(value, 8); },
      unitsToCoin: function (value) { return Number(value || 0) / 100000000; },
      getRequiredFeeUnits: function () { return 0; },
      wifToAccount: async function (wif) {
        const decoded = await C.wifToPrivateKey(wif);
        if (decoded.version !== coin.WIF_PREFIX) throw new Error("WIF network does not match " + config.label + ".");
        async function address(compressed) {
          const publicKey = C.privateKeyHexToPublicKeyHex(decoded.privateKeyHex, compressed);
          const hash = await C.hash160Hex(publicKey);
          return C.base58CheckEncode(C.concatBytes(new Uint8Array([prefix]), C.hexToUint8Array(hash)));
        }
        const compressedAddress = await address(true), uncompressedAddress = await address(false);
        return Object.assign({}, decoded, { currency: coin.NAME, network: config.network, ticker: config.ticker,
          address: decoded.compressed ? compressedAddress : uncompressedAddress, compressedAddress: compressedAddress,
          uncompressedAddress: uncompressedAddress });
      },
      getAddressBalance: async function (_client, _values, address) {
        await publicAddress(address, prefix);
        if (config.chain === "bsv") {
          const result = await C.readBsvAddressBalance(address, config.network);
          if (result.totalSats === null) throw new Error(result.warning || "Pending BSV balance unavailable");
          return result;
        }
        const url = config.api + "/address/" + encodeURIComponent(address);
        const data = await read(url);
        let confirmed, unconfirmed;
        if (config.chain === "bitcoin") {
          if (!data || data.address !== address || !data.chain_stats || !data.mempool_stats) throw new Error("Unexpected Bitcoin address response.");
          confirmed = integer(data.chain_stats.funded_txo_sum, "confirmed funding") - integer(data.chain_stats.spent_txo_sum, "confirmed spending");
          unconfirmed = integer(data.mempool_stats.funded_txo_sum, "pending funding") - integer(data.mempool_stats.spent_txo_sum, "pending spending");
        } else {
          if (!data) throw new Error("Unexpected BSV balance response.");
          confirmed = data.confirmed;
          unconfirmed = data.unconfirmed;
        }
        integer(confirmed, "confirmed balance"); integer(unconfirmed, "pending balance", true);
        const total = integer(confirmed + unconfirmed, "total balance");
        return { chain: config.chain, network: config.network, address: address, confirmedSats: confirmed,
          unconfirmedSats: unconfirmed, totalSats: total, provider: config.api };
      },
      getRawTransaction: async function (_client, _values, txid) {
        if (!/^[0-9a-f]{64}$/i.test(txid)) throw new Error("Expected a transaction ID.");
        const url = config.api + "/tx/" + txid.toLowerCase() + "/hex";
        const hex = String(await read(url, true)).trim();
        if (await C.transactionId(hex) !== txid.toLowerCase()) throw new Error("Provider returned a different transaction.");
        return hex;
      }
    };
    function unavailable() { throw new Error("This network currently supports receiving and balance checks. Sending is a later phase."); }
    coin.createRawTransaction = unavailable;
    coin.signRawTransaction = unavailable;
    coin.sendRawTransaction = unavailable;
    C.installCoin(coin.NAME, Object.freeze(coin));
    return coin;
  }

  accountCoin({ name: "bitcoin", label: "Bitcoin", ticker: "BTC", order: 40,
    chain: "bitcoin", network: "mainnet", api: "https://mempool.space/api", explorer: "https://mempool.space" });
  accountCoin({ name: "bitcoinTestnet4", label: "Bitcoin Testnet4", ticker: "tBTC4", order: 41,
    chain: "bitcoin", network: "testnet4", testnet: true,
    api: "https://mempool.space/testnet4/api", explorer: "https://mempool.space/testnet4",
    faucets: [{ label: "Mempool Testnet4 faucet", url: "https://mempool.space/testnet4/faucet" },
      { label: "Coinfaucet Testnet4", url: "https://coinfaucet.eu/en/btc-testnet4/" }] });
  accountCoin({ name: "bsv", label: "Bitcoin SV", ticker: "BSV", order: 42,
    chain: "bsv", network: "mainnet", api: "https://api.whatsonchain.com/v1/bsv/main", explorer: "https://whatsonchain.com" });
  accountCoin({ name: "bsvTestnet", label: "Bitcoin SV Testnet", ticker: "tBSV", order: 43,
    chain: "bsv", network: "testnet", testnet: true,
    api: "https://api.whatsonchain.com/v1/bsv/test", explorer: "https://test.whatsonchain.com",
    faucets: [{ label: "BSV testnet faucet", url: "https://bsvfaucet.com" },
      { label: "BSV testnet funding guide", url: "https://hub.bsvblockchain.org/bsv-code-academy/beginner-path/beginner/development-environment" }] });
})(typeof window !== "undefined" ? window : globalThis);
