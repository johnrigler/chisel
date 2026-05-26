Chisel 2.4.2e provider cross-check patch

Files:
- chisel.js
- chisel.sign.js

Apply:
  cp chisel-2.4.2e-provider-crosscheck-patch/chisel.js .
  cp chisel-2.4.2e-provider-crosscheck-patch/chisel.sign.js .

Then bump cache strings in index.html:
  chisel.js?2.4.2e
  chisel.sign.js?2.4.2e

New console checks:
  CHISEL.about()
  await CHISEL.litecoin.healthCheck({ network: "mainnet" })

Provider UTXO report, no transaction build:
  const account = await CHISEL.litecoin.wifToAccount(LTC_WIF, { network: "mainnet" });
  const cross = await CHISEL.litecoin.compareAddressUtxos(account.address, {
    network: "mainnet",
    providers: ["litecoinspace", "blockcypherLitecoin"]
  });
  cross;

Build using only commonly reported UTXOs when more than one provider succeeds:
  const plan = await CHISEL.litecoin.makeOpReturnSelfSend(LTC_WIF, {
    network: "mainnet",
    feeSats: 10000,
    opReturnAscii: "hello chisel",
    providers: ["litecoinspace", "blockcypherLitecoin"],
    crossCheckProviders: true
  });

Require clean provider agreement:
  const plan = await CHISEL.litecoin.makeSelfSend(LTC_WIF, {
    network: "mainnet",
    feeSats: 10000,
    providers: ["litecoinspace", "blockcypherLitecoin"],
    requireProviderAgreement: true
  });

Plan summary, no raw hex wall:
  CHISEL.litecoin.summarizePlan(plan)

Broadcast remains guarded:
  await CHISEL.litecoin.broadcastPlan(plan, {
    network: "mainnet",
    confirmBroadcast: true,
    providers: ["litecoinspace", "blockcypherLitecoin"]
  });

Notes:
- Still legacy P2PKH only.
- Still console-first.
- Cross-check only compares UTXO outpoints and amounts after provider normalization.
- If only one provider works, the comparison returns a warning instead of pretending redundancy exists.
