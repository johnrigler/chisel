# Gomez / Jethro: optional Graph-backed incremental transaction retrieval

**Status:** design and experiment notes, not implemented. Captured from the October 11–12, 2026 discussion. This proposal does not replace Chisel's existing blockchain providers or reinterpret the ledger as an off-chain database.

## Problem observed in Gomez

Today Gomez uses address-history queries against a Polygon contract address. Repeated calls may return old transactions along with new ones. Gomez/Chisel must vary query parameters, paginate, track transaction hashes already processed, and avoid duplicate interpretation. This is especially awkward with an ever-growing record history.

A Chisel-style record is deliberately discoverable from its **on-chain destination contract address and transaction structure**. The address is the protocol's index key; transaction calldata carries records; the browser interprets them. The service returning address history is an infrastructure index, not the authority defining the application-level meaning.

## Proposed architecture

```text
Polygon ledger: Jethro / Gomez address + immutable transaction history
          |
          | transaction indexing
          v
The Graph subgraph, Substreams-based pipeline, or comparable query service
          |
          | incremental query (cursor, block/tx ordering)
          v
Chisel / Gomez provider adapter
          |
          | fetch raw input, validate, decode M64, dedupe
          v
Existing Chisel interpreter, viewer and ledger record model
```

**Polygon remains the source of truth.** The Graph could maintain a derived index for convenient and efficient **new-record** retrieval; Chisel remains responsible for deterministic interpretation and independent verification. Keep existing explorer/RPC retrieval as a fallback and validation route.

## Important technical constraint

A conventional event-handler subgraph is **not** a drop-in replacement for PolygonScan's arbitrary-address transaction-history API. If Gomez/Jethro's inscriptions are arbitrary transaction inputs and the contract emits no matching events, a subgraph that watches events alone will miss those records. Contract call handlers have network/provider tracing limitations. For existing historical arbitrary input, investigate a Substreams transaction-filtering pipeline or a separate address-history indexer that ingests complete transactions and materializes a queryable dataset. A Substreams stream by itself is not a hosted historical GraphQL address-query endpoint.

For **future** instances, an explicit `RecordPublished(bytes32 id, bytes32 digest, ...)` event and versioned publication function could simplify conventional subgraph indexing, but introduces execution/event gas and must not invalidate older calldata-only records. Preserve plain-calldata publishing as an option.

## Multiple Jethro instances

Jethro can be a **protocol shared by many contract deployments**, not one address. Identical Solidity or a compatible interface does not make instances automatically discoverable. Candidates include:
- An event-emitting factory that records each new instance.
- A registry contract storing instance addresses and protocol versions.
- On-ledger instance links, beginning from a known root and traversed by Chisel.
- Explicit user-configured root/seed addresses.

A Graph pipeline could index a discovered set of instances, allowing filtered retrieval per address, owner, protocol version, or shared schema. No extra registry contract is *intrinsically required* if published links and known seed addresses already meet discovery needs. Open/public writes versus owner-authorized publication are independent policy choices per instance.

## Cursor, consistency, and verification

Proposed record identifier: `(chainId, txHash, recordOrdinal)`; preserve provenance including contract address, block number, block hash, transaction index, and publication payload. Transaction hash is a natural deduplication key for one-record-per-tx deployments; record ordinal is needed if a transaction can contain multiple records.

- Track the last fully indexed **stable block** and transaction position, rather than solely a timestamp or local count.
- Page deterministically (e.g. block number + transaction index + record ordinal), including a tie-breaker; do not rely solely on `skip` pagination at scale.
- Account for indexing lag, missing ranges, transaction reversions, network/provider errors, and chain reorganizations; rescan a small overlap and deduplicate records. A reorg can move/remove records, so preserve block hash and reconcile.
- Distinguish `tx.to == instanceAddress` from calls routed via proxies, internal calls, events, or transactions merely *mentioning* an address.
- Fetch and verify source transactions/receipts through an independent RPC when needed; treat indexed responses as claims about on-chain data, not an authority in themselves.
- Do not assume The Graph indexes full calldata for every Polygon transaction or that it can reconstruct all past arbitrary recipient transactions automatically.
- Preserve canonical M64 version/dictionary identifiers and never execute arbitrary untrusted payloads automatically.

## Minimal comparison experiment

1. Document deployed Gomez and Jethro Polygon addresses, actual write patterns, chain/network, expected payloads, and an independently checked sample set of transactions.
2. Run the existing address-history retrieval path and capture number of requests, bytes transferred, time to first new record, records found, duplicates, and provider rate limits.
3. Prototype an indexer that **actually captures the same raw calldata records** (Graph if feasible; otherwise first validate with a transaction-filtering stream). Compare completeness against the known Polygon history before adding a UI adapter.
4. Add optional `graph` provider to Chisel's existing provider boundary without coupling decoding/hydration logic to GraphQL. Prefer a provider-neutral output shape.
5. Test incremental query, fresh writes, pagination, gap recovery, chain reorgs, multiple deployed Jethro addresses, explorer/RPC fallback, and deterministic M64 interpretation.
6. Compare indexing/hosting fees, latency, operational burden, and recovery if the Graph index is lost. Report findings, including cases where a conventional RPC/address service wins.

## ETHDenver angle

Demonstrate **one authoritative ledger and two independent retrieval routes**: current Polygon address history and a Graph-backed incremental index, both yielding identical Chisel records. This is a concrete interoperability and indexing benchmark for conversations with Graph ecosystem engineers or other funded data infrastructure teams, not a claim that this integration already exists or that it solves The Graph's network incentive/decentralization challenges.
