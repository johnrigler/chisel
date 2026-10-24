# CertLedger hash handoff

Open `index.html#sha256=<64-lowercase-hex>`, paste a digest, or choose the
hash-only `chisel-certledger-anchor-v1` JSON exported by Commons.
The page reviews the digest and tag amount before an explicit **Load into Send**.
It writes a whitelisted artifact payload to `sessionStorage` under the existing
`chisel.pendingPayloadAnalyzer.v1` key, then opens `../../index.html?mode=send`.
The existing loader consumes and removes that pending payload. It does not sign
or broadcast merely by loading it.

The OP_RETURN text is `sha256:` plus 64 lowercase hex digits (71 ASCII bytes).
The namespace is the explicit Litecoin transport profile **LMx / CertLedger**:
`LMxCERTLEDGERzzzzzzzzzzzzzzzWTMCKs`. This is the new hash-intake convention;
older CertLedger design notes left the address unspecified. The general index
is `LLLLLLLLLLLLLLLLLLLLLLLLLLLLXgkk2V`.

Only the digest is accepted from a URL fragment. Imported drafts must agree on
coin, network, namespace, digest and ASCII text. Recipient addresses, amounts,
scripts, key fields and extra metadata from imported JSON are ignored.
Recipients are rebuilt locally from the fixed indices and the reviewed amount.
The tag amount defaults to 0.00001000 LTC per output and can be reviewed within
the local intake bounds; network fees are separately reviewed in Send.

This is a preparation UI, not a receipt viewer, signature validator or live
CertLedger feed. PDF bytes, filenames, email addresses and inspection metadata
are not required here. A static copy works on GitHub Pages, an IPFS directory
or another Chisel mirror with the existing Send files available.
