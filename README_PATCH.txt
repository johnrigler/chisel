Chisel 2.4.2b provider/factory patch
=====================================

Purpose
-------
This patch assumes 2.4.2a already works from the console. It keeps Litecoin
console-first, but moves the Litecoin resource onto reusable rails:

- CHISEL.providers registry
- CHISEL.installProvider(name, provider)
- CHISEL.getProvider(name)
- CHISEL.getProviders()
- CHISEL.createBitcoinLikeCoin(config)
- CHISEL.about()
- provider attempt reports for redundant third-party calls
- Litecoin rebuilt as a generic bitcoinlike-p2pkh resource

Files
-----
- chisel.js
- chisel.sign.js

chisel.sign.js is included because WIF decoding must allow non-Bitcoin WIF
prefixes. Coin/resource code validates the prefix after decoding.

Apply
-----
Copy these files over the project root:

  cp chisel.js /path/to/chisel/chisel.js
  cp chisel.sign.js /path/to/chisel/chisel.sign.js

Then bump the cache string in index.html, for example:

  <script src="chisel.js?2.4.2b"></script>
  <script src="chisel.sign.js?2.4.2b"></script>

Console checks
--------------

  CHISEL.about()
  CHISEL.getProviders().map(p => p.NAME)
  CHISEL.litecoin.healthCheck({ network: "mainnet" })
  CHISEL.litecoin.healthCheck({ network: "testnet" })

Backward-compatible 2.4.2a calls should still work:

  await CHISEL.litecoin.wifToAccount(WIF, { network: "mainnet" })
  await CHISEL.litecoin.getAddressUtxos(address, { network: "mainnet", provider: "litecoinspace" })
  await CHISEL.litecoin.getAddressUtxos(address, { network: "mainnet", provider: "blockcypher" })

New provider-report calls:

  await CHISEL.litecoin.getAddressUtxosWithReport(address, { network: "mainnet" })
  await CHISEL.litecoin.getTransactionWithReport(txid, { network: "mainnet" })
  await CHISEL.litecoin.broadcastRawTransactionWithReport(rawHex, { network: "mainnet" })

Simple self-send builder:

  const tx = await CHISEL.litecoin.makeSelfSend(WIF, {
    network: "mainnet",
    feeSats: 10000
  });

  tx

Broadcast only after inspecting tx.signedHex and tx.sendBackCoin:

  await CHISEL.litecoin.broadcastRawTransactionWithReport(tx.signedHex, {
    network: "mainnet",
    providers: ["litecoinspace", "blockcypherLitecoin"]
  });

Notes
-----
This is still P2PKH-only. It does not claim SegWit, P2SH, PSBT, coin selection,
change address selection, or fee estimation. That is deliberate.
