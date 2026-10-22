# BSV support direction

Recorded October 21, 2026. John Rigler's Chisel direction.
Status: proposed extension; no BSV implementation or live compatibility test is
claimed by this note.

## Placement

The idea of supporting **Bitcoin SV (BSV)** belongs in Chisel's tooling work.
This is recorded in the existing Chisel repository. No new repository or fork
name has been selected. Mogwai can consume the resulting tools or records as
needed; it does not become the owner of the chain adapter. The BSV-specific research thread remains separate from the current Commons
narrative.

## Purpose

Explore BSV as another ledger on which someone can read, publish and recover
Chisel-style artifacts. A person already using that chain could potentially
use the same general approach there. This does not require other participants
or chains to adopt its naming system.

The associated naming question is whether a BSV-based name or address-index
mechanism could be used as one optional approach to discovery. Rigler recalls
advocacy of BSV as a new DNS-like system. The speaker, project, date and source
have not yet been identified; this is a research lead, not a verified account
of a particular protocol.

## Inspected baseline

The baseline inspected is
[Chisel main at c660d4e](https://github.com/johnrigler/chisel/tree/c660d4eda321816a28de0a80602cd40ac4d615e9).

- The inspected tree did not expose a dedicated BSV-named adapter.
- No BSV or WhatsOnChain match was found in the fetched `chisel.js` or
  `chisel.portal.config.json`.
- The BSV match in `chisel.portal.js` was a category-input placeholder
  (“dogecoin, bsv, old tool, needs repair”), not a provider implementation.
- The inspected README and active development direction do not establish
  working BSV support.

This is a bounded source inspection, not a claim that no historical branch,
other project or external tool has ever supported BSV.

## Next work when the extension is taken up

1. Establish a small set of public BSV transaction fixtures and identify the
   actual node or service interfaces used to obtain their raw bytes.
2. Implement and verify reading: explicit chain identity, transaction/output
   parsing, readable labels, payloads and content references. Preserve unfamiliar
   data for inspection.
3. Test discovery from an address or other selected index convention. Identify
   the remembered DNS-related project before claiming compatibility with it.
4. Establish transaction-building and publishing support using chain-specific
   serialization, signing, fee and service fixtures. Existing support for other
   chains is not proof of compatibility.
5. Keep the browser runtime vanilla JavaScript and suitable for static hosting,
   including IPFS. Optional development tooling can prepare fixtures.

The first concrete task is a read-path feasibility check with known raw
transactions. Signing and broadcasting are later capabilities to establish.
This note adds no wallet or broadcast behavior and does not reorder the
existing M64 development sequence.
