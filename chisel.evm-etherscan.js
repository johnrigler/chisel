(function (root) {
  "use strict";

  // Ethereum mainnet address-index convention. This is a recipient address,
  // not a claim of ownership or a deployed smart contract.
  const ADDRESS = "0x1111111111111111111111111111111111111111";
  const CHAIN_ID = "1";
  const CONTRACT_NAME = "ethereum-main-thunderword";
  const API_ENDPOINT = "https://api.etherscan.io/v2/api";
  const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

  function buildRequestUrl(apiKey, page, offset) {
    const key = String(apiKey || "").trim();
    if (!key) throw new Error("Enter an Etherscan V2 API key to pull Ethereum transactions.");
    const url = new URL(API_ENDPOINT);
    url.search = new URLSearchParams({
      chainid: CHAIN_ID,
      module: "account",
      action: "txlist",
      address: ADDRESS,
      startblock: "0",
      endblock: "99999999",
      page: String(Math.max(1, Math.floor(Number(page) || 1))),
      offset: String(Math.min(100, Math.max(1, Math.floor(Number(offset) || 100)))),
      sort: "desc",
      apikey: key
    }).toString();
    return url;
  }

  function packetForTransaction(tx, fetchedAt) {
    if (!tx || typeof tx !== "object" || !HASH_RE.test(String(tx.hash || ""))) return null;
    // Preserve the explorer's calldata and transaction fields verbatim.
    return {
      txid: tx.hash.slice(2).toLowerCase(),
      hash: tx.hash,
      coin: "evm",
      chainId: CHAIN_ID,
      tx: Object.assign({}, tx),
      contract: {
        name: CONTRACT_NAME,
        address: ADDRESS,
        chainId: CHAIN_ID
      },
      source: {
        provider: "etherscan-v2",
        action: "account/txlist",
        chainId: CHAIN_ID,
        address: ADDRESS,
        fetchedAt: fetchedAt || new Date().toISOString()
      }
    };
  }

  async function fetchPage(apiKey, page, options) {
    const opts = options || {};
    const fetcher = opts.fetcher || root.fetch.bind(root);
    const pageSize = Math.min(100, Math.max(1, Math.floor(Number(opts.pageSize) || 100)));
    const requestUrl = buildRequestUrl(apiKey, page, pageSize);
    // Never include the URL (which contains the key) in diagnostics or errors.
    const response = await fetcher(requestUrl.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error("Etherscan HTTP " + response.status + " while retrieving Ethereum address transactions.");
    const json = await response.json();
    if (!json || !Array.isArray(json.result)) {
      if (json && json.status === "0" && /no transactions found/i.test(String(json.message || "") + " " + String(json.result || ""))) {
        return { packets: [], page: Math.max(1, Math.floor(Number(page) || 1)), pageSize: pageSize, hasMore: false };
      }
      // Etherscan error text is not forwarded, because it may echo credentials.
      throw new Error("Etherscan did not return a transaction array. Check the API key, quota, and chain.");
    }
    if (json.status !== "1") throw new Error("Etherscan rejected the transaction-history request.");
    const seen = new Set();
    const fetchedAt = new Date().toISOString();
    const packets = json.result.map(function (tx) { return packetForTransaction(tx, fetchedAt); })
      .filter(function (packet) {
        if (!packet || seen.has(packet.txid)) return false;
        seen.add(packet.txid);
        return true;
      });
    return {
      packets: packets,
      page: Math.max(1, Math.floor(Number(page) || 1)),
      pageSize: pageSize,
      hasMore: json.result.length === pageSize
    };
  }

  root.CHISEL_EVM_ETHERSCAN = {
    ADDRESS: ADDRESS,
    CHAIN_ID: CHAIN_ID,
    CONTRACT_NAME: CONTRACT_NAME,
    packetForTransaction: packetForTransaction,
    fetchPage: fetchPage
  };
})(window);
