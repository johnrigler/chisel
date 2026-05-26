Chisel 2.4.2c safety-console patch
===================================

Base: 2.4.2b provider/factory patch.

Files:
- chisel.js
- chisel.sign.js

Purpose
-------
2.4.2c keeps Litecoin console-first, but makes the self-send path safer and more inspectable before broadcast.

Changes
-------

1. CHISEL.about() now reports core: "2.4.2c".

2. Added local raw transaction inspection helpers:

   CHISEL.readVarInt(hex, cursor)
   CHISEL.readUInt32LE(hex, cursor)
   CHISEL.readUInt64LE(hex, cursor)
   CHISEL.parseRawTransactionDetailed(rawTxHex)

   This parser is intentionally conservative. It handles legacy non-SegWit transactions only.
   That matches the current P2PKH-only Litecoin path.

3. Litecoin makeSelfSend() now returns a plan object instead of a loose tx object:

   const plan = await CHISEL.litecoin.makeSelfSend(WIF, {
     network: "mainnet",
     feeSats: 10000
   });

   New fields include:

   type: "p2pkh-self-send-plan"
   status: "built-not-broadcast"
   broadcasted: false
   localUnsignedDecode
   localSignedDecode
   warnings
   nextStep

4. Added explicit verification:

   const check = await CHISEL.litecoin.verifySelfSendPlan(plan);
   check;

   It checks:
   - exactly one input
   - exactly one output
   - output script matches the derived self-send address
   - output total equals sendBackUnits
   - input - output equals feeUnits

5. Added guarded broadcast:

   await CHISEL.litecoin.broadcastPlan(plan, {
     confirmBroadcast: true,
     network: "mainnet",
     providers: ["litecoinspace", "blockcypherLitecoin"]
   });

   If confirmBroadcast is omitted, it refuses to broadcast.
   If verification warnings exist, it refuses unless allowWarnings: true is passed.

Apply
-----

unzip chisel-2.4.2c-safety-console-patch.zip
cp chisel-2.4.2c-safety-console-patch/chisel.js .
cp chisel-2.4.2c-safety-console-patch/chisel.sign.js .

Then bump cache strings in index.html:

<script src="chisel.js?2.4.2c"></script>
<script src="chisel.sign.js?2.4.2c"></script>

Console smoke test
------------------

CHISEL.about()
CHISEL.litecoin
CHISEL.parseRawTransactionDetailed

Build, verify, then broadcast:

const plan = await CHISEL.litecoin.makeSelfSend(LTC_WIF, {
  network: "mainnet",
  feeSats: 10000
});

plan;

const check = await CHISEL.litecoin.verifySelfSendPlan(plan);
check;

await CHISEL.litecoin.broadcastPlan(plan, {
  confirmBroadcast: true,
  network: "mainnet",
  providers: ["litecoinspace", "blockcypherLitecoin"]
});

Notes
-----
This is still legacy P2PKH only. It does not support SegWit/P2SH/PSBT yet.
