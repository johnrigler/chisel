# Twetch as an application graph in Chisel

Chisel is a general-purpose ledger instrument, not a membership authority. Twetch membership and application visibility are separate from ledger inclusion and signature authenticity.

## First increment (2.9.8)
- Open a BSV record and use Explore BSV / Address rabbit trails. The local catalog facet matches exact, case-sensitive addresses reported in transaction inputs/prevouts, outputs and AIP metadata. Missing raw records or unresolved prevouts limit coverage.
- BSV records link to BananaBlocks. Mainnet legacy address candidates link to WhatsOnChain, mempool.space (BTC) and Blockchair (BCH); these are independent histories, not merged balances.
- Addresses beginning with 1Ax through 1Ex are labeled Thunderword-pattern candidates, not proven burns; AIP signers are not verified by this view. No heuristic labels a change, service or owner definitively.
- No new network dependency on startup, no signing, no broadcast.

## Next steps
Separate Python indexer and rebuildable twetch.sqlite3 on rigler.org; preserve raw transactions, block/chain provenance, MAP action and references, AIP evidence, and address edges with outpoints. Export an ordinary static catalog for the IPFS/browser reader. Use BananaBlocks protocol discovery for incremental coverage, independent raw retrieval and eventually verified inclusion proofs. Do not equate indexer recognition with Twetch account registration or authorization. Investigate additional outputs in valid Twetch transactions and keep a separate signed reference transaction as a fallback. Cross-ledger associations must retain chain identifiers and must not imply ownership from address text alone.
