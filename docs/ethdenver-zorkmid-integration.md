# ETHDenver / Zorkmid integration plan

Planning as of 2026-10-11. [Conference system plan](https://github.com/johnrigler/EthDenver/blob/main/docs/ethdenver-2027-showcase.md).

Chisel remains chain-agnostic in principle and keeps its existing UTXO reading, signing, OP_RETURN, readable-address, ASC and M64 capabilities intact. Do **not** migrate existing ledger artifacts merely to support a new conference token.

Candidate Base / EVM module:
- Read chain ID, contract metadata, token balances and standard ERC-20 Transfer logs with vanilla browser JS; wallets provide signatures, not the web page.
- Allow optional Base Sepolia etch and artifact events through separate minimal contracts; decode alongside existing Chisel records with explicit chain and contract identifiers.
- Preserve Gomez/Jethro/M64 semantics where supported; port encodings only after reviewing actual source and proving round-trip test vectors. Encoding is not executable authorization.
- Verify tx receipts, confirmations, event topics, contract addresses, signature and sender context; distinguish emitted logs from stored state, and payload bytes from human-readable representation.
- Optional wallet connect must not gate public read-only viewing or expose WIF/seed/private keys.
- Prototype `etch(bytes)`, `etchAndSend(recipient,amount,bytes)` only with permission and bounds checks; a separate relayer needs limits, nonces and replay protections.
- Base vs Polygon benchmarking: identical calldata, ERC-20 transfers, event payloads, and artifact hash / CID registration on testnets. Measure total paid transaction fees and indexed-read reliability, not chain-wide average fee slogans.

Do not ship token deployment, mint authority, liquidity pools, arbitrary external execution, or sponsored gas without separately reviewed engineering and explicit authorization.

Demo acceptance: a stranger follows a stable QR to a public game record, verifies it against signed source, opens the associated ledger record in Chisel, and sees chain/source/confirmation status without possessing crypto.
