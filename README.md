# Chisel

Chisel is a lightweight system for constructing and transmitting **data-rich UTXO transactions**.

It shifts responsibility away from full nodes and external indexers, enabling clients to:
- construct meaningful transactions locally
- sign them independently
- push them to the network via a minimal proxy

---

## Overview

Chisel consists of two components:

### 1. Proxy (Python)

A thin server that exposes a constrained subset of blockchain RPC functionality.

- Acts as a relay between client and node
- Broadcasts transactions to the mempool
- Avoids exposing full node surface area


---

### 2. Client (Vanilla JavaScript)

A zero-dependency (runtime) browser-side library that:

- Builds UTXO transactions
- Signs payloads locally (via elliptic)
- Interacts with the proxy
- Encodes arbitrary data into transactions

This repositions the client as the primary execution environment.

---

## Design Intent

Traditional architecture:


The full node becomes a **transport layer**, not a computation layer.

---

## Blockchain Support

Originally tested with:
- Digibyte (limited by external indexing dependencies)

Primarily designed for:
- Ravencoin (native address indexing + asset support)

---

## Data Encoding

Chisel is designed for **data-first transactions**, not just value transfer.

Use cases include:
- asset metadata
- lightweight protocols
- embedded instructions

---

## `un` — Unspendable Address Utilities

Chisel includes a JavaScript implementation of:

https://github.io/johnrigler/unspendable

Capabilities:
- Derive deterministic unspendable addresses
- Attach required checksum suffixes (e.g. last 6 digits)
- Encode semantic meaning into provably unspendable outputs

This enables a form of **ad hoc symbolic language** embedded in transactions. The version of this which exists on the ledger is called MacDougall and follows a set of 
rules which fit into the constraints of this language "hack".

Influences:
- BSV script/data patterns
- OP_RETURN-style encoding (without strict reliance)

---

## Philosophy

- Minimize trust surface
- Eliminate dependency on third-party indexers
- Keep signing client-side
- Treat the blockchain as a **data transport layer**, not just a ledger

---

## Security Model

- Private keys never leave the client
- Proxy does not sign or mutate transactions
- All critical operations occur locally before broadcast

---

## Third-Party Libraries

- elliptic (MIT)
- crypto-js (MIT)

---

## Notes

Chisel assumes:
- familiarity with UTXO models
- understanding of raw transaction construction
- comfort with client-side cryptography

It is not a beginner abstraction layer.

---
