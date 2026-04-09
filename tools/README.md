```md
# Satellites

The `satellites` folder is for code that uses Chisel from outside the core project.

A satellite is not part of Chisel itself. It is a separate page, service, tool, or runtime that sits somewhere else and calls into Chisel when it needs to construct, sign, serialize, decode, or broadcast a transaction.

Examples include:

- a page that prints random labels
- a QR scanner that reads WIF data and populates a form
- a server proxy
- a browser utility for building transactions
- an IPFS helper page or service
- a Ravencoin-specific tool that does things Chisel should not assume for all UTXO currencies

The reason this folder exists is to protect the boundary around Chisel.

Chisel should stay small. Its job is to facilitate meaningful crypto data transactions for various UTXO currencies through a minimal client/proxy model. The point is not to absorb every interface, integration, chain rule, or experiment. The point is to keep the core focused on generic transaction work.

So the satellites folder is where context-specific code goes.

## What belongs in Chisel

Chisel should contain the reusable transaction logic that can apply across UTXO systems, or at least the parts that are central to the project’s purpose.

That includes things like:

- transaction construction
- transaction serialization
- signing flows
- generic helper logic around UTXO handling
- proxy interaction
- broadly reusable data-transaction primitives

If a feature is central to creating or transmitting a meaningful UTXO transaction, and it is not tightly coupled to one UI, one deployment, or one chain, it probably belongs in Chisel.

## What belongs in Satellites

A feature belongs in `satellites` when it depends on a particular environment, workflow, chain, or experiment.

That includes things like:

- browser pages
- forms
- QR camera flows
- print layouts
- IPFS upload helpers
- chain-specific special cases
- one-off operational tools
- admin or testing interfaces
- code that is useful, but not general enough to define the core

A satellite can be polished and important without belonging in Chisel.

The question is not whether it is valuable. The question is whether it is core.

## The boundary

A simple rule:

If something can be removed without changing what Chisel fundamentally is, it probably belongs in `satellites`.

Another way to say it:

Chisel is the engine.
Satellites are the places where that engine gets used.

## Examples

### Random label printer

A page that generates and prints random labels is a satellite.

Why:
- it is a specific UI
- it is tied to printing
- it may generate or display keys in a workflow that is operational, not core
- Chisel does not need to know anything about printers, page layout, or label sheets

That page can import Chisel, ask it for transaction-related functionality, and remain completely separate.

### QR scanner that populates WIF data

This should usually be a satellite.

Why:
- camera access is environment-specific
- QR decoding is UI/input plumbing
- populating a WIF field is a workflow concern
- Chisel should not need to know how secrets entered the system

Chisel can accept WIF or key material once provided, but the scanning experience itself belongs outside the core.

### Server proxy

A proxy can be a satellite if it is deployment-specific or tailored to one environment.

If it is the standard minimal proxy that defines the project’s basic architecture, it may belong alongside the core project. But specialized proxies, wrappers, queue layers, auth layers, or chain-tuned versions belong in `satellites`.

A good rule is:

- the canonical minimal proxy is core-adjacent
- custom proxies are satellites

### IPFS tooling

IPFS tooling should generally be a satellite.

Why:
- IPFS is an external integration
- upload/retrieval workflows are not part of generic UTXO transaction logic
- different projects may choose different storage layers
- some chains or use cases will not need IPFS at all

A satellite can upload content to IPFS, receive a hash or CID, and then hand that value to Chisel for transaction encoding or broadcast.

That keeps the integration available without making it mandatory.

### Ravencoin-specific logic

Ravencoin-specific code that cannot be generalized to all UTXO currencies should live in `satellites`.

Why:
- chain-specific rules should not distort the core API
- asset behavior, metadata conventions, and address/index assumptions are not universal
- Chisel should not become “Ravencoin plus some other chains later”

This is especially important because Ravencoin includes conveniences and structures that other UTXO systems may not. If a piece of logic assumes those features, it should live outside the core unless it can be cleanly isolated behind a general interface.

Ravencoin can still be a first-class use case without becoming the definition of the whole project.

## Where easyBase-type pieces go

If “easyBase” refers to a layer of practical tools and UX helpers around Chisel, most of those pieces probably belong in `satellites`.

For example:

- QR scanner that populates WIF data: satellite
- IPFS upload/retrieval tooling: satellite
- Ravencoin-specific asset helpers: satellite
- browser transaction builder pages: satellite
- printing or labeling tools: satellite
- workflow dashboards: satellite

These are all useful, but they are use-site code, not protocol core.

The only parts that should move inward are the pieces that prove themselves to be:

- generic
- reusable
- non-UI
- non-chain-specific
- central to meaningful UTXO data transactions

If an easyBase feature is really a broadly reusable transaction primitive, it can graduate into Chisel later. Until then, `satellites` is the right place for it.

## Why this separation matters

Without this separation, Chisel will slowly turn into a grab bag of unrelated concerns:

- camera handling
- print workflows
- storage integrations
- chain quirks
- application UI
- deployment glue

That makes the core harder to reason about and harder to port across UTXO environments.

With this separation, Chisel stays small and clear:

- Chisel does the transaction work
- satellites provide the context

This also makes experimentation easier. A satellite can be ugly, temporary, chain-specific, or highly opinionated without forcing those decisions into the core project.

## Mental model

Use this test.

Ask:

“Does this help define Chisel, or does it simply use Chisel?”

If it uses Chisel, it belongs in `satellites`.

If Chisel would feel incomplete or broken without it, it may belong in the core.

## In practice

A common flow looks like this:

1. A satellite collects or derives data
2. The satellite formats that data for a particular workflow
3. The satellite calls Chisel
4. Chisel constructs, signs, serializes, decodes, or prepares the transaction
5. A proxy or broadcast layer hands the result to the network

This keeps the system modular.

The satellite owns the workflow.
Chisel owns the transaction logic.

## Summary

The `satellites` folder is for independent tools, pages, services, and integrations that sit outside the core project and use Chisel in their own environment.

It is the right place for:

- random label printing pages
- QR-to-WIF tools
- IPFS helpers
- Ravencoin-specific code that does not generalize
- custom proxies
- experiments
- operational utilities

Chisel should remain focused on generic, reusable UTXO transaction capabilities.

Everything else can orbit it.
```

