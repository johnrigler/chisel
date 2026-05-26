Chisel 2.4.2d patch
=====================

Purpose
-------
2.4.2d keeps Litecoin console-first and adds conservative OP_RETURN support to the local Litecoin P2PKH self-send builder.

Files
-----
- chisel.js
- chisel.sign.js
- README_PATCH.txt

Apply
-----
unzip chisel-2.4.2d-opreturn-console-patch.zip
cp chisel-2.4.2d-opreturn-console-patch/chisel.js .
cp chisel-2.4.2d-opreturn-console-patch/chisel.sign.js .

Then bump cache strings in index.html, for example:

<script src="chisel.js?2.4.2d"></script>
<script src="chisel.sign.js?2.4.2d"></script>

Console smoke test
------------------
CHISEL.about()
CHISEL.buildOpReturnScript("68656c6c6f")
CHISEL.readOpReturnPushHex(CHISEL.buildOpReturnScript("68656c6c6f"))

Build a Litecoin mainnet self-send with OP_RETURN ASCII
-------------------------------------------------------
const plan = await CHISEL.litecoin.makeOpReturnSelfSend(LTC_WIF, {
  network: "mainnet",
  feeSats: 10000,
  opReturnAscii: "hello chisel"
});

plan;

Verify before broadcast
-----------------------
const check = await CHISEL.litecoin.verifySelfSendPlan(plan);
check;

Broadcast only after inspection
-------------------------------
await CHISEL.litecoin.broadcastPlan(plan, {
  confirmBroadcast: true,
  network: "mainnet",
  providers: ["litecoinspace", "blockcypherLitecoin"]
});

Notes
-----
- Legacy P2PKH only.
- OP_RETURN output is zero-value.
- OP_RETURN payloads over 80 bytes create a warning.
- broadcastPlan refuses plans with warnings unless allowWarnings: true is passed.
- No SegWit, P2SH, PSBT, dynamic fee estimation, or UI integration yet.
