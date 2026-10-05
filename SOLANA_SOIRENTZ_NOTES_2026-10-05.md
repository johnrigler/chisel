# Solana and Soirentz Integration Notes
Date: 2026-10-05

## Public Chisel scope

Public Chisel should eventually support Solana in vanilla JavaScript.

The goal is a generic Solana adapter, not a React application and not a Zorkmid-specific implementation.

Expected public capabilities:

- connect common Solana wallets such as Phantom and Backpack;
- read SOL balances;
- read SPL and Token-2022 balances;
- inspect transactions;
- sign messages;
- construct and submit transactions;
- read and write Chisel-style records;
- display organization and identity attestations.

The runtime should remain compatible with static hosting, GitHub Pages, and IPFS.

## Soirentz relationship

Soirentz is the CertLedger of religion.

Soirentz defines the institutional semantics:

- organization identity;
- denomination / tradition claims;
- ministers, officers, stewards, and participants;
- credentials;
- attestations;
- doctrine and bylaw versions;
- governance actions;
- succession;
- work;
- compensation;
- donation addresses;
- public records.

Chisel is the technical lens that reads and writes those objects across supported chains.

## Institutional identities

A real-world organization can publish a durable ledger identity:

    organization identity
        -> legal name / EIN / public records
        -> governing documents
        -> denomination / tradition
        -> wallet addresses
        -> signed attestations
        -> governance history
        -> donation transaction references
        -> succession records

This does not create legal or tax status. It creates a verifiable correspondence between an on-chain identity and an off-chain institution.

## Charitable and religious organizations

A church or other qualified organization could publish signed wallet attestations so a donor can verify that a given address belongs to that organization.

Chisel can then assemble an evidentiary packet around a contribution:

- recipient identity;
- transaction signature;
- timestamp;
- amount / asset;
- organizational references;
- signed acknowledgment if supplied by the organization;
- user-provided basis or valuation metadata.

Chisel should not claim that a transfer is deductible merely because the recipient appears in Chisel.

## Chain independence

Solana is useful as a solar-side transport because of its wallet ecosystem and token tooling.

Institutional continuity should not depend on Solana remaining available forever.

The public protocol should preserve enough information to migrate or re-attest an identity on another chain.
