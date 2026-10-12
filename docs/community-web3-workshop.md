# Community ownership workshop: wallets, records, and DeFi

Status: proposed concept (2026-10-11). No contracts or tokens deployed.

## Principle
Start with useful collaboration among people in Grants/Milan, NM: everyone can create and verify records with their own wallet. A practical session should not require believing in Web3 first.

## Suggested 90-minute workshop
- 0–15 min: wallets, public keys, irreversible transactions and safety; no participant shares a seed phrase.
- 15–30 min: QR stickers and a locally generated identity artifact. Demonstrate public verification.
- 30–50 min: use Chisel to create/read a small human-readable inscription, comparing chain fees and permanence.
- 50–70 min: optional Base DeFi demonstration with a $100 *hypothetical* wallet, USDC lending vs ETH/USDC LP vs token research. Explain variable yield, risk and gas. Do not mix up UTXO Chisel transactions with EVM token calls.
- 70–90 min: collaborative local archive, Q&A, and a link to verify the group's published record.

## Tokens
Potential ERC-20 demonstration on Base using OpenZeppelin, with explicit documentation of contract owner permissions, mintability, transfer constraints, and any liquidity pool. Treat it as a separate opt-in experiment, not as an investment promise or necessary condition for the workshop. Never assume a pool or a market exists merely because a token was deployed.

## Integration boundary
Chisel remains a browser-first/IPFS-first system for self-sovereign identities and human-readable ledger records. Separate modules or links should handle EVM token/LP interactions; don't silently expand transaction-signing scope to Base.

## Next actions
- [ ] Validate library/college meeting-room requirements and fees, and check whether periodic workshops are permitted.
- [ ] Make a safe sticker/ledger demo using only test funds.
- [ ] Define optional public, opt-in attestations for workshop-created artifacts.
- [ ] Link to read-only sbstats DeFi dashboard when it is ready.
- [ ] Consider an ETHDenver version with the token-and-liquidity demo as a second station.
- [ ] Keep Zork/Lantern as optional advanced demos rather than workshop entry points.

Success: attendees leave able to verify an artifact, understand wallet custody and transaction costs, and explain the difference between protocol collaboration and price speculation.
