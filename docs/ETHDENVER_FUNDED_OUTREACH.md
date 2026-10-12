# ETHDenver: funded collaboration and engineering outreach

Status: planning notes, 2026-10-12. This document records positioning and next steps; it is not an application or a claim that a meeting is scheduled.

## Objective

Use ETHDenver to meet people at **funded engineering teams** who might hire John for remote engineering work, contract research, or a clearly scoped funded milestone. Attendance is primarily for prearranged conversations rather than participating in the hackathon, occupying MakerSpace, or launching an unfunded token.

The ask: **"Let's meet in Denver."** Make contact before the event and arrange meetings with technical leads, founders, maintainers, and engineering hiring managers.

## Positioning

Independent blockchain infrastructure engineer working on on-chain indexing, human-readable ledger records, self-sovereign identity, deterministic content reconstruction, and minimal execution layers. Background also includes extensive enterprise infrastructure engineering.

Short introduction:

> I've been building blockchain indexing and publication systems across UTXO and EVM networks. Chisel uses on-chain transaction/address structures as its index, and I'm exploring how compact M64 artifacts and EVM contracts can bridge durable records to programmable execution. I'm looking for a funded infrastructure team that can use this experience. Will you be at ETHDenver? Let's meet in Denver.

Avoid marketing every repository as a product or describing proposed features as shipped.

## Portfolio: demonstration vs research

- **Chisel:** Transaction/address-based **on-chain** index, self-sovereign keys/identity and human-readable UTXO inscriptions. Demonstrate real transaction lookup and verification, with explorer/RPC acting as transport, not authority.
- **Polygon/EVM experiments (Jethro, Gomez):** Transaction input inscriptions and Solidity mappings/contract interactions. Separate verified examples from ideas about registries or contract graphs.
- **M64:** Existing compression/representation experiments plus proposed ledger hydration, immutable symbol tables, and an optional direct M64 interpreter implemented in vanilla JS and Solidity. Interpreter is *not yet implemented*.
- **Bongo:** Prototype hash-stack commitments and on-chain game coordination. Explicitly disclose unresolved manipulation, withholding, block-ordering, and financial-security issues. Not a ready-money game.
- **Lantern/Zork:** Demonstration of identity and portable frontend/backend boundaries, not necessarily a lead pitch.

Supporting artifacts: short technical portfolio, code/commit links, transaction hashes, one reproducible five-minute demo, and a one-page profile for hiring or contract conversations. A 20-minute talk is a secondary asset, not the primary goal.

## Prospective audiences to research and contact

These are **lead categories**, not verified openings, offers, sponsorships, or confirmed attendance:

- Cross-chain interoperability and infrastructure teams (e.g., ChainSafe)
- Ethereum tooling, wallets, account abstraction, and developer infrastructure teams (e.g., Consensys)
- Protocol data access, archival/indexing, identity, and decentralized publishing teams
- Ethereum Foundation ecosystem funding, for a bounded open-source deliverable if employment/contract work is unavailable
- IPFS tooling/grant organizations, especially for reproducible content hydration

Check current hiring status, actual budgets, remote-work requirements, event attendance, decision-maker names, and submission deadlines **before** making specific claims.

## Outreach workflow

1. Select 10–15 funded teams working on indexing, on-chain data, chain interoperability, programmable wallets, or decentralized storage.
2. Identify a specific engineering challenge each team faces. Reference the exact repo or technical artifact that demonstrates a relevant capability.
3. Send a concise personalized note requesting a 20–30 minute meeting at ETHDenver; include a portfolio link and an explicit hire/contract/research-milestone ask.
4. Keep a lightweight tracking file with contact, organization, technical fit, request date, reply, proposed meeting, next action. Avoid publishing private contact details to a public repo.
5. Arrange a small number of substantive conversations in advance rather than depending on walk-up networking.
6. Follow up with a scoped proposal: technical problem, deliverable, acceptance test, schedule, and compensation.

Remote engineering from New Mexico is preferred. Denver attendance is a meeting opportunity, not consent to relocate or work unpaid.

## Boundaries and messaging

- On-chain records and on-chain indexing are central to Chisel. Off-chain explorers and RPCs merely retrieve history.
- EVM contracts cannot inspect arbitrary past transaction calldata by hash; any on-chain consumption requires accessible contract state/bytecode or an explicit data/proof delivery design.
- Avoid conflating published notes, implemented features, tested behavior, and deployed financial systems.
- Do not frame the work as a speculative token investment. A token can be a demo component but not the sales proposition.
- The value proposition is **solving funded engineering problems**, not collecting enthusiasm or presenting for free.
